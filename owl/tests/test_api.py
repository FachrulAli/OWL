"""Uji API: autentikasi, penolakan data tidak valid, dan kebijakan.

Memetakan ke Requirements FR-01, FR-04, FR-05, FR-07, FR-10, FR-12, dan
NFR 5.1, serta butir checklist "uji data kosong, tidak valid, dan indikator
tidak tersedia" dan "uji autentikasi dan otorisasi API".
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "services" / "backend"
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import policy  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402


def _paksa(name: str, value):
    """`Settings` adalah dataclass beku, jadi setattr biasa ditolak. Untuk uji,
    nilainya ditimpa lewat object.__setattr__ dan dikembalikan sesudahnya."""
    lama = getattr(settings, name)
    object.__setattr__(settings, name, value)
    return lama


@pytest.fixture()
def client(tmp_path):
    db_lama = _paksa("DB_PATH", str(tmp_path / "uji.db"))
    policy.reset()
    with TestClient(app) as c:
        yield c
    policy.reset()
    _paksa("DB_PATH", db_lama)


def _telemetri(device_id: str = "UJI-01") -> dict:
    return {
        "device_id": device_id,
        "collected_at": "2026-11-13T00:00:00Z",
        "apps": [], "accessibility_services": [], "user_certificates": [],
        "vpn_profiles": [], "overlay_packages": [],
        "attestation": {"play_integrity": "MEETS_STRONG_INTEGRITY",
                        "key_attestation": True},
        "integrity": {"security_patch": "2026-11-01"},
        "network": {"egress_mb_24h": 0.0, "screen_on_ratio_24h": 0.5},
    }


# ——————————————————————— FR-01 registrasi ———————————————————————

def test_registrasi_perangkat(client):
    r = client.post("/api/devices", json={"device_id": "UJI-01", "label": "HP uji"})
    assert r.status_code == 200 and r.json()["ok"] is True
    assert any(d["device_id"] == "UJI-01" for d in client.get("/api/devices").json())


def test_telemetri_perangkat_belum_terdaftar_ditolak(client):
    r = client.post("/api/telemetry", json=_telemetri("BELUM-ADA"),
                    headers={"X-OWL-Token": settings.INGEST_TOKEN})
    assert r.status_code == 404


# ——————————————————————— FR-04 validasi ———————————————————————

def test_telemetri_tidak_valid_ditolak_dan_dicatat(client):
    r = client.post("/api/telemetry", json={"collected_at": "bukan tanggal"},
                    headers={"X-OWL-Token": settings.INGEST_TOKEN})
    assert r.status_code == 422
    rejects = client.get("/api/rejects").json()
    assert any(x["reason"] == "telemetri tidak valid" for x in rejects)


def test_badan_kosong_ditolak_dan_dicatat(client):
    r = client.post("/api/telemetry", json={},
                    headers={"X-OWL-Token": settings.INGEST_TOKEN})
    assert r.status_code == 422
    assert client.get("/api/rejects").json()


def test_token_penggelaran_salah_ditolak_dan_dicatat(client):
    r = client.post("/api/telemetry", json=_telemetri(),
                    headers={"X-OWL-Token": "salah"})
    assert r.status_code == 401
    assert any(x["reason"] == "token tidak sah" for x in client.get("/api/rejects").json())


# ——————————————————————— FR-03 indikator tidak tersedia ———————————————————————

def test_indikator_tidak_terbaca_melewati_aturannya(client):
    """Indikator yang tidak dapat diperiksa tidak boleh dianggap lulus."""
    client.post("/api/devices", json={"device_id": "UJI-01"})
    t = _telemetri()
    t["availability"] = {
        "certificates": {"status": "unavailable", "reason": "trust store tidak terbaca"},
        "network_destinations": {"status": "not_supported", "reason": "butuh resolver satuan"},
    }
    r = client.post("/api/telemetry", json=t,
                    headers={"X-OWL-Token": settings.INGEST_TOKEN})
    assert r.status_code == 200
    a = r.json()["assessment"]
    assert set(a["skipped_rules"]) == {"OWL-C01", "OWL-N02", "OWL-N03"}
    assert a["availability"]["certificates"]["status"] == "unavailable"


# ——————————————————————— FR-05 dan FR-07 ———————————————————————

def test_skor_dapat_direproduksi(client):
    """Input dan aturan yang sama harus menghasilkan skor yang sama."""
    client.post("/api/devices", json={"device_id": "UJI-01"})
    skor = []
    for _ in range(3):
        r = client.post("/api/telemetry", json=_telemetri(),
                        headers={"X-OWL-Token": settings.INGEST_TOKEN})
        skor.append(r.json()["assessment"]["score"])
    assert len(set(skor)) == 1


@pytest.mark.parametrize("resource,harapan", [("standard", "limited"), ("classified", "deny")])
def test_rekomendasi_mengikuti_ambang(client, resource, harapan):
    client.post("/api/demo/seed")
    r = client.post(f"/api/gate/KOMANDO-02?resource={resource}")
    assert r.json()["decision"] == harapan


def test_empat_tingkat_risiko_terjangkau(client):
    """Checklist: uji skenario risiko rendah, sedang, tinggi, dan kritis.

    Tiap kasus memakai perangkat berbeda. Memakai satu perangkat berulang
    akan membuat skor terbawa naik oleh lantai peluruhan, sehingga ujinya
    menguji urutan pengiriman, bukan aturannya.
    """
    kasus = {
        # rendah: tidak ada indikator berisiko
        "UJI-RENDAH": {},
        # sedang: satu layanan aksesibilitas, kategori runtime jenuh di 30
        "UJI-SEDANG": {"accessibility_services": [{"package": "com.x"}]},
        # tinggi: runtime 30 + aplikasi 25 + konfigurasi 20 = 75
        "UJI-TINGGI": {
            "accessibility_services": [{"package": "com.x"}],
            "overlay_packages": ["com.x"],
            "user_certificates": [{"subject": "CN=Proxy"}],
            "vpn_profiles": [{"name": "vpn-asing"}],
            "apps": [{"package": "com.y", "installer": "",
                      "permissions": ["android.permission.RECORD_AUDIO",
                                      "android.permission.CAMERA"]}],
        },
        # kritis: seluruh kategori menyala, termasuk root dan patch sangat tua
        "UJI-KRITIS": {
            "accessibility_services": [{"package": "com.x"}],
            "overlay_packages": ["com.x"],
            "user_certificates": [{"subject": "CN=Proxy"}],
            "vpn_profiles": [{"name": "vpn-asing"}],
            "apps": [{"package": "com.y", "installer": "",
                      "permissions": ["android.permission.RECORD_AUDIO",
                                      "android.permission.CAMERA"]}],
            "integrity": {"security_patch": "2020-01-01",
                          "root_artifacts": ["/system/xbin/su"]},
            "network": {"egress_mb_24h": 500.0, "screen_on_ratio_24h": 0.0,
                        "unusual_destinations": ["203.0.113.9"]},
        },
    }
    hasil = {}
    for device_id, tambahan in kasus.items():
        client.post("/api/devices", json={"device_id": device_id})
        t = _telemetri(device_id) | tambahan
        r = client.post("/api/telemetry", json=t,
                        headers={"X-OWL-Token": settings.INGEST_TOKEN})
        assert r.status_code == 200, r.text
        hasil[device_id] = r.json()["assessment"]["level"]

    assert hasil == {
        "UJI-RENDAH": "rendah", "UJI-SEDANG": "sedang",
        "UJI-TINGGI": "tinggi", "UJI-KRITIS": "kritis",
    }


# ——————————————————————— FR-10 audit ———————————————————————

def test_keputusan_tercatat_sebagai_event_audit(client):
    client.post("/api/demo/seed")
    client.post("/api/gate/KOMANDO-02?resource=classified")
    d = client.get("/api/decisions").json()
    assert d and all(k in d[0] for k in ("decided_at", "device_id", "score", "decision", "reason"))


# ——————————————————————— FR-12 dan NFR 5.1 ———————————————————————

def test_kebijakan_butuh_token_administrasi(client):
    r = client.put("/api/policy/threshold", json={"name": "high", "value": 60})
    assert r.status_code == 403


def test_kebijakan_berubah_dan_tercatat(client):
    h = {"X-OWL-Admin": settings.ADMIN_TOKEN}
    r = client.put("/api/policy/threshold", json={"name": "high", "value": 60}, headers=h)
    assert r.status_code == 200 and r.json()["old"] == 70.0
    p = client.get("/api/policy").json()
    assert p["thresholds"]["high"] == 60.0
    assert any(a["field"] == "threshold.high" for a in p["audit"])


def test_perubahan_kebijakan_yang_ditolak_tidak_berlaku(client):
    """Perubahan yang gagal tetapi tetap mengubah ambang jauh lebih berbahaya
    daripada perubahan yang gagal terang-terangan."""
    h = {"X-OWL-Admin": settings.ADMIN_TOKEN}
    sebelum = client.get("/api/policy").json()["thresholds"]
    r = client.put("/api/policy/threshold", json={"name": "medium", "value": 95}, headers=h)
    assert r.status_code == 400
    assert client.get("/api/policy").json()["thresholds"] == sebelum


def test_bobot_dapat_diubah_dan_memengaruhi_penilaian_berikutnya(client):
    h = {"X-OWL-Admin": settings.ADMIN_TOKEN}
    client.post("/api/demo/seed")
    sebelum = client.get("/api/devices").json()
    skor_sebelum = {d["device_id"]: d["score"] for d in sebelum}
    assert client.put("/api/policy/weight", json={"category": "runtime", "value": 10},
                      headers=h).status_code == 200
    client.post("/api/demo/seed")
    sesudah = {d["device_id"]: d["score"] for d in client.get("/api/devices").json()}
    assert sesudah["KOMANDO-02"] < skor_sebelum["KOMANDO-02"]


def test_kunci_api_baca_ditegakkan_saat_diisi(client):
    lama = _paksa("API_KEY", "rahasia-baca")
    try:
        assert client.get("/api/devices").status_code == 401
        assert client.get("/api/devices",
                          headers={"X-OWL-Api-Key": "rahasia-baca"}).status_code == 200
        assert client.get("/health").status_code == 200   # kesehatan tetap terbuka
    finally:
        _paksa("API_KEY", lama)
