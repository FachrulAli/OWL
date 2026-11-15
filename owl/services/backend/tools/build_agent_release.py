"""Build APK rilis bertanda tangan dengan kunci lokal; tak memasang APK ke HP."""
import argparse
import json
import os
import secrets
import subprocess
from pathlib import Path


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base", required=True)
    p.add_argument("--ca", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    owl = Path(__file__).resolve().parents[3]
    local = owl.parent / ".local"
    local.mkdir(exist_ok=True)
    config_file = local / "signing.json"
    store = local / "owl-agent.p12"
    if config_file.exists():
        signing = json.loads(config_file.read_text())
    else:
        if store.exists():
            raise RuntimeError("Keystore sudah ada tanpa konfigurasi; pulihkan signing.json")
        signing = {"password": secrets.token_urlsafe(32)}
        config_file.write_text(json.dumps(signing), encoding="utf-8")
        config_file.chmod(0o600)
    env = os.environ | {"OWL_SIGNING_STORE_FILE": str(store.resolve()),
        "OWL_SIGNING_STORE_PASSWORD": signing["password"], "OWL_SIGNING_KEY_PASSWORD": signing["password"],
        "OWL_SIGNING_KEY_ALIAS": "owl-agent"}
    java = Path(os.environ["JAVA_HOME"]) / "bin"
    if not store.exists():
        subprocess.run([str(java / "keytool.exe"), "-genkeypair", "-alias", "owl-agent", "-keyalg", "RSA",
            "-keysize", "3072", "-validity", "3650", "-dname", "CN=OWL Unit Agent", "-storetype", "PKCS12",
            "-keystore", str(store), "-storepass:env", "OWL_SIGNING_STORE_PASSWORD", "-keypass:env", "OWL_SIGNING_KEY_PASSWORD"],
            env=env, check=True, capture_output=True)
    android = owl / "agent/android"
    subprocess.run([str(android / "gradlew.bat"), ":app:assembleRelease", ":app:lintRelease", ":app:testReleaseUnitTest",
        "-PowlBase=" + args.base, "-PowlCa=" + str(args.ca.resolve()), "--console=plain"], cwd=android, env=env, check=True)
    cert = subprocess.run([str(java / "keytool.exe"), "-exportcert", "-alias", "owl-agent", "-keystore", str(store),
        "-storepass:env", "OWL_SIGNING_STORE_PASSWORD"], env=env, check=True, capture_output=True).stdout
    import hashlib
    apk = android / "app/build/outputs/apk/release/app-release.apk"
    result = {"apk": str(apk), "apk_sha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
              "signer_sha256": hashlib.sha256(cert).hexdigest(), "base_url": args.base,
              "scope": "local release signer for this workspace; replace with approved unit signer for deployment"}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
