"""Endpoint operasi roadmap B6–B9 dan D15."""
from __future__ import annotations

import base64
import hashlib
import re
import secrets
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import PlainTextResponse, HTMLResponse
from pydantic import BaseModel, Field, field_validator

from . import attest, db, operations, rules
from .api import require_admin, require_read
from .models import Sensitivity

router = APIRouter()


class AccessProof(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    challenge: str
    signature: str


@router.get("/api/access/challenge")
async def access_challenge(device_id: str):
    dev = await db.get_device(device_id)
    if not dev or not dev.get("public_key") or dev.get("revoked"):
        raise HTTPException(403, "Perangkat tidak dapat meminta sesi akses")
    challenge = secrets.token_urlsafe(32)
    await db.put_value("access_challenge:" + device_id,
                       {"challenge": challenge, "expires": (operations.now() + timedelta(minutes=1)).isoformat()})
    return {"challenge": challenge, "signing_payload": f"OWL-ACCESS\n{device_id}\n{challenge}"}


@router.post("/api/access/sessions")
async def access_session(body: AccessProof):
    key = "access_challenge:" + body.device_id
    stored = await db.get_value(key)
    await db.put_value(key, None)
    dev = await db.get_device(body.device_id)
    if (not stored or stored["challenge"] != body.challenge or
            stored["expires"] <= operations.now().isoformat() or not dev or dev.get("revoked")):
        raise HTTPException(403, "Tantangan akses tidak sah atau kedaluwarsa")
    payload = f"OWL-ACCESS\n{body.device_id}\n{body.challenge}".encode()
    if not attest.verify_signature(dev["public_key"], payload, body.signature):
        raise HTTPException(403, "Bukti kepemilikan kunci tidak sah")
    d = await operations.current(body.device_id)
    if d.decision == "deny":
        raise HTTPException(403, d.reason)
    token = secrets.token_urlsafe(32)
    expires = (operations.now() + timedelta(minutes=5)).isoformat()
    await db.put_value("access_session:" + hashlib.sha256(token.encode()).hexdigest(),
                       {"device_id": body.device_id, "public_key": dev["public_key"], "expires": expires})
    return {"token": token, "expires_at": expires, "decision": d.decision}


async def authorize(authorization: str | None, resource: Sensitivity):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sesi akses diperlukan", headers={"WWW-Authenticate": "Bearer"})
    hashed = hashlib.sha256(authorization[7:].encode()).hexdigest()
    session = await db.get_value("access_session:" + hashed)
    if not session or session["expires"] <= operations.now().isoformat():
        raise HTTPException(401, "Sesi akses tidak sah atau kedaluwarsa")
    dev = await db.get_device(session["device_id"])
    if not dev or dev.get("public_key") != session["public_key"]:
        raise HTTPException(403, "Kunci perangkat berubah")
    d = await operations.current(session["device_id"], resource)
    await operations.record_transition(d)
    if d.decision == "deny" or (resource == "classified" and d.decision == "limited"):
        raise HTTPException(403, d.reason)
    return d


@router.get("/api/access/verify")
async def verify_access(authorization: str | None = Header(None),
                        x_owl_resource: Sensitivity = Header("classified")):
    try:
        d = await authorize(authorization, x_owl_resource)
    except HTTPException as exc:
        import unicodedata
        reason = unicodedata.normalize("NFKD", str(exc.detail)).encode("ascii", "ignore").decode()
        exc.headers = (exc.headers or {}) | {"X-OWL-Reason": " ".join(reason.splitlines())[:1500]}
        raise
    return PlainTextResponse("allow", headers={"X-OWL-Decision": d.decision})


@router.get("/protected/{resource}")
async def protected(resource: Sensitivity, authorization: str | None = Header(None)):
    d = await authorize(authorization, resource)
    return HTMLResponse(f"<h1>Sistem OWL: {resource}</h1><p>Akses diterima ({d.decision}).</p>")


class CaseChange(BaseModel):
    status: Literal["baru", "diperiksa", "diselesaikan", "dikecualikan"]
    note: str = Field(min_length=3, max_length=2000)
    ttl_minutes: int = Field(default=30, ge=1, le=1440)


@router.get("/api/cases", dependencies=[Depends(require_read)])
async def cases():
    result = []
    for dev in await db.list_devices():
        case = await operations.expire_case(dev["device_id"])
        if case:
            result.append(case)
    return result


@router.put("/api/cases/{device_id}")
async def update_case(device_id: str, body: CaseChange, actor: str = Depends(require_admin)):
    if not await db.get_device(device_id):
        raise HTTPException(404, "Perangkat tidak dikenal")
    old = await db.get_value("case:" + device_id, {})
    value = {"device_id": device_id, "status": body.status, "note": body.note,
             "actor": actor, "updated_at": operations.now().isoformat(),
             "expires_at": (operations.now() + timedelta(minutes=body.ttl_minutes)).isoformat()
                           if body.status == "dikecualikan" else None}
    await db.put_value("case:" + device_id, value)
    await db.save_policy_change(actor, "case:" + device_id, str(old), str(value))
    return value


@router.post("/api/blocklist/import")
async def import_blocklist(bundle: dict, actor: str = Depends(require_admin)):
    if bundle.get("type") != "bundle" or not isinstance(bundle.get("objects"), list):
        raise HTTPException(400, "Diperlukan bundle STIX")
    packages, signers = set(), set()
    for obj in bundle["objects"]:
        if not isinstance(obj, dict):
            raise HTTPException(400, "Objek STIX tidak sah")
        if obj.get("revoked") or obj.get("type") != "indicator":
            continue
        pattern = obj.get("pattern", "")
        if obj.get("pattern_type", "stix") != "stix" or not isinstance(pattern, str):
            raise HTTPException(400, "Indicator harus memuat pattern STIX berupa teks")
        pkg = re.fullmatch(r"\[software:name = '([A-Za-z0-9_.]+)'\]", pattern)
        sig = re.fullmatch(r"\[x-android-app:signer_sha256 = '([a-fA-F0-9]{64})'\]", pattern)
        if pkg:
            packages.add(pkg[1])
        elif sig:
            signers.add(sig[1].lower())
        else:
            raise HTTPException(400, "Pola indicator belum didukung; gunakan software:name atau x-android-app:signer_sha256")
    value = {"packages": sorted(packages), "signers": sorted(signers)}
    old = await db.get_value("dynamic_blocklist", {})
    await db.put_value("dynamic_blocklist", value)
    await db.save_policy_change(actor, "dynamic_blocklist", str(old), str(value))
    await operations.restore_rules()
    return value


@router.get("/api/blocklist", dependencies=[Depends(require_read)])
async def blocklist():
    return {"imported": await db.get_value("dynamic_blocklist", {"packages": [], "signers": []}),
            "built_in": rules.catalog().get("blocklists", {})}


class FactoryEntry(BaseModel):
    manufacturer: str = Field(min_length=1, max_length=64)
    package: str = Field(pattern=r"^[A-Za-z0-9_.]+$")
    signer_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


@router.put("/api/factory-allowlist")
async def factory_allowlist(entries: list[FactoryEntry], actor: str = Depends(require_admin)):
    old = await db.get_value("factory_allowlist", [])
    value = [e.model_dump() | {"signer_sha256": e.signer_sha256.lower()} for e in entries]
    await db.put_value("factory_allowlist", value)
    await db.save_policy_change(actor, "factory_allowlist", str(old), str(value))
    await operations.restore_rules()
    return value


@router.get("/api/factory-allowlist", dependencies=[Depends(require_read)])
async def get_factory_allowlist():
    return await db.get_value("factory_allowlist", [])


@router.get("/api/metrics", dependencies=[Depends(require_read)])
async def metrics():
    return await operations.metrics()


@router.post("/api/alarms/scan")
async def scan(actor: str = Depends(require_admin)):
    await operations.scan()
    return {"ok": True}
