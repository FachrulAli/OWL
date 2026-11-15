"""Bukti roadmap B6–B9, C10–C11, D15 termasuk jalur penolakan."""
import base64
import json
from datetime import timedelta

import pytest

from test_roadmap_a import client, rantai, _daftar, ADMIN
from test_attestation import _kirim, _telemetri
from app import db, operations, rules
from app.models import Telemetry


def session(client, rantai, device="HP-01"):
    ch = client.get("/api/access/challenge", params={"device_id": device}).json()
    signature = rantai.tanda_tangan(ch["signing_payload"].encode())
    return client.post("/api/access/sessions", json={"device_id": device,
                       "challenge": ch["challenge"], "signature": signature})


def ready(client, rantai):
    assert _daftar(client, rantai, "HP-01").json()["attested"]
    assert _kirim(client, rantai, _telemetri("HP-01", 1)).status_code == 200
    r = session(client, rantai)
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_gateway_allow_deny_allow_with_same_session(client, rantai):
    headers = ready(client, rantai)
    assert client.get("/protected/classified", headers=headers).status_code == 200
    t = _telemetri("HP-01", 2)
    t["integrity"]["root_artifacts"] = ["/system/bin/su"]
    _kirim(client, rantai, t)
    assert client.get("/protected/classified", headers=headers).status_code == 403
    _kirim(client, rantai, _telemetri("HP-01", 3))
    assert client.get("/protected/classified", headers=headers).status_code == 200


def test_session_requires_device_proof_and_nonce_is_once(client, rantai):
    ready(client, rantai)
    ch = client.get("/api/access/challenge?device_id=HP-01").json()
    body = {"device_id": "HP-01", "challenge": ch["challenge"], "signature": "invalid"}
    assert client.post("/api/access/sessions", json=body).status_code == 403
    body["signature"] = rantai.tanda_tangan(ch["signing_payload"].encode())
    assert client.post("/api/access/sessions", json=body).status_code == 403
    assert client.get("/protected/standard").status_code == 401
    assert client.get("/protected/standard", headers={"Authorization": "Bearer fabricated"}).status_code == 401


def test_revoked_device_cannot_use_existing_session(client, rantai):
    headers = ready(client, rantai)
    client.put("/api/devices/HP-01/revoke", json={"reason": "HP hilang"}, headers=ADMIN)
    assert client.get("/protected/standard", headers=headers).status_code == 403


def test_new_revocation_list_blocks_existing_session_immediately(client, rantai):
    headers = ready(client, rantai)
    dev = client.get("/api/devices/HP-01").json()["device"]
    serial = dev["attestation"]["chain_serials"][0]
    client.post("/api/attestation/revocations", json={"entries": {serial: {"status": "REVOKED"}}}, headers=ADMIN)
    assert client.get("/protected/standard", headers=headers).status_code == 403


def test_expired_or_rotated_session_denied(client, rantai):
    headers = ready(client, rantai)
    token = headers["Authorization"][7:]
    import hashlib
    key = "access_session:" + hashlib.sha256(token.encode()).hexdigest()
    value = client.portal.call(db.get_value, key)
    value["expires"] = (operations.now() - timedelta(seconds=1)).isoformat()
    client.portal.call(db.put_value, key, value)
    assert client.get("/protected/standard", headers=headers).status_code == 401
    headers = ready(client, rantai)
    client.portal.call(db.conn().execute, "UPDATE devices SET public_key='other' WHERE device_id='HP-01'")
    assert client.get("/protected/standard", headers=headers).status_code == 403


def test_stale_report_cannot_use_session(client, rantai):
    headers = ready(client, rantai)
    client.portal.call(db.conn().execute, "UPDATE assessments SET assessed_at='2000-01-01T00:00:00+00:00'")
    assert client.get("/protected/standard", headers=headers).status_code == 403


def test_one_transition_one_event(client, rantai):
    ready(client, rantai)
    for i in (2, 3):
        t = _telemetri("HP-01", i)
        t["integrity"]["root_artifacts"] = ["su"]
        _kirim(client, rantai, t)
    events = [e for e in client.get("/api/soc/events?limit=100").json() if e["kind"] == "decision_changed"]
    assert len(events) == 1
    event = json.loads(events[0]["payload"])
    assert event["old_decision"] == "allow" and event["new_decision"] == "deny"
    assert event["rules"]


def test_case_exception_expires_and_cannot_bypass_root(client, rantai):
    headers = ready(client, rantai)
    value = {"status": "dikecualikan", "note": "Disetujui petugas", "ttl_minutes": 1}
    assert client.put("/api/cases/HP-01", json=value).status_code == 403
    assert client.put("/api/cases/HP-01", json=value, headers=ADMIN).status_code == 200
    case = client.portal.call(db.get_value, "case:HP-01")
    case["expires_at"] = (operations.now() - timedelta(minutes=1)).isoformat()
    client.portal.call(db.put_value, "case:HP-01", case)
    assert client.get("/api/cases").json()[0]["status"] == "baru"
    client.put("/api/cases/HP-01", json=value, headers=ADMIN)
    t = _telemetri("HP-01", 2)
    t["integrity"]["root_artifacts"] = ["su"]
    _kirim(client, rantai, t)
    assert client.get("/protected/standard", headers=headers).status_code == 403
    audit = client.get("/api/policy").json()["audit"]
    assert any(a["field"] == "case:HP-01" and a["actor"] == "system" for a in audit)


def test_case_exception_can_open_score_denial_and_expiry_closes_it(client, rantai):
    headers = ready(client, rantai)
    # Skor tinggi tanpa aturan penentu: ambang dibuat rendah untuk uji ini.
    from app import policy
    old = policy.thresholds()
    for name, value in {"medium": 1, "high": 2, "critical": 3}.items():
        policy.set_threshold(name, value)
    try:
        t = _telemetri("HP-01", 2)
        t["vpn_profiles"] = [{"name": "vpn-asing"}]
        _kirim(client, rantai, t)
        assert client.get("/protected/classified", headers=headers).status_code == 403
        client.put("/api/cases/HP-01", json={"status": "dikecualikan", "note": "Pemeriksaan selesai"}, headers=ADMIN)
        assert client.get("/protected/classified", headers=headers).status_code == 200
        case = client.portal.call(db.get_value, "case:HP-01")
        case["expires_at"] = (operations.now() - timedelta(seconds=1)).isoformat()
        client.portal.call(db.put_value, "case:HP-01", case)
        assert client.get("/protected/classified", headers=headers).status_code == 403
    finally:
        for name, value in reversed(list(old.items())):
            policy.set_threshold(name, value)


def bundle(pattern):
    return {"type": "bundle", "objects": [{"type": "indicator", "pattern_type": "stix", "pattern": pattern}]}


def test_stix_replace_live_matching_and_audit(client, rantai):
    headers = ready(client, rantai)
    t = _telemetri("HP-01", 2)
    t["apps"] = [{"package": "test.payload", "installer": "com.android.vending", "signer_sha256": "a" * 64}]
    _kirim(client, rantai, t)
    for pattern in ("[software:name = 'test.payload']", "[x-android-app:signer_sha256 = '" + "a" * 64 + "']"):
        assert client.post("/api/blocklist/import", json=bundle(pattern)).status_code == 403
        assert client.post("/api/blocklist/import", json=bundle(pattern), headers=ADMIN).status_code == 200
        assert client.get("/protected/standard", headers=headers).status_code == 403
        assert client.post("/api/blocklist/import", json={"type": "bundle", "objects": []}, headers=ADMIN).status_code == 200
        assert client.get("/protected/standard", headers=headers).status_code == 200
    assert client.post("/api/blocklist/import", json=bundle("unsupported"), headers=ADMIN).status_code == 400
    assert any(a["field"] == "dynamic_blocklist" for a in client.get("/api/policy").json()["audit"])


def test_c10_whole_phone_upload_is_low_hidden_app_is_detected(client):
    t = Telemetry(**_telemetri("HP", 1))
    t.network.egress_mb_24h = 1536
    t.network.screen_on_ratio_24h = 0.02
    f = next(f for f in rules.evaluate(t) if f.rule_id == "OWL-N01")
    assert f.severity == "low"
    from app.models import AppNetwork
    t.network.apps = [AppNetwork(package="normal", uid=10001, egress_mb_24h=1536, foreground_ms_24h=1000)]
    assert not any(f.rule_id == "OWL-N01" for f in rules.evaluate(t))
    t.network.apps[0].foreground_ms_24h = 0
    assert any(f.rule_id == "OWL-N01" for f in rules.evaluate(t))


@pytest.mark.parametrize("brand", ["Infinix", "Samsung", "Google"])
def test_factory_allowlist_requires_brand_package_and_signer(client, brand):
    entry = {"manufacturer": brand, "package": "vendor.app", "signer_sha256": "b" * 64}
    assert client.put("/api/factory-allowlist", json=[entry], headers=ADMIN).status_code == 200
    t = Telemetry(**(_telemetri("HP", 1) | {"manufacturer": brand, "apps": [{"package": "vendor.app", "signer_sha256": "b" * 64}]}))
    assert not any(f.rule_id == "OWL-A01" for f in rules.evaluate(t))
    t.apps[0].signer_sha256 = "c" * 64
    assert any(f.rule_id == "OWL-A01" for f in rules.evaluate(t))


def test_silence_and_rejection_spike_emit_without_dashboard(client, rantai):
    ready(client, rantai)
    client.portal.call(db.conn().execute, "UPDATE assessments SET assessed_at='2000-01-01T00:00:00+00:00'")
    for _ in range(10):
        client.post("/api/telemetry", json=_telemetri("HP-01"), headers={"X-OWL-Token": "wrong"})
    for _ in range(2):
        assert client.post("/api/alarms/scan", headers=ADMIN).status_code == 200
    events = client.get("/api/soc/events?limit=100").json()
    for kind in ("device_silent", "rejection_spike"):
        assert sum(e["kind"] == kind for e in events) == 1
    m = client.get("/api/metrics").json()
    assert m["decisions"]["deny"] == 1 and m["rejects_by_reason"]["token tidak sah"] == 10


def test_reimporting_old_list_does_not_make_it_fresh(client):
    assert client.post("/api/attestation/revocations?source_date=2000-01-01",
        json={"entries": {"aa": {}}}, headers=ADMIN).status_code == 200
    assert client.get("/health").json()["revocation"]["status"] == "basi"
    assert client.post("/api/attestation/revocations?source_date=invalid",
        json={"entries": {"aa": {}}}, headers=ADMIN).status_code == 400


def test_workflow_read_endpoints_require_read_key(client):
    from app.config import settings
    old = settings.API_KEY
    object.__setattr__(settings, "API_KEY", "private-read")
    try:
        for path in ("/api/cases", "/api/metrics", "/api/blocklist", "/api/factory-allowlist"):
            assert client.get(path).status_code == 401
            assert client.get(path, headers={"X-OWL-Api-Key": "private-read"}).status_code == 200
    finally:
        object.__setattr__(settings, "API_KEY", old)


def test_step_up_and_restrict_gate_paths(client, rantai):
    headers = ready(client, rantai)
    from app import policy
    for name, value in {"medium": 1, "high": 2, "critical": 90}.items():
        policy.set_threshold(name, value)
    t = _telemetri("HP-01", 2)
    t["vpn_profiles"] = [{"name": "vpn-asing"}]
    _kirim(client, rantai, t)
    assert client.get("/protected/standard", headers=headers).status_code == 200
    assert client.get("/protected/classified", headers=headers).status_code == 403
    policy.set_threshold("high", 70)
    assert client.get("/api/access/verify", headers=headers | {"X-OWL-Resource": "standard"}).headers["x-owl-decision"] == "step_up"
    assert client.get("/protected/classified", headers=headers).status_code == 200


def test_persistent_dynamic_rules_are_restored(client):
    value = bundle("[software:name = 'persisted.payload']")
    client.post("/api/blocklist/import", json=value, headers=ADMIN)
    rules.set_dynamic({"packages": [], "signers": []}, [])
    client.portal.call(operations.restore_rules)
    t = Telemetry(**(_telemetri("HP", 1) | {"apps": [{"package": "persisted.payload"}]}))
    assert any(f.rule_id == "OWL-A03" for f in rules.evaluate(t))


def test_reenrollment_needs_new_report_before_new_access(client, rantai):
    headers = ready(client, rantai)
    assert _daftar(client, rantai, "HP-01").json()["attested"]
    assert client.get("/protected/standard", headers=headers).status_code == 403
    assert session(client, rantai).status_code == 403
    _kirim(client, rantai, _telemetri("HP-01", 2))
    assert session(client, rantai).status_code == 200


def test_new_unlocked_attestation_blocks_access_before_next_report(client, rantai):
    headers = ready(client, rantai)
    assert _daftar(client, rantai, "HP-01", boot_state=2, locked=False).json()["attested"]
    assert client.get("/protected/standard", headers=headers).status_code == 403


def test_alarm_scan_removes_expired_session_records(client):
    client.portal.call(db.put_value, "access_session:expired", {"expires": "2000-01-01T00:00:00+00:00"})
    client.post("/api/alarms/scan", headers=ADMIN)
    assert client.portal.call(db.get_value, "access_session:expired") is None
