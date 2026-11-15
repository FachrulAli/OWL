"""Uji verifikasi Key Attestation dan laporan bertanda tangan.

Rantai di sini dibuat sendiri dengan akar uji, lalu akar itu disematkan
menggantikan akar Google. Yang diuji adalah LOGIKA verifikasinya: rantai,
tantangan, tingkat keamanan, keadaan boot, dan identitas aplikasi. Bahwa
perangkat sungguhan menghasilkan rantai yang berujung pada akar Google
dibuktikan terpisah pada perangkat fisik, bukan di sini.
"""
import base64
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "services" / "backend"
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402
from cryptography import x509  # noqa: E402
from cryptography.hazmat.primitives import hashes, serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from cryptography.x509.oid import NameOID  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import attest, policy  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402

TOKEN = {"X-OWL-Token": settings.INGEST_TOKEN}
PAKET = "id.tniad.owl.agent"
SIDIK = "aa" * 32


# ——————————————————————— pembuat DER untuk uji ———————————————————————

def _len(n: int) -> bytes:
    if n < 0x80:
        return bytes([n])
    b = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(b)]) + b


def _tlv(tag: bytes, content: bytes) -> bytes:
    return tag + _len(len(content)) + content


def _int(v: int) -> bytes:
    return _tlv(b"\x02", v.to_bytes(max(1, (v.bit_length() + 8) // 8), "big"))


def _enum(v: int) -> bytes:
    return _tlv(b"\x0a", bytes([v]))


def _oct(b: bytes) -> bytes:
    return _tlv(b"\x04", b)


def _seq(*parts: bytes) -> bytes:
    return _tlv(b"\x30", b"".join(parts))


def _set(*parts: bytes) -> bytes:
    return _tlv(b"\x31", b"".join(parts))


def _ctx(tag: int, content: bytes) -> bytes:
    """Tag konteks EXPLICIT, termasuk bentuk bernomor tinggi (704 dst.)."""
    if tag < 31:
        return _tlv(bytes([0xA0 | tag]), content)
    digits = []
    while True:
        digits.insert(0, tag & 0x7F)
        tag >>= 7
        if not tag:
            break
    body = bytes([d | 0x80 for d in digits[:-1]] + [digits[-1]])
    return _tlv(b"\xbf" + body, content)


def _key_description(challenge: bytes, level: int = 1, boot_state: int = 0,
                     locked: bool = True, paket: str = PAKET) -> bytes:
    app_id = _seq(_set(_seq(_oct(paket.encode()), _int(1))), _set(_oct(bytes.fromhex(SIDIK))))
    software = _seq(_ctx(709, _oct(app_id)))
    root_of_trust = _seq(_oct(b"\x01" * 32), _tlv(b"\x01", b"\xff" if locked else b"\x00"),
                         _enum(boot_state), _oct(b"\x02" * 32))
    tee = _seq(_ctx(704, root_of_trust), _ctx(705, _int(120000)), _ctx(706, _int(202412)))
    return _seq(_int(100), _enum(level), _int(100), _enum(level),
                _oct(challenge), _oct(b""), software, tee)


# ——————————————————————— pembuat rantai ———————————————————————

def _name(cn: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def _cert(subject, issuer, pub, signer, ext: bytes | None = None, ca: bool = False):
    now = datetime.now(timezone.utc)
    b = (x509.CertificateBuilder().subject_name(_name(subject)).issuer_name(_name(issuer))
         .public_key(pub).serial_number(x509.random_serial_number())
         .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=365)))
    if ca:
        b = b.add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
    if ext is not None:
        b = b.add_extension(x509.UnrecognizedExtension(attest.KEY_DESCRIPTION_OID, ext), critical=False)
    return b.sign(signer, hashes.SHA256())


class Rantai:
    """Akar uji, perantara, dan kunci agent beserta rantai attestation-nya."""

    def __init__(self):
        self.root_key = ec.generate_private_key(ec.SECP384R1())
        self.root = _cert("Akar Uji", "Akar Uji", self.root_key.public_key(), self.root_key, ca=True)
        self.mid_key = ec.generate_private_key(ec.SECP256R1())
        self.mid = _cert("Perantara Uji", "Akar Uji", self.mid_key.public_key(), self.root_key, ca=True)
        self.agent_key = ec.generate_private_key(ec.SECP256R1())

    def buat(self, challenge: bytes, **kw) -> list[str]:
        leaf = _cert("Android Keystore Key", "Perantara Uji", self.agent_key.public_key(),
                     self.mid_key, ext=_key_description(challenge, **kw))
        return [base64.b64encode(c.public_bytes(serialization.Encoding.DER)).decode()
                for c in (leaf, self.mid, self.root)]

    def tanda_tangan(self, body: bytes) -> str:
        return base64.b64encode(self.agent_key.sign(body, ec.ECDSA(hashes.SHA256()))).decode()


@pytest.fixture()
def rantai(monkeypatch):
    r = Rantai()
    monkeypatch.setattr(attest, "_roots_cache", [r.root])
    return r


# ——————————————————————— verifikasi rantai ———————————————————————

def test_akar_google_yang_disematkan_terbaca():
    attest._roots_cache = None
    roots = attest.trusted_roots()
    assert len(roots) == 2
    assert any("f92009e853b6b045" in r.subject.rfc4514_string() for r in roots)
    attest._roots_cache = None


def test_rantai_sah_diterima_dan_isinya_terbaca(rantai):
    ch = b"tantangan-owl-0123456789abcdef!!"
    r = attest.verify_chain(rantai.buat(ch), ch)
    assert r.verified and r.hardware_backed and r.trusted, r.reason
    assert r.security_level == "tee"
    assert r.boot_state == "verified" and r.device_locked is True and r.boot_ok
    assert r.os_patch_level == "2024-12"
    assert r.app_package == PAKET and r.app_signers == [SIDIK]


def test_tantangan_lain_ditolak(rantai):
    """Rantai lama tidak dapat diputar ulang untuk pendaftaran baru."""
    r = attest.verify_chain(rantai.buat(b"tantangan lama"), b"tantangan baru")
    assert not r.verified and "tantangan" in r.reason


def test_akar_yang_tidak_disematkan_ditolak(rantai):
    lain = Rantai()
    ch = b"x" * 32
    r = attest.verify_chain(lain.buat(ch), ch)
    assert not r.verified and "akar attestation Google" in r.reason
    assert r.security_level == "tee"          # isi tetap terbaca untuk analis


def test_kunci_perangkat_lunak_sah_tetapi_tidak_dipercaya(rantai):
    ch = b"y" * 32
    r = attest.verify_chain(rantai.buat(ch, level=0), ch)
    assert r.verified and not r.hardware_backed and not r.trusted


def test_rantai_yang_diubah_ditolak(rantai):
    ch = b"z" * 32
    chain = rantai.buat(ch)
    palsu = Rantai()
    chain[1] = base64.b64encode(palsu.mid.public_bytes(serialization.Encoding.DER)).decode()
    r = attest.verify_chain(chain, ch)
    assert not r.verified


def test_masukan_rusak_tidak_melempar(rantai):
    for chain in ([], ["bukan base64!!"], [base64.b64encode(b"bukan sertifikat").decode()]):
        r = attest.verify_chain(chain, b"x")
        assert not r.verified and r.reason


# ——————————————————————— alur lewat API ———————————————————————

def _paksa(name: str, value):
    lama = getattr(settings, name)
    object.__setattr__(settings, name, value)
    return lama


@pytest.fixture()
def client(tmp_path):
    db_lama = _paksa("DB_PATH", str(tmp_path / "attest.db"))
    mode_lama = _paksa("ATTESTATION_MODE", "verify")
    policy.reset()
    with TestClient(app) as c:
        yield c
    policy.reset()
    _paksa("ATTESTATION_MODE", mode_lama)
    _paksa("DB_PATH", db_lama)


def _telemetri(device_id: str, detik: int = 0) -> dict:
    at = datetime(2026, 11, 15, 8, 0, 0, tzinfo=timezone.utc) + timedelta(seconds=detik)
    return {
        "device_id": device_id, "collected_at": at.isoformat().replace("+00:00", "Z"),
        "apps": [], "accessibility_services": [], "user_certificates": [],
        "vpn_profiles": [], "overlay_packages": [],
        # Agent yang dikuasai penyerang akan selalu mengklaim ini benar.
        "attestation": {"play_integrity": "UNAVAILABLE", "key_attestation": True},
        "integrity": {"security_patch": datetime.now(timezone.utc).date().isoformat()},
        "network": {"egress_mb_24h": 0.0, "screen_on_ratio_24h": 0.5},
    }


def _daftar(client, rantai, device_id: str, **kw):
    ch = client.get(f"/api/enroll/challenge?device_id={device_id}", headers=TOKEN).json()["challenge"]
    return client.post("/api/devices", headers=TOKEN, json={
        "device_id": device_id, "attestation_chain": rantai.buat(base64.b64decode(ch), **kw)})


def _kirim(client, rantai, t: dict, tanda_tangani: bool = True):
    body = json.dumps(t).encode()
    h = TOKEN | {"Content-Type": "application/json"}
    if tanda_tangani:
        h["X-OWL-Signature"] = rantai.tanda_tangan(body)
    return client.post("/api/telemetry", content=body, headers=h)


def test_tantangan_menuntut_token(client):
    assert client.get("/api/enroll/challenge?device_id=X").status_code == 401


def test_perangkat_terbukti_lolos_dan_laporannya_harus_bertanda_tangan(client, rantai):
    r = _daftar(client, rantai, "HP-01")
    assert r.status_code == 200 and r.json()["attested"] is True

    # Tanpa tanda tangan: ditolak dan dicatat, walau tokennya benar.
    r = _kirim(client, rantai, _telemetri("HP-01"), tanda_tangani=False)
    assert r.status_code == 401
    assert any(x["reason"] == "tanda tangan laporan tidak sah" for x in client.get("/api/rejects").json())

    r = _kirim(client, rantai, _telemetri("HP-01", 1))
    assert r.status_code == 200, r.text
    a = r.json()["assessment"]
    assert a["attestation_ok"] is True and a["score"] == 0.0
    assert a["availability"]["attestation"]["source"] == "server"
    assert r.json()["decision"]["decision"] == "allow"


def test_laporan_bertanda_tangan_kunci_lain_ditolak(client, rantai):
    _daftar(client, rantai, "HP-01")
    penyusup = Rantai()
    assert _kirim(client, penyusup, _telemetri("HP-01")).status_code == 401


def test_laporan_lama_tidak_dapat_diputar_ulang(client, rantai):
    _daftar(client, rantai, "HP-01")
    t = _telemetri("HP-01", 10)
    assert _kirim(client, rantai, t).status_code == 200
    assert _kirim(client, rantai, t).status_code == 409
    assert _kirim(client, rantai, _telemetri("HP-01", 5)).status_code == 409
    assert _kirim(client, rantai, _telemetri("HP-01", 20)).status_code == 200


def test_klaim_agent_tidak_berlaku_tanpa_bukti(client):
    """Perangkat yang mendaftar tanpa rantai, lalu mengklaim key_attestation
    benar. Dulu klaim itu dipercaya; sekarang gerbang menolak."""
    client.post("/api/devices", json={"device_id": "HP-KLAIM"}, headers=TOKEN)
    r = client.post("/api/telemetry", json=_telemetri("HP-KLAIM"), headers=TOKEN)
    assert r.status_code == 200
    assert r.json()["assessment"]["attestation_ok"] is False
    assert r.json()["decision"]["decision"] == "deny"


def test_rantai_berakar_asing_tidak_dipercaya(client, rantai):
    asing = Rantai()
    r = _daftar(client, asing, "HP-EMU")
    assert r.status_code == 200 and r.json()["attested"] is False
    r = _kirim(client, asing, _telemetri("HP-EMU"))
    assert r.status_code == 200
    d = r.json()
    assert d["decision"]["decision"] == "deny"
    x01 = next(f for f in d["assessment"]["findings"] if f["rule_id"] == "OWL-X01")
    assert any("akar attestation Google" in e for e in x01["evidence"])


def test_bootloader_terbuka_menurut_perangkat_keras_ditolak(client, rantai):
    """Keadaan boot datang dari attestation, bukan dari tebakan agent."""
    assert _daftar(client, rantai, "HP-UNLOCK", boot_state=2, locked=False).json()["attested"] is True
    r = _kirim(client, rantai, _telemetri("HP-UNLOCK"))
    d = r.json()
    assert any(f["rule_id"] == "OWL-D01" and f["decisive"] for f in d["assessment"]["findings"])
    assert d["decision"]["decision"] == "deny" and d["decision"]["quarantine"] is True


def test_kunci_yang_diminta_aplikasi_lain_ditolak(client, rantai):
    r = _daftar(client, rantai, "HP-APP", paket="com.aplikasi.lain")
    assert r.json()["attested"] is False
    assert "com.aplikasi.lain" in r.json()["attestation"]["reason"]


def test_penanda_tangan_agent_ditegakkan_jika_diisi(client, rantai):
    lama = _paksa("AGENT_SIGNERS", "bb" * 32)
    try:
        assert _daftar(client, rantai, "HP-SIG").json()["attested"] is False
        _paksa("AGENT_SIGNERS", SIDIK.upper())
        assert _daftar(client, rantai, "HP-SIG2").json()["attested"] is True
    finally:
        _paksa("AGENT_SIGNERS", lama)


def test_kunci_terbukti_tidak_dapat_ditimpa_pendaftaran_tanpa_bukti(client, rantai):
    _daftar(client, rantai, "HP-01")
    r = client.post("/api/devices", json={"device_id": "HP-01", "label": "diambil alih"}, headers=TOKEN)
    assert r.status_code == 409
    # Pendaftaran ulang yang SAH (tantangan baru, rantai baru) tetap boleh.
    assert _daftar(client, rantai, "HP-01").status_code == 200


def test_tantangan_sekali_pakai(client, rantai):
    ch = client.get("/api/enroll/challenge?device_id=HP-02", headers=TOKEN).json()["challenge"]
    chain = rantai.buat(base64.b64decode(ch))
    body = {"device_id": "HP-02", "attestation_chain": chain}
    assert client.post("/api/devices", json=body, headers=TOKEN).json()["attested"] is True
    lain = Rantai()                      # rantai sama dipakai lagi oleh pihak lain
    r = client.post("/api/devices", json={"device_id": "HP-03", "attestation_chain": chain}, headers=TOKEN)
    assert r.json()["attested"] is False
    assert lain is not None


def test_mode_claim_tetap_menerima_klaim_untuk_emulator(client):
    _paksa("ATTESTATION_MODE", "claim")
    client.post("/api/devices", json={"device_id": "EMU"}, headers=TOKEN)
    r = client.post("/api/telemetry", json=_telemetri("EMU"), headers=TOKEN)
    assert r.json()["decision"]["decision"] == "allow"


def test_data_contoh_tetap_dinilai_pada_mode_verify(client):
    client.post("/api/demo/seed")
    skor = {d["device_id"]: d["score"] for d in client.get("/api/devices").json()}
    assert skor == {"TACTICAL-07": 18.0, "KOMANDO-02": 87.0}
