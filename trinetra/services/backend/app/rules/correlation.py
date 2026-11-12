"""Engine korelasi Sigma (temporal / temporal_ordered / event_count).

Ini komponen yang membuat TRINETRA bisa menuduh "zero-click" alih-alih hanya
melaporkan indikator lepas. Engine menyimpan jejak pendek (per perangkat) dari
aturan atomik mana yang menyala pada detik berapa, lalu menanyakan:

    apakah aturan A, B, C menyala BERURUTAN pada perangkat yang sama,
    seluruhnya di dalam jendela waktu T?

Jejak disimpan di memori dengan batas jelas (per-grup, per-aturan, dan
kedaluwarsa otomatis) supaya aman berjalan terus-menerus.

Catatan tentang waktu: perbandingan memakai timestamp EVENT, bukan waktu
kedatangan. Jadi urutan tetap benar walaupun event sampai tidak berurutan
(hal yang normal terjadi pada telemetri HP yang sempat offline lalu menyusul).
"""
from collections import deque
from datetime import datetime, timedelta, timezone

# (group_key) -> {rule_name: deque[(ts, event_id, stage)]}
_hits: dict[str, dict[str, deque]] = {}
# (corr_id, group_key) -> ts terakhir korelasi ini dinyalakan
_last_fire: dict[tuple[str, str], datetime] = {}

MAX_PER_RULE = 64          # jejak maksimum per aturan per perangkat
_observes = 0
_PRUNE_EVERY = 500


def reset():
    _hits.clear()
    _last_fire.clear()


def _group_key(ev: dict, fields: list[str]) -> str:
    return "|".join(str(ev.get(f, "")) for f in fields)


def _prune(now: datetime, horizon_s: int):
    """Buang jejak yang sudah melewati jendela terpanjang."""
    cutoff = now - timedelta(seconds=horizon_s * 2)
    empty_groups = []
    for gk, rules in _hits.items():
        empty_rules = []
        for rn, dq in rules.items():
            while dq and dq[0][0] < cutoff:
                dq.popleft()
            if not dq:
                empty_rules.append(rn)
        for rn in empty_rules:
            del rules[rn]
        if not rules:
            empty_groups.append(gk)
    for gk in empty_groups:
        del _hits[gk]
    for k, ts in list(_last_fire.items()):
        if ts < cutoff:
            del _last_fire[k]


def observe(ev: dict, signals: list[dict], corr_rules: list[dict]):
    """Catat aturan atomik yang menyala pada event ini."""
    global _observes
    if not signals or not corr_rules:
        return
    ts = ev.get("ts")
    if not isinstance(ts, datetime):
        ts = datetime.now(timezone.utc)
    # Satu event bisa relevan untuk korelasi dengan group-by berbeda.
    keys = {tuple(c["group_by"]) for c in corr_rules}
    stage = ev.get("chain_stage", "")
    eid = str(ev.get("event_id", ""))
    for kf in keys:
        gk = _group_key(ev, list(kf))
        rules = _hits.setdefault(gk, {})
        for s in signals:
            dq = rules.setdefault(s["rule_id"], deque(maxlen=MAX_PER_RULE))
            dq.append((ts, eid, stage))

    _observes += 1
    if _observes % _PRUNE_EVERY == 0:
        horizon = max((c["timespan"] for c in corr_rules), default=3600)
        _prune(ts, horizon)


def _window(dq: deque, start: datetime):
    return [h for h in dq if h[0] >= start]


def _check_ordered(rules_hits: list[list], timespan: int):
    """Cari rangkaian berurutan paling rapat; kembalikan jejaknya atau None.

    rules_hits[i] = daftar (ts, event_id, stage) untuk aturan ke-i, urut waktu.
    """
    if not rules_hits or any(not h for h in rules_hits):
        return None
    for first in rules_hits[0]:
        picked = [first]
        cursor = first[0]
        ok = True
        for nxt in rules_hits[1:]:
            cand = next((h for h in nxt if h[0] >= cursor), None)
            if cand is None:
                ok = False
                break
            picked.append(cand)
            cursor = cand[0]
        if ok and (picked[-1][0] - picked[0][0]).total_seconds() <= timespan:
            return picked
    return None


def evaluate(ev: dict, corr_rules: list[dict]) -> list[dict]:
    """Kembalikan korelasi yang terpenuhi untuk perangkat pada event ini."""
    if not corr_rules:
        return []
    now = ev.get("ts")
    if not isinstance(now, datetime):
        now = datetime.now(timezone.utc)

    out = []
    for c in corr_rules:
        gk = _group_key(ev, c["group_by"])
        rules = _hits.get(gk)
        if not rules:
            continue
        # jangan membanjiri: satu korelasi per perangkat per jendela
        last = _last_fire.get((c["id"], gk))
        if last and (now - last).total_seconds() < c["timespan"]:
            continue

        start = now - timedelta(seconds=c["timespan"])
        per_rule = [sorted(_window(rules.get(r, deque()), start))
                    for r in c["rules"]]

        picked = None
        if c["type"] == "temporal_ordered":
            picked = _check_ordered(per_rule, c["timespan"])
        elif c["type"] == "temporal":
            if all(per_rule) and per_rule:
                latest = [h[-1] for h in per_rule]
                span = (max(x[0] for x in latest)
                        - min(x[0] for x in latest)).total_seconds()
                if span <= c["timespan"]:
                    picked = sorted(latest)
        elif c["type"] == "event_count":
            flat = sorted(h for hits in per_rule for h in hits)
            if len(flat) >= c["count_gte"]:
                picked = flat[-c["count_gte"]:]

        if not picked:
            continue

        _last_fire[(c["id"], gk)] = now
        out.append({
            "rule_id": c["id"],
            "sigma_id": c["sigma_id"],
            "title": c["title"],
            "category": c["category"],
            "severity": c["severity"],
            "level": c["level"],
            "mitre": c["mitre"],
            "source": "sigma_correlation",
            "corr_type": c["type"],
            "kill_chain": c["kill_chain"],
            "response": c["response"],
            "timespan_s": c["timespan"],
            "span_s": round((picked[-1][0] - picked[0][0]).total_seconds(), 1),
            "members": [
                {"rule": r, "ts": h[0].isoformat(), "event_id": h[1],
                 "stage": h[2]}
                for r, h in zip(
                    c["rules"] if c["type"] != "event_count"
                    else [c["rules"][0]] * len(picked), picked)
            ],
        })
    return out


def stats() -> dict:
    return {
        "tracked_devices": len(_hits),
        "tracked_hits": sum(len(dq) for r in _hits.values() for dq in r.values()),
        "fired": len(_last_fire),
    }
