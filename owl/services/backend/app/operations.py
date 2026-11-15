"""Workflow penanganan, daftar dinamis, keputusan terkini, dan alarm."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from . import attest, db, pdp, rules, scoring, soc
from .models import AccessDecision, RiskAssessment, Telemetry


def now():
    return datetime.now(timezone.utc)


async def restore_rules():
    rules.set_dynamic(await db.get_value("dynamic_blocklist", {"packages": [], "signers": []}),
                      await db.get_value("factory_allowlist", []))


async def current(device_id: str, resource="standard") -> AccessDecision:
    dev = await db.get_device(device_id)
    row = await db.last_assessment(device_id)
    if not dev or not row:
        return AccessDecision(device_id=device_id, resource=resource, decision="deny", score=0,
                              reason="Perangkat belum memiliki laporan", quarantine=False)
    # Gunakan kebijakan saat ini atas telemetri terakhir, tanpa memudakan laporan.
    t = Telemetry(**row["telemetry"])
    att = dev.get("attestation") or {}
    if att and (att.get("boot_state") != "verified" or not att.get("device_locked")):
        t.integrity.bootloader_unlocked = True
    a = scoring.score(t, rules.evaluate(t))
    a.assessed_at = datetime.fromisoformat(row["assessed_at"])
    a.attestation_ok = row["attestation_ok"]
    if att and not (att.get("verified") and att.get("hardware_backed")):
        a.attestation_ok = False
    if (att.get("chain_sha256") and t.attestation.certificate_chain_sha256 != att["chain_sha256"]):
        # Enrollment kunci baru membutuhkan laporan dari identitas yang baru;
        # laporan bersih milik kunci lama tak dapat membuka sesi perangkat baru.
        a.attestation_ok = False
    if attest.serials_revoked(att.get("chain_serials", []), await db.revoked_serials()):
        a.attestation_ok = False
    d = pdp.decide(a, resource=resource,
                   revoked=dev.get("revoked_reason", "") if dev.get("revoked") else None)
    case = await expire_case(device_id)
    expires = case.get("expires_at")
    # Pengecualian hanya terhadap skor: tak dapat meloloskan pencabutan,
    # laporan basi, attestation gagal, atau aturan penentu.
    if (case.get("status") == "dikecualikan" and expires and
            datetime.fromisoformat(expires) > now() and not dev.get("revoked") and
            a.attestation_ok and not any(f.decisive for f in a.findings) and
            "kedaluwarsa" not in d.reason.lower()):
        d.decision, d.quarantine = "allow", False
        d.reason = "Pengecualian admin sampai " + expires + ": " + case["note"]
    return d


async def expire_case(device_id):
    key = "case:" + device_id
    case = await db.get_value(key, {})
    if (case.get("status") == "dikecualikan" and case.get("expires_at") and
            datetime.fromisoformat(case["expires_at"]) <= now()):
        old = dict(case)
        case.update(status="baru", actor="system", updated_at=now().isoformat(), expires_at=None)
        await db.put_value(key, case)
        await db.save_policy_change("system", key, str(old), str(case))
        await soc.emit("exception_expired", device_id, {"previous_expiry": old["expires_at"]})
    return case


async def record_transition(d: AccessDecision):
    key = "decision_state:" + d.resource + ":" + d.device_id
    previous = await db.get_value(key)
    await db.put_value(key, d.decision)
    if previous is not None and previous != d.decision:
        await soc.emit("decision_changed", d.device_id,
                       {"old_decision": previous, "new_decision": d.decision,
                        "resource": d.resource, "reason": d.reason,
                        "rules": d.top_contributors})
    if d.quarantine:
        key = "case:" + d.device_id
        case = await db.get_value(key, {})
        if not case or case.get("status") == "diselesaikan":
            value = {"device_id": d.device_id, "status": "baru", "actor": "system", "note": d.reason,
                     "updated_at": now().isoformat(), "expires_at": None}
            await db.put_value(key, value)
            await db.save_policy_change("system", key, str(case), str(value))


async def metrics():
    devices = await db.list_devices()
    counts = {k: 0 for k in ("allow", "step_up", "limited", "deny")}
    ages = {}
    for dev in devices:
        d = await current(dev["device_id"])
        counts[d.decision] += 1
        at = dev.get("assessed_at") or dev["enrolled_at"]
        ages[dev["device_id"]] = max(0, (now() - datetime.fromisoformat(at)).total_seconds())
    cur = await db.conn().execute("SELECT reason, COUNT(*) AS n FROM rejects GROUP BY reason")
    rejects = {r["reason"]: r["n"] for r in await cur.fetchall()}
    unchecked = [d["device_id"] for d in devices if d.get("attestation") and
                 not d["attestation"].get("chain_serials")]
    return {"devices": len(devices), "decisions": counts,
            "revocation_unchecked_devices": unchecked,
            "report_age_seconds": ages, "rejects_by_reason": rejects}


async def scan():
    cur = await db.conn().execute("SELECT key, value FROM kv WHERE key LIKE 'access_session:%' OR key LIKE 'access_challenge:%'")
    import json
    for row in await cur.fetchall():
        value = json.loads(row["value"])
        if not value or value.get("expires", "") <= now().isoformat():
            await db.conn().execute("DELETE FROM kv WHERE key=?", (row["key"],))
    await db.conn().commit()
    limit = float(rules.catalog().get("parameters", {}).get("max_report_age_minutes", 60)) * 60
    for dev in await db.list_devices():
        key = "silent:" + dev["device_id"]
        at = dev.get("assessed_at") or dev["enrolled_at"]
        silent = limit > 0 and (now() - datetime.fromisoformat(at)).total_seconds() > limit
        if silent and not await db.get_value(key, False):
            await soc.emit("device_silent", dev["device_id"], {"last_report_at": dev.get("assessed_at"), "limit_seconds": limit})
        await db.put_value(key, silent)
        await record_transition(await current(dev["device_id"]))
    cutoff = (now() - timedelta(minutes=5)).isoformat()
    cur = await db.conn().execute("SELECT COUNT(*) AS n FROM rejects WHERE received_at>=?", (cutoff,))
    count = (await cur.fetchone())["n"]
    alarm = count >= 10
    if alarm and not await db.get_value("reject_alarm", False):
        await soc.emit("rejection_spike", "", {"count": count, "window_seconds": 300, "threshold": 10})
    await db.put_value("reject_alarm", alarm)


async def loop(lock):
    while True:
        await asyncio.sleep(60)
        try:
            async with lock:
                await scan()
        except asyncio.CancelledError:
            raise
        except Exception:
            from .applog import log
            log().exception("pemeriksaan alarm gagal")
