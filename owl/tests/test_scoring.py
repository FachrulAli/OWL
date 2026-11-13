"""Uji mesin skor dan gerbang.

Dua angka pada naskah demo, 18 dan 87, dikunci di sini. Jika seseorang
menyetel bobot atau severitas tanpa memperbarui naskah, uji inilah yang
memberi tahu, bukan juri.
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "services" / "backend"
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402

from app import demo, pdp, rules, scoring  # noqa: E402
from app.config import settings  # noqa: E402
from app.models import InstalledApp, Telemetry  # noqa: E402


@pytest.fixture(autouse=True, scope="module")
def _catalog():
    rules.load()


def _assess(t: Telemetry):
    return scoring.score(t, rules.evaluate(t))


# ——————————————————————— angka demo ———————————————————————

def test_perangkat_bersih_18():
    a = _assess(demo.telemetry_bersih())
    assert a.score == 18.0
    assert a.level == "rendah"


def test_perangkat_berisiko_87():
    a = _assess(demo.telemetry_berisiko())
    assert a.score == 87.0
    assert a.level == "tinggi"


def test_gerbang_terklasifikasi_menolak_yang_berisiko():
    a = _assess(demo.telemetry_berisiko())
    d = pdp.decide(a, "classified")
    assert d.decision == "deny" and d.quarantine is True


def test_gerbang_terklasifikasi_meloloskan_yang_bersih():
    a = _assess(demo.telemetry_bersih())
    d = pdp.decide(a, "classified")
    assert d.decision == "allow" and d.quarantine is False


def test_perangkat_berisiko_tidak_langsung_ditolak_di_jaringan_biasa():
    """87 berada di bawah ambang deny untuk sumber daya biasa. Ini yang
    membuat tabel ambang pada proposal dan naskah demo tidak bertabrakan."""
    a = _assess(demo.telemetry_berisiko())
    assert pdp.decide(a, "standard").decision == "limited"


# ——————————————————————— sifat mesin skor ———————————————————————

def test_kontributor_berjumlah_sama_dengan_skor():
    """Skor harus dapat ditelusuri: jumlah poin tiap temuan sama dengan
    skor akhir. Tanpa sifat ini, kolom kontributor di dashboard berbohong."""
    for t in (demo.telemetry_bersih(), demo.telemetry_berisiko()):
        a = _assess(t)
        assert round(sum(f.points for f in a.findings), 1) == a.score


def test_kategori_jenuh_pada_bobotnya():
    """Sepuluh aplikasi sideload tidak boleh lebih merah daripada tiga."""
    t = demo.telemetry_berisiko()
    t.apps = t.apps + [
        InstalledApp(package=f"com.rogue{i}", installer="", permissions=[])
        for i in range(10)
    ]
    a = _assess(t)
    app_cat = next(c for c in a.categories if c.category == "app")
    assert app_cat.score == settings.WEIGHTS["app"]
    assert a.score <= 100.0


def test_skor_tidak_pernah_melewati_100():
    t = demo.telemetry_berisiko()
    t.integrity.root_artifacts = ["/system/xbin/su", "Magisk"]
    t.integrity.bootloader_unlocked = True
    t.network.unusual_destinations = ["203.0.113.9"]
    t.network.beacon_jitter_pct = 2.0
    a = _assess(t)
    assert 0.0 <= a.score <= 100.0


def test_sinyal_tunggal_diturunkan_tanpa_korelasi():
    """Satu indikator di perangkat hampir selalu ambigu. Aturan bertanda
    corroborate turun satu tingkat jika ia satu-satunya yang menyala."""
    t = demo.telemetry_bersih()
    t.integrity.security_patch = (datetime.now(timezone.utc).date()).isoformat()
    t.network.new_destinations = []
    f = rules.evaluate(t)
    assert len(f) == 1 and f[0].rule_id == "OWL-A02"
    assert f[0].downgraded is True and f[0].severity == "low"


def test_korelasi_tidak_menurunkan_saat_sinyal_banyak():
    f = rules.evaluate(demo.telemetry_berisiko())
    assert not any(x.downgraded for x in f)


# ——————————————————————— attestation ———————————————————————

def test_attestation_gagal_menolak_walau_perangkat_terlihat_bersih():
    """Laporan 'perangkat bersih' dari agent yang tidak terverifikasi tidak
    berarti apa-apa (deepdive §7.4)."""
    t = demo.telemetry_bersih()
    t.attestation.key_attestation = False
    t.attestation.play_integrity = "FAILED"
    a = _assess(t)
    assert a.attestation_ok is False
    d = pdp.decide(a, "standard")
    assert d.decision == "deny" and d.quarantine is True


# ——————————————————————— peluruhan ———————————————————————

def test_peluruhan_lima_poin_per_hari():
    now = datetime.now(timezone.utc)
    assert scoring.decay(87.0, now - timedelta(days=1), now) == pytest.approx(82.0)
    assert scoring.decay(87.0, now - timedelta(days=10), now) == pytest.approx(37.0)
    assert scoring.decay(10.0, now - timedelta(days=30), now) == 0.0


def test_perangkat_merah_tidak_menjadi_hijau_dalam_satu_laporan():
    """Satu laporan bersih sesudah temuan berat hanya menurunkan skor
    sebanyak peluruhan satu hari, bukan mengembalikannya ke nol."""
    now = datetime.now(timezone.utc)
    t = demo.telemetry_bersih()
    a = scoring.score(t, rules.evaluate(t), previous=87.0,
                      last_seen=now - timedelta(days=1))
    assert a.score == pytest.approx(82.0)
