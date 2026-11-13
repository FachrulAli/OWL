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

    # Air-gapped: tidak ada panggilan keluar selain ke SOC di dalam jaringan
    # sendiri. Diberlakukan oleh jaringan, dan ditegaskan di sini supaya
    # terbaca sebagai keputusan, bukan kelalaian.
    AIR_GAPPED: bool = _s("OWL_AIR_GAPPED", "true").lower() == "true"


settings = Settings()
