"""Rekam hasil penilaian kedua perangkat contoh ke berkas JSON.

Dipakai dashboard ketika OWL Core tidak terjangkau, misalnya pada tautan
publik yang dibuka juri sebelum stack dijalankan. Yang direkam adalah
keluaran mesin aturan dan mesin skor yang sungguhan, bukan angka yang
ditulis tangan di frontend, dan berkas ini dibuat ulang dengan satu perintah
sehingga tidak dapat diam-diam menyimpang dari mesinnya:

    make snapshot
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import cef, demo, pdp, rules, scoring, stix  # noqa: E402

OUT = Path(__file__).resolve().parents[3] / "frontend" / "src" / "data" / "snapshot.json"


def main() -> None:
    rules.load()
    meta = {d["device_id"]: d for d in demo.DEVICES}
    devices, decisions, soc = [], {}, []

    for t in (demo.telemetry_bersih(), demo.telemetry_berisiko()):
        a = scoring.score(t, rules.evaluate(t))
        d = meta[a.device_id]
        row = json.loads(a.model_dump_json())
        devices.append({**d, "enrolled_at": a.assessed_at.isoformat(),
                        "score": a.score, "level": a.level,
                        "assessed_at": a.assessed_at.isoformat(),
                        "findings": row["findings"],
                        "attestation_ok": a.attestation_ok,
                        "availability": row["availability"],
                        "skipped_rules": row["skipped_rules"]})
        decisions[a.device_id] = {
            r: json.loads(pdp.decide(a, r).model_dump_json())
            for r in ("standard", "classified")
        }
        dec = pdp.decide(a, "classified")
        soc.append({"id": len(soc) + 1, "device_id": a.device_id,
                    "sent_at": a.assessed_at.isoformat(), "kind": "stix",
                    "delivered": False,
                    "payload": json.dumps(stix.bundle(a, dec, d["label"], d["unit"]),
                                          ensure_ascii=False, default=str)})
        soc.append({"id": len(soc) + 1, "device_id": a.device_id,
                    "sent_at": a.assessed_at.isoformat(), "kind": "cef",
                    "delivered": False,
                    "payload": cef.line(a, dec, d["label"], d["unit"])})

    c = rules.catalog()
    from app import policy
    from app.config import settings
    catalog = {
        "version": c.get("version"), "updated": str(c.get("updated", "")),
        "parameters": c.get("parameters", {}), "allowlists": c.get("allowlists", {}),
        "rules": c["rules"], "weights": policy.weights(), "severity": settings.SEVERITY,
        "saturation": settings.CATEGORY_SATURATION,
        "thresholds": policy.thresholds(),
        "enforcement": "rekomendasi",
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "engine_version": settings.VERSION,
        "devices": sorted(devices, key=lambda d: -d["score"]),
        "decisions": decisions,
        "soc_events": soc,
        "catalog": catalog,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"snapshot ditulis: {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
