"""TRINETRA backend — FastAPI app + background pipeline.

Wires the detection consumer, periodic cross-node correlation, and cache
refresh into the app lifecycle alongside the REST/WS API.
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_pg, init_ch, pg
from .enrichment import refresh_caches
from .rules.engine import load_catalog
from .scoring import seed_entity_risk
from . import ml_client
from .consumer import run_consumer, stop as stop_consumer
from . import ingest, indicators, apkscan
from .orchestration import correlate_recent
from .ws import hub
from .api.routes import router

_tasks: list[asyncio.Task] = []


async def _periodic_correlation():
    while True:
        await asyncio.sleep(20)
        try:
            findings = await correlate_recent(window_minutes=15)
            for f in findings:
                await hub.broadcast("correlation", f)
        except Exception as e:
            print(f"[correlation] error: {e}", flush=True)


async def _periodic_cache_refresh():
    while True:
        await asyncio.sleep(30)
        try:
            await refresh_caches()
        except Exception as e:
            print(f"[cache] refresh error: {e}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pg()
    await init_ch()
    await refresh_caches()
    load_catalog()
    indicators.load()
    apkscan.load()
    ml_client.init()
    # jalur masuk telemetri agent MTD nyata (HP prajurit)
    await ingest.start()

    # seed in-memory risk from persisted entity_risk
    async with pg().acquire() as con:
        rows = await con.fetch("SELECT entity_id, risk_score FROM entity_risk")
        for r in rows:
            seed_entity_risk(r["entity_id"], float(r["risk_score"] or 0))

    _tasks.append(asyncio.create_task(run_consumer()))
    _tasks.append(asyncio.create_task(_periodic_correlation()))
    _tasks.append(asyncio.create_task(_periodic_cache_refresh()))
    print("[backend] startup complete", flush=True)
    yield
    stop_consumer()
    for t in _tasks:
        t.cancel()
    await ingest.stop()
    await ml_client.close()


app = FastAPI(title="TRINETRA", version="2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)
app.include_router(router)


@app.get("/")
async def root():
    return {"service": "TRINETRA backend", "version": "2.0",
            "docs": "/docs", "ws": "/ws"}
