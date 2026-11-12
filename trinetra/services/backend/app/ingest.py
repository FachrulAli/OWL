"""Jalur masuk telemetri dari agent MOBILE nyata (/ingest/mobile).

Agent di HP prajurit TIDAK berbicara langsung ke Kafka: HP tidak boleh memegang
kredensial broker, dan jaringan seluler terlalu tidak stabil untuk klien Kafka.
Agent mengirim batch JSON lewat HTTPS ke endpoint ini, lalu backend yang
menaruhnya ke topik yang sama dengan simulator. Akibatnya pipeline deteksi
tidak bisa membedakan mana data dari HP asli dan mana dari simulator — satu
jalur kode, satu perilaku, dan demo tetap utuh walau agent tidak terpasang.

Autentikasi: token bersama per-penggelaran (INGEST_TOKEN). Untuk produksi
diganti sertifikat klien per-perangkat; token cukup dan jujur untuk prototipe.
"""
import os
import uuid
from datetime import datetime, timezone

import orjson
from aiokafka import AIOKafkaProducer

from .config import settings

INGEST_TOKEN = os.getenv("INGEST_TOKEN", "trinetra-demo-token")
MAX_BATCH = int(os.getenv("INGEST_MAX_BATCH", "500"))

_producer: AIOKafkaProducer | None = None
STATS = {"batches": 0, "events": 0, "rejected": 0, "devices": set()}


async def start():
    global _producer
    try:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP,
            value_serializer=lambda v: orjson.dumps(v),
            compression_type="lz4",
            linger_ms=50,
        )
        await _producer.start()
        print("[ingest] producer siap; /ingest/mobile aktif", flush=True)
    except Exception as e:
        _producer = None
        print(f"[ingest] producer gagal start: {e}", flush=True)


async def stop():
    global _producer
    if _producer is not None:
        await _producer.stop()
        _producer = None


def ready() -> bool:
    return _producer is not None


# Field yang BOLEH diterima dari agent. Daftar putih, bukan daftar hitam:
# apa pun yang dikirim agent di luar daftar ini dibuang, sehingga perangkat
# yang dikompromikan tidak bisa menyuntik field palsu ke dalam pipeline.
ALLOWED = {
    "event_id", "ts", "category", "activity",
    "screen_on", "user_interaction", "foreground_app",
    "egress_mb", "ingress_mb", "dest_asn", "dest_ip", "dns_domain",
    "beacon_interval_s",
    "tls_mitm", "thermal_state", "battery_drop_pct", "cpu_pct", "charging",
    "inbound_msg", "sender_known", "notified", "msg_app",
    "msg_has_attachment", "msg_binary", "mic_active", "cam_active",
    "crash_proc", "crash_count", "crash_reason",
    "pkg_added", "pkg_name", "pkg_sha256", "pkg_hidden", "installer_source",
    "perm_sensitive", "accessibility_granted", "device_admin_granted",
    "integrity_fail", "profile_added", "profile_trusted", "tamper_detail",
    "patch_age_days", "net_gen", "cell_unknown", "cell_encryption",
    "radio_anomaly", "platform", "os_version", "device_model", "login_hour",
}

# Field yang DITENTUKAN SERVER, tidak pernah dipercaya dari perangkat.
# Identitas perangkat berasal dari registry (siapa pemegang HP, satuan mana,
# tier berapa) — kalau ini boleh dikirim HP, satu HP bisa mengaku HP Pangdam.
SERVER_SET = {"entity_id", "role", "node_id", "tier", "unit_id", "domain",
              "endpoint_id", "label_scenario", "ioc_match",
              "chain_id", "chain_stage", "chain_step", "chain_len"}


def sanitize(raw: dict, identity: dict) -> dict | None:
    """Saring satu event agent menjadi event mentah yang siap dinormalisasi."""
    if not isinstance(raw, dict):
        return None
    ev = {k: v for k, v in raw.items() if k in ALLOWED}
    if not ev:
        return None

    ts = ev.get("ts")
    if ts:
        try:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            # Jam perangkat bisa salah atau dimanipulasi. Timestamp masa depan
            # akan merusak jendela korelasi, jadi dipangkas ke waktu server.
            now = datetime.now(timezone.utc)
            ev["ts"] = (min(dt, now)).isoformat()
        except (ValueError, TypeError):
            ev["ts"] = datetime.now(timezone.utc).isoformat()
    else:
        ev["ts"] = datetime.now(timezone.utc).isoformat()

    ev["event_id"] = str(uuid.uuid4())      # id selalu dari server
    ev["domain"] = "mobile"
    ev["label_scenario"] = "live_agent"     # penanda: data HP nyata, bukan simulasi
    ev.update({k: v for k, v in identity.items() if k in SERVER_SET})
    return ev


async def publish(events: list[dict], identity: dict) -> dict:
    """Taruh batch event agent ke topik telemetri."""
    if _producer is None:
        return {"accepted": 0, "error": "producer belum siap"}
    accepted = 0
    for raw in events[:MAX_BATCH]:
        ev = sanitize(raw, identity)
        if ev is None:
            STATS["rejected"] += 1
            continue
        await _producer.send(settings.TOPIC_RAW,
                             key=ev["entity_id"].encode(), value=ev)
        accepted += 1
    STATS["batches"] += 1
    STATS["events"] += accepted
    STATS["devices"].add(identity.get("entity_id", "?"))
    return {"accepted": accepted, "rejected": len(events) - accepted}


def stats() -> dict:
    return {"batches": STATS["batches"], "events": STATS["events"],
            "rejected": STATS["rejected"],
            "devices": sorted(STATS["devices"])}
