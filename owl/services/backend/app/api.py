"""REST API OWL Core."""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import (APIRouter, Depends, Header, HTTPException, Query, Request,
                     WebSocket, WebSocketDisconnect)
from pydantic import BaseModel, Field

from . import db, demo, pdp, policy, retention, rules, scoring, soc
from . import cef as cef_mod
from . import stix as stix_mod
from .applog import log
from .config import settings
from .models import AccessDecision, Device, RiskAssessment, Sensitivity, Telemetry
from .ws import hub

router = APIRouter()


def _check_token(token: str | None) -> None:
    if token != settings.INGEST_TOKEN:
        log().warning("telemetri ditolak, token penggelaran tidak sah")
        raise HTTPException(status_code=401, detail="token penggelaran tidak sah")


async def require_read(x_owl_api_key: str | None = Header(default=None)) -> None:
    """Autentikasi baca untuk dashboard dan API (NFR 5.1).

    Dibiarkan kosong, API terbuka. Itu HANYA sah untuk purwarupa di jaringan
    terisolasi, dan keadaannya dinyatakan di /health supaya tidak terlewat
    saat penggelaran. Isi OWL_API_KEY sebelum menaruh OWL di jaringan yang
    dipakai bersama.
    """
    if not settings.API_KEY:
        return
    if x_owl_api_key != settings.API_KEY:
        log().warning("akses baca ditolak, kunci API tidak sah")
        raise HTTPException(status_code=401, detail="kunci API tidak sah")


def require_demo() -> None:
    """Endpoint demo hanya ada jika OWL_DEMO menyala."""
    if not settings.DEMO_MODE:
        raise HTTPException(status_code=404, detail="mode demo dimatikan")


async def require_admin(x_owl_admin: str | None = Header(default=None)) -> str:
    """Otorisasi administrasi kebijakan (FR-12 dan NFR 5.1)."""
    if not settings.ADMIN_TOKEN or x_owl_admin != settings.ADMIN_TOKEN:
        log().warning("perubahan kebijakan ditolak, token administrasi tidak sah")
        raise HTTPException(status_code=403, detail="token administrasi tidak sah")
    return "admin"


# ——————————————————————————— dasar ———————————————————————————

@router.get("/health")
async def health():
    return {"service": settings.SERVICE, "version": settings.VERSION,
            "air_gapped": settings.AIR_GAPPED,
            "api_auth": "aktif" if settings.API_KEY else "terbuka",
            "retention_days": settings.RETENTION_DAYS,
            "log_file": settings.LOG_FILE or "(hanya keluaran standar)",
            "enforcement": "rekomendasi"}


@router.get("/api/catalog", dependencies=[Depends(require_read)])
async def catalog():
    c = rules.catalog()
    return {
        "version": c.get("version"),
        "updated": str(c.get("updated", "")),
        "parameters": c.get("parameters", {}),
        "allowlists": c.get("allowlists", {}),
        "rules": c["rules"],
        "weights": policy.weights(),
        "severity": settings.SEVERITY,
        "saturation": settings.CATEGORY_SATURATION,
        "thresholds": policy.thresholds(),
        "enforcement": "rekomendasi",
    }


# ——————————————————————————— perangkat ———————————————————————————

@router.post("/api/devices")
async def enroll(d: Device, request: Request,
                 x_owl_token: str | None = Header(default=None)):
    # Pendaftaran menuntut token penggelaran yang sama dengan telemetri.
    # Tanpa itu siapa pun di jaringan dapat mendaftarkan perangkat karangan,
    # atau menimpa label dan satuan perangkat yang sudah ada.
    try:
        _check_token(x_owl_token)
    except HTTPException:
        await db.save_reject(d.device_id, "pendaftaran ditolak", "token tidak sah",
                             request.client.host if request.client else "")
        raise
    await db.upsert_device(d.model_dump())
    await hub.broadcast("device_enrolled", d.model_dump())
    return {"ok": True, "device_id": d.device_id}


@router.get("/api/devices", dependencies=[Depends(require_read)])
async def devices():
    return await db.list_devices()


@router.get("/api/devices/{device_id}", dependencies=[Depends(require_read)])
async def device_detail(device_id: str):
    d = await db.get_device(device_id)
    if not d:
        raise HTTPException(404, "perangkat tidak terdaftar")
    a = await db.last_assessment(device_id)
    return {"device": d, "assessment": a, "history": await db.history(device_id)}


# ——————————————————————————— telemetri ———————————————————————————

async def _assess(t: Telemetry) -> tuple[RiskAssessment, AccessDecision, dict]:
    dev = await db.get_device(t.device_id)
    if not dev:
        raise HTTPException(404, "perangkat belum terdaftar; daftarkan lebih dahulu")

    prev = await db.last_assessment(t.device_id)
    previous = prev["score"] if prev else None
    last_seen = datetime.fromisoformat(prev["assessed_at"]) if prev else None

    findings = rules.evaluate(t)
    a = scoring.score(t, findings, previous=previous, last_seen=last_seen)
    d = pdp.decide(a, resource="standard")

    await db.save_assessment(json.loads(a.model_dump_json()), json.loads(t.model_dump_json()))
    await db.save_decision(d.model_dump())
    out = await soc.dispatch(a, d, device_label=dev.get("label", ""), unit=dev.get("unit", ""))

    await hub.broadcast("assessment", json.loads(a.model_dump_json()))
    return a, d, out


@router.post("/api/telemetry")
async def telemetry(t: Telemetry, request: Request,
                    x_owl_token: str | None = Header(default=None)):
    ip = request.client.host if request.client else ""
    try:
        _check_token(x_owl_token)
    except HTTPException:
        await db.save_reject("", "token tidak sah", "", ip)
        raise
    try:
        a, d, out = await _assess(t)
    except HTTPException as e:
        await db.save_reject(t.device_id, "ditolak saat penilaian", str(e.detail), ip)
        raise
    return {"assessment": a, "decision": d, "soc": out}


@router.get("/api/rejects", dependencies=[Depends(require_read)])
async def rejects(limit: int = 50):
    """FR-04: telemetri yang ditolak, beserta alasannya."""
    return await db.recent_rejects(limit)


# ——————————————————————————— gerbang ———————————————————————————

@router.post("/api/gate/{device_id}", dependencies=[Depends(require_read)])
async def gate(device_id: str, resource: Sensitivity = Query("classified")):
    """Keputusan gerbang. Inilah momen demo: perangkat datang, lalu lolos
    atau ditolak, berdasarkan penilaian terakhir yang dimiliki OWL."""
    row = await db.last_assessment(device_id)
    if not row:
        raise HTTPException(404, "belum ada penilaian untuk perangkat ini")
    a = RiskAssessment(**{k: row[k] for k in
                          ("device_id", "assessed_at", "score", "level", "findings",
                           "categories", "attestation_ok", "availability",
                           "skipped_rules")})
    d = pdp.decide(a, resource=resource)
    await db.save_decision(d.model_dump())
    await hub.broadcast("gate", d.model_dump())
    return d


# ——————————————————————————— ekspor ———————————————————————————

@router.get("/api/devices/{device_id}/stix", dependencies=[Depends(require_read)])
async def export_stix(device_id: str, resource: Sensitivity = Query("classified")):
    row = await db.last_assessment(device_id)
    if not row:
        raise HTTPException(404, "belum ada penilaian untuk perangkat ini")
    dev = await db.get_device(device_id) or {}
    a = RiskAssessment(**{k: row[k] for k in
                          ("device_id", "assessed_at", "score", "level", "findings",
                           "categories", "attestation_ok", "availability",
                           "skipped_rules")})
    d = pdp.decide(a, resource=resource)
    return stix_mod.bundle(a, d, device_label=dev.get("label", ""), unit=dev.get("unit", ""))


@router.get("/api/devices/{device_id}/cef", dependencies=[Depends(require_read)])
async def export_cef(device_id: str, resource: Sensitivity = Query("classified")):
    row = await db.last_assessment(device_id)
    if not row:
        raise HTTPException(404, "belum ada penilaian untuk perangkat ini")
    dev = await db.get_device(device_id) or {}
    a = RiskAssessment(**{k: row[k] for k in
                          ("device_id", "assessed_at", "score", "level", "findings",
                           "categories", "attestation_ok", "availability",
                           "skipped_rules")})
    d = pdp.decide(a, resource=resource)
    return {"cef": cef_mod.line(a, d, device_label=dev.get("label", ""), unit=dev.get("unit", ""))}


@router.get("/api/soc/events", dependencies=[Depends(require_read)])
async def soc_events(limit: int = 20):
    return await db.recent_soc_events(limit)


@router.get("/api/decisions", dependencies=[Depends(require_read)])
async def decisions(limit: int = 50):
    return await db.recent_decisions(limit)


# ——————————————————————————— kebijakan (FR-12) ———————————————————————————

class WeightChange(BaseModel):
    category: str
    value: float = Field(ge=0, le=100)


class ThresholdChange(BaseModel):
    name: str
    value: float = Field(ge=0, le=100)


@router.get("/api/policy", dependencies=[Depends(require_read)])
async def get_policy():
    return {"weights": policy.weights(), "thresholds": policy.thresholds(),
            "audit": await db.policy_audit(20)}


@router.put("/api/policy/weight")
async def put_weight(c: WeightChange, actor: str = Depends(require_admin)):
    try:
        old, new = policy.set_weight(c.category, c.value)
    except (KeyError, ValueError) as e:
        raise HTTPException(400, str(e))
    await db.save_policy_change(actor, f"weight.{c.category}", str(old), str(new))
    await hub.broadcast("policy", {"field": f"weight.{c.category}", "value": new})
    return {"ok": True, "field": f"weight.{c.category}", "old": old, "new": new,
            "catatan": "berlaku pada penilaian berikutnya; riwayat tidak dihitung ulang"}


@router.put("/api/policy/threshold")
async def put_threshold(c: ThresholdChange, actor: str = Depends(require_admin)):
    try:
        old, new = policy.set_threshold(c.name, c.value)
    except (KeyError, ValueError) as e:
        raise HTTPException(400, str(e))
    await db.save_policy_change(actor, f"threshold.{c.name}", str(old), str(new))
    await hub.broadcast("policy", {"field": f"threshold.{c.name}", "value": new})
    return {"ok": True, "field": f"threshold.{c.name}", "old": old, "new": new,
            "catatan": "berlaku pada penilaian berikutnya; riwayat tidak dihitung ulang"}


# ——————————————————————————— retensi ———————————————————————————

@router.get("/api/retention", dependencies=[Depends(require_read)])
async def get_retention():
    """Kebijakan retensi beserta cacah baris yang sedang disimpan (NFR 5.1)."""
    return {
        "retention_days": settings.RETENTION_DAYS,
        "sweep_hours": settings.RETENTION_SWEEP_HOURS,
        "cutoff": retention.cutoff(),
        "purged_tables": [t for t, _ in retention.TABLES],
        "kept_tables": list(retention.KEPT),
        "counts": await retention.counts(),
        "catatan": "jejak audit kebijakan dan identitas perangkat tidak dihapus",
    }


@router.post("/api/retention/sweep")
async def run_retention(days: float | None = Query(default=None, ge=0),
                        actor: str = Depends(require_admin)):
    """Jalankan penyapuan sekarang. `days` menimpa ambang hanya untuk sekali ini."""
    hasil = await retention.sweep(days)
    log().info("penyapuan retensi manual", extra={"actor": actor, **hasil})
    return hasil


# ——————————————————————————— demo ———————————————————————————

@router.post("/api/demo/seed",
             dependencies=[Depends(require_demo), Depends(require_read)])
async def demo_seed():
    """Muat dua perangkat contoh: satu bersih, satu berisiko."""
    result = await demo.seed(_assess)
    return result


@router.post("/api/demo/reset",
             dependencies=[Depends(require_demo), Depends(require_read)])
async def demo_reset():
    await db.reset()
    await hub.broadcast("reset", {})
    return {"ok": True}


# ——————————————————————————— websocket ———————————————————————————

@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket, key: str | None = Query(default=None)):
    # Siaran ini membawa penilaian lengkap, jadi tunduk pada kunci baca yang
    # sama dengan API. Browser tidak dapat menyetel header pada WebSocket,
    # sehingga kuncinya dibawa lewat parameter kueri.
    if settings.API_KEY and key != settings.API_KEY:
        await ws.close(code=4401)
        return
    await hub.join(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(ws)
