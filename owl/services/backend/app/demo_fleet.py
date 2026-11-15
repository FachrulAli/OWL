"""Armada contoh untuk dashboard: sekitar enam puluh perangkat di banyak Kodam.

Tujuannya satu: dashboard pimpinan tidak boleh kosong atau hanya berisi dua
perangkat saat didemokan. Armada ini DATA CONTOH, bukan perangkat nyata, dan
setiap perangkatnya diberi label "contoh" pada kolom `label` supaya tidak ada
yang mengira itu laporan lapangan.

Skornya tidak ditulis tangan. Tiap perangkat adalah telemetri berbentuk sama
dengan yang dikirim agent, dibuat dari dua templat di `demo.py` lalu diubah
menurut profil risikonya, dan dinilai oleh mesin aturan dan mesin skor yang
sama dengan perangkat sungguhan. Sebarannya sengaja dibuat mirip armada
nyata: sebagian besar bersih, ekor kecil berisiko.

Deterministik: benih tetap, sehingga angka di dashboard sama tiap kali dimuat
dan tiap kali `make snapshot` dijalankan.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from . import demo
from .models import AppNetwork, Telemetry

# (singkat untuk ID, nama persis seperti di peta, jumlah perangkat)
KODAM = [
    ("MBS", "Mabes TNI AD", 4),
    ("JYA", "Kodam Jaya/Jayakarta", 7),
    ("SLW", "Kodam III/Siliwangi", 7),
    ("DPN", "Kodam IV/Diponegoro", 5),
    ("BRW", "Kodam V/Brawijaya", 6),
    ("BBR", "Kodam I/Bukit Barisan", 4),
    ("SRW", "Kodam II/Sriwijaya", 3),
    ("UDY", "Kodam IX/Udayana", 3),
    ("TJP", "Kodam XII/Tanjungpura", 3),
    ("MLW", "Kodam VI/Mulawarman", 3),
    ("HSN", "Kodam XIV/Hasanuddin", 5),
    ("MRD", "Kodam XIII/Merdeka", 2),
    ("PTM", "Kodam XVI/Pattimura", 2),
    ("CDR", "Kodam XVII/Cenderawasih", 3),
    ("KSR", "Kodam XVIII/Kasuari", 2),
    ("IMD", "Kodam Iskandar Muda", 2),
    ("TTB", "Kodam XIX/Tuanku Tambusai", 2),
]

SATUAN = ["Yonif 303", "Yonif Raider 400", "Yonkav 7", "Yonarmed 12", "Yonzipur 5",
          "Staf Intel", "Staf Operasi", "Staf Komunikasi", "Kodim Induk", "Denma"]
PERAN = [("Tamtama", 3), ("Bintara", 4), ("Perwira Pertama", 3), ("Perwira Menengah", 2)]
MODEL = [("Samsung Galaxy A55", "Samsung", "Android 14"), ("Samsung Galaxy A35", "Samsung", "Android 14"),
         ("Samsung Galaxy S24", "Samsung", "Android 15"), ("Xiaomi Redmi Note 13", "Xiaomi", "Android 13"),
         ("Oppo A78", "OPPO", "Android 13"), ("Infinix Note 30", "Infinix", "Android 13"),
         ("Vivo Y36", "vivo", "Android 13"), ("Google Pixel 8", "Google", "Android 15"),
         ("Samsung Galaxy A15", "Samsung", "Android 14")]

# profil: nama, bobot. Bobotnya menentukan bentuk armada.
PROFIL = [("bersih", 44), ("patch_lama", 12), ("sideload", 10), ("ca_vpn", 7),
          ("aksesibilitas", 6), ("bootloader", 4), ("attestasi", 4),
          ("berisiko", 4), ("payload", 2), ("unggahan", 3)]


def _pilih(rng: random.Random, pilihan):
    total = sum(w for _, w in pilihan)
    x = rng.uniform(0, total)
    for nama, w in pilihan:
        x -= w
        if x <= 0:
            return nama
    return pilihan[-1][0]


def _ubah(t: Telemetry, profil: str, rng: random.Random) -> None:
    """Terapkan satu profil risiko pada telemetri dasar yang bersih."""
    if profil == "bersih":
        t.integrity.security_patch = demo._patch(rng.randint(8, 55))
        t.network.egress_mb_24h = round(rng.uniform(4, 30), 1)
        t.network.screen_on_ratio_24h = round(rng.uniform(0.2, 0.6), 2)
        t.network.new_destinations = []
        if rng.random() < 0.6:  # banyak armada tidak membawa aplikasi pabrik tak bersumber
            t.apps = [a for a in t.apps if a.package != "com.vendor.catatan"]
    elif profil == "patch_lama":
        t.integrity.security_patch = demo._patch(rng.randint(130, 280))
    elif profil == "sideload":
        r = demo.telemetry_berisiko()
        t.apps = list(t.apps) + [a for a in r.apps if a.package == "com.sys.servicehelper"]
    elif profil == "ca_vpn":
        r = demo.telemetry_berisiko()
        t.user_certificates = r.user_certificates
        t.vpn_profiles = r.vpn_profiles
    elif profil == "aksesibilitas":
        r = demo.telemetry_berisiko()
        t.accessibility_services = r.accessibility_services
        t.overlay_packages = r.overlay_packages
    elif profil == "bootloader":
        t.integrity.bootloader_unlocked = True
        t.integrity.root_artifacts = ["/system/xbin/su"]
    elif profil == "attestasi":
        t.attestation.key_attestation = False
        t.attestation.play_integrity = "MEETS_BASIC_INTEGRITY"
        t.integrity.play_integrity = "MEETS_BASIC_INTEGRITY"
    elif profil == "berisiko":
        base = demo.telemetry_berisiko()
        for f in ("accessibility_services", "overlay_packages", "user_certificates",
                  "vpn_profiles", "apps", "integrity", "network"):
            setattr(t, f, getattr(base, f))
    elif profil == "payload":
        r = demo.telemetry_berisiko()
        t.apps = list(t.apps) + [r.apps[0].model_copy(update={"package": "com.metasploit.stage"})]
    elif profil == "unggahan":
        t.network.egress_mb_24h = round(rng.uniform(120, 260), 1)
        t.network.screen_on_ratio_24h = 0.03
        t.network.apps = [AppNetwork(package="com.vendor.catatan", uid=10077,
                                     egress_mb_24h=t.network.egress_mb_24h, foreground_ms_24h=0)]


def armada(seed: int = 2026) -> list[tuple[dict, Telemetry, int]]:
    """Daftar (data perangkat, telemetri, menit sejak laporan terakhir)."""
    rng = random.Random(seed)
    out = []
    urut = 0
    for kode, nama, n in KODAM:
        for i in range(1, n + 1):
            urut += 1
            model, _, os_ver = rng.choice(MODEL)
            peran = _pilih(rng, PERAN)
            profil = _pilih(rng, PROFIL)
            did = f"{kode}-{i:03d}"
            satuan = rng.choice(SATUAN)
            meta = {
                "device_id": did,
                "label": f"HP dinas {satuan} (contoh)",
                "owner_role": peran,
                "unit": f"{nama} · {satuan}" if kode != "MBS" else f"Mabes TNI AD · {satuan}",
                "model": model,
                "os_version": os_ver,
            }
            t = demo.telemetry_bersih()
            t.device_id = did
            t.integrity.bootloader_unlocked = False
            t.attestation.certificate_chain_sha256 = f"{urut:04x}" + "e" * 60
            _ubah(t, profil, rng)
            # Sebagian kecil perangkat sudah lama tidak melapor.
            menit = 0
            if rng.random() < 0.09:
                menit = rng.randint(180, 1800)
            else:
                menit = rng.randint(1, 40)
            out.append((meta, t, menit))
    return out


async def seed(assess) -> dict:
    """Muat armada lewat jalur penilaian yang sama dengan telemetri sungguhan."""
    from . import db
    await db.reset()
    for d in (demo.DEVICES):
        await db.upsert_device(d)
    hasil = []
    for t in (demo.telemetry_bersih(), demo.telemetry_berisiko()):
        a, _, _ = await assess(t)
        hasil.append(a.device_id)
    for meta, t, menit in armada():
        await db.upsert_device(meta)
        a, _, _ = await assess(t)
        if menit > 60:
            lama = (datetime.now(timezone.utc) - timedelta(minutes=menit)).isoformat()
            await db.conn().execute("UPDATE assessments SET assessed_at=? WHERE device_id=?", (lama, a.device_id))
    await db.conn().commit()
    return {"ok": True, "devices": len(hasil) + len(armada())}
