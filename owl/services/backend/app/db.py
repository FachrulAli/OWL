"""Penyimpanan OWL.

SQLite untuk purwarupa (deepdive §10.3). Skemanya sengaja dibuat datar dan
tanpa fitur khas SQLite supaya pindah ke PostgreSQL pada penggelaran satuan
tidak menuntut penulisan ulang kueri.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite

from .config import settings

_db: aiosqlite.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    device_id   TEXT PRIMARY KEY,
    label       TEXT NOT NULL DEFAULT '',
    owner_role  TEXT NOT NULL DEFAULT '',
    unit        TEXT NOT NULL DEFAULT '',
    model       TEXT NOT NULL DEFAULT '',
    os_version  TEXT NOT NULL DEFAULT '',
    enrolled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT NOT NULL REFERENCES devices(device_id),
    assessed_at TEXT NOT NULL,
    score       REAL NOT NULL,
    level       TEXT NOT NULL,
    findings    TEXT NOT NULL,
    categories  TEXT NOT NULL,
    telemetry   TEXT NOT NULL,
    attestation_ok INTEGER NOT NULL DEFAULT 1,
    availability   TEXT NOT NULL DEFAULT '{}',
    skipped_rules  TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS ix_assessments_device ON assessments(device_id, assessed_at DESC);

CREATE TABLE IF NOT EXISTS decisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT NOT NULL,
    decided_at  TEXT NOT NULL,
    resource    TEXT NOT NULL,
    decision    TEXT NOT NULL,
    score       REAL NOT NULL,
    quarantine  INTEGER NOT NULL DEFAULT 0,
    reason      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_decisions_device ON decisions(device_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS soc_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT NOT NULL,
    sent_at     TEXT NOT NULL,
    kind        TEXT NOT NULL,
    delivered   INTEGER NOT NULL DEFAULT 0,
    payload     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_soc_sent ON soc_events(sent_at DESC);

-- FR-04: telemetri yang ditolak dicatat, tidak dibuang diam-diam. Tanpa
-- catatan ini, agent yang mengirim data rusak akan tampak seperti agent yang
-- tidak pernah mengirim apa-apa, dan perangkatnya terlihat "belum dinilai"
-- padahal sedang gagal.
CREATE TABLE IF NOT EXISTS rejects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT NOT NULL,
    source_ip   TEXT NOT NULL DEFAULT '',
    device_id   TEXT NOT NULL DEFAULT '',
    reason      TEXT NOT NULL,
    detail      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_rejects_at ON rejects(received_at DESC);

-- Tantangan pendaftaran: sekali pakai, berumur pendek. Rantai attestation
-- harus memuat tantangan ini, sehingga rantai lama tidak dapat diputar ulang.
CREATE TABLE IF NOT EXISTS enroll_challenges (
    device_id   TEXT PRIMARY KEY,
    challenge   TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

-- FR-12: perubahan bobot dan ambang dicatat beserta pelakunya.
CREATE TABLE IF NOT EXISTS policy_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    changed_at  TEXT NOT NULL,
    actor       TEXT NOT NULL DEFAULT '',
    field       TEXT NOT NULL,
    old_value   TEXT NOT NULL,
    new_value   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_policy_at ON policy_audit(changed_at DESC);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init() -> None:
    global _db
    Path(settings.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    _db = await aiosqlite.connect(settings.DB_PATH)
    _db.row_factory = aiosqlite.Row
    await _db.executescript(SCHEMA)
    # Kolom yang ditambahkan sesudah skema pertama. Basis data lama tetap
    # dapat dibuka: kolomnya ditambahkan di tempat, bukan dibuat ulang.
    cur = await _db.execute("PRAGMA table_info(devices)")
    have = {r["name"] for r in await cur.fetchall()}
    for col, ddl in (("public_key", "TEXT NOT NULL DEFAULT ''"),
                     ("attestation", "TEXT NOT NULL DEFAULT ''"),
                     ("last_collected_at", "TEXT NOT NULL DEFAULT ''")):
        if col not in have:
            await _db.execute(f"ALTER TABLE devices ADD COLUMN {col} {ddl}")
    await _db.commit()


async def close() -> None:
    global _db
    if _db is not None:
        await _db.close()
        _db = None


def conn() -> aiosqlite.Connection:
    if _db is None:
        raise RuntimeError("basis data belum diinisialisasi")
    return _db


# ——————————————————————————— perangkat ———————————————————————————

async def upsert_device(d: dict) -> None:
    await conn().execute(
        """INSERT INTO devices (device_id, label, owner_role, unit, model, os_version, enrolled_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(device_id) DO UPDATE SET
             label=excluded.label, owner_role=excluded.owner_role, unit=excluded.unit,
             model=excluded.model, os_version=excluded.os_version""",
        (d["device_id"], d.get("label", ""), d.get("owner_role", ""), d.get("unit", ""),
         d.get("model", ""), d.get("os_version", ""), _now()),
    )
    await conn().commit()


def _device_row(row) -> dict:
    r = dict(row)
    r["attestation"] = json.loads(r["attestation"]) if r.get("attestation") else None
    return r


async def get_device(device_id: str) -> dict | None:
    cur = await conn().execute("SELECT * FROM devices WHERE device_id=?", (device_id,))
    row = await cur.fetchone()
    return _device_row(row) if row else None


async def save_challenge(device_id: str, challenge: str) -> None:
    await conn().execute(
        """INSERT INTO enroll_challenges (device_id, challenge, created_at) VALUES (?,?,?)
           ON CONFLICT(device_id) DO UPDATE SET
             challenge=excluded.challenge, created_at=excluded.created_at""",
        (device_id, challenge, _now()))
    await conn().commit()


async def take_challenge(device_id: str, ttl_seconds: float) -> str | None:
    """Ambil tantangan lalu hapus: sekali pakai, berhasil ataupun gagal."""
    cur = await conn().execute(
        "SELECT challenge, created_at FROM enroll_challenges WHERE device_id=?", (device_id,))
    row = await cur.fetchone()
    if not row:
        return None
    await conn().execute("DELETE FROM enroll_challenges WHERE device_id=?", (device_id,))
    await conn().commit()
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(row["created_at"])).total_seconds()
    return row["challenge"] if age <= ttl_seconds else None


async def set_device_attestation(device_id: str, public_key: str, attestation: dict) -> None:
    await conn().execute(
        "UPDATE devices SET public_key=?, attestation=?, last_collected_at='' WHERE device_id=?",
        (public_key, json.dumps(attestation, ensure_ascii=False), device_id))
    await conn().commit()


async def set_last_collected(device_id: str, collected_at: str) -> None:
    await conn().execute(
        "UPDATE devices SET last_collected_at=? WHERE device_id=?", (collected_at, device_id))
    await conn().commit()


async def list_devices() -> list[dict]:
    cur = await conn().execute(
        """SELECT d.*,
                  a.score AS score, a.level AS level, a.assessed_at AS assessed_at,
                  a.findings AS findings, a.attestation_ok AS attestation_ok,
                  a.availability AS availability, a.skipped_rules AS skipped_rules
             FROM devices d
             LEFT JOIN assessments a ON a.id = (
                 SELECT id FROM assessments WHERE device_id = d.device_id
                 ORDER BY assessed_at DESC, id DESC LIMIT 1)
            ORDER BY COALESCE(a.score, -1) DESC, d.device_id""")
    out = []
    for row in await cur.fetchall():
        r = dict(row)
        r["findings"] = json.loads(r["findings"]) if r.get("findings") else []
        r["availability"] = json.loads(r["availability"]) if r.get("availability") else {}
        r["skipped_rules"] = json.loads(r["skipped_rules"]) if r.get("skipped_rules") else []
        r["attestation_ok"] = bool(r["attestation_ok"]) if r.get("attestation_ok") is not None else None
        r["attestation"] = json.loads(r["attestation"]) if r.get("attestation") else None
        r.pop("public_key", None)
        out.append(r)
    return out


# ——————————————————————————— penilaian ———————————————————————————

async def save_assessment(a: dict, telemetry: dict) -> int:
    cur = await conn().execute(
        """INSERT INTO assessments
             (device_id, assessed_at, score, level, findings, categories, telemetry,
              attestation_ok, availability, skipped_rules)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (a["device_id"], a["assessed_at"], a["score"], a["level"],
         json.dumps(a["findings"], ensure_ascii=False),
         json.dumps(a["categories"], ensure_ascii=False),
         json.dumps(telemetry, ensure_ascii=False, default=str),
         int(a.get("attestation_ok", True)),
         json.dumps(a.get("availability", {}), ensure_ascii=False, default=str),
         json.dumps(a.get("skipped_rules", []), ensure_ascii=False)),
    )
    await conn().commit()
    return cur.lastrowid


async def last_assessment(device_id: str) -> dict | None:
    cur = await conn().execute(
        """SELECT * FROM assessments WHERE device_id=?
            ORDER BY assessed_at DESC, id DESC LIMIT 1""", (device_id,))
    row = await cur.fetchone()
    if not row:
        return None
    r = dict(row)
    r["findings"] = json.loads(r["findings"])
    r["categories"] = json.loads(r["categories"])
    r["availability"] = json.loads(r.get("availability") or "{}")
    r["skipped_rules"] = json.loads(r.get("skipped_rules") or "[]")
    r["telemetry"] = json.loads(r["telemetry"])
    r["attestation_ok"] = bool(r["attestation_ok"])
    return r


async def history(device_id: str, limit: int = 50) -> list[dict]:
    cur = await conn().execute(
        """SELECT assessed_at, score, level FROM assessments
            WHERE device_id=? ORDER BY assessed_at DESC, id DESC LIMIT ?""",
        (device_id, limit))
    return [dict(r) for r in await cur.fetchall()]


# ——————————————————————————— keputusan ———————————————————————————

async def save_decision(d: dict) -> None:
    await conn().execute(
        """INSERT INTO decisions (device_id, decided_at, resource, decision, score, quarantine, reason)
           VALUES (?,?,?,?,?,?,?)""",
        (d["device_id"], _now(), d["resource"], d["decision"], d["score"],
         int(d.get("quarantine", False)), d.get("reason", "")),
    )
    await conn().commit()


async def recent_decisions(limit: int = 50) -> list[dict]:
    cur = await conn().execute(
        "SELECT * FROM decisions ORDER BY decided_at DESC, id DESC LIMIT ?", (limit,))
    return [dict(r) for r in await cur.fetchall()]


# ——————————————————————————— event SOC ———————————————————————————

async def save_soc_event(device_id: str, kind: str, payload: str, delivered: bool) -> None:
    await conn().execute(
        "INSERT INTO soc_events (device_id, sent_at, kind, delivered, payload) VALUES (?,?,?,?,?)",
        (device_id, _now(), kind, int(delivered), payload))
    await conn().commit()


async def recent_soc_events(limit: int = 20) -> list[dict]:
    cur = await conn().execute(
        "SELECT * FROM soc_events ORDER BY sent_at DESC, id DESC LIMIT ?", (limit,))
    return [dict(r) | {"delivered": bool(r["delivered"])} for r in await cur.fetchall()]


async def save_reject(device_id: str, reason: str, detail: str, source_ip: str = "") -> None:
    await conn().execute(
        "INSERT INTO rejects (received_at, source_ip, device_id, reason, detail) VALUES (?,?,?,?,?)",
        (_now(), source_ip, device_id, reason, detail[:2000]))
    await conn().commit()


async def recent_rejects(limit: int = 50) -> list[dict]:
    cur = await conn().execute(
        "SELECT * FROM rejects ORDER BY received_at DESC, id DESC LIMIT ?", (limit,))
    return [dict(r) for r in await cur.fetchall()]


async def save_policy_change(actor: str, field: str, old: str, new: str) -> None:
    await conn().execute(
        "INSERT INTO policy_audit (changed_at, actor, field, old_value, new_value) VALUES (?,?,?,?,?)",
        (_now(), actor, field, old, new))
    await conn().commit()


async def policy_latest() -> dict[str, str]:
    """Nilai terakhir tiap ruas kebijakan, untuk dipulihkan saat layanan mulai."""
    cur = await conn().execute(
        """SELECT field, new_value FROM policy_audit
            WHERE id IN (SELECT MAX(id) FROM policy_audit GROUP BY field)""")
    return {r["field"]: r["new_value"] for r in await cur.fetchall()}


async def policy_audit(limit: int = 50) -> list[dict]:
    cur = await conn().execute(
        "SELECT * FROM policy_audit ORDER BY changed_at DESC, id DESC LIMIT ?", (limit,))
    return [dict(r) for r in await cur.fetchall()]


async def reset() -> None:
    for t in ("soc_events", "decisions", "assessments", "devices", "rejects",
              "enroll_challenges"):
        await conn().execute(f"DELETE FROM {t}")
    await conn().commit()
