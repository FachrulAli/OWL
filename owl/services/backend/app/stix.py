"""Ekspor STIX 2.1 (deepdive §8.3).

Bundle yang dikeluarkan memakai x-oca-asset untuk perangkat, satu indicator
per aturan yang menyala, dan satu observed-data yang menautkan keduanya ke
skor. Bentuk ini dipilih supaya dapat ditelan Kartika CSIRT tanpa pengurai
khusus OWL.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from .models import AccessDecision, RiskAssessment

STIX_VERSION = "2.1"


def _id(kind: str) -> str:
    return f"{kind}--{uuid.uuid4()}"


def _ts(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _pattern(rule_id: str) -> str:
    """Pola STIX per aturan. Pola ini deskriptif: ia menyatakan indikator apa
    yang teramati, bukan memerintahkan SIEM mencarinya ulang."""
    return {
        "OWL-R01": "[x-oca-asset:permissions CONTAINS 'BIND_ACCESSIBILITY_SERVICE']",
        "OWL-R02": "[x-oca-asset:permissions CONTAINS 'SYSTEM_ALERT_WINDOW']",
        "OWL-A01": "[x-oca-asset:x_install_source NOT IN ('com.android.vending')]",
        "OWL-A02": "[x-oca-asset:permissions CONTAINS 'RECORD_AUDIO' AND x-oca-asset:permissions CONTAINS 'CAMERA']",
        "OWL-C01": "[x-oca-asset:x_user_ca_count > 0]",
        "OWL-C02": "[x-oca-asset:x_vpn_profile != 'allowlisted']",
        "OWL-D01": "[x-oca-asset:x_device_integrity = 'FAILED']",
        "OWL-D02": "[x-oca-asset:x_security_patch_age_days > 60]",
        "OWL-N01": "[x-oca-asset:x_egress_mb_24h > 50 AND x-oca-asset:x_screen_on_ratio < 0.15]",
        "OWL-N02": "[x-oca-asset:x_beacon_jitter_pct < 10]",
        "OWL-X01": "[x-oca-asset:x_agent_attestation = 'FAILED']",
    }.get(rule_id, f"[x-oca-asset:x_owl_rule = '{rule_id}']")


def bundle(a: RiskAssessment, d: AccessDecision | None = None,
           device_label: str = "", unit: str = "") -> dict:
    now = _ts(a.assessed_at)
    objects: list[dict] = []

    indicators = []
    for f in a.findings:
        ind_id = _id("indicator")
        indicators.append(ind_id)
        objects.append({
            "type": "indicator",
            "spec_version": STIX_VERSION,
            "id": ind_id,
            "created": now,
            "modified": now,
            "name": f"{f.rule_id} {f.title}",
            "description": f.detail,
            "indicator_types": ["anomalous-activity"],
            "pattern": _pattern(f.rule_id),
            "pattern_type": "stix",
            "valid_from": now,
            "confidence": {"tinggi": 85, "sedang": 60, "rendah": 30}.get(f.confidence, 50),
            "labels": [f.category, f.severity],
            "external_references": (
                [{"source_name": "mitre-attack-mobile", "description": f.mitre}] if f.mitre else []
            ),
            "x_owl_points": f.points,
            "x_owl_evidence": f.evidence,
        })

    asset = {
        "type": "x-oca-asset",
        "spec_version": STIX_VERSION,
        "id": _id("x-oca-asset"),
        "created": now,
        "modified": now,
        "name": device_label or a.device_id,
        "device_id": a.device_id,
        "x_owl_unit": unit,
        "x_owl_risk_score": a.score,
        "x_owl_risk_level": a.level,
        "x_owl_risk_contributors": [f.rule_id for f in a.findings],
        "x_owl_attestation_ok": a.attestation_ok,
    }
    objects.append(asset)

    objects.append({
        "type": "observed-data",
        "spec_version": STIX_VERSION,
        "id": _id("observed-data"),
        "created": now,
        "modified": now,
        "first_observed": now,
        "last_observed": now,
        "number_observed": 1,
        "object_refs": [asset["id"]] + indicators,
    })

    if d is not None:
        objects.append({
            "type": "x-owl-access-decision",
            "spec_version": STIX_VERSION,
            "id": _id("x-owl-access-decision"),
            "created": now,
            "device_id": d.device_id,
            "resource_sensitivity": d.resource,
            "decision": d.decision,
            "quarantine": d.quarantine,
            "risk_score": d.score,
            "reason": d.reason,
        })

    return {
        "type": "bundle",
        "id": _id("bundle"),
        "objects": objects,
    }
