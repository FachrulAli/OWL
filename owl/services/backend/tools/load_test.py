"""Ukur penerimaan laporan bertanda tangan di ASGI lokal, bukan kapasitas jaringan."""
import argparse
import base64
import json
import platform
import statistics
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from app import db
from app.config import settings
from app.main import app


def run(devices=100, concurrency=20, rounds=3):
    results = []
    with tempfile.TemporaryDirectory(prefix="owl-load-") as directory:
        old = settings.DB_PATH
        object.__setattr__(settings, "DB_PATH", str(Path(directory) / "load.db"))
        try:
            with TestClient(app) as client:
                keys = {f"LOAD-{i}": ec.generate_private_key(ec.SECP256R1()) for i in range(devices)}
                for name, key in keys.items():
                    client.portal.call(db.upsert_device, {"device_id": name})
                    pub = base64.b64encode(key.public_key().public_bytes(serialization.Encoding.DER,
                                           serialization.PublicFormat.SubjectPublicKeyInfo)).decode()
                    client.portal.call(db.set_device_attestation, name, pub,
                        {"verified": True, "hardware_backed": True, "boot_state": "verified", "device_locked": True})
                start = time.perf_counter()
                def send(name, round):
                    body = json.dumps({"device_id": name,
                        "collected_at": (datetime.now(timezone.utc) + timedelta(seconds=round)).isoformat(),
                        "attestation": {"key_attestation": True},
                        "integrity": {"security_patch": datetime.now(timezone.utc).date().isoformat()},
                        "network": {"apps": []}}).encode()
                    sig = base64.b64encode(keys[name].sign(body, ec.ECDSA(hashes.SHA256()))).decode()
                    then = time.perf_counter()
                    r = client.post("/api/telemetry", content=body,
                        headers={"Content-Type": "application/json", "X-OWL-Token": settings.INGEST_TOKEN,
                                 "X-OWL-Signature": sig})
                    return {"status": r.status_code, "ms": (time.perf_counter() - then) * 1000}
                with ThreadPoolExecutor(max_workers=concurrency) as pool:
                    for round in range(rounds):
                        results.extend(pool.map(lambda name: send(name, round), keys))
                elapsed = time.perf_counter() - start
                latencies = sorted(r["ms"] for r in results)
                failures = sum(r["status"] != 200 for r in results)
                return {"devices": devices, "concurrency": concurrency, "reports": len(results),
                    "failures": failures, "elapsed_seconds": round_number(elapsed),
                    "reports_per_second": round_number(len(results) / elapsed),
                    "latency_ms": {"median": round_number(statistics.median(latencies)),
                        "p95": round_number(latencies[int((len(latencies)-1)*.95)]),
                        "max": round_number(max(latencies))},
                    "platform": platform.platform(), "python": platform.python_version(),
                    "scope": "ASGI TestClient, single process, SQLite WAL; signature verification included; enrollment and network excluded"}
        finally:
            object.__setattr__(settings, "DB_PATH", old)


def round_number(n):
    return round(n, 2)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--devices", type=int, default=100)
    p.add_argument("--concurrency", type=int, default=20)
    p.add_argument("--rounds", type=int, default=3)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    if min(args.devices, args.concurrency, args.rounds) < 1:
        p.error("semua angka harus positif")
    result = run(args.devices, args.concurrency, args.rounds)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    sys.exit(1 if result["failures"] else 0)
