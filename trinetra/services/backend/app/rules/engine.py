"""Deterministic rule engine (§10.3 FR-08) — evaluates the Sigma-like catalog.

Returns a list of matched signals, each with category, severity and the rule id.
Baseline-relative thresholds ($baseline:param:attr) are resolved against the
entity's role baseline config loaded by the enrichment layer.
"""
import os
import re

import yaml

from ..enrichment import role_baselines
from . import sigma_loader, correlation

_CATALOG: list[dict] = []
_CATALOG_PATH = os.path.join(os.path.dirname(__file__), "catalog.yml")


def load_catalog():
    """Muat katalog lama (domain endpoint) + seluruh aturan format Sigma."""
    global _CATALOG
    with open(_CATALOG_PATH) as f:
        _CATALOG = yaml.safe_load(f) or []
    sigma_loader.load()
    return _CATALOG


def sigma_rules() -> list[dict]:
    return sigma_loader.atomic()


def correlation_rules() -> list[dict]:
    return sigma_loader.correlations()


def catalog() -> list[dict]:
    return _CATALOG


def _resolve(value, ev):
    """Resolve $baseline:param:attr references; otherwise return literal."""
    if isinstance(value, str) and value.startswith("$baseline:"):
        _, param, attr = value.split(":")
        bl = role_baselines(ev.get("role", "")).get(param)
        if not bl:
            return None
        return bl.get(attr)
    return value


def _cmp(field_val, op, target) -> bool:
    if target is None:
        return False
    try:
        if op == "eq":
            return field_val == target
        if op == "ne":
            return field_val != target
        if op == "gt":
            return float(field_val) > float(target)
        if op == "gte":
            return float(field_val) >= float(target)
        if op == "lt":
            return float(field_val) < float(target)
        if op == "lte":
            return float(field_val) <= float(target)
        if op == "in":
            return field_val in target
        if op == "contains":
            return str(target).lower() in str(field_val).lower()
        if op == "regex":
            return re.search(target, str(field_val)) is not None
    except (ValueError, TypeError):
        return False
    return False


def evaluate(ev: dict) -> list[dict]:
    """Return matched rule signals for a normalized+enriched event.

    Dua sumber aturan: katalog lama (domain endpoint / insider threat) dan
    katalog format Sigma (domain mobile / MTD). Aturan hanya dievaluasi pada
    domain yang sesuai supaya kedua permukaan tidak saling mengganggu.
    """
    signals = []
    if ev.get("domain", "endpoint") == "mobile":
        return sigma_loader.evaluate_atomic(ev)
    signals.extend(sigma_loader.evaluate_atomic(ev))
    for rule in _CATALOG:
        matched = True
        for cond in rule.get("when", []):
            fv = ev.get(cond["field"])
            tv = _resolve(cond["value"], ev)
            if not _cmp(fv, cond["op"], tv):
                matched = False
                break
        if matched:
            signals.append({
                "source": "catalog",
                "rule_id": rule["id"],
                "title": rule["title"],
                "category": rule["category"],
                "severity": float(rule["severity"]),
                "mitre": rule.get("mitre", []),
            })
    return signals


def evaluate_correlated(ev: dict) -> tuple[list[dict], list[dict]]:
    """Evaluasi aturan atomik lalu uji correlation rule pada perangkat ini.

    Mengembalikan (signals_atomik, signals_korelasi). Korelasi dinilai setelah
    jejak event ini dicatat, jadi event terakhir dari sebuah rantai langsung
    memicu korelasinya pada putaran yang sama.
    """
    signals = evaluate(ev)
    corr_rules = sigma_loader.correlations()
    correlation.observe(ev, signals, corr_rules)
    corrs = correlation.evaluate(ev, corr_rules)
    return signals, corrs
