"""Uji roadmap A1 sampai A4: daftar pencabutan, pencabutan perangkat,
pengikatan penanda tangan agent, dan token pendaftaran per perangkat."""
import base64
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "services" / "backend"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest  # noqa: E402
from cryptography import x509  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import attest, policy  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from test_attestation import Rantai, _kirim, _telemetri, PAKET, SIDIK  # noqa: E402

TOKEN = {"X-OWL-Token": settings.INGEST_TOKEN}
ADMIN = {"X-OWL-Admin": settings.ADMIN_TOKEN}


def _paksa(name: str, value):
    lama = getattr(settings, name)
    object.__setattr__(settings, name, value)
    return lama


@pytest.fixture()
def rantai(monkeypatch):
    r = Rantai()
    monkeypatch.setattr(attest, "_roots_cache", [r.root])
    monkeypatch.setattr(attest, "_roots_source", str(attest.ROOTS_PATH))
    return r


@pytest.fixture()
def client(tmp_path):
    db_lama = _paksa("DB_PATH", str(tmp_path / "a.db"))
    mode_lama = _paksa("ATTESTATION_MODE", "verify")
    enroll_lama = _paksa("ENROLL_MODE", "shared")
    policy.reset()
    with TestClient(app) as c:
        yield c
    policy.reset()
    _paksa("ENROLL_MODE", enroll_lama)
    _paksa("ATTESTATION_MODE", mode_lama)
    _paksa("DB_PATH", db_lama)


def _daftar(client, rantai, device_id, headers=None, **kw):
    h = dict(TOKEN) | (headers or {})
    ch = client.get(f"/api/enroll/challenge?device_id={device_id}", headers=h)
    if ch.status_code != 200:
        return ch
    return client.post("/api/devices", headers=h, json={
        "device_id": device_id,
        "attestation_chain": rantai.buat(base64.b64decode(ch.json()["challenge"]), **kw)})


def _serial_daun(rantai, tantangan=b"x" * 32) -> int:
    daun = x509.load_der_x509_certificate(base64.b64decode(rantai.buat(tantangan)[0]))
    return daun.serial_number


# ——————————————————————— A1: daftar pencabutan ———————————————————————

def test_rantai_dengan_seri_tercabut_ditolak(rantai):
    ch = b"c" * 32
    chain = rantai.buat(ch)
    daun = x509.load_der_x509_certificate(base64.b64decode(chain[0]))
    for bentuk in (str(daun.serial_number), format(daun.serial_number, "x")):
        r = attest.verify_chain(chain, ch, revoked={attest.normalize_serial(bentuk)})
        assert not r.verified and "daftar pencabutan Google" in r.reason, bentuk


def test_rantai_tanpa_seri_tercabut_lolos(rantai):
    ch = b"c" * 32
    assert attest.verify_chain(rantai.buat(ch), ch, revoked={"deadbeef"}).verified


def test_impor_menuntut_admin_dan_bentuk_yang_benar(client):
    assert client.post("/api/attestation/revocations", json={"entries": {"1": {}}}).status_code == 403
    assert client.post("/api/attestation/revocations", json={}, headers=ADMIN).status_code == 400
    assert client.post("/api/attestation/revocations", json={"entries": {"1": "bukan objek"}},
                       headers=ADMIN).status_code == 400


def test_pencabutan_yang_diimpor_berlaku_pada_perangkat_yang_sudah_terdaftar(client, rantai):
    """Daftar baru harus langsung berlaku untuk perangkat yang mendaftar SEBELUMNYA."""
    assert _daftar(client, rantai, "HP-01").json()["attested"] is True
    assert _kirim(client, rantai, _telemetri("HP-01", 1)).json()["decision"]["decision"] == "allow"

    dev = client.get("/api/devices/HP-01", headers={"X-OWL-Api-Key": settings.API_KEY} if settings.API_KEY else {}).json()
    seri = dev["device"]["attestation"]["chain_serials"][0]
    r = client.post("/api/attestation/revocations?source_date=2026-11-15",
                    json={"entries": {seri: {"status": "REVOKED", "reason": "KEY_COMPROMISE"}}}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["entries"] == 1

    j = _kirim(client, rantai, _telemetri("HP-01", 2)).json()
    assert j["decision"]["decision"] == "deny"
    x01 = next(f for f in j["assessment"]["findings"] if f["rule_id"] == "OWL-X01")
    assert any("pencabutan" in e for e in x01["evidence"])


def test_daftar_diganti_bukan_ditambah(client):
    client.post("/api/attestation/revocations", json={"entries": {"aa": {"status": "REVOKED"}, "bb": {}}}, headers=ADMIN)
    r = client.post("/api/attestation/revocations", json={"entries": {"cc": {}}}, headers=ADMIN)
    assert r.json() == {"ok": True, "entries": 1, "previous": 2}


def test_health_menyatakan_daftar_belum_diimpor_lalu_terkini(client):
    assert client.get("/health").json()["revocation"]["status"] == "belum diimpor"
    client.post("/api/attestation/revocations", json={"entries": {"aa": {}}}, headers=ADMIN)
    h = client.get("/health").json()["revocation"]
    assert h["status"] == "terkini" and h["entries"] == 1


def test_daftar_yang_basi_dinyatakan_basi(client):
    client.post("/api/attestation/revocations", json={"entries": {"aa": {}}}, headers=ADMIN)
    lama = _paksa("REVOCATION_MAX_AGE_DAYS", -1.0)
    try:
        assert client.get("/health").json()["revocation"]["status"] == "basi"
    finally:
        _paksa("REVOCATION_MAX_AGE_DAYS", lama)


# ——————————————————————— A2: pencabutan perangkat ———————————————————————

def test_perangkat_dicabut_ditolak_walau_tanda_tangannya_sah(client, rantai):
    _daftar(client, rantai, "HP-01")
    assert _kirim(client, rantai, _telemetri("HP-01", 1)).status_code == 200

    assert client.put("/api/devices/HP-01/revoke", json={"reason": "hilang"}).status_code == 403
    r = client.put("/api/devices/HP-01/revoke", json={"reason": "HP hilang di lapangan"}, headers=ADMIN)
    assert r.status_code == 200

    assert _kirim(client, rantai, _telemetri("HP-01", 2)).status_code == 403
    assert any(x["reason"] == "laporan dari perangkat dicabut" for x in client.get("/api/rejects").json())
    g = client.post("/api/gate/HP-01?resource=standard").json()
    assert g["decision"] == "deny" and g["quarantine"] is True and "HP hilang" in g["reason"]
    # tidak dapat mendaftar ulang untuk lolos dari pencabutan
    assert _daftar(client, rantai, "HP-01").status_code == 403


def test_pencabutan_dapat_dibuka_dan_tercatat(client, rantai):
    _daftar(client, rantai, "HP-01")
    client.put("/api/devices/HP-01/revoke", json={"reason": "uji pencabutan"}, headers=ADMIN)
    assert client.delete("/api/devices/HP-01/revoke", headers=ADMIN).status_code == 200
    assert _kirim(client, rantai, _telemetri("HP-01", 5)).status_code == 200
    audit = client.get("/api/policy").json()["audit"]
    assert [a["field"] for a in audit if a["field"] == "device.revoke:HP-01"] == ["device.revoke:HP-01"] * 2


def test_mencabut_perangkat_tak_dikenal_404(client):
    assert client.put("/api/devices/TAK-ADA/revoke", json={"reason": "uji saja"}, headers=ADMIN).status_code == 404


# ——————————————————————— A3: pengikatan penanda tangan ———————————————————————

def test_penggelaran_tanpa_penanda_tangan_menolak_pendaftaran(client, rantai):
    demo = _paksa("DEMO_MODE", False)
    try:
        r = _daftar(client, rantai, "HP-01")
        assert r.json()["attested"] is False and "OWL_AGENT_SIGNERS" in r.json()["attestation"]["reason"]
        assert client.get("/health").json()["agent_signers"] == "kosong"
        sg = _paksa("AGENT_SIGNERS", SIDIK)
        try:
            assert _daftar(client, rantai, "HP-02").json()["attested"] is True
            assert client.get("/health").json()["agent_signers"] == "aktif"
        finally:
            _paksa("AGENT_SIGNERS", sg)
    finally:
        _paksa("DEMO_MODE", demo)


def test_mode_demo_tetap_mengizinkan_tanpa_penanda_tangan(client, rantai):
    assert _paksa("DEMO_MODE", True) is not None
    assert _daftar(client, rantai, "HP-01").json()["attested"] is True


# ——————————————————————— A4: token pendaftaran ———————————————————————

@pytest.fixture()
def mode_token(client):
    lama = _paksa("ENROLL_MODE", "token")
    yield
    _paksa("ENROLL_MODE", lama)


def _terbitkan(client, device_id, **kw):
    r = client.post("/api/enroll/tokens", json={"device_id": device_id} | kw, headers=ADMIN)
    assert r.status_code == 200, r.text
    return r.json()


def test_penerbitan_token_menuntut_admin(client, mode_token):
    assert client.post("/api/enroll/tokens", json={"device_id": "HP-01"}).status_code == 403


def test_token_bersama_tidak_cukup_untuk_mendaftar(client, rantai, mode_token):
    r = _daftar(client, rantai, "HP-01")
    assert r.status_code == 401
    assert "tidak dikirim" in r.json()["detail"]
    r = client.post("/api/devices", json={"device_id": "PENYUSUP"}, headers=TOKEN)
    assert r.status_code == 401
    assert not any(d["device_id"] == "PENYUSUP" for d in client.get("/api/devices").json())


def test_token_per_perangkat_sekali_pakai(client, rantai, mode_token):
    t = _terbitkan(client, "HP-01")
    assert t["provision_url"].startswith("owl://enroll?") and t["token"] in t["provision_url"]
    h = {"X-OWL-Enroll": t["token"]}
    r = _daftar(client, rantai, "HP-01", headers=h)
    assert r.status_code == 200 and r.json()["attested"] is True
    # sudah hangus: tidak dapat dipakai lagi, termasuk untuk meminta tantangan
    assert _daftar(client, rantai, "HP-01", headers=h).status_code == 401
    assert "sudah dipakai" in _daftar(client, rantai, "HP-01", headers=h).json()["detail"]


def test_token_perangkat_lain_ditolak(client, rantai, mode_token):
    t = _terbitkan(client, "HP-01")
    r = _daftar(client, rantai, "HP-02", headers={"X-OWL-Enroll": t["token"]})
    assert r.status_code == 401 and "perangkat lain" in r.json()["detail"]


def test_token_kedaluwarsa_ditolak(client, rantai, mode_token):
    t = _terbitkan(client, "HP-01", ttl_minutes=0.0001)
    import time
    time.sleep(0.05)
    r = _daftar(client, rantai, "HP-01", headers={"X-OWL-Enroll": t["token"]})
    assert r.status_code == 401 and "kedaluwarsa" in r.json()["detail"]


def test_pendaftaran_gagal_verifikasi_tidak_menghanguskan_token(client, rantai, mode_token):
    t = _terbitkan(client, "HP-01")
    asing = Rantai()
    assert _daftar(client, asing, "HP-01", headers={"X-OWL-Enroll": t["token"]}).json()["attested"] is False
    r = _daftar(client, rantai, "HP-01", headers={"X-OWL-Enroll": t["token"]})
    assert r.json()["attested"] is True


def test_pengambilalihan_identitas_butuh_token_dari_admin(client, rantai, mode_token):
    """Dulu pendaftaran ulang dengan perangkat keras lain yang sah dapat menimpa
    kunci perangkat korban. Sekarang menuntut token yang hanya admin terbitkan."""
    t = _terbitkan(client, "HP-KORBAN")
    assert _daftar(client, rantai, "HP-KORBAN", headers={"X-OWL-Enroll": t["token"]}).json()["attested"] is True
    penyerang = Rantai()
    assert _daftar(client, penyerang, "HP-KORBAN").status_code == 401
    assert _kirim(client, rantai, _telemetri("HP-KORBAN", 1)).status_code == 200   # kunci korban utuh


def test_token_disimpan_sebagai_sidik(client, mode_token):
    import sqlite3
    t = _terbitkan(client, "HP-01")
    con = sqlite3.connect(settings.DB_PATH)
    isi = json.dumps(con.execute("SELECT * FROM enroll_tokens").fetchall())
    assert t["token"] not in isi
