"""Ingestion & detection pipeline consumer (§9.1 detection pipeline).

Consumes raw telemetry from Kafka and runs the full chain per event:
  normalize (OCSF) -> enrich (role/identity) -> rule engine + ML/UEBA (parallel)
  -> risk scoring -> persist (ClickHouse) -> case management (Postgres)
  -> live push (WebSocket).

ClickHouse writes are batched for throughput; Postgres case writes happen only
when an entity crosses the alert threshold.
"""
import asyncio
import time
import uuid
from datetime import datetime, timezone

from aiokafka import AIOKafkaConsumer
import orjson

from .config import settings
from .db import ch_insert
from .ocsf import normalize
from .enrichment import enrich
from .rules.engine import evaluate
from . import ml_client
from .scoring import score_event
from .cases import upsert_case, update_entity_risk
from .ws import hub

_EVENT_COLS = [
    "event_id", "ts", "tier", "node_id", "unit_id", "entity_id", "role",
    "endpoint_id", "os", "category", "activity", "egress_mb", "dest_class",
    "files_accessed", "endpoints_touched", "usb_event", "privilege_change",
    "config_change", "login_hour", "src_ip", "src_geo", "command",
    "process_name", "raw", "label_scenario",
]
_SCORE_COLS = [
    "score_id", "ts", "entity_id", "role", "tier", "node_id", "risk_score",
    "event_score", "rule_signals", "ml_anomaly", "categories", "contributors",
    "event_id",
]

# live counters for the /stats endpoint
STATS = {"events": 0, "alerts": 0, "signals": 0, "started": time.time()}

_event_buf: list[list] = []
_score_buf: list[list] = []
_last_flush = time.time()
_stop = False


def _event_row(ev: dict) -> list:
    return [
        uuid.UUID(ev["event_id"]) if ev.get("event_id") else uuid.uuid4(),
        ev["ts"], ev["tier"], ev["node_id"], ev.get("unit_id", ""), ev["entity_id"],
        ev["role"], ev.get("endpoint_id", ""), ev.get("os", ""), ev["category"],
        ev.get("activity", ""), float(ev["egress_mb"]), ev["dest_class"],
        int(ev["files_accessed"]), int(ev["endpoints_touched"]), int(ev["usb_event"]),
        int(ev["privilege_change"]), int(ev["config_change"]), int(ev["login_hour"]),
        ev.get("src_ip", ""), ev.get("src_geo", ""), ev.get("command", ""),
        ev.get("process_name", ""), "", ev.get("label_scenario", "normal"),
    ]


async def _flush(force=False):
    global _event_buf, _score_buf, _last_flush
    now = time.time()
    if not force and len(_event_buf) < settings.CH_FLUSH_EVENTS and \
            (now - _last_flush) < settings.CH_FLUSH_SECONDS:
        return
    ev_rows, _event_buf = _event_buf, []
    sc_rows, _score_buf = _score_buf, []
    _last_flush = now
    try:
        await ch_insert("trinetra.events", ev_rows, _EVENT_COLS)
        await ch_insert("trinetra.risk_scores", sc_rows, _SCORE_COLS)
    except Exception as e:
        print(f"[consumer] clickhouse flush error: {e}", flush=True)


# warm-up: first N consumed events only TRAIN the UEBA baseline; no scoring,
# no risk accrual, no cases — so cold-start jitter never pegs entities. Matches
# the §10.2 baseline warm-up period (here compressed for the demo).
WARMUP_CONSUME = int(__import__("os").getenv("WARMUP_CONSUME", "4000"))


async def _handle(raw: dict):
    ev = normalize(raw)
    if ev is None:
        return
    ev = enrich(ev)

    # ML call trains the per-role baseline online on every observation.
    ml = await ml_client.score(ev)
    STATS["events"] += 1

    # During warm-up, feed baselines but do not score/alert.
    if STATS["events"] <= WARMUP_CONSUME:
        _event_buf.append(_event_row(ev))
        if STATS["events"] == WARMUP_CONSUME:
            print(f"[consumer] warm-up complete ({WARMUP_CONSUME} events); "
                  f"baseline trained, scoring enabled", flush=True)
        return

    # parallel detection: rules (sync, cheap) + ML anomaly (already fetched)
    signals = evaluate(ev)
    score = score_event(ev, signals, ml)
    STATS["signals"] += len(signals)

    _event_buf.append(_event_row(ev))
    _score_buf.append([
        uuid.uuid4(), ev["ts"], ev["entity_id"], ev["role"], ev["tier"], ev["node_id"],
        score["entity_risk"], score["event_score"], score["rule_signals"],
        score["ml_anomaly"], score["categories"], score["contributors"],
        uuid.UUID(ev["event_id"]) if ev.get("event_id") else uuid.uuid4(),
    ])

    await update_entity_risk(ev["entity_id"], score["entity_risk"])

    # push notable events live (anything with a signal or elevated risk)
    if signals or score["event_score"] >= 20:
        await hub.broadcast("event", {
            "entity_id": ev["entity_id"], "display_name": ev.get("display_name"),
            "role": ev["role"], "node_id": ev["node_id"], "tier": ev["tier"],
            "category": ev["category"], "activity": ev.get("activity"),
            "event_score": score["event_score"], "entity_risk": score["entity_risk"],
            "categories": score["categories"], "ml_anomaly": score["ml_anomaly"],
            "ts": ev["ts"].isoformat(),
        })

    case = await upsert_case(ev, score)
    if case:
        if case.get("_new"):
            STATS["alerts"] += 1
        await hub.broadcast("case", {
            "case_id": case["case_id"], "entity_id": case["entity_id"],
            "role": case["role"], "node_id": case["node_id"], "tier": case["tier"],
            "severity": case["severity"], "risk_score": case["risk_score"],
            "categories": list(case["categories"]), "title": case["title"],
            "status": case["status"], "is_new": case.get("_new", False),
        })


async def run_consumer():
    global _stop
    consumer = AIOKafkaConsumer(
        settings.TOPIC_RAW,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP,
        group_id=settings.CONSUMER_GROUP,
        auto_offset_reset="earliest",
        value_deserializer=lambda b: orjson.loads(b),
        enable_auto_commit=True,
    )
    # retry until Kafka is up
    for _ in range(30):
        try:
            await consumer.start()
            break
        except Exception as e:
            print(f"[consumer] waiting for kafka: {e}", flush=True)
            await asyncio.sleep(2)
    else:
        print("[consumer] could not connect to kafka; giving up", flush=True)
        return

    print("[consumer] started; consuming telemetry", flush=True)
    try:
        while not _stop:
            try:
                batch = await consumer.getmany(timeout_ms=500, max_records=200)
            except Exception as e:
                import traceback
                print(f"[consumer] poll error: {e}", flush=True)
                traceback.print_exc()
                await asyncio.sleep(1)
                continue
            for _tp, msgs in batch.items():
                for m in msgs:
                    try:
                        await _handle(m.value)
                    except Exception as e:
                        print(f"[consumer] handle error: {e}", flush=True)
            await _flush()
    finally:
        await _flush(force=True)
        await consumer.stop()
        print("[consumer] stopped", flush=True)


def stop():
    global _stop
    _stop = True
