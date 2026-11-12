"""Pemuat & evaluator aturan format Sigma (subset) untuk TRINETRA.

Mengapa engine sendiri, bukan pySigma: pySigma menerjemahkan Sigma ke query
backend SIEM (Splunk/ES/dsb), sedangkan TRINETRA mengevaluasi aturan
*per-event di dalam arus* (streaming) sebelum data disimpan. Jadi aturannya
tetap ditulis dalam format Sigma yang standar dan bisa dibagikan antar satuan,
tetapi dievaluasi langsung di sini.

Subset yang didukung (cukup untuk seluruh katalog TRINETRA):
  - detection: beberapa blok `selection*` / `filter*`, map field -> nilai
  - nilai berupa skalar atau daftar (daftar = OR)
  - modifier: |gte |gt |lte |lt |contains |startswith |endswith |re |all
  - condition: nama blok, `and`, `or`, `not`, tanda kurung,
               `all of <pola*>`, `1 of <pola*>`, `any of <pola*>`
Aturan dengan konstruksi di luar subset ditolak saat muat (dengan peringatan),
bukan diam-diam dianggap cocok.
"""
import os
import re

import yaml

SIGMA_DIR = os.path.join(os.path.dirname(__file__), "sigma")

_MODIFIERS = {"gte", "gt", "lte", "lt", "contains", "startswith", "endswith",
              "re", "all"}


# --------------------------------------------------------------------------
# pencocokan field
# --------------------------------------------------------------------------
def _match_one(field_val, mod: str, target) -> bool:
    if target is None:
        return False
    try:
        if mod in ("gte", "gt", "lte", "lt"):
            a, b = float(field_val), float(target)
            return {"gte": a >= b, "gt": a > b, "lte": a <= b, "lt": a < b}[mod]
        s = str(field_val)
        t = str(target)
        if mod == "contains":
            return t.lower() in s.lower()
        if mod == "startswith":
            return s.lower().startswith(t.lower())
        if mod == "endswith":
            return s.lower().endswith(t.lower())
        if mod == "re":
            return re.search(t, s) is not None
        # tanpa modifier: kesetaraan, longgar terhadap tipe angka/string
        if isinstance(target, bool):
            return bool(field_val) == target
        if isinstance(target, (int, float)) and not isinstance(target, bool):
            return float(field_val) == float(target)
        return s.lower() == t.lower()
    except (TypeError, ValueError):
        return False


def _match_field(ev: dict, key: str, target) -> bool:
    parts = key.split("|")
    field = parts[0]
    mods = [m for m in parts[1:] if m in _MODIFIERS]
    unknown = [m for m in parts[1:] if m not in _MODIFIERS]
    if unknown:
        return False
    require_all = "all" in mods
    mod = next((m for m in mods if m != "all"), "")
    fv = ev.get(field)
    if fv is None:
        return False
    targets = target if isinstance(target, list) else [target]
    results = (_match_one(fv, mod, t) for t in targets)
    return all(results) if require_all else any(results)


def _match_selection(ev: dict, block) -> bool:
    """Satu blok selection: semua field di-AND; daftar nilai di-OR."""
    if isinstance(block, list):           # daftar map -> OR antar map
        return any(_match_selection(ev, b) for b in block)
    if not isinstance(block, dict):
        return False
    return all(_match_field(ev, k, v) for k, v in block.items())


# --------------------------------------------------------------------------
# parser `condition`
# --------------------------------------------------------------------------
_TOK = re.compile(r"\(|\)|\ball of\b|\bany of\b|\b1 of\b|\band\b|\bor\b|\bnot\b|[\w*]+",
                  re.IGNORECASE)


class SigmaConditionError(ValueError):
    pass


def _tokenize(cond: str) -> list[str]:
    return [t.strip() for t in _TOK.findall(cond or "") if t.strip()]


def _expand(pattern: str, names: list[str]) -> list[str]:
    if pattern == "them":
        return list(names)
    rx = re.compile("^" + re.escape(pattern).replace(r"\*", ".*") + "$")
    return [n for n in names if rx.match(n)]


def compile_condition(cond: str, block_names: list[str]):
    """Ubah string condition menjadi fungsi (matched_set) -> bool."""
    toks = _tokenize(cond)
    pos = {"i": 0}

    def peek():
        return toks[pos["i"]].lower() if pos["i"] < len(toks) else None

    def take():
        t = toks[pos["i"]]
        pos["i"] += 1
        return t

    def primary():
        t = peek()
        if t is None:
            raise SigmaConditionError("condition terpotong")
        if t == "(":
            take()
            node = expr_or()
            if peek() != ")":
                raise SigmaConditionError("kurung tidak ditutup")
            take()
            return node
        if t == "not":
            take()
            inner = primary()
            return lambda m: not inner(m)
        if t in ("all of", "any of", "1 of"):
            kind = take().lower()
            if peek() is None:
                raise SigmaConditionError("pola setelah '%s' kosong" % kind)
            names = _expand(take(), block_names)
            if not names:
                return lambda m: False
            if kind == "all of":
                return lambda m: all(n in m for n in names)
            return lambda m: any(n in m for n in names)
        name = take()
        if name not in block_names:
            raise SigmaConditionError(f"blok detection '{name}' tidak ada")
        return lambda m: name in m

    def expr_and():
        node = primary()
        while peek() == "and":
            take()
            rhs = primary()
            prev = node
            node = (lambda p, r: (lambda m: p(m) and r(m)))(prev, rhs)
        return node

    def expr_or():
        node = expr_and()
        while peek() == "or":
            take()
            rhs = expr_and()
            prev = node
            node = (lambda p, r: (lambda m: p(m) or r(m)))(prev, rhs)
        return node

    fn = expr_or()
    if pos["i"] != len(toks):
        raise SigmaConditionError(f"token tersisa: {toks[pos['i']:]}")
    return fn


# --------------------------------------------------------------------------
# pemuatan
# --------------------------------------------------------------------------
_atomic: list[dict] = []
_correlations: list[dict] = []
_errors: list[str] = []

_TIMESPAN = re.compile(r"^(\d+)\s*([smhd])$", re.IGNORECASE)
_UNIT_S = {"s": 1, "m": 60, "h": 3600, "d": 86400}


def parse_timespan(v) -> int:
    if isinstance(v, (int, float)):
        return int(v)
    m = _TIMESPAN.match(str(v or "").strip())
    if not m:
        raise ValueError(f"timespan tidak dikenal: {v!r}")
    return int(m.group(1)) * _UNIT_S[m.group(2).lower()]


def _mitre_from_tags(tags) -> list[str]:
    out = []
    for t in tags or []:
        t = str(t)
        if t.lower().startswith("attack.t"):
            out.append(t.split(".", 1)[1].upper())
    return out


def _load_doc(doc: dict, src: str):
    name = doc.get("name") or doc.get("id")
    if not name:
        _errors.append(f"{src}: aturan tanpa 'name'")
        return
    tri = doc.get("trinetra") or {}

    if "correlation" in doc:
        c = doc["correlation"]
        try:
            ts = parse_timespan(c.get("timespan"))
        except ValueError as e:
            _errors.append(f"{src}:{name}: {e}")
            return
        ctype = c.get("type")
        if ctype not in ("temporal", "temporal_ordered", "event_count",
                         "value_count"):
            _errors.append(f"{src}:{name}: tipe korelasi '{ctype}' tidak didukung")
            return
        _correlations.append({
            "id": name,
            "sigma_id": doc.get("id", ""),
            "title": doc.get("title", name),
            "description": (doc.get("description") or "").strip(),
            "type": ctype,
            "rules": list(c.get("rules") or []),
            "group_by": list(c.get("group-by") or c.get("group_by") or ["entity_id"]),
            "timespan": ts,
            "count_gte": int((c.get("condition") or {}).get("gte", 1)),
            "field": c.get("field", ""),
            "level": doc.get("level", "high"),
            "mitre": _mitre_from_tags(doc.get("tags")),
            "category": tri.get("category", "correlated"),
            "severity": float(tri.get("severity", 50)),
            "kill_chain": list(tri.get("kill_chain") or []),
            "response": tri.get("response", "investigate"),
        })
        return

    det = doc.get("detection") or {}
    blocks = {k: v for k, v in det.items() if k != "condition"}
    if not blocks:
        _errors.append(f"{src}:{name}: tidak ada blok detection")
        return
    cond_str = det.get("condition") or " and ".join(blocks)
    try:
        cond_fn = compile_condition(cond_str, list(blocks))
    except SigmaConditionError as e:
        _errors.append(f"{src}:{name}: condition tidak didukung ({e})")
        return
    ls = doc.get("logsource") or {}
    _atomic.append({
        "id": name,
        "sigma_id": doc.get("id", ""),
        "title": doc.get("title", name),
        "description": (doc.get("description") or "").strip(),
        "blocks": blocks,
        "condition": cond_fn,
        "condition_str": cond_str,
        "level": doc.get("level", "medium"),
        "mitre": _mitre_from_tags(doc.get("tags")),
        "domain": (ls.get("product") or "endpoint").lower(),
        "service": ls.get("service", ""),
        "category": tri.get("category", "anomaly"),
        "severity": float(tri.get("severity", 20)),
        "stage": tri.get("stage", ""),
        "falsepositives": doc.get("falsepositives") or [],
    })


def load(directory: str | None = None) -> tuple[list[dict], list[dict]]:
    _atomic.clear()
    _correlations.clear()
    _errors.clear()
    d = directory or SIGMA_DIR
    if not os.path.isdir(d):
        return _atomic, _correlations
    for fn in sorted(os.listdir(d)):
        if not fn.endswith((".yml", ".yaml")):
            continue
        path = os.path.join(d, fn)
        try:
            docs = [x for x in yaml.safe_load_all(open(path)) if x]
        except yaml.YAMLError as e:
            _errors.append(f"{fn}: YAML tidak valid ({e})")
            continue
        for doc in docs:
            _load_doc(doc, fn)

    # buang korelasi yang mengacu ke aturan yang tidak ada — lebih baik gagal
    # keras saat muat daripada diam-diam tidak pernah menyala.
    names = {a["id"] for a in _atomic}
    valid = []
    for c in _correlations:
        missing = [r for r in c["rules"] if r not in names]
        if missing:
            _errors.append(f"{c['id']}: mengacu aturan tidak dikenal {missing}")
            continue
        valid.append(c)
    _correlations[:] = valid

    if _errors:
        for e in _errors:
            print(f"[sigma] PERINGATAN {e}", flush=True)
    print(f"[sigma] dimuat: {len(_atomic)} aturan atomik, "
          f"{len(_correlations)} korelasi, {len(_errors)} ditolak", flush=True)
    return _atomic, _correlations


def atomic() -> list[dict]:
    return _atomic


def correlations() -> list[dict]:
    return _correlations


def errors() -> list[str]:
    return list(_errors)


def evaluate_atomic(ev: dict) -> list[dict]:
    """Jalankan semua aturan atomik Sigma yang sesuai domain event."""
    dom = ev.get("domain", "endpoint")
    out = []
    for r in _atomic:
        if r["domain"] not in (dom, "any"):
            continue
        matched = {name for name, blk in r["blocks"].items()
                   if _match_selection(ev, blk)}
        if r["condition"](matched):
            out.append({
                "rule_id": r["id"],
                "sigma_id": r["sigma_id"],
                "title": r["title"],
                "category": r["category"],
                "severity": r["severity"],
                "stage": r["stage"],
                "level": r["level"],
                "mitre": r["mitre"],
                "source": "sigma",
            })
    return out
