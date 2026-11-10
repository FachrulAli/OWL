"""TRINETRA telemetry simulator.

Generates a continuous stream of synthetic endpoint/log telemetry for the
seeded entity roster and publishes it to Kafka topic `trinetra.telemetry.raw`.
Replaces real eBPF/ETW/Osquery agents for the hackathon demo while producing
the same OCSF-aligned event shape the pipeline expects.

Normal traffic dominates; anomaly scenarios are injected at ANOMALY_RATE so the
detector must separate signal from noise. An initial warm-up burst seeds the
baseline quickly so the demo doesn't need to wait 7-14 days.
"""
import json
import os
import random
import time
import uuid
from datetime import datetime, timezone

from confluent_kafka import Producer

from roles import ENTITIES, ROLE_PROFILES, NORMAL_GEO, OFFICE_SUBNETS
from scenarios import SCENARIOS, apply_scenario

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
TOPIC = os.getenv("TOPIC", "trinetra.telemetry.raw")
EPS = float(os.getenv("EVENTS_PER_SECOND", "40"))
WARMUP_EVENTS = int(os.getenv("WARMUP_EVENTS", "4000"))

# Insider threat = a FEW bad actors among many normal users. We concentrate
# anomalous behavior on a small designated set of "insiders" (each with a
# signature scenario for a coherent investigation story); everyone else stays
# within baseline. This is both realistic and gives the dashboard clear
# signal-vs-noise contrast.
INSIDER_ANOMALY_RATE = float(os.getenv("INSIDER_ANOMALY_RATE", "0.14"))
# tiny background rate for normal users (occasional benign-looking deviation
# that decays and should NOT escalate to a case) — proves low false positives.
NOISE_ANOMALY_RATE = float(os.getenv("NOISE_ANOMALY_RATE", "0.004"))

# entity_id -> preferred scenario (story-driven); these are the insiders.
INSIDERS = {
    "usr-admin-02":  "data_exfiltration",   # admin pusat membocorkan data besar
    "usr-kodam-5":   "lateral_movement",    # analis Kodam V/Brawijaya (Surabaya)
    "usr-kodam-14":  "config_tampering",    # operator Kodam XIV/Hasanuddin (Makassar)
    "usr-kodam-17":  "usb_exfiltration",    # personel Kodam XVII/Cenderawasih (Papua)
}


def _clip(v, lo=0):
    return max(lo, v)


def _norm_ip():
    return random.choice(OFFICE_SUBNETS) + f"{random.randint(1,254)}.{random.randint(1,254)}"


def base_event(entity, warmup=False) -> dict:
    entity_id, role, node_id, tier, os_name = entity
    prof = ROLE_PROFILES[role]
    lo, hi = prof["login_hours"]
    category = random.choices(
        ["process", "file", "network", "logon", "config"],
        weights=[3, 3, 2, 1, 1],
    )[0]
    return {
        "event_id": str(uuid.uuid4()),
        "ts": datetime.now(timezone.utc).isoformat(),
        "tier": tier,
        "node_id": node_id,
        "unit_id": node_id if tier == 2 else "",
        "entity_id": entity_id,
        "role": role,
        "endpoint_id": f"{entity_id}-host",
        "os": os_name,
        "category": category,
        "activity": "normal_activity",
        "egress_mb": round(_clip(random.gauss(*prof["egress_mb"])), 2),
        "dest_class": "internal",
        "files_accessed": int(_clip(random.gauss(*prof["files_accessed"]))),
        "endpoints_touched": int(_clip(random.gauss(*prof["endpoints_touched"]))),
        "usb_event": 1 if random.random() < prof["usb_rate"] else 0,
        "privilege_change": 1 if random.random() < prof["privilege_rate"] else 0,
        "config_change": 1 if random.random() < prof["config_rate"] else 0,
        "login_hour": random.randint(int(lo), int(hi)),
        "src_ip": _norm_ip(),
        "src_geo": NORMAL_GEO,
        "command": random.choice(prof["commands"]),
        "process_name": random.choice(prof["processes"]),
        "label_scenario": "normal",
    }


def delivery_cb(err, msg):
    if err is not None:
        print(f"[simulator] delivery failed: {err}", flush=True)


def main():
    producer = Producer({
        "bootstrap.servers": KAFKA_BOOTSTRAP,
        "linger.ms": 50,
        "compression.type": "lz4",
    })
    print(f"[simulator] producing to {KAFKA_BOOTSTRAP} topic={TOPIC} "
          f"eps={EPS} insiders={list(INSIDERS)}", flush=True)

    # Warm-up: emit a burst of normal-only traffic so baselines form fast.
    print(f"[simulator] warm-up: {WARMUP_EVENTS} normal events...", flush=True)
    for i in range(WARMUP_EVENTS):
        ev = base_event(random.choice(ENTITIES), warmup=True)
        producer.produce(TOPIC, key=ev["entity_id"], value=json.dumps(ev),
                         callback=delivery_cb)
        if i % 500 == 0:
            producer.poll(0)
    producer.flush()
    print("[simulator] warm-up complete; streaming live traffic.", flush=True)

    scenario_keys = list(SCENARIOS.keys())
    interval = 1.0 / EPS if EPS > 0 else 0.025
    n = 0
    while True:
        entity = random.choice(ENTITIES)
        entity_id = entity[0]
        ev = base_event(entity)
        if entity_id in INSIDERS and random.random() < INSIDER_ANOMALY_RATE:
            # 70% their signature scenario, 30% a random one (insiders drift)
            scenario = (INSIDERS[entity_id] if random.random() < 0.7
                        else random.choice(scenario_keys))
            ev = apply_scenario(ev, scenario)
        elif random.random() < NOISE_ANOMALY_RATE:
            ev = apply_scenario(ev, random.choice(scenario_keys))
        producer.produce(TOPIC, key=ev["entity_id"], value=json.dumps(ev),
                         callback=delivery_cb)
        n += 1
        if n % 100 == 0:
            producer.poll(0)
            print(f"[simulator] produced {n} live events", flush=True)
        time.sleep(interval)


if __name__ == "__main__":
    while True:
        try:
            main()
        except Exception as e:  # keep the simulator resilient during demos
            print(f"[simulator] error: {e}; retrying in 5s", flush=True)
            time.sleep(5)
