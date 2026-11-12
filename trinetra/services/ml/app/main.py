"""TRINETRA ML/UEBA engine — scoring + online baselining service (§8.2)."""
from fastapi import FastAPI
from pydantic import BaseModel

from .baseline import registry, FEATURES

app = FastAPI(title="TRINETRA ML/UEBA Engine", version="2.0")


class ScoreReq(BaseModel):
    entity_id: str
    role: str
    features: dict
    domain: str = "endpoint"      # endpoint (insider) | mobile (MTD)


class FeedbackReq(BaseModel):
    entity_id: str | None = None
    role: str | None = None
    verdict: str
    domain: str = "endpoint"


@app.get("/health")
def health():
    return {"ok": True, "features": FEATURES, "roles": registry.status()}


@app.post("/score")
def score(req: ScoreReq):
    return registry.score(req.role, req.features, req.domain)


@app.post("/feedback")
def feedback(req: FeedbackReq):
    registry.feedback(req.role, req.verdict, req.domain)
    return {"ok": True}


@app.get("/status")
def status():
    return registry.status()
