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

# Kategori telemetri MOBILE -> kelas OCSF. Dipisah supaya domain endpoint
# (insider threat) dan domain mobile (MTD) tidak saling mengganggu.
OCSF_CLASS_MOBILE = {
    "net":       (4001, "Network Activity"),
    "power":     (1004, "Device Activity"),
    "msg":       (4011, "Email Activity"),          # pesan masuk (metadata)
    "media":     (1004, "Device Activity"),         # akses mikrofon/kamera
    "proc":      (1007, "Process Activity"),
    "pkg":       (1009, "Module Activity"),         # pemasangan aplikasi
    "integrity": (6003, "Configuration Change"),
    "radio":     (4001, "Network Activity"),
}

# Default field khusus MOBILE. Semuanya wajib ada agar rule & UEBA stabil.
_MOB_NUM = {
    "screen_on": 0, "user_interaction": 0, "ingress_mb": 0.0, "thermal_state": 0,
    "battery_drop_pct": 0.0, "cpu_pct": 0.0, "inbound_msg": 0, "sender_known": 1,
    "notified": 1, "msg_has_attachment": 0, "msg_binary": 0, "mic_active": 0,
    "cam_active": 0, "crash_count": 0, "pkg_added": 0, "pkg_hidden": 0,
    "perm_sensitive": 0, "accessibility_granted": 0, "device_admin_granted": 0,
    "integrity_fail": 0, "profile_added": 0, "profile_trusted": 1,
    "patch_age_days": 0, "cell_unknown": 0, "cell_encryption": 1,
    "radio_anomaly": 0, "beacon_interval_s": 0, "tls_mitm": 0, "charging": 0,
    "chain_step": 0, "chain_len": 0,
}
_MOB_STR = {
    "platform": "", "os_version": "", "device_model": "", "foreground_app": "",
    "dest_asn": "", "dest_ip": "", "dns_domain": "", "msg_app": "",
    "crash_proc": "",
    "crash_reason": "", "pkg_name": "", "pkg_sha256": "",
    "installer_source": "",
    "tamper_detail": "", "net_gen": "", "chain_id": "", "chain_stage": "",
}

# Proses parser OS yang menangani masukan dari luar tanpa interaksi pengguna.
# Crash pada proses INI adalah penanda kuat tahap eksploitasi zero-click;
# crash pada aplikasi biasa tidak.
PARSER_PROCS = {
    "imtransferagent", "messagesblastdoorservice", "mediaserverd",
    "webkit.networking", "identityservicesd", "media.codec", "mediaserver",
    "com.android.bluetooth", "webview_zygote", "com.whatsapp:voip",
    "com.android.phone", "surfaceflinger",
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

    domain = str(raw.get("domain", "endpoint")).lower()
    category = raw.get("category", "net" if domain == "mobile" else "process")
    table = OCSF_CLASS_MOBILE if domain == "mobile" else OCSF_CLASS
    class_uid, class_name = table.get(category, (0, "Unknown"))

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
        "domain": domain,
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

    if domain != "mobile":
        return ev

    for k, d in _MOB_NUM.items():
        v = raw.get(k, d)
        try:
            ev[k] = type(d)(v) if v is not None else d
        except (TypeError, ValueError):
            ev[k] = d
    for k, d in _MOB_STR.items():
        ev[k] = str(raw.get(k, d) or d)

    # ---- field turunan: inilah yang membuat rule Sigma tetap sederhana ----
    # idle = HP tidak sedang dipakai siapa pun. Hampir semua aktivitas sah
    # yang terlihat "mencurigakan" sebenarnya terjadi saat idle == 0.
    ev["idle"] = 1 if (ev["screen_on"] == 0 and ev["user_interaction"] == 0) else 0
    # pesan masuk dari pengirim tak dikenal yang TIDAK memunculkan notifikasi
    # dan tiba saat HP idle = pola pengiriman zero-click.
    ev["silent_inbound"] = 1 if (
        ev["inbound_msg"] == 1 and ev["sender_known"] == 0
        and ev["notified"] == 0 and ev["idle"] == 1) else 0
    # crash pada proses parser OS saat idle = penanda tahap eksploitasi.
    ev["parser_crash"] = 1 if (
        ev["crash_proc"].lower() in PARSER_PROCS and ev["idle"] == 1) else 0
    # mikrofon/kamera hidup tanpa aplikasi di depan & HP idle = penyadapan.
    ev["covert_sensor"] = 1 if (
        (ev["mic_active"] == 1 or ev["cam_active"] == 1)
        and ev["idle"] == 1 and not ev["foreground_app"]) else 0
    # trafik keluar saat idle (dipakai rule + UEBA sebagai fitur utama).
    ev["idle_egress_mb"] = ev["egress_mb"] if ev["idle"] == 1 else 0.0
    # panas/boros padahal idle dan tidak sedang dicas.
    ev["idle_thermal"] = 1 if (
        ev["idle"] == 1 and ev["charging"] == 0 and ev["thermal_state"] >= 3) else 0
    # aplikasi dipasang dari luar toko resmi.
    ev["sideloaded"] = 1 if (
        ev["pkg_added"] == 1 and ev["installer_source"] not in
        ("com.android.vending", "com.apple.AppStore", "")) else 0
    return ev
