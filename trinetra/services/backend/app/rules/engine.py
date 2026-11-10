"""Deterministic rule engine (§10.3 FR-08) — evaluates the Sigma-like catalog.

Returns a list of matched signals, each with category, severity and the rule id.
Baseline-relative thresholds ($baseline:param:attr) are resolved against the
entity's role baseline config loaded by the enrichment layer.
"""
import os
import re

import yaml

from ..enrichment import role_baselines

_CATALOG: list[dict] = []
_CATALOG_PATH = os.path.join(os.path.dirname(__file__), "catalog.yml")


def load_catalog():
    global _CATALOG
    with open(_CATALOG_PATH) as f:
        _CATALOG = yaml.safe_load(f) or []
    return _CATALOG


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
    """Return matched rule signals for a normalized+enriched event."""
    signals = []
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
                "rule_id": rule["id"],
                "title": rule["title"],
                "category": rule["category"],
                "severity": float(rule["severity"]),
                "mitre": rule.get("mitre", []),
            })
    return signals
