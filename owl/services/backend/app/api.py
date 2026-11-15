"""REST API OWL Core."""
from __future__ import annotations

import base64
import json
import secrets
from datetime import datetime, timezone

from fastapi import (APIRouter, Depends, Header, HTTPException, Query, Request,
                     WebSocket, WebSocketDisconnect)
from pydantic import BaseModel, Field

from . import attest, db, demo, pdp, policy, retention, rules, scoring, soc, operations
from . import cef as cef_mod
from . import stix as stix_mod
from .applog import log
from .config import settings
from .models import (AccessDecision, Device, IndicatorStatus, RiskAssessment,
                     Sensitivity, Telemetry)
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
            "attestation": settings.ATTESTATION_MODE,
            "enroll": settings.ENROLL_MODE,
            "agent_signers": "aktif" if settings.AGENT_SIGNERS.strip() else "kosong",
            "revocation": _revocation_state(await db.revocation_meta()),
            "enforcement": "rekomendasi"}


def _revocation_state(meta: dict) -> dict:
    """Keadaan daftar pencabutan untuk /health dan metrik. Daftar yang belum
    diimpor atau sudah basi dinyatakan, bukan dibiarkan terbaca bersih."""
    if not meta["imported_at"]:
        return {"status": "belum diimpor", "entries": 0}
    umur = (datetime.now(timezone.utc) - datetime.fromisoformat(meta["imported_at"])).total_seconds() / 86400
    if meta.get("source_date"):
        source = datetime.fromisoformat(meta["source_date"])
        if source.tzinfo is None:
            source = source.replace(tzinfo=timezone.utc)
        umur = max(umur, (datetime.now(timezone.utc) - source).total_seconds() / 86400)
    return {"status": "basi" if umur > settings.REVOCATION_MAX_AGE_DAYS else "terkini",
            "entries": meta["entries"], "age_days": round(umur, 1),
            "imported_at": meta["imported_at"], "source_date": meta["source_date"]}


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
                 x_owl_token: str | None = Header(default=None),
                 x_owl_enroll: str | None = Header(default=None)):
    # Pendaftaran menuntut token penggelaran yang sama dengan telemetri.
    # Tanpa itu siapa pun di jaringan dapat mendaftarkan perangkat karangan,
    # atau menimpa label dan satuan perangkat yang sudah ada.
    ip = request.client.host if request.client else ""
    try:
        _check_token(x_owl_token)
    except HTTPException:
        await db.save_reject(d.device_id, "pendaftaran ditolak", "token tidak sah", ip)
        raise
    await _check_enroll_gate(d.device_id, x_owl_enroll, ip, "pendaftaran ditolak")
    lama0 = await db.get_device(d.device_id)
    if lama0 and lama0.get("revoked"):
        await db.save_reject(d.device_id, "pendaftaran ditolak", "perangkat dicabut administrator", ip)
        raise HTTPException(status_code=403, detail="perangkat dicabut administrator")

    att = None
    if d.attestation_chain:
        ch = await db.take_challenge(d.device_id, settings.CHALLENGE_TTL_SECONDS)
        if ch is None:
            att = attest.AttestationResult(
                reason="tantangan pendaftaran tidak ada atau sudah kedaluwarsa")
        else:
            roots = attest.trusted_roots(settings.ATTESTATION_ROOTS or None)
            att = attest.verify_chain(d.attestation_chain, base64.b64decode(ch),
                                      roots=roots, revoked=await db.revoked_serials())
            _check_app_identity(att)

    # Kunci yang sudah terbukti tidak boleh ditimpa pendaftaran yang tidak
    # terbukti. Tanpa ini, siapa pun yang memegang token dapat mengambil alih
    # identitas perangkat dengan mendaftar ulang tanpa rantai.
    lama = await db.get_device(d.device_id)
    lama_tepercaya = bool(lama and lama.get("public_key") and (lama.get("attestation") or {}).get("verified")
                          and (lama.get("attestation") or {}).get("hardware_backed"))
    if lama_tepercaya and not (att and att.trusted):
        await db.save_reject(d.device_id, "pendaftaran ulang ditolak",
                             "perangkat sudah punya kunci terverifikasi; "
                             + (att.reason if att else "pendaftaran baru tidak membawa rantai attestation"), ip)
        log().warning("pendaftaran ulang tanpa attestation sah ditolak",
                      extra={"device_id": d.device_id})
        raise HTTPException(status_code=409,
                            detail="perangkat sudah terdaftar dengan kunci terverifikasi")

    meta = d.model_dump(exclude={"attestation_chain"})
    await db.upsert_device(meta)
    # Token pendaftaran hangus begitu pendaftarannya diterima. Pendaftaran yang
    # gagal verifikasi tidak menghanguskannya, supaya perangkat yang sah dapat
    # mengulang; umurnya terbatas.
    if x_owl_enroll and (att is None or att.trusted):
        await db.consume_enroll_token(x_owl_enroll)
    if att is not None:
        await db.set_device_attestation(d.device_id, att.public_key_b64, att.to_dict())
        log().info("pendaftaran dengan attestation", extra={
            "device_id": d.device_id, "terverifikasi": att.verified,
            "tingkat": att.security_level, "boot": att.boot_state, "sebab": att.reason})
    await hub.broadcast("device_enrolled", meta)
    return {"ok": True, "device_id": d.device_id,
            "attested": bool(att and att.trusted),
            "attestation": att.to_dict() | {"public_key_b64": ""} if att else None}


async def _check_enroll_gate(device_id: str, token: str | None, ip: str, reason: str) -> None:
    """A4: pada mode token, pendaftaran dan permintaan tantangan menuntut token
    sekali pakai yang diterbitkan admin untuk perangkat ini.

    Token penggelaran bersama sama untuk seluruh armada. Tanpa langkah ini,
    siapa pun yang memegangnya dapat mendaftarkan perangkat karangan, atau
    mengambil alih identitas perangkat lain dengan mendaftar ulang memakai
    perangkat kerasnya sendiri."""
    if settings.ENROLL_MODE != "token":
        return
    salah = await db.check_enroll_token(token, device_id)
    if salah:
        await db.save_reject(device_id, reason, salah, ip)
        log().warning("pendaftaran ditolak, token pendaftaran tidak sah",
                      extra={"device_id": device_id, "sebab": salah})
        raise HTTPException(status_code=401, detail=salah)


def _check_app_identity(att: "attest.AttestationResult") -> None:
    """Kunci harus diminta oleh agent OWL, bukan aplikasi lain di perangkat itu."""
    if not att.verified:
        return
    # A3: pada penggelaran (mode verify, bukan demo) pengikatan penanda tangan
    # wajib. Tanpa itu nama paket saja yang diperiksa, dan nama paket dapat
    # dipakai aplikasi lain.
    if (settings.ATTESTATION_MODE == "verify" and not settings.DEMO_MODE
            and not settings.AGENT_SIGNERS.strip()):
        att.verified = False
        att.reason = ("OWL_AGENT_SIGNERS belum diisi: pada penggelaran (OWL_DEMO=false) "
                      "sidik penanda tangan agent wajib diikat")
        return
    if settings.AGENT_PACKAGE and att.app_package != settings.AGENT_PACKAGE:
        att.verified = False
        att.reason = (f"kunci diminta oleh paket {att.app_package or 'tidak dikenal'}, "
                      f"bukan {settings.AGENT_PACKAGE}")
        return
    wajib = {s.strip().lower() for s in settings.AGENT_SIGNERS.split(",") if s.strip()}
    if wajib and not wajib & {s.lower() for s in att.app_signers}:
        att.verified = False
        att.reason = "penanda tangan agent tidak ada di daftar yang diizinkan"


@router.get("/api/enroll/challenge")
async def enroll_challenge(request: Request,
                           device_id: str = Query(min_length=1, max_length=64),
                           x_owl_token: str | None = Header(default=None),
                           x_owl_enroll: str | None = Header(default=None)):
    """Tantangan sekali pakai untuk Key Attestation. Agent membuat kuncinya
    DENGAN tantangan ini, sehingga rantai yang dihasilkan membuktikan kunci
    itu dibuat sekarang, untuk pendaftaran ini."""
    _check_token(x_owl_token)
    await _check_enroll_gate(device_id, x_owl_enroll,
                             request.client.host if request.client else "", "tantangan ditolak")
    ch = base64.b64encode(secrets.token_bytes(32)).decode("ascii")
    await db.save_challenge(device_id, ch)
    return {"challenge": ch, "expires_in": settings.CHALLENGE_TTL_SECONDS}


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

def _apply_server_trust(t: Telemetry, dev: dict, synthetic: bool,
                        revoked: set[str] | None = None) -> None:
    """Ganti KLAIM agent tentang dirinya dengan hasil verifikasi OWL Core.

    Sebelum ini `key_attestation` adalah boolean yang dikirim agent, dan agent
    yang dikuasai penyerang cukup mengirim `true`. Sekarang:

      perangkat punya catatan attestation   hasil verifikasinya yang berlaku,
                                            apa pun mode dan apa pun klaimnya.
      tidak punya, mode verify              tidak dipercaya, OWL-X01 menyala.
      tidak punya, mode claim               klaim agent dipakai (emulator, curl).

    Telemetri contoh dari tombol demo ditandai `synthetic` dan dilewati: ia
    tidak pernah datang dari perangkat, dan dashboard menyebutnya contoh.
    """
    if synthetic:
        return
    now = datetime.now().astimezone()
    att = dev.get("attestation")
    if att:
        trusted = bool(att.get("verified") and att.get("hardware_backed"))
        # Daftar pencabutan yang diimpor SESUDAH perangkat mendaftar tetap
        # berlaku: nomor seri rantainya disimpan dan diperiksa lagi di sini.
        hit = attest.serials_revoked(att.get("chain_serials", []), revoked)
        if hit:
            trusted = False
            att = dict(att, reason=f"sertifikat dalam rantai ada di daftar pencabutan Google ({hit})")
        t.attestation.key_attestation = trusted
        t.attestation.certificate_chain_sha256 = att.get("chain_sha256", "")
        if trusted:
            boot_ok = att.get("boot_state") == "verified" and att.get("device_locked") is True
            if not boot_ok:
                # Perangkat keras sendiri menyatakan boot tidak terverifikasi
                # atau bootloader terbuka. Ini bukan tebakan agent.
                t.integrity.bootloader_unlocked = True
            reason = (f"terverifikasi OWL Core: kunci di {att.get('security_level')}, "
                      f"boot {att.get('boot_state') or 'tidak dilaporkan'}, "
                      f"bootloader {'terkunci' if att.get('device_locked') else 'TERBUKA'}")
            t.availability["integrity"] = IndicatorStatus(
                status="ok", source="server", checked_at=now,
                reason="keadaan boot dibaca dari attestation perangkat keras")
        else:
            reason = att.get("reason") or "rantai attestation tidak lolos verifikasi"
        t.availability["attestation"] = IndicatorStatus(
            status="ok", source="server", checked_at=now, reason=reason)
    elif settings.ATTESTATION_MODE != "claim":
        t.attestation.key_attestation = False
        t.availability["attestation"] = IndicatorStatus(
            status="ok", source="server", checked_at=now,
            reason="perangkat belum pernah mengirim rantai attestation")


async def _assess(t: Telemetry, synthetic: bool = False) -> tuple[RiskAssessment, AccessDecision, dict]:
    dev = await db.get_device(t.device_id)
    if not dev:
        raise HTTPException(404, "perangkat belum terdaftar; daftarkan lebih dahulu")
    _apply_server_trust(t, dev, synthetic, await db.revoked_serials())

    prev = await db.last_assessment(t.device_id)
    previous = prev["score"] if prev else None
    last_seen = datetime.fromisoformat(prev["assessed_at"]) if prev else None

    findings = rules.evaluate(t)
    a = scoring.score(t, findings, previous=previous, last_seen=last_seen)
    d = pdp.decide(a, resource="standard")

    await db.save_assessment(json.loads(a.model_dump_json()), json.loads(t.model_dump_json()))
    d = await operations.current(t.device_id)
    await db.save_decision(d.model_dump())
    await operations.record_transition(d)
    out = await soc.dispatch(a, d, device_label=dev.get("label", ""), unit=dev.get("unit", ""))

    await hub.broadcast("assessment", json.loads(a.model_dump_json()))
    return a, d, out


@router.post("/api/telemetry")
async def telemetry(t: Telemetry, request: Request,
                    x_owl_token: str | None = Header(default=None),
                    x_owl_signature: str | None = Header(default=None)):
    ip = request.client.host if request.client else ""
    try:
        _check_token(x_owl_token)
    except HTTPException:
        await db.save_reject("", "token tidak sah", "", ip)
        raise

    # Perangkat yang sudah mendaftarkan kunci HARUS menandatangani laporannya.
    # Token penggelaran sama untuk seluruh armada, jadi tanpa tanda tangan ini
    # siapa pun yang memegang token dapat mengirim laporan "bersih" atas nama
    # perangkat lain.
    dev = await db.get_device(t.device_id)
    if dev and dev.get("revoked"):
        await db.save_reject(t.device_id, "laporan dari perangkat dicabut",
                             dev.get("revoked_reason", ""), ip)
        raise HTTPException(status_code=403, detail="perangkat dicabut administrator")
    if dev and dev.get("public_key"):
        raw = await request.body()
        if not x_owl_signature or not attest.verify_signature(dev["public_key"], raw, x_owl_signature):
            await db.save_reject(t.device_id, "tanda tangan laporan tidak sah",
                                 "tidak ada" if not x_owl_signature else "tidak cocok dengan kunci perangkat", ip)
            log().warning("laporan ditolak, tanda tangan tidak sah",
                          extra={"device_id": t.device_id})
            raise HTTPException(status_code=401, detail="tanda tangan laporan tidak sah")
        # Laporan lama yang sah tanda tangannya tetap tidak boleh diputar ulang.
        baru = t.collected_at.isoformat()
        if dev.get("last_collected_at") and baru <= dev["last_collected_at"]:
            await db.save_reject(t.device_id, "laporan diputar ulang",
                                 f"collected_at {baru} tidak lebih baru dari {dev['last_collected_at']}", ip)
            raise HTTPException(status_code=409, detail="laporan lama; waktu pengumpulan tidak maju")
        await db.set_last_collected(t.device_id, baru)
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
    dev = await db.get_device(device_id) or {}
    d = await operations.current(device_id, resource)
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
    d = await operations.current(device_id, resource)
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
    d = await operations.current(device_id, resource)
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


# ——————————————————————————— A1: daftar pencabutan ———————————————————————————

@router.post("/api/attestation/revocations")
async def import_revocations(body: dict, actor: str = Depends(require_admin),
                             source_date: str = Query(default="")):
    """Impor daftar pencabutan Google. Bentuknya persis berkas
    https://android.googleapis.com/attestation/status, yang diunduh di mesin
    terhubung dan dibawa lewat media: OWL Core tidak pernah mengunduhnya."""
    entries = body.get("entries")
    if source_date:
        try:
            datetime.fromisoformat(source_date)
        except ValueError:
            raise HTTPException(400, "source_date harus tanggal ISO")
    if not isinstance(entries, dict) or not entries:
        raise HTTPException(400, "berkas tidak memuat `entries`")
    bersih = {}
    for k, v in entries.items():
        if not isinstance(v, dict):
            raise HTTPException(400, f"entri {k} bukan objek")
        bersih[attest.normalize_serial(k)] = v
    lama = (await db.revocation_meta())["entries"]
    n = await db.replace_revocations(bersih, source_date)
    await db.save_policy_change(actor, "attestation.revocations", str(lama), str(n))
    log().info("daftar pencabutan attestation diimpor", extra={"entri": n, "sebelumnya": lama})
    return {"ok": True, "entries": n, "previous": lama}


@router.get("/api/attestation/revocations", dependencies=[Depends(require_read)])
async def get_revocations():
    return _revocation_state(await db.revocation_meta())


# ——————————————————————————— A2: pencabutan perangkat ———————————————————————————

class RevokeBody(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


@router.put("/api/devices/{device_id}/revoke")
async def revoke_device(device_id: str, b: RevokeBody, actor: str = Depends(require_admin)):
    if not await db.get_device(device_id):
        raise HTTPException(404, "perangkat tidak terdaftar")
    await db.set_device_revoked(device_id, b.reason)
    await db.save_policy_change(actor, f"device.revoke:{device_id}", "aktif", f"dicabut: {b.reason}")
    log().warning("perangkat dicabut", extra={"device_id": device_id, "alasan": b.reason})
    await hub.broadcast("device_revoked", {"device_id": device_id, "reason": b.reason})
    return {"ok": True, "device_id": device_id, "revoked": True}


@router.delete("/api/devices/{device_id}/revoke")
async def unrevoke_device(device_id: str, actor: str = Depends(require_admin)):
    if not await db.get_device(device_id):
        raise HTTPException(404, "perangkat tidak terdaftar")
    await db.set_device_revoked(device_id, None)
    await db.save_policy_change(actor, f"device.revoke:{device_id}", "dicabut", "aktif")
    await hub.broadcast("device_unrevoked", {"device_id": device_id})
    return {"ok": True, "device_id": device_id, "revoked": False}


# ——————————————————————————— A4: token pendaftaran ———————————————————————————

class EnrollTokenBody(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    ttl_minutes: float | None = Field(default=None, gt=0, le=1440)


@router.post("/api/enroll/tokens")
async def issue_enroll_token(b: EnrollTokenBody, request: Request,
                             actor: str = Depends(require_admin)):
    """Terbitkan token pendaftaran sekali pakai untuk SATU perangkat. Tokennya
    hanya muncul di jawaban ini; yang tersimpan hanya sidiknya."""
    ttl = b.ttl_minutes or settings.ENROLL_TOKEN_TTL_MINUTES
    token, expires = await db.create_enroll_token(b.device_id, ttl, actor)
    await db.save_policy_change(actor, f"enroll.token:{b.device_id}", "-", f"terbit, berlaku sampai {expires}")
    base = (settings.PUBLIC_BASE_URL or str(request.base_url)).rstrip("/")
    from urllib.parse import quote
    return {"device_id": b.device_id, "token": token, "expires_at": expires,
            "provision_url": f"owl://enroll?base={quote(base, safe='')}&device={quote(b.device_id, safe='')}&token={token}"}


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
    async def contoh(t: Telemetry):
        return await _assess(t, synthetic=True)
    result = await demo.seed(contoh)
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
