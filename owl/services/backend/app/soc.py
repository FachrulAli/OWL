"""Pengiriman ke SOC dan CSIRT (deepdive §8.3 dan §8.4).

Dua jalur keluar, keduanya tetap di dalam jaringan satuan:

  webhook  POST bertanda tangan HMAC-SHA256 ke Kartika CSIRT, membawa
           bundle STIX 2.1 utuh.
  syslog   satu baris CEF ke kolektor SIEM, lewat UDP.

Pada mode air-gapped tidak ada tujuan yang dikonfigurasi, dan event tetap
dicatat di basis data lokal supaya dapat diambil petugas lewat berkas. Event
yang tidak terkirim disimpan sebagai `delivered = 0`, bukan dibuang diam-diam.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import socket

import httpx

from . import db
from .applog import log
from .config import settings
from .models import AccessDecision, RiskAssessment
from . import cef as cef_mod
from . import stix as stix_mod


def sign(payload: bytes, secret: str | None = None) -> str:
    key = (secret or settings.SOC_WEBHOOK_SECRET).encode("utf-8")
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


async def send_webhook(a: RiskAssessment, d: AccessDecision | None,
                       device_label: str = "", unit: str = "") -> tuple[bool, dict]:
    bundle = stix_mod.bundle(a, d, device_label=device_label, unit=unit)
    body = {
        "event": "risk_threshold_breached" if a.score >= settings.T_HIGH else "risk_assessed",
        "device_id": a.device_id,
        "risk_score": a.score,
        "severity": a.level,
        "decision": d.decision if d else None,
        "stix_bundle": bundle,
    }
    raw = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
    signature = sign(raw)

    delivered = False
    if settings.SOC_WEBHOOK_URL:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.post(
                    settings.SOC_WEBHOOK_URL,
                    content=raw,
                    headers={"Content-Type": "application/json",
                             "X-OWL-Signature": signature},
                )
                delivered = r.status_code < 300
        except Exception as e:                      # jaringan satuan bisa putus
            log().warning("webhook soc gagal", extra={
                "device_id": a.device_id, "sebab": str(e)})

    await db.save_soc_event(a.device_id, "stix", raw.decode("utf-8"), delivered)
    return delivered, {"signature": signature, "body": body}


async def send_cef(a: RiskAssessment, d: AccessDecision | None,
                   device_label: str = "", unit: str = "") -> tuple[bool, str]:
    msg = cef_mod.line(a, d, device_label=device_label, unit=unit)
    delivered = False
    if settings.CEF_SYSLOG_HOST:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.sendto(f"<134>{msg}".encode("utf-8"),
                         (settings.CEF_SYSLOG_HOST, settings.CEF_SYSLOG_PORT))
            delivered = True
        except Exception as e:
            log().warning("syslog cef gagal", extra={
                "device_id": a.device_id, "sebab": str(e)})

    await db.save_soc_event(a.device_id, "cef", msg, delivered)
    return delivered, msg


async def dispatch(a: RiskAssessment, d: AccessDecision | None,
                   device_label: str = "", unit: str = "") -> dict:
    """Kirim ke kedua jalur. Dipanggil setelah setiap penilaian."""
    ok_stix, stix_info = await send_webhook(a, d, device_label, unit)
    ok_cef, cef_line = await send_cef(a, d, device_label, unit)
    return {
        "stix": {"delivered": ok_stix, "signature": stix_info["signature"],
                 "bundle": stix_info["body"]["stix_bundle"]},
        "cef": {"delivered": ok_cef, "line": cef_line},
        "air_gapped": settings.AIR_GAPPED,
    }
