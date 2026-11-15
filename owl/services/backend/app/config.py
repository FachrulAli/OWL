"""Konfigurasi OWL Core.

Seluruh nilai dapat ditimpa lewat variabel lingkungan supaya satuan dapat
menyetel ambang tanpa membangun ulang image.
"""
import os
from dataclasses import dataclass, field


def _f(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


def _s(name: str, default: str) -> str:
    return os.getenv(name, default)


@dataclass(frozen=True)
class Settings:
    # ——— identitas layanan ———
    SERVICE: str = "OWL Core"
    VERSION: str = "1.0.0"

    # ——— penyimpanan ———
    # SQLite untuk purwarupa (deepdive §10.3). PostgreSQL dipakai pada
    # penggelaran satuan; skemanya identik dan ada di infra/postgres.
    DB_PATH: str = _s("OWL_DB", "owl.db")

    # ——— bobot kategori (deepdive §7.2) ———
    # Jumlahnya 100. Dasar logisnya dicatat di dokumen, bukan dikarang di sini.
    WEIGHTS: dict = field(default_factory=lambda: {
        "runtime":  30.0,   # perilaku runtime: aksesibilitas, overlay
        "app":      25.0,   # integritas aplikasi: sideload, izin berlebih
        "config":   20.0,   # konfigurasi: CA pengguna, VPN
        "device":   15.0,   # integritas perangkat: root, patch
        "identity": 10.0,   # sinyal lintas kategori: perilaku jaringan
    })

    # Jumlah severitas yang membuat satu kategori mencapai bobot penuhnya.
    # 5 setara satu temuan critical, atau satu high ditambah satu medium.
    CATEGORY_SATURATION: float = _f("OWL_SATURATION", 5.0)

    # ——— severitas (skala kualitatif setara CVSS) ———
    SEVERITY: dict = field(default_factory=lambda: {
        "low": 1.0, "medium": 2.0, "high": 3.0, "critical": 5.0,
    })

    # ——— peluruhan ———
    # Minus 5 poin per hari tanpa sinyal baru (deepdive §7.2).
    DECAY_PER_DAY: float = _f("OWL_DECAY_PER_DAY", 5.0)

    # ——— ambang keputusan akses (deepdive §7.2) ———
    T_MEDIUM: float = _f("OWL_T_MEDIUM", 30.0)
    T_HIGH: float = _f("OWL_T_HIGH", 70.0)
    T_CRITICAL: float = _f("OWL_T_CRITICAL", 90.0)

    # ——— integrasi SOC ———
    SOC_WEBHOOK_URL: str = _s("OWL_SOC_WEBHOOK", "")
    SOC_WEBHOOK_SECRET: str = _s("OWL_SOC_SECRET", "owl-demo-secret")
    CEF_SYSLOG_HOST: str = _s("OWL_SYSLOG_HOST", "")
    CEF_SYSLOG_PORT: int = int(_s("OWL_SYSLOG_PORT", "514"))

    # ——— penerimaan telemetri ———
    INGEST_TOKEN: str = _s("OWL_INGEST_TOKEN", "owl-demo-token")

    # Kunci baca untuk dashboard dan API (NFR 5.1). Dibiarkan kosong, API
    # terbuka, dan itu HANYA sah untuk purwarupa di jaringan terisolasi.
    # /health dan dokumentasi API tetap terbuka supaya pemeriksaan kesehatan
    # tidak menuntut rahasia.
    API_KEY: str = _s("OWL_API_KEY", "")

    # Kunci administrasi untuk mengubah bobot dan ambang (FR-12).
    ADMIN_TOKEN: str = _s("OWL_ADMIN_TOKEN", "owl-demo-admin")

    # ——— retensi data (NFR 5.1) ———
    # Telemetri, penilaian, keputusan, event SOC, dan penolakan dihapus
    # setelah sekian hari. Jejak audit perubahan kebijakan TIDAK ikut dihapus,
    # sebab kewajiban auditnya justru menuntut jejak itu tetap ada, dan
    # identitas perangkat yang masih terdaftar juga tetap disimpan.
    RETENTION_DAYS: float = _f("OWL_RETENTION_DAYS", 90.0)
    # Jarak antar penyapuan. Penyapuan juga dijalankan sekali saat mulai.
    RETENTION_SWEEP_HOURS: float = _f("OWL_RETENTION_SWEEP_HOURS", 6.0)

    # ——— pencatatan (NFR 5.3) ———
    # Baris JSON ke berkas, berputar pada ukuran tertentu. Dibiarkan kosong,
    # pencatatan hanya ke keluaran standar.
    LOG_FILE: str = _s("OWL_LOG_FILE", "owl.log")
    LOG_MAX_BYTES: int = int(_s("OWL_LOG_MAX_BYTES", str(5 * 1024 * 1024)))
    LOG_BACKUPS: int = int(_s("OWL_LOG_BACKUPS", "3"))

    # ——— kepercayaan pada laporan agent ———
    # verify  OWL Core hanya memercayai perangkat yang rantai Key Attestation-nya
    #         lolos verifikasi di sini. Perangkat tanpa rantai yang sah memicu
    #         OWL-X01 dan ditolak. Ini bawaan.
    # claim   klaim `key_attestation` dari agent dipercaya untuk perangkat yang
    #         TIDAK punya catatan attestation. Hanya untuk emulator dan telemetri
    #         contoh lewat curl; emulator tidak punya kunci attestation Google.
    # Perangkat yang SUDAH mengirim rantai selalu dinilai dari hasil verifikasi,
    # apa pun modenya: bukti mengalahkan klaim.
    ATTESTATION_MODE: str = _s("OWL_ATTESTATION", "verify").lower()
    # Berkas akar yang disematkan. Kosong berarti rules/google-attestation-roots.pem.
    ATTESTATION_ROOTS: str = _s("OWL_ATTESTATION_ROOTS", "")
    # Daftar pencabutan lebih tua dari ini dinyatakan basi di /health dan metrik.
    REVOCATION_MAX_AGE_DAYS: float = _f("OWL_REVOCATION_MAX_AGE_DAYS", 14.0)
    # token : pendaftaran dan permintaan tantangan menuntut token sekali pakai
    #         per perangkat yang diterbitkan admin. Bawaan.
    # shared: cukup token penggelaran bersama. Hanya untuk emulator dan uji.
    ENROLL_MODE: str = _s("OWL_ENROLL", "token").lower()
    ENROLL_TOKEN_TTL_MINUTES: float = _f("OWL_ENROLL_TTL", 60.0)
    PUBLIC_BASE_URL: str = _s("OWL_PUBLIC_BASE_URL", "")
    # Identitas aplikasi yang boleh memegang kunci agent. Sidik penanda tangan
    # dipisah koma; dibiarkan kosong berarti hanya nama paket yang diperiksa,
    # dan itu HANYA sah selama agent masih build debug.
    AGENT_PACKAGE: str = _s("OWL_AGENT_PACKAGE", "id.tniad.owl.agent")
    AGENT_SIGNERS: str = _s("OWL_AGENT_SIGNERS", "")
    CHALLENGE_TTL_SECONDS: float = _f("OWL_CHALLENGE_TTL", 300.0)

    # Endpoint demo (/api/demo/seed dan /api/demo/reset). `reset` MENGHAPUS
    # seluruh perangkat dan penilaian, jadi pada penggelaran satuan keduanya
    # harus mati: OWL_DEMO=false membuat keduanya menjawab 404.
    DEMO_MODE: bool = _s("OWL_DEMO", "true").lower() == "true"

    # Air-gapped: tidak ada panggilan keluar selain ke SOC di dalam jaringan
    # sendiri. Diberlakukan oleh jaringan, dan ditegaskan di sini supaya
    # terbaca sebagai keputusan, bukan kelalaian.
    AIR_GAPPED: bool = _s("OWL_AIR_GAPPED", "true").lower() == "true"


settings = Settings()
