"""REST API OWL Core."""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException, Query, WebSocket, WebSocketDisconnect

from . import db, demo, pdp, rules, scoring, soc
from . import cef as cef_mod
from . import stix as stix_mod
from .config import settings
from .models import AccessDecision, Device, RiskAssessment, Sensitivity, Telemetry
from .ws import hub

router = APIRouter()


def _check_token(token: str | None) -> None:
    if token != settings.INGEST_TOKEN:
        raise HTTPException(status_code=401, detail="token penggelaran tidak sah")


# ——————————————————————————— dasar ———————————————————————————

@router.get("/health")
async def health():
    return {"service": settings.SERVICE, "version": settings.VERSION,
            "air_gapped": settings.AIR_GAPPED}


@router.get("/api/catalog")
async def catalog():
    c = rules.catalog()
    return {
        "version": c.get("version"),
        "updated": str(c.get("updated", "")),
        "parameters": c.get("parameters", {}),
        "allowlists": c.get("allowlists", {}),
        "rules": c["rules"],
        "weights": settings.WEIGHTS,
        "severity": settings.SEVERITY,
        "saturation": settings.CATEGORY_SATURATION,
        "thresholds": {"medium": settings.T_MEDIUM, "high": settings.T_HIGH,
                       "critical": settings.T_CRITICAL},
    }


# ——————————————————————————— perangkat ———————————————————————————

@router.post("/api/devices")
async def enroll(d: Device):
    await db.upsert_device(d.model_dump())
    await hub.broadcast("device_enrolled", d.model_dump())
    return {"ok": True, "device_id": d.device_id}


@router.get("/api/devices")
async def devices():
    return await db.list_devices()


@router.get("/api/devices/{device_id}")
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
async def telemetry(t: Telemetry, x_owl_token: str | None = Header(default=None)):
    _check_token(x_owl_token)
    a, d, out = await _assess(t)
    return {"assessment": a, "decision": d, "soc": out}


# ——————————————————————————— gerbang ———————————————————————————

@router.post("/api/gate/{device_id}")
async def gate(device_id: str, resource: Sensitivity = Query("classified")):
    """Keputusan gerbang. Inilah momen demo: perangkat datang, lalu lolos
    atau ditolak, berdasarkan penilaian terakhir yang dimiliki OWL."""
    row = await db.last_assessment(device_id)
    if not row:
        raise HTTPException(404, "belum ada penilaian untuk perangkat ini")
    a = RiskAssessment(**{k: row[k] for k in
                          ("device_id", "assessed_at", "score", "level", "findings",
                           "categories", "attestation_ok")})
    d = pdp.decide(a, resource=resource)
    await db.save_decision(d.model_dump())
    await hub.broadcast("gate", d.model_dump())
    return d


# ——————————————————————————— ekspor ———————————————————————————

@router.get("/api/devices/{device_id}/stix")
async def export_stix(device_id: str, resource: Sensitivity = Query("classified")):
    row = await db.last_assessment(device_id)
    if not row:
        raise HTTPException(404, "belum ada penilaian untuk perangkat ini")
    dev = await db.get_device(device_id) or {}
    a = RiskAssessment(**{k: row[k] for k in
                          ("device_id", "assessed_at", "score", "level", "findings",
                           "categories", "attestation_ok")})
    d = pdp.decide(a, resource=resource)
    return stix_mod.bundle(a, d, device_label=dev.get("label", ""), unit=dev.get("unit", ""))


@router.get("/api/devices/{device_id}/cef")
async def export_cef(device_id: str, resource: Sensitivity = Query("classified")):
    row = await db.last_assessment(device_id)
    if not row:
        raise HTTPException(404, "belum ada penilaian untuk perangkat ini")
    dev = await db.get_device(device_id) or {}
    a = RiskAssessment(**{k: row[k] for k in
                          ("device_id", "assessed_at", "score", "level", "findings",
                           "categories", "attestation_ok")})
    d = pdp.decide(a, resource=resource)
    return {"cef": cef_mod.line(a, d, device_label=dev.get("label", ""), unit=dev.get("unit", ""))}


@router.get("/api/soc/events")
async def soc_events(limit: int = 20):
    return await db.recent_soc_events(limit)


@router.get("/api/decisions")
async def decisions(limit: int = 50):
    return await db.recent_decisions(limit)


# ——————————————————————————— demo ———————————————————————————

@router.post("/api/demo/seed")
async def demo_seed():
    """Muat dua perangkat contoh: satu bersih, satu berisiko."""
    result = await demo.seed(_assess)
    return result


@router.post("/api/demo/reset")
async def demo_reset():
    await db.reset()
    await hub.broadcast("reset", {})
    return {"ok": True}


# ——————————————————————————— websocket ———————————————————————————

@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await hub.join(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(ws)
