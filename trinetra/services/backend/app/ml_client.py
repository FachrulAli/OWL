"""Client for the UEBA/ML engine (separate service, §8.2 ML/UEBA Engine).

Falls back gracefully to anomaly=0 if the ML service is briefly unavailable so
the deterministic rule path keeps working during a demo.
"""
import httpx

from .config import settings

_client: httpx.AsyncClient | None = None


def init():
    global _client
    _client = httpx.AsyncClient(base_url=settings.ML_URL, timeout=2.0)


async def close():
    if _client:
        await _client.aclose()


async def score(ev: dict) -> dict:
    """Return {'anomaly': 0..1, 'peer_deviation': float, 'model': str}."""
    if _client is None:
        return {"anomaly": 0.0, "peer_deviation": 0.0, "model": "none"}
    try:
        r = await _client.post("/score", json={
            "entity_id": ev["entity_id"],
            "role": ev["role"],
            "features": {
                "egress_mb": ev.get("egress_mb", 0),
                "files_accessed": ev.get("files_accessed", 0),
                "endpoints_touched": ev.get("endpoints_touched", 0),
                "usb_event": ev.get("usb_event", 0),
                "privilege_change": ev.get("privilege_change", 0),
                "config_change": ev.get("config_change", 0),
                "login_hour": ev.get("login_hour", 12),
            },
        })
        r.raise_for_status()
        return r.json()
    except Exception:
        return {"anomaly": 0.0, "peer_deviation": 0.0, "model": "unavailable"}


async def health() -> dict:
    if _client is None:
        return {"ok": False}
    try:
        r = await _client.get("/health")
        return r.json()
    except Exception:
        return {"ok": False}
