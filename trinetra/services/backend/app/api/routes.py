"""REST API for the command-center dashboard."""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from ..db import pg, ch_query
from ..enrichment import role_baselines, all_nodes
from ..rules.engine import catalog
from ..scoring import entity_risk, severity_from_risk
from .. import ml_client
from ..consumer import STATS
from ..ws import hub

router = APIRouter()


@router.get("/health")
async def health():
    ml = await ml_client.health()
    return {"ok": True, "ml": ml}


@router.get("/stats")
async def stats():
    import time
    uptime = time.time() - STATS["started"]
    return {
        "events": STATS["events"],
        "alerts": STATS["alerts"],
        "signals": STATS["signals"],
        "uptime_sec": round(uptime, 1),
        "eps": round(STATS["events"] / uptime, 1) if uptime > 0 else 0,
    }


@router.get("/entities")
async def entities():
    pool = pg()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "SELECT e.entity_id, e.display_name, e.role, e.node_id, n.tier, "
            "       r.risk_score, r.last_event "
            "FROM entities e JOIN nodes n ON n.node_id=e.node_id "
            "LEFT JOIN entity_risk r ON r.entity_id=e.entity_id "
            "ORDER BY r.risk_score DESC NULLS LAST")
    out = []
    for r in rows:
        live = entity_risk(r["entity_id"])          # decayed live value
        risk = max(live, float(r["risk_score"] or 0))
        out.append({
            "entity_id": r["entity_id"], "display_name": r["display_name"],
            "role": r["role"], "node_id": r["node_id"], "tier": r["tier"],
            "risk_score": round(risk, 1), "severity": severity_from_risk(risk),
            "last_event": r["last_event"].isoformat() if r["last_event"] else None,
        })
    out.sort(key=lambda x: x["risk_score"], reverse=True)
    return out


@router.get("/entities/{entity_id}")
async def entity_detail(entity_id: str):
    pool = pg()
    async with pool.acquire() as con:
        ent = await con.fetchrow(
            "SELECT e.entity_id, e.display_name, e.role, e.node_id, n.tier "
            "FROM entities e JOIN nodes n ON n.node_id=e.node_id WHERE e.entity_id=$1",
            entity_id)
    if not ent:
        raise HTTPException(404, "entity not found")

    # baseline vs actual (last 24h averages from ClickHouse)
    actual_rows, cols = await ch_query(
        """
        SELECT avg(egress_mb) egress_mb, avg(files_accessed) files_accessed,
               avg(endpoints_touched) endpoints_touched, sum(usb_event) usb_event,
               sum(privilege_change) privilege_change, sum(config_change) config_change,
               count() events
        FROM trinetra.events
        WHERE entity_id = {e:String} AND ts >= now() - toIntervalHour(24)
        """, {"e": entity_id})
    actual = dict(zip(cols, actual_rows[0])) if actual_rows and actual_rows[0] else {}

    baselines = role_baselines(ent["role"])
    baseline_view = []
    for param, cfg in baselines.items():
        baseline_view.append({
            "parameter": param,
            "normal_low": cfg.get("normal_low"),
            "normal_high": cfg.get("normal_high"),
            "static_crit": cfg.get("static_crit"),
            "actual": round(float(actual.get(param, 0) or 0), 2),
        })

    # investigation timeline (recent scored events with signals)
    tl_rows, tl_cols = await ch_query(
        """
        SELECT ts, risk_score, event_score, categories, ml_anomaly, contributors
        FROM trinetra.risk_scores
        WHERE entity_id = {e:String}
        ORDER BY ts DESC LIMIT 50
        """, {"e": entity_id})
    timeline = [dict(zip(tl_cols, r)) for r in tl_rows]
    for t in timeline:
        t["ts"] = t["ts"].isoformat()

    # raw recent events
    ev_rows, ev_cols = await ch_query(
        """
        SELECT ts, category, activity, command, egress_mb, files_accessed,
               endpoints_touched, src_geo, login_hour, label_scenario
        FROM trinetra.events WHERE entity_id = {e:String} ORDER BY ts DESC LIMIT 50
        """, {"e": entity_id})
    events = [dict(zip(ev_cols, r)) for r in ev_rows]
    for e in events:
        e["ts"] = e["ts"].isoformat()

    live = entity_risk(entity_id)
    return {
        "entity": dict(ent),
        "risk_score": live,
        "severity": severity_from_risk(live),
        "baselines": baseline_view,
        "actual_24h": {k: (round(float(v), 2) if v is not None else 0) for k, v in actual.items()},
        "timeline": timeline,
        "events": events,
    }


@router.get("/cases")
async def cases(status: str | None = None):
    pool = pg()
    q = ("SELECT case_id, entity_id, role, node_id, tier, severity, risk_score, "
         "categories, title, summary, status, verdict, created_at, updated_at FROM cases ")
    args = []
    if status:
        q += "WHERE status = $1 "
        args.append(status)
    q += "ORDER BY risk_score DESC, created_at DESC LIMIT 200"
    async with pool.acquire() as con:
        rows = await con.fetch(q, *args)
    out = []
    for r in rows:
        d = dict(r)
        d["categories"] = list(d["categories"])
        d["created_at"] = d["created_at"].isoformat()
        d["updated_at"] = d["updated_at"].isoformat()
        out.append(d)
    return out


@router.post("/cases/{case_id}/verdict")
async def set_verdict(case_id: int, payload: dict):
    verdict = payload.get("verdict")
    if verdict not in ("true_positive", "false_positive"):
        raise HTTPException(400, "verdict must be true_positive or false_positive")
    note = payload.get("note", "")
    pool = pg()
    async with pool.acquire() as con:
        row = await con.fetchrow("SELECT entity_id, role FROM cases WHERE case_id=$1", case_id)
        if not row:
            raise HTTPException(404, "case not found")
        new_status = "closed" if verdict == "false_positive" else "escalated"
        await con.execute(
            "UPDATE cases SET verdict=$1, status=$2, updated_at=now() WHERE case_id=$3",
            verdict, new_status, case_id)
        await con.execute(
            "INSERT INTO feedback (case_id, entity_id, verdict, note) VALUES ($1,$2,$3,$4)",
            case_id, row["entity_id"], verdict, note)
    # forward feedback to ML tuning loop (§9.1)
    try:
        await ml_client._client.post("/feedback", json={
            "entity_id": row["entity_id"], "role": row["role"], "verdict": verdict})
    except Exception:
        pass
    return {"ok": True, "case_id": case_id, "verdict": verdict, "status": new_status}


@router.get("/nodes")
async def nodes():
    """Orchestration tree with aggregated risk per node (§8 Tier 0 command center)."""
    pool = pg()
    async with pool.acquire() as con:
        node_rows = await con.fetch(
            "SELECT node_id, name, tier, parent_id FROM nodes ORDER BY tier, node_id")
        agg = await con.fetch(
            "SELECT e.node_id, max(r.risk_score) max_risk, avg(r.risk_score) avg_risk, "
            "count(*) FILTER (WHERE r.risk_score >= 50) high_count, count(*) total "
            "FROM entities e LEFT JOIN entity_risk r ON r.entity_id=e.entity_id "
            "GROUP BY e.node_id")
    agg_map = {a["node_id"]: a for a in agg}
    out = []
    for n in node_rows:
        a = agg_map.get(n["node_id"])
        out.append({
            "node_id": n["node_id"], "name": n["name"], "tier": n["tier"],
            "parent_id": n["parent_id"],
            "max_risk": round(float(a["max_risk"]), 1) if a and a["max_risk"] else 0,
            "avg_risk": round(float(a["avg_risk"]), 1) if a and a["avg_risk"] else 0,
            "high_count": int(a["high_count"]) if a else 0,
            "total": int(a["total"]) if a else 0,
        })
    return out


@router.get("/correlations")
async def correlations():
    pool = pg()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "SELECT corr_id, pattern, entity_ids, node_ids, score, summary, created_at "
            "FROM correlations ORDER BY created_at DESC LIMIT 50")
    out = []
    for r in rows:
        d = dict(r)
        d["entity_ids"] = list(d["entity_ids"])
        d["node_ids"] = list(d["node_ids"])
        d["created_at"] = d["created_at"].isoformat()
        out.append(d)
    return out


@router.get("/heatmap")
async def heatmap():
    """Risk matrix: node x role (for the command-center heatmap §10.7 FR-21)."""
    pool = pg()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "SELECT e.node_id, e.role, coalesce(max(r.risk_score),0) risk "
            "FROM entities e LEFT JOIN entity_risk r ON r.entity_id=e.entity_id "
            "GROUP BY e.node_id, e.role")
    return [{"node_id": r["node_id"], "role": r["role"], "risk": round(float(r["risk"]), 1)}
            for r in rows]


@router.get("/rules")
async def rules():
    return catalog()


@router.get("/categories/timeline")
async def category_timeline(hours: int = 6):
    """Alert volume per anomaly category over time — dashboard trend chart."""
    rows, cols = await ch_query(
        """
        SELECT toStartOfFifteenMinutes(ts) AS bucket, cat AS category, count() AS n
        FROM (
            SELECT ts, arrayJoin(categories) AS cat FROM trinetra.risk_scores
            WHERE ts >= now() - toIntervalHour({h:UInt32}) AND risk_score >= 40
        )
        GROUP BY bucket, category ORDER BY bucket
        """, {"h": hours})
    return [{"bucket": r[0].isoformat(), "category": r[1], "count": int(r[2])} for r in rows]


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()   # keepalive; client doesn't need to send
    except WebSocketDisconnect:
        await hub.disconnect(ws)
    except Exception:
        await hub.disconnect(ws)
