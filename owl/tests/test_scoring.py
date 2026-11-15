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
from app.models import InstalledApp, Telemetry, VpnProfile  # noqa: E402


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
    t.apps = [a for a in t.apps if a.installer]          # buang aplikasi tanpa sumber
    t.vpn_profiles = [VpnProfile(name="vpn-asing")]
    f = rules.evaluate(t)
    assert len(f) == 1 and f[0].rule_id == "OWL-C02"
    assert f[0].downgraded is True and f[0].severity == "low"


def test_korelasi_tidak_menurunkan_saat_sinyal_banyak():
    f = rules.evaluate(demo.telemetry_berisiko())
    assert not any(x.downgraded for x in f)


# ——————————————————————— sumber pemasangan ———————————————————————

P_MIC = "android.permission.RECORD_AUDIO"
P_CAM = "android.permission.CAMERA"
P_LOC = "android.permission.ACCESS_FINE_LOCATION"
PKG_INSTALLER = "com.google.android.packageinstaller"


def _hanya_aplikasi(apps: list[InstalledApp]) -> Telemetry:
    """Perangkat bersih yang seluruh temuannya dibuang, lalu diberi aplikasi
    tertentu, supaya uji di bawah hanya menilai aturan aplikasi."""
    t = demo.telemetry_bersih()
    t.integrity.security_patch = datetime.now(timezone.utc).date().isoformat()
    t.network.new_destinations = []
    t.apps = apps
    return t


def test_apk_pasang_manual_tidak_lolos_sebagai_toko():
    """APK yang dipasang dari berkas tercatat dipasang oleh penginstal paket
    sistem. Nama itu pernah ada di daftar toko, sehingga payload uji pada HP
    sungguhan lolos dari OWL-A01."""
    t = _hanya_aplikasi([InstalledApp(package="com.x.payload", installer=PKG_INSTALLER)])
    f = rules.evaluate(t)
    a01 = next(x for x in f if x.rule_id == "OWL-A01")
    assert a01.severity == "high"
    assert "dipasang manual" in a01.evidence[0]


def test_sumber_tidak_tercatat_lebih_ringan_daripada_pasang_manual():
    t = _hanya_aplikasi([InstalledApp(package="com.vendor.bawaan", installer="")])
    a01 = next(x for x in rules.evaluate(t) if x.rule_id == "OWL-A01")
    assert a01.severity == "medium"


def test_agent_owl_tidak_menandai_dirinya_sendiri():
    t = _hanya_aplikasi([InstalledApp(package="id.tniad.owl.agent", installer="")])
    assert rules.evaluate(t) == []


def test_izin_perekaman_aplikasi_toko_tidak_dihitung():
    """Aplikasi pesan dari toko resmi memegang mikrofon dan kamera di hampir
    setiap ponsel. Menghitungnya membuat seluruh armada mulai dari 10 poin dan
    tidak membedakan apa pun."""
    t = _hanya_aplikasi([InstalledApp(package="com.whatsapp", installer="com.android.vending",
                                     permissions=[P_MIC, P_CAM, P_LOC])])
    assert rules.evaluate(t) == []


def test_perangkat_dengan_dan_tanpa_payload_dapat_dibedakan():
    """Sifat yang gagal pada HP uji 2026-11-15: skor dengan dan tanpa payload
    sama persis. Dikunci di sini supaya tidak terulang."""
    toko = InstalledApp(package="com.whatsapp", installer="com.android.vending",
                        permissions=[P_MIC, P_CAM])
    payload = InstalledApp(package="com.x.payload", installer=PKG_INSTALLER,
                           permissions=[P_MIC, P_CAM, P_LOC])
    tanpa = _assess(_hanya_aplikasi([toko]))
    dengan = _assess(_hanya_aplikasi([toko, payload]))
    assert tanpa.score == 0.0
    assert dengan.score >= tanpa.score + 20


# ——————————————————————— aturan penentu ———————————————————————

def test_aplikasi_di_daftar_larangan_ditolak_tanpa_melihat_skor():
    t = _hanya_aplikasi([InstalledApp(package="com.metasploit.stage", installer=PKG_INSTALLER)])
    a = _assess(t)
    assert a.score < 70                      # skornya sendiri TIDAK cukup untuk menolak
    for resource in ("standard", "classified"):
        d = pdp.decide(a, resource)
        assert d.decision == "deny" and d.quarantine is True
        assert "OWL-A03" in d.reason


def test_daftar_larangan_cocok_lewat_penanda_tangan(monkeypatch):
    """Nama paket dapat diganti; kunci penanda tangan tidak."""
    sidik = "ab" * 32
    monkeypatch.setitem(rules.catalog()["blocklists"], "signers", [sidik.upper()])
    t = _hanya_aplikasi([InstalledApp(package="com.nama.diganti", installer="com.android.vending",
                                     signer_sha256=sidik)])
    f = rules.evaluate(t)
    assert any(x.rule_id == "OWL-A03" and x.decisive for x in f)


def test_perangkat_root_ditolak_walau_skornya_rendah():
    """Root hanya menyumbang 15 poin, dan dulu itu berarti lolos."""
    t = _hanya_aplikasi([])
    t.integrity.root_artifacts = ["/system/xbin/su"]
    a = _assess(t)
    assert a.score < 30
    assert pdp.decide(a, "standard").decision == "deny"


def test_laporan_kedaluwarsa_ditolak():
    """Perangkat yang berhenti melapor bukan perangkat yang aman."""
    a = _assess(demo.telemetry_bersih())
    kini = a.assessed_at
    assert pdp.decide(a, "standard", now=kini + timedelta(minutes=30)).decision == "allow"
    d = pdp.decide(a, "standard", now=kini + timedelta(minutes=61))
    assert d.decision == "deny" and d.quarantine is False
    assert "kedaluwarsa" in d.reason


# ——————————————————————— attestation ———————————————————————

def test_kunci_tidak_terbukti_menolak_walau_perangkat_terlihat_bersih():
    """Laporan 'perangkat bersih' dari agent yang tidak terverifikasi tidak
    berarti apa-apa (deepdive §7.4)."""
    t = demo.telemetry_bersih()
    t.attestation.key_attestation = False
    a = _assess(t)
    assert a.attestation_ok is False
    d = pdp.decide(a, "standard")
    assert d.decision == "deny" and d.quarantine is True


def test_verdict_failed_menolak_walau_kunci_terbukti():
    """FAILED berarti verdict berhasil diambil DAN menyatakan agent palsu.
    Itu berbeda dari verdict yang tidak dapat diambil."""
    t = demo.telemetry_bersih()
    t.attestation.play_integrity = "FAILED"
    a = _assess(t)
    assert a.attestation_ok is False
    assert pdp.decide(a, "standard").decision == "deny"


def test_verdict_tidak_diperoleh_sah_pada_mode_air_gapped():
    """Pada jaringan air-gapped token Play Integrity mustahil diverifikasi,
    karena membukanya menuntut menghubungi Google. Menyamakan ketiadaan
    verdict dengan agent palsu pernah membuat SELURUH perangkat ditolak pada
    mode penggelaran utama produk ini."""
    t = demo.telemetry_bersih()
    t.attestation.play_integrity = "UNAVAILABLE"
    t.attestation.key_attestation = True
    f = rules.evaluate(t)
    assert not any(x.rule_id == "OWL-X01" for x in f)
    a = scoring.score(t, f)
    assert a.attestation_ok is True
    assert pdp.decide(a, "classified").decision == "allow"


def test_verdict_tidak_diperoleh_dicatat_pada_mode_terhubung(monkeypatch):
    """Di luar air-gapped, verdict yang tidak diperoleh tetap dicatat sebagai
    temuan medium: laporannya dipercaya, tetapi analis melihat catatannya."""
    class Terhubung:
        AIR_GAPPED = False
    monkeypatch.setattr(rules, "settings", Terhubung)
    t = demo.telemetry_bersih()
    t.attestation.play_integrity = "UNAVAILABLE"
    f = rules.evaluate(t)
    x = next(x for x in f if x.rule_id == "OWL-X01")
    assert x.severity == "medium"
    a = scoring.score(t, f)
    assert a.attestation_ok is True


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
