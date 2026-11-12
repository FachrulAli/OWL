"""Uji pemindai APK: APK sintetis berpola RAT, APK bersih, dan dua uji pelindung.

Jalankan:  python3 -m pip install yara-x && python3 tests/test_apkscan.py

APK "jahat" di sini dibuat dari nol oleh skrip ini — berisi kombinasi STRING
nama API Android yang jarang muncul bersamaan pada aplikasi sah. Tidak ada
sampel malware sungguhan di repositori ini."""
import io, os, sys, zipfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "services", "backend"))
from app import apkscan, indicators            # noqa: E402

indicators.load(os.path.join(REPO, "infra", "indicators", "stix2"))
apkscan.load(os.path.join(REPO, "infra", "yara"))


def mk_apk(manifest: bytes, dex: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("AndroidManifest.xml", manifest)
        z.writestr("classes.dex", dex)
        z.writestr("resources.arsc", b"\x00" * 128)
        z.writestr("res/drawable/ic.png", b"\x89PNG" + b"\x00" * 64)
    return buf.getvalue()


# --- APK "jahat" sintetis: kombinasi kemampuan khas RAT Android ---
bad_manifest = b"""
android.permission.RECORD_AUDIO android.permission.READ_SMS
android.permission.ACCESS_FINE_LOCATION android.permission.READ_CONTACTS
android.permission.CAMERA android.permission.RECEIVE_BOOT_COMPLETED
android.permission.SYSTEM_ALERT_WINDOW android.permission.REQUEST_INSTALL_PACKAGES
android.intent.action.BOOT_COMPLETED BIND_DEVICE_ADMIN
"""
bad_dex = b"""dex\x0a035\x00
android.accessibilityservice.AccessibilityService AccessibilityNodeInfo
dispatchGesture performGlobalAction SYSTEM_ALERT_WINDOW
android/media/MediaRecorder setAudioSource startForegroundService
setComponentEnabledSetting COMPONENT_ENABLED_STATE_DISABLED
android.intent.action.BOOT_COMPLETED
android.provider.Telephony.SMS_RECEIVED abortBroadcast android/telephony/SmsManager
android/app/admin/DeviceAdminReceiver onDisableRequested lockNow
dalvik/system/DexClassLoader
Runtime getRuntime /system/bin/sh
SpyNote
"""

# --- APK bersih sintetis: aplikasi Android biasa ---
ok_manifest = b"android.permission.INTERNET android.permission.VIBRATE"
ok_dex = (b"dex\x0a035\x00 androidx.core.app.NotificationCompat "
          b"androidx.recyclerview.widget.RecyclerView retrofit2.Retrofit "
          b"com.google.android.material.button.MaterialButton")

for label, blob in (("APK sintetis berpola RAT", mk_apk(bad_manifest, bad_dex)),
                    ("APK bersih", mk_apk(ok_manifest, ok_dex))):
    r = apkscan.scan_apk(blob, f"{label}.apk")
    print(f"\n  ===== {label} =====")
    print(f"  sha256   : {r['sha256'][:32]}...")
    print(f"  putusan  : {r['verdict'].upper()}   skor: {r['score']}")
    print(f"  anggota dipindai: {r['members_scanned']}   engine: {r['engine']}")
    if r["ioc_match"]:
        print(f"  IOC      : {r['ioc_match']}")
    for m in r["matches"]:
        print(f"    - {m['rule']:42s} sev={m['severity']:<5} "
              f"({m['confidence']}) di {m['where'][:44]}")
    for n in r["notes"]:
        print(f"    catatan: {n}")

# --- uji pelindung: zip bomb sederhana harus tidak menggantung pemindai ---
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    for i in range(50):
        z.writestr(f"big{i}.dex", b"\x00" * (5 * 1024 * 1024))
r = apkscan.scan_apk(buf.getvalue(), "bomb.apk")
print(f"\n  ===== uji pelindung dekompresi =====")
print(f"  putusan: {r['verdict']}  anggota dipindai: {r['members_scanned']}")
for n in r["notes"]:
    print(f"    catatan: {n}")

# --- uji path traversal pada nama anggota ---
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as z:
    z.writestr("../../../../etc/passwd.dex", b"dex SpyNote")
    z.writestr("/abs/evil.dex", b"dex CraxsRat")
r = apkscan.scan_apk(buf.getvalue(), "traversal.apk")
print(f"\n  ===== uji nama anggota berbahaya =====")
print(f"  putusan: {r['verdict']}  anggota dipindai: {r['members_scanned']}")
print("  (nama anggota hanya dipakai sebagai label; tidak ada berkas ditulis)")
for m in r["matches"]:
    print(f"    - {m['rule']} di {m['where']}")
import glob
leaked = glob.glob("/tmp/etc/passwd*") + glob.glob("./etc/passwd*")
print(f"  berkas bocor ke disk: {leaked or 'TIDAK ADA'}")
