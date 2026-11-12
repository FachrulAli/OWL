/*
  TRINETRA — aturan YARA untuk APK Android (dievaluasi dengan YARA-X).

  POSISI LAPISAN INI: pelengkap, bukan tulang punggung. Zero-click kelas
  Pegasus tidak meninggalkan berkas untuk dipindai, jadi YARA tidak akan
  pernah menangkapnya. Yang ditangkap di sini adalah ancaman yang MEMANG
  berbentuk berkas: APK sideload berisi RAT/stalkerware — vektor yang nyata
  dan sering pada perangkat dinas.

  CARA KERJA: APK adalah arsip ZIP, isinya terkompresi, sehingga memindai
  berkas APK mentah hampir tidak menemukan apa pun. Karena itu pemindai
  TRINETRA membongkar APK lebih dulu lalu menjalankan aturan ini pada tiap
  anggota arsip (classes*.dex, AndroidManifest.xml, lib/, assets/) —
  pendekatan yang sama dipakai platform analisis APK seperti Koodous.

  SIFAT TEMUAN: heuristik. Aturan di bawah mencocokkan KOMBINASI kemampuan
  yang jarang dipakai bersamaan oleh aplikasi sah. Satu aturan menyala berarti
  "perlu diperiksa", bukan "terbukti jahat". Skor akhir dihitung di apkscan.py
  dan hasilnya tetap masuk ke pipeline korelasi yang sama.

  Penulis: TRINETRA / Kartika Cyber Hackathon 2026 (Pussiberad x Codepolitan)
*/

rule android_accessibility_remote_control
{
    meta:
        author      = "TRINETRA"
        description = "AccessibilityService + overlay + injeksi input: kendali penuh layar & masukan korban"
        severity    = "35"
        category    = "malicious_app"
        mitre       = "T1626"
        confidence  = "medium"
    strings:
        $acc1 = "android.accessibilityservice.AccessibilityService" ascii
        $acc2 = "AccessibilityNodeInfo" ascii
        $inj1 = "dispatchGesture" ascii
        $inj2 = "performGlobalAction" ascii
        $ovl  = "SYSTEM_ALERT_WINDOW" ascii
    condition:
        1 of ($acc*) and 1 of ($inj*) and $ovl
}

rule android_covert_audio_video_capture
{
    meta:
        author      = "TRINETRA"
        description = "Perekaman mikrofon/kamera dari layanan latar belakang tanpa antarmuka"
        severity    = "40"
        category    = "covert_surveillance"
        mitre       = "T1429,T1512"
        confidence  = "medium"
    strings:
        $rec1 = "android/media/MediaRecorder" ascii
        $rec2 = "setAudioSource" ascii
        $cam1 = "android/hardware/camera2/CameraManager" ascii
        $cam2 = "takePicture" ascii
        $svc  = "startForegroundService" ascii
        $hide = "setComponentEnabledSetting" ascii
    condition:
        (1 of ($rec*) or 1 of ($cam*)) and $svc and $hide
}

rule android_sms_interception
{
    meta:
        author      = "TRINETRA"
        description = "Penyadapan SMS: menangkap SMS masuk, membatalkan notifikasi, lalu meneruskannya"
        severity    = "38"
        category    = "covert_surveillance"
        mitre       = "T1636"
        confidence  = "medium"
    strings:
        $r1 = "android.provider.Telephony.SMS_RECEIVED" ascii
        $r2 = "abortBroadcast" ascii
        $s1 = "android/telephony/SmsManager" ascii
        $s2 = "getMessageBody" ascii
    condition:
        $r1 and $r2 and 1 of ($s*)
}

rule android_hidden_launcher_persistence
{
    meta:
        author      = "TRINETRA"
        description = "Menyembunyikan ikon launcher + bangkit saat boot: pola stalkerware persisten"
        severity    = "32"
        category    = "spyware_implant"
        mitre       = "T1625"
        confidence  = "medium"
    strings:
        $h1 = "COMPONENT_ENABLED_STATE_DISABLED" ascii
        $h2 = "setComponentEnabledSetting" ascii
        $b1 = "android.intent.action.BOOT_COMPLETED" ascii
        $b2 = "RECEIVE_BOOT_COMPLETED" ascii
    condition:
        all of ($h*) and 1 of ($b*)
}

rule android_device_admin_lock
{
    meta:
        author      = "TRINETRA"
        description = "Device Admin dipakai untuk menahan pencabutan izin / mencegah uninstall"
        severity    = "30"
        category    = "malicious_app"
        mitre       = "T1626"
        confidence  = "medium"
    strings:
        $d1 = "android/app/admin/DeviceAdminReceiver" ascii
        $d2 = "onDisableRequested" ascii
        $d3 = "lockNow" ascii
        $d4 = "BIND_DEVICE_ADMIN" ascii
    condition:
        2 of ($d*)
}

rule android_dynamic_payload_loading
{
    meta:
        author      = "TRINETRA"
        description = "Memuat kode tambahan saat berjalan (DexClassLoader) — menyembunyikan muatan dari pemindaian statis"
        severity    = "28"
        category    = "malicious_app"
        mitre       = "T1407"
        confidence  = "low"
    strings:
        $l1 = "dalvik/system/DexClassLoader" ascii
        $l2 = "dalvik/system/InMemoryDexClassLoader" ascii
        $l3 = "dalvik/system/PathClassLoader" ascii
        $n1 = "System.loadLibrary" ascii
        $u1 = "openConnection" ascii
    condition:
        1 of ($l1, $l2) or ($l3 and $n1 and $u1)
}

rule android_remote_shell_root
{
    meta:
        author      = "TRINETRA"
        description = "Eksekusi perintah shell + percobaan root dari dalam aplikasi"
        severity    = "34"
        category    = "malicious_app"
        mitre       = "T1631"
        confidence  = "medium"
    strings:
        $e1 = "Runtime" ascii
        $e2 = "getRuntime" ascii
        $e3 = "/system/bin/sh" ascii
        $e4 = "su -c" ascii
        $r1 = "/system/xbin/su" ascii
        $r2 = "Superuser.apk" ascii
    condition:
        ($e1 and $e2 and 1 of ($e3, $e4)) or 1 of ($r*)
}

rule android_rat_family_strings
{
    meta:
        author      = "TRINETRA"
        description = "Jejak keluarga RAT Android yang beredar luas (heuristik berbasis nama/perintah)"
        severity    = "45"
        category    = "malicious_app"
        mitre       = "T1476"
        confidence  = "heuristic"
    strings:
        $f1 = "SpyNote" nocase ascii
        $f2 = "CraxsRat" nocase ascii
        $f3 = "AhMyth" nocase ascii
        $f4 = "DroidJack" nocase ascii
        $c1 = "x0000ca" ascii           // penanda perintah kamera AhMyth
        $c2 = "x0000mc" ascii           // penanda perintah mikrofon AhMyth
        $c3 = "getInstalledApps" ascii
    condition:
        1 of ($f*) or 2 of ($c*)
}

rule android_manifest_surveillance_permissions
{
    meta:
        author      = "TRINETRA"
        description = "Gabungan izin pemantauan menyeluruh dalam satu aplikasi (dinilai pada AndroidManifest)"
        severity    = "26"
        category    = "malicious_app"
        mitre       = "T1424"
        confidence  = "low"
    strings:
        $p1 = "android.permission.RECORD_AUDIO" ascii
        $p2 = "android.permission.READ_SMS" ascii
        $p3 = "android.permission.ACCESS_FINE_LOCATION" ascii
        $p4 = "android.permission.READ_CONTACTS" ascii
        $p5 = "android.permission.CAMERA" ascii
        $p6 = "android.permission.READ_CALL_LOG" ascii
        $p7 = "android.permission.SYSTEM_ALERT_WINDOW" ascii
        $p8 = "android.permission.REQUEST_INSTALL_PACKAGES" ascii
    condition:
        5 of ($p*)
}
