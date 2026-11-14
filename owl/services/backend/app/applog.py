"""Pencatatan OWL Core (NFR 5.3).

Satu baris JSON per kejadian, ke keluaran standar dan ke berkas yang
berputar pada ukuran tertentu. Dipilih JSON karena berkas log yang hanya
dapat dibaca manusia tidak dapat ditarik ke SIEM satuan, sedangkan satu
baris per kejadian tetap dapat dibaca `tail` di lapangan.

Yang TIDAK pernah masuk log: isi telemetri, kunci API, token administrasi,
dan tanda tangan webhook. Log keamanan yang memuat rahasianya sendiri
berubah menjadi sasaran, bukan alat.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .config import settings

_RESERVED = {
    "args", "asctime", "created", "exc_info", "exc_text", "filename",
    "funcName", "levelname", "levelno", "lineno", "module", "msecs",
    "message", "msg", "name", "pathname", "process", "processName",
    "relativeCreated", "stack_info", "thread", "threadName", "taskName",
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        row = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "event": record.getMessage(),
            "logger": record.name,
        }
        for k, v in record.__dict__.items():
            if k not in _RESERVED and not k.startswith("_"):
                row[k] = v
        if record.exc_info:
            row["error"] = self.formatException(record.exc_info).splitlines()[-1]
        return json.dumps(row, ensure_ascii=False, default=str)


_log = logging.getLogger("owl")
_configured = False


def setup() -> logging.Logger:
    """Pasang pencatat. Aman dipanggil berulang kali."""
    global _configured
    if _configured:
        return _log

    _log.setLevel(logging.INFO)
    _log.propagate = False
    fmt = JsonFormatter()

    out = logging.StreamHandler(sys.stdout)
    out.setFormatter(fmt)
    _log.addHandler(out)

    if settings.LOG_FILE:
        try:
            Path(settings.LOG_FILE).parent.mkdir(parents=True, exist_ok=True)
            berkas = RotatingFileHandler(
                settings.LOG_FILE, maxBytes=settings.LOG_MAX_BYTES,
                backupCount=settings.LOG_BACKUPS, encoding="utf-8")
            berkas.setFormatter(fmt)
            _log.addHandler(berkas)
        except OSError as e:
            # Berkas log yang tidak dapat dibuka bukan alasan untuk
            # menolak menyala. Keluaran standar tetap jalan.
            _log.warning("berkas log tidak dapat dibuka", extra={"sebab": str(e)})

    _configured = True
    return _log


def log() -> logging.Logger:
    return setup()
