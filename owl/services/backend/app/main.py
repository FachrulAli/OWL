"""OWL Core — gerbang risiko perangkat untuk lingkungan TNI AD.

Air-gapped, on-prem. Tidak ada panggilan keluar selain ke SOC di dalam
jaringan satuan sendiri.
"""
from contextlib import asynccontextmanager

import json

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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


@app.exception_handler(RequestValidationError)
async def on_invalid(request: Request, exc: RequestValidationError):
    """FR-04: telemetri yang tidak valid ditolak DAN dicatat.

    Tanpa catatan ini, agent yang mengirim data rusak akan tampak seperti
    agent yang tidak pernah mengirim apa-apa, dan perangkatnya terlihat
    "belum dinilai" padahal sedang gagal terus-menerus. Itu kegagalan yang
    menyamar sebagai keadaan normal, dan justru itu yang paling berbahaya
    pada sistem pemantauan.
    """
    detail = json.dumps(exc.errors(), ensure_ascii=False, default=str)[:2000]
    if request.url.path.startswith("/api/"):
        device_id = ""
        try:
            body = await request.json()
            device_id = str(body.get("device_id", ""))[:64]
        except Exception:
            pass
        try:
            await db.save_reject(
                device_id, "telemetri tidak valid", detail,
                request.client.host if request.client else "")
        except Exception as e:
            print(f"[owl] gagal mencatat penolakan: {e}", flush=True)
    return JSONResponse(status_code=422,
                        content={"detail": exc.errors(), "dicatat": True})


@app.get("/")
async def root():
    return {"service": settings.SERVICE, "version": settings.VERSION,
            "docs": "/docs", "ws": "/ws"}
