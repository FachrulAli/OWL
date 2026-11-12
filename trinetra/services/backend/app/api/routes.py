"""REST API for the command-center dashboard."""
from fastapi import (APIRouter, File, Header, HTTPException, UploadFile,
                     WebSocket, WebSocketDisconnect)

from ..db import pg, ch_query
from ..enrichment import role_baselines, all_nodes, all_entities
from ..rules.engine import catalog, sigma_rules, correlation_rules
from ..rules import correlation as corr_engine
from .. import ingest, indicators, apkscan, ios_sweep
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
        "chains": STATS.get("chains", 0),
        "ingest": ingest.stats(),
        "indicators": indicators.stats(),
        "yara": apkscan.stats(),
        "correlation": corr_engine.stats(),
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


@router.get("/sigma/rules")
async def sigma_catalog():
    """Katalog deteksi sebagai kode: aturan atomik + correlation rule.

    Dipakai halaman "Detection-as-Code" di dashboard supaya aturan yang
    dipakai bisa diaudit langsung dari UI, bukan hanya ada di dalam kode.
    """
    atomic = [{
        "id": r["id"], "sigma_id": r["sigma_id"], "title": r["title"],
        "description": r["description"], "domain": r["domain"],
        "service": r["service"], "level": r["level"], "category": r["category"],
        "severity": r["severity"], "stage": r["stage"], "mitre": r["mitre"],
        "condition": r["condition_str"],
        "fields": sorted({k.split("|")[0] for blk in r["blocks"].values()
                          for k in (blk if isinstance(blk, dict) else {})}),
        "falsepositives": r["falsepositives"],
    } for r in sigma_rules()]
    corrs = [{
        "id": c["id"], "sigma_id": c["sigma_id"], "title": c["title"],
        "description": c["description"], "type": c["type"], "rules": c["rules"],
        "timespan_s": c["timespan"], "group_by": c["group_by"],
        "count_gte": c["count_gte"], "level": c["level"],
        "category": c["category"], "severity": c["severity"],
        "kill_chain": c["kill_chain"], "response": c["response"],
        "mitre": c["mitre"],
    } for c in correlation_rules()]
    return {"atomic": atomic, "correlation": corrs,
            "format": "Sigma specification v2 (public domain)",
            "note": "Aturan dievaluasi oleh engine streaming TRINETRA sendiri, "
                    "bukan diterjemahkan ke backend SIEM eksternal."}


@router.get("/indicators")
async def indicator_status():
    """Status lapisan intel: indikator spyware publik yang sedang dimuat."""
    s = indicators.stats()
    return {
        **s,
        "sources": [
            {"name": "AmnestyTech/investigations", "license": "CC-BY 2.0",
             "campaigns": ["Pegasus"]},
            {"name": "mvt-project/mvt-indicators", "license": "MIT",
             "campaigns": [c for c in s.get("campaigns", []) if c != "Pegasus"]},
        ],
        "catatan": "Indikator bersifat historis dan bisa menghasilkan false "
                   "positive, karena itu tidak pernah dipakai sebagai bukti "
                   "tunggal — selalu dikorelasikan dengan perilaku perangkat.",
    }


@router.post("/scan/apk")
async def scan_apk(file: UploadFile = File(...),
                   device_id: str | None = None,
                   x_trinetra_token: str = Header(default="")):
    """Pindai satu berkas APK dengan YARA-X + daftar sidik indikator.

    Dipakai untuk APK sideload yang terdeteksi di perangkat (atau diunggah
    analis). Bila `device_id` diberikan dan perangkat terdaftar, hasilnya
    disuntikkan sebagai event ke pipeline supaya ikut penilaian risiko dan
    korelasi — bukan hanya ditampilkan sebagai hasil pindai lepas.
    """
    if x_trinetra_token != ingest.INGEST_TOKEN:
        raise HTTPException(status_code=401, detail="token tidak valid")
    if not apkscan.ready():
        raise HTTPException(
            status_code=503,
            detail=apkscan.stats().get("error") or "pemindai YARA belum siap")

    MAX = 200 * 1024 * 1024
    data = await file.read(MAX + 1)
    if len(data) > MAX:
        raise HTTPException(status_code=413, detail="berkas melebihi 200 MB")
    if not data:
        raise HTTPException(status_code=400, detail="berkas kosong")

    result = apkscan.scan_apk(data, file.filename or "unggahan.apk")

    if device_id:
        ent = all_entities().get(device_id)
        if ent is None:
            result["ingested"] = False
            result["ingest_note"] = f"perangkat '{device_id}' tidak terdaftar"
        elif not ingest.ready():
            result["ingested"] = False
            result["ingest_note"] = "jalur ingest belum siap"
        else:
            await ingest.publish([{
                "category": "pkg",
                "activity": "apk_scan_verdict",
                "pkg_added": 1,
                "pkg_name": result["filename"],
                "pkg_sha256": result["sha256"],
                "installer_source": "unknown",
                "perm_sensitive": 1 if result["score"] >= 35 else 0,
                "screen_on": 0,
                "user_interaction": 0,
            }], {
                "entity_id": device_id, "endpoint_id": device_id,
                "role": ent["role"], "node_id": ent["node_id"],
                "tier": ent["tier"],
                "unit_id": ent["node_id"] if ent["tier"] >= 1 else "",
            })
            result["ingested"] = True

    return result


@router.post("/sweep/ios")
async def sweep_ios(file: UploadFile = File(...),
                    device_id: str | None = None,
                    x_trinetra_token: str = Header(default="")):
    """Analisis bundel diagnostik iOS (sysdiagnose / .tar.gz / .zip).

    Jalur iOS bersifat PERIODIK dan RETROSPEKTIF, bukan real-time: iOS tidak
    menyediakan API bagi aplikasi pihak ketiga untuk melihat proses sistem
    atau crash-nya. Pemegang perangkat menarik bundel diagnostik sendiri
    (Setelan → Privasi & Keamanan → Analisis), lalu dianalisis di sini.
    Inilah cara kerja forensik mobile sebenarnya — MVT (Amnesty) dan
    iShutdown (Kaspersky) bekerja dengan pola yang sama.

    Bila `device_id` diberikan, temuan disuntikkan ke pipeline sebagai event
    sehingga aturan Sigma dan korelasi yang sama tetap berlaku.
    """
    if x_trinetra_token != ingest.INGEST_TOKEN:
        raise HTTPException(status_code=401, detail="token tidak valid")

    MAX = 600 * 1024 * 1024
    data = await file.read(MAX + 1)
    if len(data) > MAX:
        raise HTTPException(status_code=413, detail="bundel melebihi 600 MB")
    if not data:
        raise HTTPException(status_code=400, detail="berkas kosong")

    result = ios_sweep.sweep(data, file.filename or "sysdiagnose")
    events = result.pop("events", [])
    result["events_generated"] = len(events)

    if device_id and events:
        ent = all_entities().get(device_id)
        if ent is None:
            result["ingested"] = False
            result["ingest_note"] = f"perangkat '{device_id}' tidak terdaftar"
        elif not ingest.ready():
            result["ingested"] = False
            result["ingest_note"] = "jalur ingest belum siap"
        else:
            await ingest.publish(events, {
                "entity_id": device_id, "endpoint_id": device_id,
                "role": ent["role"], "node_id": ent["node_id"],
                "tier": ent["tier"],
                "unit_id": ent["node_id"] if ent["tier"] >= 1 else "",
            })
            result["ingested"] = True
    return result


@router.get("/chains")
async def chain_hits(limit: int = 50, entity_id: str | None = None):
    """Rantai kill-chain yang terbukti — inti temuan zero-click."""
    where = "WHERE 1=1"
    params = {"limit": limit}
    if entity_id:
        where += " AND entity_id = {entity_id:String}"
        params["entity_id"] = entity_id
    rows = await ch_query(
        f"SELECT ts, entity_id, node_id, tier, corr_id, corr_type, title, "
        f"category, severity, level, response, span_s, timespan_s, "
        f"kill_chain, mitre, members FROM trinetra.chain_hits {where} "
        f"ORDER BY ts DESC LIMIT {{limit:UInt32}}", params)
    ents = all_entities()
    out = []
    for r in rows:
        d = dict(r)
        d["display_name"] = (ents.get(d["entity_id"]) or {}).get(
            "display_name", d["entity_id"])
        try:
            d["members"] = __import__("json").loads(d.get("members") or "[]")
        except ValueError:
            d["members"] = []
        out.append(d)
    return out


@router.post("/ingest/mobile")
async def ingest_mobile(payload: dict,
                        x_trinetra_token: str = Header(default="")):
    """Terima batch telemetri dari agent MTD di HP prajurit.

    Body: {"device_id": "...", "events": [ {...}, ... ]}
    Header: X-Trinetra-Token

    Perangkat harus sudah terdaftar di registry. Identitas (pangkat, satuan,
    tier) diambil dari registry, TIDAK dari apa yang dikirim HP — supaya HP
    yang sudah dikuasai penyerang tidak bisa mengaku sebagai HP pejabat lain.
    """
    if x_trinetra_token != ingest.INGEST_TOKEN:
        raise HTTPException(status_code=401, detail="token tidak valid")
    device_id = str(payload.get("device_id") or "").strip()
    events = payload.get("events") or []
    if not device_id or not isinstance(events, list):
        raise HTTPException(status_code=400,
                            detail="butuh device_id dan events[]")
    ent = all_entities().get(device_id)
    if ent is None:
        raise HTTPException(
            status_code=403,
            detail=f"perangkat '{device_id}' belum terdaftar di registry")
    if not ingest.ready():
        raise HTTPException(status_code=503, detail="jalur ingest belum siap")

    identity = {
        "entity_id": device_id,
        "endpoint_id": device_id,
        "role": ent["role"],
        "node_id": ent["node_id"],
        "tier": ent["tier"],
        "unit_id": ent["node_id"] if ent["tier"] >= 1 else "",
    }
    res = await ingest.publish(events, identity)
    return {"ok": True, "device_id": device_id, **res}


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
