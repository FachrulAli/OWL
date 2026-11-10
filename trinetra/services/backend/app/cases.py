"""Case management (§10.6) — create/update cases from high-risk entities,
with de-duplication (one open case per entity, escalate instead of duplicate).
"""
from .db import pg
from .scoring import severity_from_risk


async def upsert_case(ev: dict, score: dict) -> dict | None:
    """Create or escalate a case when entity risk crosses alert threshold.
    Returns the case row (as dict) if a case was created/updated, else None.
    """
    from .config import settings
    risk = score["entity_risk"]
    if risk < settings.ALERT_THRESHOLD:
        return None

    severity = severity_from_risk(risk)
    categories = score["categories"] or ["behavioral_anomaly"]
    title = f"{ev.get('display_name', ev['entity_id'])} — {', '.join(categories)}"
    summary = (f"Risiko entity {risk:.0f}/100 pada role {ev['role']} "
               f"di {ev['node_id']}. Kategori: {', '.join(categories)}.")

    pool = pg()
    async with pool.acquire() as con:
        existing = await con.fetchrow(
            "SELECT case_id, status, risk_score FROM cases "
            "WHERE entity_id=$1 AND status NOT IN ('closed') "
            "ORDER BY created_at DESC LIMIT 1", ev["entity_id"])
        if existing:
            row = await con.fetchrow(
                "UPDATE cases SET risk_score=$1, severity=$2, "
                "categories=(SELECT array(SELECT DISTINCT unnest(categories || $3::text[]))), "
                "summary=$4, updated_at=now(), "
                "status=CASE WHEN $2='critical' AND status='open' THEN 'escalated' ELSE status END "
                "WHERE case_id=$5 RETURNING *",
                risk, severity, categories, summary, existing["case_id"])
            return dict(row) | {"_new": False}
        else:
            row = await con.fetchrow(
                "INSERT INTO cases (entity_id, role, node_id, tier, severity, risk_score, "
                "categories, title, summary, status) "
                "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
                ev["entity_id"], ev["role"], ev["node_id"], ev["tier"], severity, risk,
                categories, title, summary,
                "escalated" if severity == "critical" else "open")
            return dict(row) | {"_new": True}


async def update_entity_risk(entity_id: str, risk: float):
    pool = pg()
    async with pool.acquire() as con:
        await con.execute(
            "UPDATE entity_risk SET risk_score=$1, last_event=now(), updated_at=now() "
            "WHERE entity_id=$2", risk, entity_id)
