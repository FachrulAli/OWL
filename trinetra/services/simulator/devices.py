"""Fleet HP prajurit + profil perilaku normal per pangkat/jabatan (mode MTD).

Ini pengganti `roles.py` untuk domain MOBILE. Satu "entity" = satu HP dinas yang
dipegang satu personel. Profil tiap pangkat menentukan distribusi perilaku
normal (pola layar, trafik, pesan masuk, jam aktif) supaya baseline UEBA punya
bahan belajar dan deteksi zero-click harus benar-benar memisahkan sinyal.

Catatan privasi (desain, bukan sekadar klaim): tidak ada field isi pesan,
isi file, lokasi presisi, atau nomor telepon mentah di skema ini. Pengirim
pesan hanya direpresentasikan sebagai hash + flag "dikenal/tidak".
"""

# device_id, role, node_id, tier, platform, os_version, model
DEVICES = [
    # --- Tier 0: Mabes / Pussiberad ---
    ("hp-pusat-pangti",  "pati",            "pusat", 0, "ios",     "17.5.1", "iPhone 15 Pro"),
    ("hp-pusat-intel",   "pamen_intel",     "pusat", 0, "android", "14",     "Samsung S24"),
    ("hp-pusat-siber",   "pama_siber",      "pusat", 0, "android", "15",     "Pixel 8"),
    ("hp-pusat-ajudan",  "ajudan",          "pusat", 0, "ios",     "16.7.8", "iPhone 13"),
    # --- Tier 1: Kodam ---
    ("hp-kodam-jaya-01", "pati",            "kodam-jaya", 1, "ios",     "17.4",   "iPhone 15"),
    ("hp-kodam-jaya-02", "pamen_intel",     "kodam-jaya", 1, "android", "14",     "Samsung S23"),
    ("hp-kodam-im-01",   "pamen_ops",       "kodam-im",   1, "android", "13",     "Oppo Reno 10"),
    ("hp-kodam-1-01",    "pamen_intel",     "kodam-1",    1, "android", "14",     "Samsung A54"),
    ("hp-kodam-2-01",    "bintara_komlek",  "kodam-2",    1, "android", "12",     "Xiaomi Redmi 12"),
    ("hp-kodam-3-01",    "pati",            "kodam-3",    1, "ios",     "17.5",   "iPhone 14 Pro"),
    ("hp-kodam-4-01",    "prajurit",        "kodam-4",    1, "android", "13",     "Vivo Y27"),
    ("hp-kodam-5-01",    "pamen_intel",     "kodam-5",    1, "ios",     "16.6",   "iPhone 13 Pro"),
    ("hp-kodam-5-02",    "prajurit",        "kodam-5",    1, "android", "14",     "Samsung A34"),
    ("hp-kodam-6-01",    "pamen_ops",       "kodam-6",    1, "android", "14",     "Pixel 7a"),
    ("hp-kodam-9-01",    "bintara_komlek",  "kodam-9",    1, "android", "13",     "Samsung A24"),
    ("hp-kodam-12-01",   "prajurit",        "kodam-12",   1, "android", "12",     "Realme C55"),
    ("hp-kodam-13-01",   "pamen_ops",       "kodam-13",   1, "android", "14",     "Samsung S22"),
    ("hp-kodam-14-01",   "pamen_intel",     "kodam-14",   1, "android", "15",     "Pixel 8 Pro"),
    ("hp-kodam-16-01",   "prajurit",        "kodam-16",   1, "android", "13",     "Infinix Note 30"),
    ("hp-kodam-17-01",   "pamen_intel",     "kodam-17",   1, "android", "14",     "Samsung S23 FE"),
    ("hp-kodam-17-02",   "bintara_komlek",  "kodam-17",   1, "android", "12",     "Xiaomi Poco M5"),
    ("hp-kodam-18-01",   "prajurit",        "kodam-18",   1, "android", "13",     "Oppo A78"),
    ("hp-kodam-19-01",   "pamen_ops",       "kodam-19",   1, "android", "14",     "Samsung A55"),
    ("hp-kodam-20-01",   "prajurit",        "kodam-20",   1, "android", "13",     "Vivo Y36"),
    ("hp-kodam-21-01",   "bintara_komlek",  "kodam-21",   1, "android", "12",     "Redmi Note 12"),
    ("hp-kodam-22-01",   "prajurit",        "kodam-22",   1, "android", "14",     "Samsung A15"),
    ("hp-kodam-23-01",   "pamen_ops",       "kodam-23",   1, "android", "14",     "Pixel 7"),
    ("hp-kodam-24-01",   "pamen_intel",     "kodam-24",   1, "ios",     "17.2",   "iPhone 14"),
    ("hp-kodam-24-02",   "prajurit",        "kodam-24",   1, "android", "13",     "Itel P55"),
]

# Profil perilaku normal per pangkat/jabatan.
# (mean, std) untuk metrik kontinu; *_rate = probabilitas per event.
ROLE_PROFILES = {
    # Perwira Tinggi / Pangdam — target bernilai tinggi, trafik rapat, banyak
    # pesan masuk dari nomor tak dikenal (protokoler), banyak panggilan.
    "pati": {
        "active_hours": (5, 23),
        "egress_mb": (1.8, 1.4),
        "ingress_mb": (6.0, 4.0),
        "screen_on_rate": 0.62,
        "msg_rate": 0.22,
        "unknown_sender_rate": 0.30,   # protokoler: sering dihubungi nomor baru
        "mic_rate": 0.10,              # sering telepon/VC
        "cam_rate": 0.03,
        "apps": ["com.whatsapp", "com.apple.MobileSMS", "id.go.tniad.komando",
                 "com.microsoft.Office.Outlook", "com.google.Chrome"],
        "msg_apps": ["com.apple.MobileSMS", "com.whatsapp", "org.telegram.messenger"],
        "thermal_mean": 0.6,
        "battery_drop": (0.9, 0.6),
        "cpu_pct": (14, 9),
    },
    # Pamen Intelijen — mobilitas tinggi, banyak unggah laporan, jam tak teratur.
    "pamen_intel": {
        "active_hours": (4, 24),
        "egress_mb": (3.2, 2.6),
        "ingress_mb": (4.5, 3.2),
        "screen_on_rate": 0.55,
        "msg_rate": 0.18,
        "unknown_sender_rate": 0.22,
        "mic_rate": 0.07,
        "cam_rate": 0.08,              # dokumentasi lapangan
        "apps": ["com.whatsapp", "id.go.tniad.lapinhar", "org.thoughtcrime.securesms",
                 "com.google.android.apps.maps", "com.adobe.reader"],
        "msg_apps": ["com.whatsapp", "org.telegram.messenger", "com.android.mms"],
        "thermal_mean": 0.8,
        "battery_drop": (1.2, 0.7),
        "cpu_pct": (18, 10),
    },
    # Pamen Operasi — pola kantor + latihan, trafik sedang.
    "pamen_ops": {
        "active_hours": (5, 22),
        "egress_mb": (1.4, 1.1),
        "ingress_mb": (3.0, 2.2),
        "screen_on_rate": 0.50,
        "msg_rate": 0.14,
        "unknown_sender_rate": 0.12,
        "mic_rate": 0.05,
        "cam_rate": 0.04,
        "apps": ["com.whatsapp", "id.go.tniad.komando", "com.google.android.gm",
                 "com.microsoft.teams"],
        "msg_apps": ["com.whatsapp", "com.android.mms"],
        "thermal_mean": 0.6,
        "battery_drop": (1.0, 0.6),
        "cpu_pct": (15, 8),
    },
    # Pama Satsiber — paham teknis, pakai tooling, trafik tidak biasa TAPI sah.
    # Sengaja dibuat "mirip anomali" untuk menguji false positive.
    "pama_siber": {
        "active_hours": (6, 24),
        "egress_mb": (5.5, 4.0),
        "ingress_mb": (9.0, 6.0),
        "screen_on_rate": 0.58,
        "msg_rate": 0.10,
        "unknown_sender_rate": 0.08,
        "mic_rate": 0.03,
        "cam_rate": 0.02,
        "apps": ["com.termux", "com.wireguard.android", "com.whatsapp",
                 "com.github.android", "org.mozilla.firefox"],
        "msg_apps": ["com.whatsapp", "org.telegram.messenger"],
        "thermal_mean": 1.0,           # memang sering panas (kompilasi, VPN)
        "battery_drop": (1.8, 1.0),
        "cpu_pct": (28, 14),
    },
    # Bintara Komlek — operator radio/komunikasi, banyak sinkronisasi data.
    "bintara_komlek": {
        "active_hours": (5, 22),
        "egress_mb": (1.0, 0.8),
        "ingress_mb": (2.4, 1.8),
        "screen_on_rate": 0.45,
        "msg_rate": 0.16,
        "unknown_sender_rate": 0.10,
        "mic_rate": 0.06,
        "cam_rate": 0.02,
        "apps": ["com.whatsapp", "id.go.tniad.komlek", "com.zello",
                 "com.google.android.apps.messaging"],
        "msg_apps": ["com.android.mms", "com.whatsapp"],
        "thermal_mean": 0.5,
        "battery_drop": (0.9, 0.5),
        "cpu_pct": (12, 7),
    },
    # Ajudan — mengekor prinsipal, pola mirip pati tapi lebih padat pesan.
    "ajudan": {
        "active_hours": (4, 24),
        "egress_mb": (1.2, 0.9),
        "ingress_mb": (3.6, 2.4),
        "screen_on_rate": 0.66,
        "msg_rate": 0.26,
        "unknown_sender_rate": 0.28,
        "mic_rate": 0.09,
        "cam_rate": 0.05,
        "apps": ["com.whatsapp", "com.apple.MobileSMS", "id.go.tniad.komando",
                 "com.apple.mobilecal"],
        "msg_apps": ["com.apple.MobileSMS", "com.whatsapp"],
        "thermal_mean": 0.6,
        "battery_drop": (1.1, 0.6),
        "cpu_pct": (13, 8),
    },
    # Prajurit — pemakaian paling "biasa": medsos, jam tidur jelas.
    "prajurit": {
        "active_hours": (5, 23),
        "egress_mb": (0.7, 0.6),
        "ingress_mb": (4.0, 3.0),
        "screen_on_rate": 0.48,
        "msg_rate": 0.12,
        "unknown_sender_rate": 0.06,
        "mic_rate": 0.04,
        "cam_rate": 0.06,
        "apps": ["com.whatsapp", "com.instagram.android", "com.zhiliaoapp.musically",
                 "com.google.android.youtube", "com.mobile.legends"],
        "msg_apps": ["com.whatsapp", "com.android.mms"],
        "thermal_mean": 0.7,
        "battery_drop": (1.3, 0.8),
        "cpu_pct": (16, 9),
    },
}

# Tujuan jaringan yang normal (ASN/CDN yang wajar untuk aplikasi di atas).
NORMAL_ASN = ["AS32934 Meta", "AS15169 Google", "AS13335 Cloudflare",
              "AS16509 Amazon", "AS8075 Microsoft", "AS17974 Telkom",
              "AS7713 Telkomsel", "AS4761 Indosat"]
NORMAL_DOMAINS = ["graph.whatsapp.net", "mmg.whatsapp.net", "clients4.google.com",
                  "firebaseinstallations.googleapis.com", "i.instagram.com",
                  "gateway.icloud.com", "komando.tniad.mil.id", "api.telegram.org"]
NET_GEN = ["5G", "4G"]
