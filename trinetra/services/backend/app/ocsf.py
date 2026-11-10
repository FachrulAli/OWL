"""OCSF-aligned normalization (§10.1 FR-03).

The simulator already emits a near-normalized shape; a real deployment would
have per-source adapters (Windows Event Log, Syslog, auditd, AD, proxy) here.
This module validates/coerces fields and maps category -> OCSF class uid so
downstream components have a stable schema.
"""
from datetime import datetime, timezone

# category -> (ocsf_class_uid, ocsf_class_name) — subset of OCSF class taxonomy
OCSF_CLASS = {
    "process": (1007, "Process Activity"),
    "file":    (1001, "File System Activity"),
    "network": (4001, "Network Activity"),
    "logon":   (3002, "Authentication"),
    "usb":     (1004, "Device Activity"),
    "config":  (6003, "Configuration Change"),
}

_NUM_DEFAULTS = {
    "egress_mb": 0.0, "files_accessed": 0, "endpoints_touched": 0,
    "usb_event": 0, "privilege_change": 0, "config_change": 0, "login_hour": 0,
}
_STR_DEFAULTS = {
    "dest_class": "internal", "src_ip": "", "src_geo": "", "command": "",
    "process_name": "", "activity": "", "unit_id": "", "os": "",
    "label_scenario": "normal", "endpoint_id": "",
}


def normalize(raw: dict) -> dict | None:
    """Return a normalized event dict, or None if the event is unusable."""
    try:
        entity_id = raw["entity_id"]
        role = raw["role"]
        node_id = raw["node_id"]
    except KeyError:
        return None

    category = raw.get("category", "process")
    class_uid, class_name = OCSF_CLASS.get(category, (0, "Unknown"))

    ts = raw.get("ts")
    try:
        dt = datetime.fromisoformat(ts) if ts else datetime.now(timezone.utc)
    except (ValueError, TypeError):
        dt = datetime.now(timezone.utc)

    ev = {
        "event_id": raw.get("event_id"),
        "ts": dt.astimezone(timezone.utc),
        "tier": int(raw.get("tier", 2)),
        "node_id": node_id,
        "entity_id": entity_id,
        "role": role,
        "category": category,
        "ocsf_class_uid": class_uid,
        "ocsf_class_name": class_name,
    }
    for k, d in _NUM_DEFAULTS.items():
        v = raw.get(k, d)
        ev[k] = type(d)(v) if v is not None else d
    for k, d in _STR_DEFAULTS.items():
        ev[k] = str(raw.get(k, d) or d)
    # derived: off-hours flag (late night / pre-dawn) used by rules + UEBA
    ev["off_hours"] = 1 if (ev["login_hour"] < 6 or ev["login_hour"] >= 22) else 0
    return ev
