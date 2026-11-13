"""Ekspor CEF (ArcSight Common Event Format) lewat Syslog (deepdive §8.3).

CEF dipakai karena hampir setiap SIEM membacanya tanpa konektor khusus.
Ini jalur kedua di samping STIX: STIX untuk pertukaran intelijen, CEF untuk
alur alert harian SOC.
"""
from __future__ import annotations

from .models import AccessDecision, RiskAssessment

VENDOR = "OWL"
PRODUCT = "OnDeviceWatchLayer"
VERSION = "1.0"

_SEV = {"rendah": 3, "sedang": 5, "tinggi": 7, "kritis": 9}


def _esc(v: str) -> str:
    """Pelolosan CEF: pipa, garis miring terbalik, dan sama dengan."""
    return str(v).replace("\\", "\\\\").replace("|", "\\|").replace("=", "\\=")


def _esc_header(v: str) -> str:
    return str(v).replace("\\", "\\\\").replace("|", "\\|")


def line(a: RiskAssessment, d: AccessDecision | None = None,
         device_label: str = "", unit: str = "") -> str:
    sig_id = 100
    name = f"Mobile Risk Score {a.level.capitalize()}"
    sev = _SEV.get(a.level, 5)

    ext = {
        "deviceId": a.device_id,
        "dvchost": device_label or a.device_id,
        "cat": "endpoint/mobile-risk",
        "rt": int(a.assessed_at.timestamp() * 1000),
        "cs1Label": "riskScore", "cs1": a.score,
        "cs2Label": "riskLevel", "cs2": a.level,
        "cs3Label": "contributors",
        "cs3": ",".join(f.rule_id for f in a.findings) or "none",
        "cs4Label": "unit", "cs4": unit or "-",
        "cn1Label": "findingCount", "cn1": len(a.findings),
        "cfp1Label": "decayApplied", "cfp1": a.decay_applied,
    }
    if d is not None:
        ext.update({
            "act": d.decision,
            "cs5Label": "resource", "cs5": d.resource,
            "cs6Label": "quarantine", "cs6": str(d.quarantine).lower(),
        })

    body = " ".join(f"{k}={_esc(v)}" for k, v in ext.items())
    return (f"CEF:0|{_esc_header(VENDOR)}|{_esc_header(PRODUCT)}|{VERSION}|"
            f"{sig_id}|{_esc_header(name)}|{sev}|{body}")
