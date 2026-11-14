"""OWL Core — gerbang risiko perangkat untuk lingkungan TNI AD.

Air-gapped, on-prem. Tidak ada panggilan keluar selain ke SOC di dalam
jaringan satuan sendiri.
"""
import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db, retention, rules
from .api import router
from .applog import setup as setup_log
from .config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    log = setup_log()
    await db.init()
    cat = rules.load()
    log.info("owl core menyala", extra={
        "aturan": len(cat["rules"]),
        "air_gapped": settings.AIR_GAPPED,
        "api_auth": "kunci" if settings.API_KEY else "terbuka",
        "retensi_hari": settings.RETENTION_DAYS,
    })

    # Penyapuan pertama saat mulai, lalu berkala. Data lampau tidak menunggu
    # jadwal berikutnya hanya karena layanan baru dinyalakan.
    await retention.sweep()
    sweeper = asyncio.create_task(retention.loop())
    try:
        yield
    finally:
        sweeper.cancel()
        try:
            await sweeper
        except asyncio.CancelledError:
            pass
        log.info("owl core berhenti")
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
    setup_log().warning("telemetri tidak valid ditolak",
                        extra={"path": request.url.path})
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
            setup_log().warning("gagal mencatat penolakan", extra={"sebab": str(e)})
    return JSONResponse(status_code=422,
                        content={"detail": exc.errors(), "dicatat": True})


@app.get("/")
async def root():
    return {"service": settings.SERVICE, "version": settings.VERSION,
            "docs": "/docs", "ws": "/ws"}
