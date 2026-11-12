"""Enrichment (§10.1 FR enrichment): attach identity/role context + baseline config.

Loads the identity registry and role baselines from Postgres into in-memory
caches (the AD/LDAP enrichment path). Refreshed periodically so policy changes
pushed from Tier 0 take effect without a restart.
"""
from .db import pg
from . import indicators

# entity_id -> {display_name, role, node_id, tier}
_entities: dict[str, dict] = {}
# role -> base_weight, risk_level
_roles: dict[str, dict] = {}
# role -> {parameter -> baseline config}
_role_baselines: dict[str, dict] = {}
# node_id -> {tier, parent_id, name}
_nodes: dict[str, dict] = {}


async def refresh_caches():
    pool = pg()
    async with pool.acquire() as con:
        nodes = await con.fetch("SELECT node_id, name, tier, parent_id FROM nodes")
        roles = await con.fetch("SELECT role, label, risk_level, base_weight FROM roles")
        ents = await con.fetch(
            "SELECT e.entity_id, e.display_name, e.role, e.node_id, n.tier, "
            "       e.holder_rank, e.holder_name, e.holder_nrp "
            "FROM entities e JOIN nodes n ON n.node_id = e.node_id")
        bl = await con.fetch(
            "SELECT role, parameter, normal_low, normal_high, static_crit, rel_mult, weight "
            "FROM role_baselines")

    _nodes.clear(); _roles.clear(); _entities.clear(); _role_baselines.clear()
    for n in nodes:
        _nodes[n["node_id"]] = dict(n)
    for r in roles:
        _roles[r["role"]] = dict(r)
    for e in ents:
        _entities[e["entity_id"]] = dict(e)
    for b in bl:
        _role_baselines.setdefault(b["role"], {})[b["parameter"]] = dict(b)


def enrich(ev: dict) -> dict:
    ent = _entities.get(ev["entity_id"])
    if ent:
        # Nama yang ditampilkan adalah ORANGNYA, bukan perangkatnya.
        # Saat sebuah HP merah, pertanyaan pertama operator adalah "siapa yang
        # harus dihubungi" — pangkat dan nama menjawabnya seketika, sementara
        # "iPhone 15 Pro" tidak. Spesifikasi perangkat tetap tersedia, tetapi
        # sebagai field tersendiri, bukan ditumpuk ke dalam satu teks nama.
        rank = (ent.get("holder_rank") or "").strip()
        name = (ent.get("holder_name") or "").strip()
        ev["display_name"] = (f"{rank} {name}".strip() if name
                              else ent["display_name"])
        ev["holder_rank"] = rank
        ev["holder_name"] = name
        ev["holder_nrp"] = ent.get("holder_nrp") or ""
        ev["node_id"] = ent["node_id"]
        ev["tier"] = ent["tier"]
        ev["role"] = ent["role"]
    else:
        ev["display_name"] = ev["entity_id"]
    role = _roles.get(ev["role"], {})
    ev["role_weight"] = float(role.get("base_weight", 1.0))
    ev["role_risk_level"] = role.get("risk_level", "medium")
    # Lapisan intel: cocokkan dengan indikator spyware publik (STIX2).
    # Hanya untuk domain mobile — daftar indikatornya memang khusus spyware HP.
    if ev.get("domain") == "mobile":
        indicators.enrich(ev)
    return ev


def role_baselines(role: str) -> dict:
    return _role_baselines.get(role, {})


def all_entities() -> dict:
    return _entities


def all_nodes() -> dict:
    return _nodes


def all_roles() -> dict:
    return _roles
