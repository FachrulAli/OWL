"""OWL Core — gerbang risiko perangkat untuk lingkungan TNI AD.

Air-gapped, on-prem. Tidak ada panggilan keluar selain ke SOC di dalam
jaringan satuan sendiri.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db, rules
from .api import router
from .config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init()
    cat = rules.load()
    print(f"[owl] {len(cat['rules'])} aturan dimuat, "
          f"air-gapped={settings.AIR_GAPPED}", flush=True)
    yield
    await db.close()


app = FastAPI(
    title="OWL — On Device Watch Layer",
    description="Gerbang risiko perangkat: enam sinyal menjadi satu keputusan akses.",
    version=settings.VERSION,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)
app.include_router(router)


@app.get("/")
async def root():
    return {"service": settings.SERVICE, "version": settings.VERSION,
            "docs": "/docs", "ws": "/ws"}
