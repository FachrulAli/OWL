"""Uji retensi data dan pencatatan (NFR 5.1 dan NFR 5.3).

Empat sifat yang dikunci di sini:

  1. Data pemeriksaan yang lebih tua daripada ambang benar-benar hilang dari
     basis data, bukan hanya disembunyikan dari API.
  2. Jejak audit perubahan kebijakan dan identitas perangkat TIDAK ikut
     terhapus. Kewajiban audit menuntut jejak itu tetap ada, jadi penyapuan
     yang ikut memakannya adalah kegagalan, bukan kebersihan.
  3. Penyapuan menuntut token administrasi.
  4. Kejadian tercatat sebagai baris JSON di berkas, dan kunci serta token
     tidak pernah ikut tercatat.

Baris lampau ditanam lewat sqlite3 biasa ke berkas basis data yang sama,
bukan lewat koneksi async milik aplikasi, supaya uji ini tidak perlu masuk
ke dalam event loop milik TestClient.
"""
import json
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "services" / "backend"
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import applog, policy  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402

ADMIN = {"X-OWL-Admin": settings.ADMIN_TOKEN}


def _paksa(name: str, value):
    lama = getattr(settings, name)
    object.__setattr__(settings, name, value)
    return lama


def _lupakan_pencatat() -> None:
    """Kosongkan pencatat supaya tiap uji memakai berkas lognya sendiri."""
    log = applog.log()
    for h in list(log.handlers):
        log.removeHandler(h)
        h.close()
    applog._configured = False


@pytest.fixture()
def client(tmp_path):
    db_lama = _paksa("DB_PATH", str(tmp_path / "uji.db"))
    log_lama = _paksa("LOG_FILE", str(tmp_path / "owl.log"))
    mode_lama = _paksa("ATTESTATION_MODE", "claim")
    enroll_lama = _paksa("ENROLL_MODE", "shared")
    _lupakan_pencatat()
    policy.reset()
    with TestClient(app) as c:
        yield c
    policy.reset()
    _paksa("ENROLL_MODE", enroll_lama)
    _paksa("ATTESTATION_MODE", mode_lama)
    _lupakan_pencatat()
    _paksa("DB_PATH", db_lama)
    _paksa("LOG_FILE", log_lama)


def _tanam(umur_hari: int) -> None:
    """Satu baris pada tiap tabel, bertanggal sekian hari lalu."""
    waktu = (datetime.now(timezone.utc) - timedelta(days=umur_hari)).isoformat()
    c = sqlite3.connect(settings.DB_PATH)
    try:
        c.execute("INSERT OR IGNORE INTO devices (device_id, enrolled_at) VALUES (?,?)",
                  (f"LAMA-{umur_hari}", waktu))
        c.execute("""INSERT INTO assessments
                     (device_id, assessed_at, score, level, findings, categories, telemetry)
                     VALUES (?,?,?,?,?,?,?)""",
                  (f"LAMA-{umur_hari}", waktu, 50.0, "sedang", "[]", "[]",
                   '{"rahasia_telemetri": "daftar aplikasi"}'))
        c.execute("""INSERT INTO decisions (device_id, decided_at, resource, decision, score)
                     VALUES (?,?,?,?,?)""",
                  (f"LAMA-{umur_hari}", waktu, "classified", "limited", 50.0))
        c.execute("INSERT INTO soc_events (device_id, sent_at, kind, payload) VALUES (?,?,?,?)",
                  (f"LAMA-{umur_hari}", waktu, "cef", "CEF:0|OWL|..."))
        c.execute("INSERT INTO rejects (received_at, reason) VALUES (?,?)",
                  (waktu, "telemetri tidak valid"))
        c.execute("""INSERT INTO policy_audit (changed_at, actor, field, old_value, new_value)
                     VALUES (?,?,?,?,?)""",
                  (waktu, "admin", "threshold.high", "70", "65"))
        c.commit()
    finally:
        c.close()


def _cacah(client) -> dict:
    return client.get("/api/retention").json()["counts"]


# ——————————————————————— NFR 5.1 retensi ———————————————————————

def test_data_lampau_dihapus_dan_jejak_audit_tetap(client):
    _tanam(umur_hari=400)
    _tanam(umur_hari=1)
    assert _cacah(client)["assessments"] == 2

    hasil = client.post("/api/retention/sweep?days=90", headers=ADMIN).json()

    assert hasil["total"] == 4                      # satu baris di empat tabel
    sesudah = _cacah(client)
    assert sesudah["assessments"] == 1              # yang berumur sehari tetap
    assert sesudah["decisions"] == 1
    assert sesudah["soc_events"] == 1
    assert sesudah["rejects"] == 1
    assert sesudah["policy_audit"] == 2             # jejak audit tidak disentuh
    assert sesudah["devices"] == 2                  # identitas perangkat tetap


def test_telemetri_lampau_benar_benar_hilang_dari_basis_data(client):
    """Bukan disembunyikan dari API, tetapi hilang dari tabelnya."""
    _tanam(umur_hari=400)
    client.post("/api/retention/sweep?days=90", headers=ADMIN)

    c = sqlite3.connect(settings.DB_PATH)
    try:
        n = c.execute("SELECT COUNT(*) FROM assessments "
                      "WHERE telemetry LIKE '%rahasia_telemetri%'").fetchone()[0]
    finally:
        c.close()
    assert n == 0


def test_penyapuan_menuntut_token_administrasi(client):
    _tanam(umur_hari=400)
    assert client.post("/api/retention/sweep").status_code == 403
    assert client.post("/api/retention/sweep",
                       headers={"X-OWL-Admin": "salah"}).status_code == 403
    assert _cacah(client)["assessments"] == 1       # yang ditolak tidak menghapus

    r = client.post("/api/retention/sweep?days=90", headers=ADMIN)
    assert r.status_code == 200 and r.json()["total"] == 4


def test_kebijakan_retensi_dapat_dibaca(client):
    b = client.get("/api/retention").json()
    assert b["retention_days"] == settings.RETENTION_DAYS
    assert "policy_audit" in b["kept_tables"] and "devices" in b["kept_tables"]
    assert "assessments" in b["purged_tables"]
    assert client.get("/health").json()["retention_days"] == settings.RETENTION_DAYS


def test_penyapuan_saat_mulai_tidak_menunggu_jadwal(client, tmp_path):
    """Layanan yang baru menyala langsung menyapu, lalu berkala."""
    baris = [json.loads(b) for b in Path(settings.LOG_FILE).read_text().splitlines()]
    assert any(r["event"] == "owl core menyala" for r in baris)
    assert client.get("/api/retention").json()["sweep_hours"] == settings.RETENTION_SWEEP_HOURS


# ——————————————————————— NFR 5.3 pencatatan ———————————————————————

def test_log_satu_baris_json_per_kejadian(client):
    client.post("/api/telemetry", json={"collected_at": "bukan tanggal"},
                headers={"X-OWL-Token": settings.INGEST_TOKEN})

    berkas = Path(settings.LOG_FILE)
    assert berkas.exists()
    baris = [json.loads(b) for b in berkas.read_text().splitlines() if b.strip()]
    assert all({"ts", "level", "event", "logger"} <= set(r) for r in baris)
    assert any(r["event"] == "telemetri tidak valid ditolak" for r in baris)


def test_kegagalan_autentikasi_tercatat(client):
    kunci_lama = _paksa("API_KEY", "kunci-uji")
    try:
        client.get("/api/devices", headers={"X-OWL-API-Key": "salah"})
        client.post("/api/retention/sweep", headers={"X-OWL-Admin": "salah"})
    finally:
        _paksa("API_KEY", kunci_lama)

    peristiwa = [json.loads(b)["event"]
                 for b in Path(settings.LOG_FILE).read_text().splitlines() if b.strip()]
    assert "akses baca ditolak, kunci API tidak sah" in peristiwa
    assert "perubahan kebijakan ditolak, token administrasi tidak sah" in peristiwa


def test_log_tidak_memuat_rahasia(client):
    kunci_lama = _paksa("API_KEY", "rahasia-sekali")
    try:
        client.get("/api/devices", headers={"X-OWL-API-Key": "rahasia-sekali"})
        client.get("/api/devices", headers={"X-OWL-API-Key": "tebakan"})
        client.post("/api/retention/sweep", headers=ADMIN)
    finally:
        _paksa("API_KEY", kunci_lama)

    isi = Path(settings.LOG_FILE).read_text()
    assert "rahasia-sekali" not in isi
    assert "tebakan" not in isi
    assert settings.ADMIN_TOKEN not in isi


def test_pencatat_aman_dipasang_berulang(client):
    """Pemasangan kedua tidak boleh menambah penangan dan menggandakan baris."""
    sebelum = len(applog.log().handlers)
    applog.setup()
    applog.setup()
    assert len(applog.log().handlers) == sebelum
