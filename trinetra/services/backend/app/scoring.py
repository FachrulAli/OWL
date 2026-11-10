"""Risk Scoring Engine (§10.4 FR-11..13).

Fuses deterministic rule signals + ML/UEBA anomaly into a single event score,
weights it by role, and maintains a time-decayed cumulative entity risk (0..100).
Multi-signal correlation (rule AND ml agreeing) boosts confidence and reduces
false positives.
"""
import json
import math
from datetime import datetime, timezone

from .config import settings

# in-memory entity risk state: entity_id -> (risk, last_ts)
_entity_risk: dict[str, tuple[float, datetime]] = {}


def _decay(prev: float, last_ts: datetime, now: datetime) -> float:
    if last_ts is None:
        return prev
    minutes = max(0.0, (now - last_ts).total_seconds() / 60.0)
    factor = 0.5 ** (minutes / settings.DECAY_HALF_LIFE_MIN)
    return prev * factor


def seed_entity_risk(entity_id: str, risk: float):
    _entity_risk[entity_id] = (risk, datetime.now(timezone.utc))


def score_event(ev: dict, signals: list[dict], ml: dict) -> dict:
    """Compute the event score + updated cumulative entity risk."""
    now = ev["ts"] if isinstance(ev.get("ts"), datetime) else datetime.now(timezone.utc)
    role_weight = float(ev.get("role_weight", 1.0))

    # --- rule contribution ---
    rule_component = 0.0
    categories = set()
    contributors = []
    for s in signals:
        rule_component += s["severity"]
        categories.add(s["category"])
        contributors.append({"type": "rule", "id": s["rule_id"],
                             "title": s["title"], "weight": s["severity"]})
    # diminishing returns on stacked rules
    rule_component = 100.0 * (1 - math.exp(-rule_component / 60.0))

    # --- ml contribution ---
    anomaly = float(ml.get("anomaly", 0.0))          # 0..1
    peer_dev = float(ml.get("peer_deviation", 0.0))
    ml_component = 100.0 * anomaly
    if anomaly > 0.2:
        contributors.append({"type": "ml", "id": ml.get("model", "ueba"),
                             "title": f"UEBA anomaly {anomaly:.2f} (peer dev {peer_dev:.1f}σ)",
                             "weight": round(ml_component, 1)})

    # --- fusion (§9.1 two parallel engines -> risk scoring) ---
    base = 0.6 * rule_component + 0.4 * ml_component
    # multi-signal agreement boost: both engines fired -> higher confidence
    if signals and anomaly > 0.5:
        base = min(100.0, base * 1.25)
        contributors.append({"type": "fusion", "id": "multi_signal",
                             "title": "Rule + UEBA agreement", "weight": round(base * 0.25, 1)})

    event_score = min(100.0, base * (0.7 + 0.3 * role_weight))

    # --- cumulative decayed entity risk ---
    prev, last_ts = _entity_risk.get(ev["entity_id"], (0.0, None))
    decayed = _decay(prev, last_ts, now)
    # Only notable events accrue risk; steady low-level/normal activity must not
    # drift an entity upward (that would make everyone eventually critical).
    MIN_ACCRUE = 20.0
    # Cap a single event's contribution so one blip can't peg an entity to
    # critical — real insider risk builds from REPEATED deviation (so ~3+
    # anomalous events to reach critical), which also absorbs transient FPs.
    PER_EVENT_CAP = 35.0
    if event_score >= MIN_ACCRUE:
        contribution = min(event_score, PER_EVENT_CAP)
        new_risk = min(100.0, decayed + contribution * (1 - decayed / 100.0))
    else:
        new_risk = decayed            # just let prior risk decay
    _entity_risk[ev["entity_id"]] = (new_risk, now)

    return {
        "event_score": round(event_score, 1),
        "entity_risk": round(new_risk, 1),
        "categories": sorted(categories),
        "ml_anomaly": round(anomaly, 3),
        "rule_signals": len(signals),
        "contributors": json.dumps(contributors),
    }


def entity_risk(entity_id: str) -> float:
    prev, last_ts = _entity_risk.get(entity_id, (0.0, None))
    return round(_decay(prev, last_ts, datetime.now(timezone.utc)), 1)


def severity_from_risk(risk: float) -> str:
    if risk >= settings.CRITICAL_THRESHOLD:
        return "critical"
    if risk >= settings.ALERT_THRESHOLD:
        return "high"
    if risk >= 30:
        return "medium"
    return "low"
