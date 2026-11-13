"""Skor risiko 0 sampai 100 yang dapat ditelusuri (deepdive §7.2).

Tiga sifat yang dijaga di sini, dan ketiganya adalah alasan OWL ada:

1. Dapat dijelaskan. Setiap poin pada skor akhir dapat ditunjuk asalnya,
   sampai ke aturan yang menghasilkannya. Tidak ada bobot tersembunyi dan
   tidak ada model yang tidak dapat dibuka.
2. Jenuh per kategori. Sepuluh aplikasi sideload tidak lebih berbahaya
   daripada tiga, sehingga kategori integritas aplikasi berhenti di bobotnya.
   Tanpa batas ini satu kategori yang berisik dapat memerahkan perangkat
   sendirian.
3. Meluruh. Perangkat yang berhenti memunculkan sinyal turun 5 poin per hari,
   sehingga temuan lama tidak menghukum perangkat selamanya.
"""
from __future__ import annotations

from datetime import datetime, timezone

from .config import settings
from .models import CategoryScore, Finding, RiskAssessment, Telemetry


def _level(score: float) -> str:
    if score >= settings.T_CRITICAL:
        return "kritis"
    if score >= settings.T_HIGH:
        return "tinggi"
    if score >= settings.T_MEDIUM:
        return "sedang"
    return "rendah"


def decay(previous: float, last_seen: datetime, now: datetime) -> float:
    """Peluruhan linear 5 poin per hari, tidak pernah di bawah nol."""
    if previous <= 0:
        return 0.0
    days = max(0.0, (now - last_seen).total_seconds() / 86400.0)
    return max(0.0, previous - settings.DECAY_PER_DAY * days)


def score(
    telemetry: Telemetry,
    findings: list[Finding],
    previous: float | None = None,
    last_seen: datetime | None = None,
) -> RiskAssessment:
    now = datetime.now(timezone.utc)
    weights = settings.WEIGHTS
    sev_points = settings.SEVERITY
    sat = settings.CATEGORY_SATURATION

    # ——— jumlahkan severitas per kategori ———
    by_cat: dict[str, list[Finding]] = {c: [] for c in weights}
    for f in findings:
        by_cat[f.category].append(f)

    categories: list[CategoryScore] = []
    total = 0.0
    for cat, weight in weights.items():
        sev_sum = sum(sev_points[f.severity] for f in by_cat[cat])
        raw = weight * (sev_sum / sat)
        capped = min(weight, raw)
        categories.append(CategoryScore(
            category=cat, weight=weight, severity_sum=sev_sum,
            score=round(capped, 1), saturated=raw > weight,
        ))
        total += capped

        # Bagikan poin kategori kembali ke tiap temuan, menurut porsi
        # severitasnya. Inilah yang membuat kolom "kontributor" di dashboard
        # berjumlah persis sama dengan skornya.
        if sev_sum > 0:
            for f in by_cat[cat]:
                f.points = round(capped * sev_points[f.severity] / sev_sum, 1)

    total = min(100.0, total)

    # ——— peluruhan terhadap penilaian sebelumnya ———
    decayed = 0.0
    floor = 0.0
    if previous is not None and last_seen is not None:
        floor = decay(previous, last_seen, now)
        decayed = round(previous - floor, 1)

    # Skor akhir adalah yang tertinggi antara penilaian saat ini dan sisa
    # penilaian sebelumnya yang belum luruh. Perangkat yang pernah merah
    # tidak langsung menjadi hijau hanya karena satu laporan bersih: itulah
    # gunanya peluruhan bertahap, bukan penghapusan seketika.
    final = max(total, floor)

    # Hanya temuan X01 yang BERAT yang membatalkan kepercayaan pada laporan.
    # X01 tingkat medium berarti verdict Play Integrity tidak diperoleh
    # sementara Key Attestation terbukti: laporannya tetap dipercaya, dengan
    # catatan yang terlihat analis.
    attestation_ok = not any(
        f.rule_id == "OWL-X01" and f.severity == "critical" for f in findings)

    return RiskAssessment(
        device_id=telemetry.device_id,
        assessed_at=now,
        score=round(final, 1),
        level=_level(final),
        findings=findings,
        categories=categories,
        decay_applied=decayed,
        previous_score=previous,
        attestation_ok=attestation_ok,
    )
