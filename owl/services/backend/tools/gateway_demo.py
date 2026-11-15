"""Demo tanpa browser melalui nginx TLS: allow -> deny -> allow."""
import argparse
import json
import os
import socket
import ssl
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx
from cryptography.hazmat.primitives import serialization

BACKEND = Path(__file__).resolve().parents[1]
OWL = BACKEND.parents[1]
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(OWL / "tests"))
from test_attestation import Rantai, _telemetri, _kirim
from create_tls import generate


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def run(nginx: Path):
    hidden = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
    scratch = OWL.parent / ".tools"
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="owl-gateway-", dir=scratch) as directory:
        temp = Path(directory).resolve()
        (temp / "logs").mkdir()
        (temp / "temp").mkdir()
        tls = temp / "tls"
        generate(tls, ["localhost", "127.0.0.1"])
        fixture = Rantai()
        root_path = temp / "attestation-root.pem"
        root_path.write_bytes(fixture.root.public_bytes(serialization.Encoding.PEM))
        backend_port, https_port, http_port = port(), port(), port()
        env = os.environ | {"OWL_DB": str(temp / "demo.db"), "OWL_ATTESTATION_ROOTS": str(root_path),
            "OWL_ENROLL": "shared", "OWL_DEMO": "true", "OWL_ATTESTATION": "verify",
            "OWL_API_KEY": "", "OWL_INGEST_TOKEN": "owl-demo-token", "OWL_LOG_FILE": str(temp / "backend.log"),
            "OWL_SOC_WEBHOOK": "", "OWL_SYSLOG_HOST": ""}
        config = (OWL / "infra/nginx-secure.conf").read_text(encoding="utf-8")
        config = (config.replace("backend:8000", f"127.0.0.1:{backend_port}")
            .replace("listen 80;", f"listen 127.0.0.1:{http_port};")
            .replace("listen 443 ssl;", f"listen 127.0.0.1:{https_port} ssl;")
            .replace(":8443", f":{https_port}")
            .replace("/etc/owl/tls", tls.as_posix())
            .replace("/etc/owl/demo/system.html", (OWL / "infra/system.html").as_posix())
            .replace("/usr/share/nginx/html", (OWL / "frontend/dist").as_posix()))
        conf = temp / "nginx.conf"
        conf.write_text("events {}\nhttp { access_log off;\n" + config + "\n}", encoding="utf-8")
        prefix = temp.as_posix() + "/"
        cmd = [str(nginx), "-p", prefix, "-c", conf.as_posix()]
        checked = subprocess.run(cmd + ["-t"], capture_output=True, **hidden)
        if checked.returncode:
            raise RuntimeError(checked.stderr.decode(errors="replace"))
        backend = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
                                    "--port", str(backend_port), "--no-access-log"], cwd=BACKEND,
                                    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **hidden)
        proxy = None
        try:
            for _ in range(100):
                try:
                    if httpx.get(f"http://127.0.0.1:{backend_port}/health", timeout=.3).is_success:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(.1)
            else:
                raise RuntimeError("Backend demo gagal mulai")
            proxy = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **hidden)
            ssl_context = ssl.create_default_context(cafile=str(tls / "ca.pem"))
            base = f"https://127.0.0.1:{https_port}"
            with httpx.Client(base_url=base, verify=ssl_context, timeout=10, trust_env=False) as client:
                for _ in range(100):
                    try:
                        client.get("/health", timeout=.5).raise_for_status()
                        break
                    except httpx.HTTPError as exc:
                        last_error = str(exc)
                        time.sleep(.1)
                else:
                    raise RuntimeError("Gateway TLS gagal mulai: " + last_error)
                ch = client.get("/api/enroll/challenge?device_id=HP-01", headers={"X-OWL-Token": "owl-demo-token"}).json()
                import base64
                r = client.post("/api/devices", headers={"X-OWL-Token": "owl-demo-token"}, json={
                    "device_id": "HP-01", "attestation_chain": fixture.buat(base64.b64decode(ch["challenge"]))})
                assert r.is_success and r.json()["attested"], r.text
                assert _kirim(client, fixture, _telemetri("HP-01", 1)).is_success
                ch = client.get("/api/access/challenge?device_id=HP-01").json()
                r = client.post("/api/access/sessions", json={"device_id": "HP-01", "challenge": ch["challenge"],
                    "signature": fixture.tanda_tangan(ch["signing_payload"].encode())})
                assert r.is_success, r.text
                headers = {"Authorization": "Bearer " + r.json()["token"]}
                sequence = [client.get("/protected/classified", headers=headers).status_code]
                t = _telemetri("HP-01", 2)
                t["integrity"]["root_artifacts"] = ["su"]
                assert _kirim(client, fixture, t).is_success
                denied = client.get("/protected/classified", headers=headers)
                sequence.append(denied.status_code)
                assert "OWL-D01" in denied.text, denied.text
                assert _kirim(client, fixture, _telemetri("HP-01", 3)).is_success
                sequence.append(client.get("/protected/classified", headers=headers).status_code)
                assert sequence == [200, 403, 200], sequence
                assert client.get("/_auth_classified").status_code == 404
                assert client.get("/protected/classified").status_code == 401
            redirect = httpx.get(f"http://127.0.0.1:{http_port}/health", follow_redirects=False, trust_env=False)
            assert redirect.status_code == 308
            untrusted_rejected = False
            try:
                httpx.get(base + "/health", trust_env=False)
            except httpx.ConnectError:
                untrusted_rejected = True
            assert untrusted_rejected
            return {"gateway": "nginx auth_request + TLS", "access_sequence": sequence,
                "http_status": 308, "unknown_ca_rejected": untrusted_rejected,
                "internal_auth_hidden": True, "unauthenticated_status": 401,
                "scope": "synthetic attestation chain rooted in temporary test CA, real HTTP/TLS requests"}
        finally:
            if proxy:
                subprocess.run(cmd + ["-s", "quit"], capture_output=True, **hidden)
                try:
                    proxy.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    proxy.terminate()
            backend.terminate()
            backend.wait(timeout=10)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--nginx", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    result = run(args.nginx.resolve())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
