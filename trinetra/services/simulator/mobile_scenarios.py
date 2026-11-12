"""8 skenario ancaman MOBILE (domain MTD) — termasuk 3 rantai zero-click.

Perbedaan penting dari skenario insider: zero-click TIDAK bisa diwakili satu
event. Yang membuatnya terdeteksi adalah URUTAN beberapa event dalam jendela
waktu pendek sementara layar mati dan tanpa interaksi pengguna. Karena itu
setiap skenario di sini mengembalikan DAFTAR event berurutan (rantai), masing-
masing diberi `chain_id` + `chain_stage` supaya engine korelasi Sigma
(temporal_ordered) punya bahan dan dashboard bisa menggambar timeline kill-chain.

CATATAN: ini telemetri sintetis yang MENDESKRIPSIKAN perilaku pasca-eksploitasi
untuk menguji detektor (blue team). Tidak ada exploit, payload, atau kode
serangan apa pun di sini.
"""
import random
import uuid

# scenario -> (kategori anomali, label, tahapan kill-chain)
MOBILE_SCENARIOS = {
    "zeroclick_imessage": (
        ["zero_click_exploit", "spyware_implant", "covert_exfiltration"],
        "Zero-click via iMessage (kelas Pegasus) — tanpa interaksi korban",
        ["delivery", "exploit", "implant", "c2", "collection"],
    ),
    "zeroclick_whatsapp": (
        ["zero_click_exploit", "spyware_implant", "covert_exfiltration"],
        "Zero-click via panggilan WhatsApp — eksploitasi parser media",
        ["delivery", "exploit", "implant", "c2"],
    ),
    "zeroclick_sms_wap": (
        ["zero_click_exploit", "persistence", "c2_beacon"],
        "Zero-click via SMS biner / WAP-push operator — tanpa notifikasi",
        ["delivery", "exploit", "persistence", "c2"],
    ),
    "sideload_rat": (
        ["malicious_app", "spyware_implant", "covert_exfiltration"],
        "APK sideload berisi RAT (kelas SpyNote/CraxsRAT)",
        ["install", "privilege", "collection", "c2"],
    ),
    "stalkerware_persist": (
        ["spyware_implant", "covert_surveillance"],
        "Stalkerware persisten — mikrofon/kamera aktif diam-diam",
        ["implant", "collection", "collection"],
    ),
    "ioc_c2_beacon": (
        ["c2_beacon", "spyware_implant"],
        "Beacon ke infrastruktur spyware yang sudah dikenal (IOC Amnesty)",
        ["c2", "c2"],
    ),
    "rogue_profile_mitm": (
        ["device_tampering", "mitm"],
        "Profil MDM / sertifikat jahat terpasang — penyadapan TLS",
        ["install", "tampering", "mitm"],
    ),
    "imsi_catcher": (
        ["radio_attack", "device_tampering"],
        "Indikasi IMSI catcher / fake BTS — penurunan paksa ke 2G",
        ["radio", "radio"],
    ),
}

# Proses parser yang jadi korban eksploitasi memori pada rantai zero-click.
# Ini NAMA PROSES SAH milik OS — yang dicurigai adalah crash-nya, bukan prosesnya.
IOS_PARSER_PROCS = ["IMTransferAgent", "MessagesBlastDoorService", "mediaserverd",
                    "WebKit.Networking", "identityservicesd"]
ANDROID_PARSER_PROCS = ["media.codec", "mediaserver", "com.android.bluetooth",
                        "webview_zygote", "com.whatsapp:voip"]

# Domain/ASN mencurigakan: domain baru-terdaftar, ASN hosting murah, bukan CDN.
SUSPECT_ASN = ["AS-UNKNOWN", "AS200019 Alexhost", "AS51167 Contabo",
               "AS14061 DigitalOcean", "AS210644 AEZA", "AS49581 Ferdinand"]
SUSPECT_DOMAINS = ["cdn-sync-{r}.xyz", "api-update-{r}.top", "mail-relay-{r}.cc",
                   "static-asset-{r}.icu", "push-gw-{r}.shop"]

# Contoh indikator kelas Pegasus/Predator (placeholder; saat runtime backend
# memuat daftar sebenarnya dari STIX2 `mvt-indicators`, lisensi MIT).
# Domain NYATA dari daftar indikator Amnesty/MVT (lihat
# infra/indicators/ATTRIBUTION.md). Dipakai agar skenario ioc_c2_beacon
# benar-benar diuji terhadap daftar indikator sungguhan, bukan terhadap
# domain karangan yang kebetulan ada di daftar kita sendiri.
KNOWN_IOC_DOMAINS = [
    "weather4free.com",
    "smscentro.com",
    "tookcheckout.com",
    "oneleadingchat.com",
    "02s.co",
    "06g.co",
    "09a.co",
]

SIDELOAD_PKGS = ["com.update.systemservice", "id.tniad.komando.apk",
                 "com.android.securityupdate", "com.whatsapp.plus",
                 "com.gov.docviewer"]
STALKERWARE_PKGS = ["com.system.sync.service", "com.android.providers.setting",
                    "com.google.playservice.core"]


def _sus_domain():
    return random.choice(SUSPECT_DOMAINS).format(r=uuid.uuid4().hex[:6])


def _parser_proc(platform: str) -> str:
    return random.choice(IOS_PARSER_PROCS if platform == "ios" else ANDROID_PARSER_PROCS)


def _silent(ev: dict) -> dict:
    """Tandai event sebagai terjadi saat HP idle: layar mati, tanpa sentuhan.

    Inilah pembeda utama zero-click. Semua aktivitas sah yang mirip (unggah
    foto besar, panggilan video, update aplikasi) terjadi saat layar NYALA atau
    setelah interaksi pengguna.
    """
    ev["screen_on"] = 0
    ev["user_interaction"] = 0
    ev["foreground_app"] = ""
    return ev


def apply_mobile_scenario(mk_event, scenario: str, platform: str) -> list[dict]:
    """Bangun rantai event untuk satu skenario.

    `mk_event` = callable yang mengembalikan event normal baru untuk device ini
    (dipanggil sekali per tahap supaya tiap tahap punya event_id & ts sendiri).
    """
    cats, _label, stages = MOBILE_SCENARIOS[scenario]
    chain_id = str(uuid.uuid4())
    chain = []

    def stage(idx: int, **fields) -> dict:
        ev = mk_event()
        ev["label_scenario"] = scenario
        ev["chain_id"] = chain_id
        ev["chain_stage"] = stages[idx] if idx < len(stages) else "unknown"
        ev["chain_step"] = idx + 1
        ev["chain_len"] = len(stages)
        ev.update(fields)
        chain.append(ev)
        return ev

    # ---------- RANTAI 1: zero-click iMessage (kelas Pegasus) ----------
    if scenario == "zeroclick_imessage":
        # 1. Pengiriman: lampiran masuk diam-diam, tidak ada notifikasi, layar mati.
        stage(0, **_silent({
            "category": "msg", "activity": "inbound_attachment",
            "inbound_msg": 1, "sender_known": 0, "notified": 0,
            "msg_app": "com.apple.MobileSMS", "msg_has_attachment": 1,
            "ingress_mb": round(random.uniform(0.2, 1.4), 2),
        }))
        # 2. Eksploitasi: proses parser lampiran mati tak wajar + CPU meledak.
        stage(1, **_silent({
            "category": "proc", "activity": "abnormal_process_exit",
            "crash_proc": _parser_proc("ios"), "crash_count": random.randint(2, 6),
            "crash_reason": "SIGSEGV", "cpu_pct": round(random.uniform(72, 99), 1),
        }))
        # 3. Implan: panas tinggi + baterai anjlok padahal HP tidak dipakai.
        stage(2, **_silent({
            "category": "power", "activity": "thermal_anomaly_idle",
            "thermal_state": random.choice([3, 4]),
            "battery_drop_pct": round(random.uniform(6.5, 14.0), 1),
            "cpu_pct": round(random.uniform(55, 92), 1),
        }))
        # 4. C2: koneksi keluar ke ASN murah / domain baru, saat layar mati.
        stage(3, **_silent({
            "category": "net", "activity": "covert_egress",
            "egress_mb": round(random.uniform(14, 120), 1),
            "ingress_mb": round(random.uniform(0.1, 1.0), 2),
            "dest_asn": random.choice(SUSPECT_ASN), "dns_domain": _sus_domain(),
            "dest_class": "foreign",
        }))
        # 5. Pengumpulan: mikrofon hidup tanpa aplikasi di depan.
        stage(4, **_silent({
            "category": "media", "activity": "covert_mic_access",
            "mic_active": 1, "cam_active": 0,
        }))

    # ---------- RANTAI 2: zero-click WhatsApp (Android) ----------
    elif scenario == "zeroclick_whatsapp":
        stage(0, **_silent({
            "category": "msg", "activity": "inbound_voip_setup",
            "inbound_msg": 1, "sender_known": 0, "notified": 0,
            "msg_app": "com.whatsapp", "msg_has_attachment": 1,
            "ingress_mb": round(random.uniform(0.3, 2.0), 2),
        }))
        stage(1, **_silent({
            "category": "proc", "activity": "abnormal_process_exit",
            "crash_proc": _parser_proc("android"), "crash_count": random.randint(2, 5),
            "crash_reason": "SIGABRT", "cpu_pct": round(random.uniform(68, 97), 1),
        }))
        # Implan Android: service baru yang hidup terus + minta izin sensitif.
        stage(2, **_silent({
            "category": "pkg", "activity": "persistent_service_spawned",
            "pkg_name": random.choice(STALKERWARE_PKGS), "pkg_added": 1,
            "installer_source": "none", "perm_sensitive": 1,
            "thermal_state": 2, "battery_drop_pct": round(random.uniform(4.0, 9.0), 1),
        }))
        stage(3, **_silent({
            "category": "net", "activity": "covert_egress",
            "egress_mb": round(random.uniform(10, 85), 1),
            "dest_asn": random.choice(SUSPECT_ASN), "dns_domain": _sus_domain(),
            "dest_class": "foreign",
        }))

    # ---------- RANTAI 3: zero-click SMS biner / WAP-push operator ----------
    elif scenario == "zeroclick_sms_wap":
        stage(0, **_silent({
            "category": "msg", "activity": "inbound_binary_sms",
            "inbound_msg": 1, "sender_known": 0, "notified": 0,
            "msg_app": "com.android.mms", "msg_binary": 1,
            "msg_has_attachment": 0,
        }))
        stage(1, **_silent({
            "category": "proc", "activity": "abnormal_process_exit",
            "crash_proc": "com.android.phone", "crash_count": random.randint(1, 3),
            "crash_reason": "SIGSEGV", "cpu_pct": round(random.uniform(45, 80), 1),
        }))
        # Persistensi: konfigurasi diubah tanpa sepengetahuan pengguna.
        stage(2, **_silent({
            "category": "integrity", "activity": "config_tampered",
            "config_change": 1, "integrity_fail": 1,
            "tamper_detail": random.choice(["dns_override", "proxy_set",
                                            "ca_cert_added", "doze_whitelist"]),
        }))
        stage(3, **_silent({
            "category": "net", "activity": "c2_beacon",
            "egress_mb": round(random.uniform(0.05, 0.4), 3),   # beacon kecil & berpola
            "dns_domain": _sus_domain(), "dest_asn": random.choice(SUSPECT_ASN),
            "beacon_interval_s": random.choice([60, 300, 600]), "dest_class": "foreign",
        }))

    # ---------- APK sideload berisi RAT ----------
    elif scenario == "sideload_rat":
        ev = mk_event()
        stage(0, **{
            "category": "pkg", "activity": "app_installed_sideload",
            "pkg_added": 1, "pkg_name": random.choice(SIDELOAD_PKGS),
            "installer_source": random.choice(["unknown", "com.android.chrome",
                                               "adb", "file_manager"]),
            "pkg_sha256": uuid.uuid4().hex + uuid.uuid4().hex,
            "perm_sensitive": 1, "screen_on": 1, "user_interaction": 1,
        })
        stage(1, **{
            "category": "integrity", "activity": "accessibility_abuse",
            "accessibility_granted": 1, "device_admin_granted": 1,
            "screen_on": 0, "user_interaction": 0, "foreground_app": "",
        })
        stage(2, **_silent({
            "category": "media", "activity": "covert_screen_capture",
            "mic_active": 1, "cam_active": 1,
        }))
        stage(3, **_silent({
            "category": "net", "activity": "covert_egress",
            "egress_mb": round(random.uniform(20, 160), 1),
            "dest_asn": random.choice(SUSPECT_ASN), "dns_domain": _sus_domain(),
            "dest_class": "foreign",
        }))

    # ---------- Stalkerware persisten ----------
    elif scenario == "stalkerware_persist":
        pkg = random.choice(STALKERWARE_PKGS)
        stage(0, **_silent({
            "category": "pkg", "activity": "hidden_app_persistent",
            "pkg_name": pkg, "pkg_hidden": 1, "perm_sensitive": 1,
            "battery_drop_pct": round(random.uniform(3.0, 7.5), 1),
        }))
        stage(1, **_silent({
            "category": "media", "activity": "covert_mic_access",
            "mic_active": 1, "foreground_app": "",
        }))
        stage(2, **_silent({
            "category": "media", "activity": "covert_cam_access",
            "cam_active": 1, "foreground_app": "",
        }))

    # ---------- Beacon ke IOC yang dikenal ----------
    elif scenario == "ioc_c2_beacon":
        dom = random.choice(KNOWN_IOC_DOMAINS)
        for i in range(2):
            stage(i, **_silent({
                "category": "net", "activity": "c2_beacon",
                "dns_domain": dom, "dest_asn": random.choice(SUSPECT_ASN),
                "egress_mb": round(random.uniform(0.02, 0.3), 3),
                "beacon_interval_s": 300, "dest_class": "foreign",
            }))

    # ---------- Profil MDM / sertifikat jahat ----------
    elif scenario == "rogue_profile_mitm":
        stage(0, **{
            "category": "integrity", "activity": "mdm_profile_installed",
            "config_change": 1, "profile_added": 1, "profile_trusted": 0,
            "screen_on": 1, "user_interaction": 1,
        })
        stage(1, **{
            "category": "integrity", "activity": "ca_cert_installed",
            "config_change": 1, "integrity_fail": 1, "tamper_detail": "ca_cert_added",
            "screen_on": 0, "user_interaction": 0,
        })
        stage(2, **_silent({
            "category": "net", "activity": "tls_interception_suspected",
            "tls_mitm": 1, "dest_asn": random.choice(SUSPECT_ASN),
            "dns_domain": "proxy-gw-" + uuid.uuid4().hex[:5] + ".net",
            "egress_mb": round(random.uniform(1.0, 12.0), 2), "dest_class": "foreign",
        }))

    # ---------- IMSI catcher / fake BTS ----------
    elif scenario == "imsi_catcher":
        for i in range(2):
            stage(i, **{
                "category": "radio", "activity": "forced_downgrade_2g",
                "net_gen": "2G", "cell_unknown": 1, "cell_encryption": 0,
                "radio_anomaly": 1, "screen_on": random.choice([0, 1]),
                "user_interaction": 0,
            })

    return chain
