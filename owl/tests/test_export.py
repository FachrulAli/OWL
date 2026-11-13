"""Uji ekspor STIX 2.1 dan CEF (deepdive §8.3)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "services" / "backend"
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402

from app import cef, demo, pdp, rules, scoring, soc, stix  # noqa: E402


@pytest.fixture(scope="module")
def penilaian():
    rules.load()
    t = demo.telemetry_berisiko()
    a = scoring.score(t, rules.evaluate(t))
    return a, pdp.decide(a, "classified")


def test_bundle_stix_berbentuk_sah(penilaian):
    a, d = penilaian
    b = stix.bundle(a, d, device_label="HP dinas perwira", unit="Staf Komando")
    assert b["type"] == "bundle" and b["id"].startswith("bundle--")
    kinds = [o["type"] for o in b["objects"]]
    assert kinds.count("x-oca-asset") == 1
    assert kinds.count("observed-data") == 1
    assert kinds.count("indicator") == len(a.findings)
    for o in b["objects"]:
        assert o["id"].startswith(o["type"] + "--")
        if o["type"] == "indicator":
            assert o["pattern_type"] == "stix"
            assert o["pattern"].startswith("[") and o["pattern"].endswith("]")


def test_observed_data_menunjuk_seluruh_objek(penilaian):
    a, d = penilaian
    b = stix.bundle(a, d)
    ids = {o["id"] for o in b["objects"]}
    od = next(o for o in b["objects"] if o["type"] == "observed-data")
    assert set(od["object_refs"]).issubset(ids)
    assert len(od["object_refs"]) == len(a.findings) + 1


def test_asset_membawa_skor_dan_kontributor(penilaian):
    a, d = penilaian
    asset = next(o for o in stix.bundle(a, d)["objects"] if o["type"] == "x-oca-asset")
    assert asset["x_owl_risk_score"] == 87.0
    assert "OWL-R01" in asset["x_owl_risk_contributors"]


def test_baris_cef_berbentuk_sah(penilaian):
    a, d = penilaian
    line = cef.line(a, d, device_label="HP dinas perwira")
    head, _, ext = line.partition("|9|") if "|9|" in line else line.partition("|7|")
    assert line.startswith("CEF:0|OWL|OnDeviceWatchLayer|1.0|")
    assert head.count("|") == 5          # tujuh ruas header, enam pemisah
    assert "cs1Label=riskScore" in line and "cs1=87.0" in line
    assert "act=deny" in line


def test_cef_meloloskan_karakter_khusus(penilaian):
    a, d = penilaian
    line = cef.line(a, d, device_label="HP|dinas=perwira")
    assert "HP\\|dinas" in line


def test_tanda_tangan_hmac_stabil():
    s1 = soc.sign(b'{"a":1}', "rahasia")
    s2 = soc.sign(b'{"a":1}', "rahasia")
    assert s1 == s2 and len(s1) == 64
    assert soc.sign(b'{"a":2}', "rahasia") != s1
