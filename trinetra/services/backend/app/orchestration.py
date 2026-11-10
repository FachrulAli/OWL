"""Tier 0 cross-node correlation (§8 Orchestration / §10.5 FR-17).

Periodically scans recent high-risk activity across nodes and surfaces
distributed insider patterns — e.g. the same anomaly category firing on
multiple Kodam at once, or coordinated off-hours exfiltration. These are the
findings that no single node can see on its own.
"""
from datetime import datetime, timezone

from .db import pg, ch_query


async def correlate_recent(window_minutes: int = 15) -> list[dict]:
    """Find cross-node patterns from recent risk scores; persist new findings."""
    rows, cols = await ch_query(
        """
        SELECT arrayStringConcat(arraySort(groupUniqArray(cat)), ',') AS pattern,
               groupUniqArray(entity_id) AS entities,
               groupUniqArray(node_id)   AS nodes,
               count()                    AS hits,
               avg(risk_score)           AS avg_risk
        FROM (
            SELECT entity_id, node_id, risk_score, arrayJoin(categories) AS cat
            FROM trinetra.risk_scores
            WHERE ts >= now() - toIntervalMinute({w:UInt32}) AND risk_score >= 40
        )
        GROUP BY cat
        HAVING length(nodes) >= 2
        """,
        {"w": window_minutes},
    )

    findings = []
    pool = pg()
    for r in rows:
        rec = dict(zip(cols, r))
        nodes = rec["nodes"]
        entities = rec["entities"]
        if len(nodes) < 2:
            continue
        score = min(100.0, float(rec["avg_risk"]) * (1 + 0.1 * len(nodes)))
        pattern = rec["pattern"]
        summary = (f"Pola '{pattern}' terdeteksi serempak di {len(nodes)} node "
                   f"({', '.join(nodes)}) melibatkan {len(entities)} entity.")
        async with pool.acquire() as con:
            # avoid spamming duplicates within the window
            dup = await con.fetchval(
                "SELECT 1 FROM correlations WHERE pattern=$1 "
                "AND created_at >= now() - ($2 || ' minutes')::interval LIMIT 1",
                pattern, str(window_minutes))
            if dup:
                continue
            row = await con.fetchrow(
                "INSERT INTO correlations (pattern, entity_ids, node_ids, score, summary) "
                "VALUES ($1,$2,$3,$4,$5) RETURNING corr_id, created_at",
                pattern, list(entities), list(nodes), score, summary)
        findings.append({
            "corr_id": row["corr_id"],
            "pattern": pattern,
            "entities": list(entities),
            "nodes": list(nodes),
            "score": round(score, 1),
            "summary": summary,
            "created_at": row["created_at"].isoformat(),
        })
    return findings
