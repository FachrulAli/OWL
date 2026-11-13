"""Dua perangkat contoh untuk demo gerbang (proposal §6).

Keduanya adalah telemetri yang bentuknya persis sama dengan yang dikirim
agent Android, bukan skor yang ditulis tangan. Skor 18 dan 87 di dashboard
dihitung mesin aturan dan mesin skor yang sama dengan yang dipakai perangkat
sungguhan. Itu pembedanya dari demo yang hanya menampilkan angka.

Rincian skornya, supaya dapat diperiksa juri:

  TACTICAL-07 (bersih)                           18
    app      OWL-A02 medium  25 x 2/5          = 10
    device   OWL-D02 medium  15 x 2/5          =  6
    identity OWL-N03 low     10 x 1/5          =  2

  KOMANDO-02 (berisiko)                          87
    runtime  OWL-R01 critical + R02 high, jenuh = 30
    app      OWL-A01 high + A02 medium, jenuh   = 25
    config   OWL-C01 high + C02 medium, jenuh   = 20
    device   OWL-D02 medium  15 x 2/5          =  6
    identity OWL-N01 high    10 x 3/5          =  6
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone

from . import db
from .models import IndicatorStatus, Telemetry


def _status(now: datetime) -> dict[str, IndicatorStatus]:
    """Status tiap indikator pada perangkat contoh (FR-02 dan FR-03).

    Kedua perangkat ini berada di satuan yang sudah tergelar penuh, sehingga
    tujuan jaringannya datang dari resolver DNS satuan, bukan dari agent.
    Pembedaan sumber itu disebutkan apa adanya: agent Android biasa memang
    tidak dapat membaca tujuan per aplikasi, dan dashboard menampilkan
    sumbernya supaya tidak ada yang menyangka agent melakukan lebih daripada
    yang mampu dilakukannya.
    """
    ok = lambda src="agent": IndicatorStatus(status="ok", source=src, checked_at=now)
    return {
        "permissions": ok(),
        "accessibility": ok(),
        "certificates": ok(),
        "vpn": ok(),
        "install_source": ok(),
        "integrity": IndicatorStatus(
            status="partial", source="agent", checked_at=now,
            reason="status bootloader tidak diberikan API publik; dinilai lewat verdict integritas"),
        "network_volume": ok(),
        "network_destinations": ok("resolver"),
        "attestation": ok(),
    }

P_MIC = "android.permission.RECORD_AUDIO"
P_CAM = "android.permission.CAMERA"
P_LOC = "android.permission.ACCESS_FINE_LOCATION"


def _patch(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


DEVICES = [
    {
        "device_id": "TACTICAL-07",
        "label": "HP dinas satuan tempur",
        "owner_role": "Bintara",
        "unit": "Yonif Raider",
        "model": "Samsung Galaxy A55",
        "os_version": "Android 14",
    },
    {
        "device_id": "KOMANDO-02",
        "label": "HP dinas perwira",
        "owner_role": "Perwira Menengah",
        "unit": "Staf Komando",
        "model": "Samsung Galaxy S24",
        "os_version": "Android 15",
    },
]


def telemetry_bersih() -> Telemetry:
    """Perangkat yang wajar. Bukan nol: satu aplikasi pesan memegang izin
    mikrofon dan lokasi, patchnya tertinggal 75 hari, dan ada satu tujuan
    jaringan baru. Skor 18 berarti lolos, bukan berarti sempurna."""
    now = datetime.now(timezone.utc)
    return Telemetry(
        availability=_status(now),
        device_id="TACTICAL-07",
        collected_at=now,
        agent_version="1.0.0",
        attestation={
            "play_integrity": "MEETS_STRONG_INTEGRITY",
            "key_attestation": True,
            "certificate_chain_sha256": "9f2c" + "a" * 60,
            "verified_at": datetime.now(timezone.utc),
        },
        accessibility_services=[],
        overlay_packages=[],
        user_certificates=[],
        vpn_profiles=[],
        apps=[
            {"package": "id.tniad.pesan", "installer": "com.android.vending",
             "permissions": [P_MIC, P_LOC]},
            {"package": "com.android.chrome", "installer": "com.android.vending",
             "permissions": []},
        ],
        integrity={
            "play_integrity": "MEETS_STRONG_INTEGRITY",
            "root_artifacts": [],
            "bootloader_unlocked": False,
            "security_patch": _patch(75),
        },
        network={
            "egress_mb_24h": 12.4,
            "screen_on_ratio_24h": 0.41,
            "unusual_destinations": [],
            "new_destinations": ["cdn.pembaruan-peta.id"],
            "beacon_jitter_pct": 64.0,
        },
    )


def telemetry_berisiko() -> Telemetry:
    """Perangkat yang membawa pola penyadapan app-layer yang sudah dikenal:
    layanan aksesibilitas asing, hamparan jendela, aplikasi sideload dengan
    izin mikrofon dan kamera, CA pengguna, VPN di luar daftar izin, dan
    unggahan besar saat perangkat tidak disentuh."""
    now = datetime.now(timezone.utc)
    return Telemetry(
        availability=_status(now),
        device_id="KOMANDO-02",
        collected_at=now,
        agent_version="1.0.0",
        attestation={
            "play_integrity": "MEETS_DEVICE_INTEGRITY",
            "key_attestation": True,
            "certificate_chain_sha256": "1b77" + "c" * 60,
            "verified_at": datetime.now(timezone.utc),
        },
        accessibility_services=[
            {"package": "com.sys.servicehelper", "label": "Service Helper"},
        ],
        overlay_packages=["com.sys.servicehelper"],
        user_certificates=[
            {"subject": "CN=Secure Proxy CA, O=-", "sha256": "7e55" + "d" * 60},
        ],
        vpn_profiles=[{"name": "fast-secure-vpn", "package": "com.fsv.client"}],
        apps=[
            {"package": "com.sys.servicehelper", "installer": "",
             "permissions": [P_MIC, P_CAM, P_LOC]},
            {"package": "id.tniad.pesan", "installer": "com.android.vending",
             "permissions": [P_MIC]},
        ],
        integrity={
            "play_integrity": "MEETS_DEVICE_INTEGRITY",
            "root_artifacts": [],
            "bootloader_unlocked": False,
            "security_patch": _patch(96),
        },
        network={
            "egress_mb_24h": 318.7,
            "screen_on_ratio_24h": 0.02,
            "unusual_destinations": [],
            "new_destinations": [],
            "beacon_jitter_pct": 48.0,
        },
    )


async def seed(assess) -> dict:
    """Daftarkan kedua perangkat lalu nilai keduanya lewat jalur yang sama
    dengan telemetri sungguhan."""
    await db.reset()
    for d in DEVICES:
        await db.upsert_device(d)

    out = []
    for t in (telemetry_bersih(), telemetry_berisiko()):
        a, dec, soc_out = await assess(t)
        out.append({
            "device_id": a.device_id,
            "score": a.score,
            "level": a.level,
            "findings": len(a.findings),
            "decision_standard": dec.decision,
        })
    return {"ok": True, "devices": out}
