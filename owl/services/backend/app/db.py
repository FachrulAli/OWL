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
    attestation_ok INTEGER NOT NULL DEFAULT 1
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
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init() -> None:
    global _db
    Path(settings.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    _db = await aiosqlite.connect(settings.DB_PATH)
    _db.row_factory = aiosqlite.Row
    await _db.executescript(SCHEMA)
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


async def get_device(device_id: str) -> dict | None:
    cur = await conn().execute("SELECT * FROM devices WHERE device_id=?", (device_id,))
    row = await cur.fetchone()
    return dict(row) if row else None


async def list_devices() -> list[dict]:
    cur = await conn().execute(
        """SELECT d.*,
                  a.score AS score, a.level AS level, a.assessed_at AS assessed_at,
                  a.findings AS findings, a.attestation_ok AS attestation_ok
             FROM devices d
             LEFT JOIN assessments a ON a.id = (
                 SELECT id FROM assessments WHERE device_id = d.device_id
                 ORDER BY assessed_at DESC, id DESC LIMIT 1)
            ORDER BY COALESCE(a.score, -1) DESC, d.device_id""")
    out = []
    for row in await cur.fetchall():
        r = dict(row)
        r["findings"] = json.loads(r["findings"]) if r.get("findings") else []
        r["attestation_ok"] = bool(r["attestation_ok"]) if r.get("attestation_ok") is not None else None
        out.append(r)
    return out


# ——————————————————————————— penilaian ———————————————————————————

async def save_assessment(a: dict, telemetry: dict) -> int:
    cur = await conn().execute(
        """INSERT INTO assessments
             (device_id, assessed_at, score, level, findings, categories, telemetry, attestation_ok)
           VALUES (?,?,?,?,?,?,?,?)""",
        (a["device_id"], a["assessed_at"], a["score"], a["level"],
         json.dumps(a["findings"], ensure_ascii=False),
         json.dumps(a["categories"], ensure_ascii=False),
         json.dumps(telemetry, ensure_ascii=False, default=str),
         int(a.get("attestation_ok", True))),
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


async def reset() -> None:
    for t in ("soc_events", "decisions", "assessments", "devices"):
        await conn().execute(f"DELETE FROM {t}")
    await conn().commit()
