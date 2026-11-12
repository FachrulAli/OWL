"""Simulator telemetri MOBILE (mode MTD) — fleet HP prajurit.

Menghasilkan arus telemetri HP yang didominasi perilaku normal, lalu menyuntik
rantai zero-click/spyware pada beberapa HP yang "dikompromikan". Dipakai sebagai
pengganti agent nyata untuk demo; agent Android asli mengirim event dengan
BENTUK YANG SAMA ke endpoint /ingest/mobile, jadi pipeline tidak tahu bedanya.

Prinsip demo: hanya HP yang memang disuntik rantai yang boleh naik ke kritis.
HP lain (termasuk `pama_siber` yang perilakunya memang berat & aneh tapi sah)
harus tetap nol — itu bukti false positive rendah.
"""
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from devices import DEVICES, ROLE_PROFILES, NORMAL_ASN, NORMAL_DOMAINS, NET_GEN
from mobile_scenarios import MOBILE_SCENARIOS, apply_mobile_scenario

# HP yang dikompromikan + rantai khasnya (cerita investigasi yang koheren).
COMPROMISED = {
    "hp-pusat-pangti": "zeroclick_imessage",    # iPhone pejabat tinggi — kelas Pegasus
    "hp-kodam-17-01":  "zeroclick_whatsapp",    # Pamen Intel Cenderawasih (Papua)
    "hp-kodam-2-01":   "zeroclick_sms_wap",     # Bintara Komlek Sriwijaya — SMS biner
    "hp-kodam-12-01":  "sideload_rat",          # Prajurit Tanjungpura — APK sideload
    "hp-kodam-24-01":  "ioc_c2_beacon",         # Pamen Intel Mandala Trikora — IOC Amnesty
    "hp-kodam-9-01":   "imsi_catcher",          # Bintara Komlek Udayana — fake BTS
}

# Peluang satu HP terkompromi memunculkan rantai pada satu putaran.
CHAIN_RATE = float(os.getenv("CHAIN_RATE", "0.055"))
# Derau: HP normal kadang berperilaku agak menyimpang TAPI tidak membentuk
# rantai utuh — harus tetap tidak jadi kasus.
BENIGN_ODDITY_RATE = float(os.getenv("BENIGN_ODDITY_RATE", "0.02"))

_DEV_BY_ID = {d[0]: d for d in DEVICES}


def _clip(v, lo=0.0):
    return max(lo, v)


def base_event(device, ts: datetime | None = None, quiet: bool = False) -> dict:
    """Satu sampel telemetri normal dari satu HP.

    quiet=True -> hanya kerangka telemetri, TANPA aktivitas normal acak
    (pesan masuk, mikrofon, crash aplikasi, pemasangan app). Dipakai sebagai
    dasar tahap skenario: kalau tidak, sebuah tahap rantai bisa mewarisi
    mikrofon-menyala acak dan ikut menyalakan aturan yang bukan bagian dari
    skenario itu — membuat data demo tidak jujur dan hasil uji menyesatkan.
    """
    device_id, role, node_id, tier, platform, os_version, model = device
    p = ROLE_PROFILES[role]
    lo, hi = p["active_hours"]

    screen_on = 1 if random.random() < p["screen_on_rate"] else 0
    fg = random.choice(p["apps"]) if screen_on else ""
    category = random.choices(
        ["net", "power", "msg", "media", "proc", "pkg", "integrity", "radio"],
        weights=[34, 22, 14, 8, 10, 4, 4, 4],
    )[0]

    ev = {
        "event_id": str(uuid.uuid4()),
        "ts": (ts or datetime.now(timezone.utc)).isoformat(),
        "domain": "mobile",
        "tier": tier,
        "node_id": node_id,
        "unit_id": node_id if tier >= 1 else "",
        "entity_id": device_id,
        "role": role,
        "endpoint_id": device_id,
        "os": f"{platform}-{os_version}",
        "platform": platform,
        "os_version": os_version,
        "device_model": model,
        "category": category,
        "activity": "normal_telemetry",

        # --- konteks interaksi (inti pembeda zero-click) ---
        "screen_on": screen_on,
        "user_interaction": 1 if screen_on and random.random() < 0.85 else 0,
        "foreground_app": fg,

        # --- jaringan ---
        "egress_mb": round(_clip(random.gauss(*p["egress_mb"])), 3),
        "ingress_mb": round(_clip(random.gauss(*p["ingress_mb"])), 3),
        "dest_class": "internal",
        "dest_asn": random.choice(NORMAL_ASN),
        "dns_domain": random.choice(NORMAL_DOMAINS),
        "beacon_interval_s": 0,
        "tls_mitm": 0,

        # --- daya & beban ---
        "thermal_state": max(0, min(4, int(round(random.gauss(p["thermal_mean"], 0.6))))),
        "battery_drop_pct": round(_clip(random.gauss(*p["battery_drop"])), 2),
        "cpu_pct": round(_clip(random.gauss(*p["cpu_pct"])), 1),

        # --- pesan masuk (METADATA saja, tanpa isi) ---
        "inbound_msg": 0,
        "sender_known": 1,
        "notified": 1,
        "msg_app": "",
        "msg_has_attachment": 0,
        "msg_binary": 0,

        # --- sensor ---
        "mic_active": 0,
        "cam_active": 0,

        # --- proses ---
        "crash_proc": "",
        "crash_count": 0,
        "crash_reason": "",

        # --- aplikasi ---
        "pkg_added": 0,
        "pkg_name": "",
        "pkg_sha256": "",
        "pkg_hidden": 0,
        "installer_source": "",
        "perm_sensitive": 0,
        "accessibility_granted": 0,
        "device_admin_granted": 0,

        # --- integritas perangkat ---
        "integrity_fail": 0,
        "config_change": 0,
        "profile_added": 0,
        "profile_trusted": 1,
        "tamper_detail": "",
        "patch_age_days": random.randint(3, 95),

        # --- radio seluler ---
        "net_gen": random.choice(NET_GEN),
        "cell_unknown": 0,
        "cell_encryption": 1,
        "radio_anomaly": 0,

        # --- korelasi rantai ---
        "chain_id": "",
        "chain_stage": "",
        "chain_step": 0,
        "chain_len": 0,

        "login_hour": random.randint(int(lo), min(23, int(hi))),
        "src_geo": "ID",
        "label_scenario": "normal",
    }

    if quiet:
        return ev

    # Perilaku normal yang spesifik per kategori.
    if category == "msg" and random.random() < p["msg_rate"] * 3:
        ev["inbound_msg"] = 1
        ev["msg_app"] = random.choice(p["msg_apps"])
        # Pesan dari nomor tak dikenal itu NORMAL (protokoler, ojol, bank).
        # Yang tidak normal adalah pesan tak dikenal + senyap + diikuti crash.
        ev["sender_known"] = 0 if random.random() < p["unknown_sender_rate"] else 1
        ev["notified"] = 1                       # notifikasi sah selalu tampil
        ev["msg_has_attachment"] = 1 if random.random() < 0.25 else 0
    elif category == "media":
        # Mikrofon/kamera menyala saat layar NYALA = pemakaian sah.
        if random.random() < p["mic_rate"] * 6:
            ev["mic_active"] = 1
            ev["screen_on"] = 1
            ev["user_interaction"] = 1
            ev["foreground_app"] = random.choice(p["apps"])
        elif random.random() < p["cam_rate"] * 6:
            ev["cam_active"] = 1
            ev["screen_on"] = 1
            ev["user_interaction"] = 1
            ev["foreground_app"] = random.choice(p["apps"])
    elif category == "proc" and random.random() < 0.06:
        # Aplikasi biasa memang kadang crash — tapi bukan proses parser OS,
        # dan tidak diikuti lonjakan panas + egress saat layar mati.
        ev["crash_proc"] = random.choice(p["apps"])
        ev["crash_count"] = 1
        ev["crash_reason"] = random.choice(["ANR", "LOW_MEMORY", "USER_REQUESTED"])
    elif category == "pkg" and random.random() < 0.12:
        # Update aplikasi dari toko resmi = sah.
        ev["pkg_added"] = 1
        ev["pkg_name"] = random.choice(p["apps"])
        ev["installer_source"] = ("com.apple.AppStore" if platform == "ios"
                                  else "com.android.vending")
        ev["screen_on"] = 1
        ev["user_interaction"] = 1

    return ev


def benign_oddity(ev: dict) -> dict:
    """Penyimpangan jinak: satu indikator menyala, tapi TIDAK membentuk rantai.

    Ini yang membedakan detektor bagus dari detektor berisik. Contoh nyata:
    backup iCloud tengah malam (egress besar, layar mati) — satu indikator saja,
    tanpa pesan senyap dan tanpa crash parser sebelumnya.
    """
    kind = random.choice(["night_backup", "hot_charging", "big_update", "odd_hour_msg"])
    ev["label_scenario"] = "benign_oddity"
    if kind == "night_backup":
        ev["category"] = "net"
        ev["activity"] = "cloud_backup"
        ev["screen_on"] = 0
        ev["egress_mb"] = round(random.uniform(40, 220), 1)
        ev["dns_domain"] = random.choice(["gateway.icloud.com", "backup.googleapis.com"])
        ev["dest_asn"] = random.choice(["AS714 Apple", "AS15169 Google"])
    elif kind == "hot_charging":
        ev["category"] = "power"
        ev["activity"] = "thermal_while_charging"
        ev["thermal_state"] = 3
        ev["charging"] = 1
        ev["battery_drop_pct"] = 0.0          # sedang dicas: bukan pengurasan
    elif kind == "big_update":
        ev["category"] = "pkg"
        ev["activity"] = "store_update_large"
        ev["pkg_added"] = 1
        ev["ingress_mb"] = round(random.uniform(150, 900), 1)
        ev["installer_source"] = "com.android.vending"
        ev["screen_on"] = 1
        ev["user_interaction"] = 1
    else:
        ev["category"] = "msg"
        ev["activity"] = "inbound_msg_odd_hour"
        ev["inbound_msg"] = 1
        ev["sender_known"] = 0
        ev["notified"] = 1                    # ADA notifikasi -> bukan zero-click
        ev["login_hour"] = random.choice([1, 2, 3])
    return ev


def make_batch() -> list[dict]:
    """Satu putaran simulasi: beberapa event normal, kadang satu rantai utuh."""
    out = []
    device = random.choice(DEVICES)
    device_id = device[0]

    if device_id in COMPROMISED and random.random() < CHAIN_RATE:
        scenario = COMPROMISED[device_id]
        _cats, _label, stages = MOBILE_SCENARIOS[scenario]
        n = len(stages)
        # Rantai nyata berjalan dalam detik sampai beberapa menit. Beri jarak
        # waktu antar tahap supaya engine korelasi temporal_ordered teruji
        # betul-betul pada urutan waktu, bukan urutan kedatangan.
        gaps = [random.randint(3, 45) for _ in range(n)]
        total = sum(gaps)
        start = datetime.now(timezone.utc) - timedelta(seconds=total)

        cursor = {"t": start}

        def mk():
            cursor["t"] = cursor["t"] + timedelta(seconds=gaps.pop(0) if gaps else 5)
            return base_event(device, ts=cursor["t"], quiet=True)

        out.extend(apply_mobile_scenario(mk, scenario, device[4]))
    else:
        ev = base_event(device)
        if random.random() < BENIGN_ODDITY_RATE:
            ev = benign_oddity(ev)
        out.append(ev)
    return out


def warmup_event() -> dict:
    """Event normal murni untuk fase pelatihan baseline."""
    return base_event(random.choice(DEVICES))
