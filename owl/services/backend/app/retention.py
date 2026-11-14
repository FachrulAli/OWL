"""Retensi data (NFR 5.1).

Telemetri dan hasil penilaian adalah data paling sensitif yang dipegang OWL:
daftar aplikasi, sertifikat, dan profil VPN pada perangkat milik personel.
Menyimpannya selamanya berlawanan dengan minimalisasi data, sebab nilainya
untuk penilaian risiko habis dalam hitungan hari sedangkan risiko kebocoran
tidak pernah habis.

Yang dihapus setelah `OWL_RETENTION_DAYS`:
  assessments   hasil penilaian beserta telemetri mentahnya
  decisions     keputusan gerbang
  soc_events    payload STIX dan baris CEF
  rejects       telemetri yang ditolak

Yang TIDAK dihapus, dan alasannya:
  devices       identitas perangkat yang masih terdaftar, bukan data pemeriksaan
  policy_audit  kewajiban audit perubahan kebijakan justru menuntut jejak ini
                tetap ada (NFR 5.1 butir terakhir)
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from . import db
from .applog import log
from .config import settings

# Tabel beserta kolom waktunya. Datar dan eksplisit supaya tidak ada tabel
# yang ikut terhapus hanya karena namanya mirip.
TABLES: list[tuple[str, str]] = [
    ("assessments", "assessed_at"),
    ("decisions", "decided_at"),
    ("soc_events", "sent_at"),
    ("rejects", "received_at"),
]

KEPT = ("devices", "policy_audit")


def cutoff(days: float | None = None) -> str:
    d = settings.RETENTION_DAYS if days is None else days
    return (datetime.now(timezone.utc) - timedelta(days=d)).isoformat()


async def sweep(days: float | None = None) -> dict:
    """Hapus baris yang lebih tua daripada ambang. Mengembalikan cacahnya."""
    batas = cutoff(days)
    hapus: dict[str, int] = {}
    for tabel, kolom in TABLES:
        cur = await db.conn().execute(
            f"DELETE FROM {tabel} WHERE {kolom} < ?", (batas,))
        hapus[tabel] = cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
    await db.conn().commit()

    total = sum(hapus.values())
    if total:
        log().info("retensi menghapus data lampau",
                   extra={"batas": batas, "dihapus": hapus, "total": total})
    return {"cutoff": batas, "deleted": hapus, "total": total,
            "retention_days": settings.RETENTION_DAYS, "kept": list(KEPT)}


async def counts() -> dict:
    """Cacah baris per tabel, untuk ditampilkan tanpa menghapus apa pun."""
    out: dict[str, int] = {}
    for tabel, _ in TABLES:
        cur = await db.conn().execute(f"SELECT COUNT(*) AS n FROM {tabel}")
        row = await cur.fetchone()
        out[tabel] = int(row["n"]) if row else 0
    for tabel in KEPT:
        cur = await db.conn().execute(f"SELECT COUNT(*) AS n FROM {tabel}")
        row = await cur.fetchone()
        out[tabel] = int(row["n"]) if row else 0
    return out


async def loop() -> None:
    """Penyapuan berkala. Dijalankan sebagai tugas latar selama layanan hidup."""
    jeda = max(0.5, settings.RETENTION_SWEEP_HOURS) * 3600
    while True:
        try:
            await asyncio.sleep(jeda)
            await sweep()
        except asyncio.CancelledError:
            raise
        except Exception as e:                       # jangan sampai mematikan layanan
            log().warning("penyapuan retensi gagal", extra={"sebab": str(e)})
