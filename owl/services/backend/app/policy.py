"""Kebijakan penilaian yang dapat diubah saat sistem berjalan (FR-12).

Bobot dan ambang berasal dari `config.settings` sebagai nilai awal, lalu
dapat ditimpa administrator lewat API. Setiap perubahan dicatat di tabel
`policy_audit` beserta nilai lama, nilai baru, dan pelakunya, karena kebijakan
yang dapat diubah tanpa jejak bukan kebijakan, melainkan lubang.

Perubahan berlaku pada penilaian BERIKUTNYA. Penilaian yang sudah tersimpan
tidak dihitung ulang, supaya riwayat tetap menggambarkan keputusan yang
memang diambil saat itu.
"""
from __future__ import annotations

from .config import settings

_weights: dict[str, float] = dict(settings.WEIGHTS)
_thresholds: dict[str, float] = {
    "medium": settings.T_MEDIUM,
    "high": settings.T_HIGH,
    "critical": settings.T_CRITICAL,
}


def weights() -> dict[str, float]:
    return dict(_weights)


def thresholds() -> dict[str, float]:
    return dict(_thresholds)


def set_weight(category: str, value: float) -> tuple[float, float]:
    """Ubah bobot satu kategori. Mengembalikan (nilai lama, nilai baru)."""
    if category not in _weights:
        raise KeyError(f"kategori tidak dikenal: {category}")
    if not 0 <= value <= 100:
        raise ValueError("bobot harus antara 0 dan 100")
    old = _weights[category]
    _weights[category] = float(value)
    return old, float(value)


def set_threshold(name: str, value: float) -> tuple[float, float]:
    """Ubah satu ambang. Mengembalikan (nilai lama, nilai baru).

    Calonnya diperiksa LEBIH DAHULU, baru disimpan. Versi pertama fungsi ini
    menyimpan nilainya lalu memeriksa urutannya, sehingga perubahan yang
    ditolak dengan HTTP 400 tetap berlaku diam-diam. Pada mesin kebijakan
    keamanan, perubahan yang gagal tetapi tetap mengubah ambang jauh lebih
    berbahaya daripada perubahan yang gagal terang-terangan.
    """
    if name not in _thresholds:
        raise KeyError(f"ambang tidak dikenal: {name}")
    if not 0 <= value <= 100:
        raise ValueError("ambang harus antara 0 dan 100")
    calon = dict(_thresholds)
    calon[name] = float(value)
    _check_order(calon)
    old = _thresholds[name]
    _thresholds[name] = float(value)
    return old, float(value)


def _check_order(th: dict[str, float]) -> None:
    m, h, c = th["medium"], th["high"], th["critical"]
    if not m <= h <= c:
        raise ValueError(
            f"ambang harus menaik: medium {m} <= high {h} <= critical {c}")


def reset() -> None:
    """Kembalikan ke nilai dari lingkungan. Dipakai uji."""
    _weights.clear()
    _weights.update(settings.WEIGHTS)
    _thresholds.update({"medium": settings.T_MEDIUM, "high": settings.T_HIGH,
                        "critical": settings.T_CRITICAL})
