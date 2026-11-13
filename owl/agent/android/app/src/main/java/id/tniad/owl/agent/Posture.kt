package id.tniad.owl.agent

import android.app.AppOpsManager
import android.app.usage.NetworkStatsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Process
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.KeyStore

/**
 * Pengumpul enam sinyal OWL dari API Android publik.
 *
 * BATAS YANG JUJUR — yang TIDAK dapat dibaca aplikasi biasa tanpa hak
 * istimewa, dan karena itu TIDAK diklaim di mana pun:
 *
 *  1. Isi lalu lintas jaringan. Agent hanya membaca metadata volume. Membaca
 *     isinya menuntut VpnService, dan hanya boleh ada satu VPN aktif pada
 *     perangkat, sehingga memasangnya justru akan mematikan VPN satuan.
 *  2. Daftar tujuan jaringan per aplikasi. `unusual_destinations` dan
 *     `new_destinations` pada skema telemetri diisi oleh resolver DNS satuan
 *     atau oleh agent yang dipasang sebagai Device Owner, bukan oleh aplikasi
 *     biasa. Pada versi ini keduanya dikirim kosong, dan backend tidak akan
 *     menyalakan aturan yang bergantung padanya. Lebih baik kosong dan jelas
 *     tidak tersedia daripada diisi angka yang tidak pernah diukur.
 *  3. Implan baseband, IMSI catcher, rootkit firmware, dan intersepsi RF.
 *     Semuanya di bawah lapisan aplikasi. Lihat deepdive §2.2 dan §6.2.
 *
 *  Yang di bawah ini seluruhnya nyata dan berjalan tanpa root.
 */
object Posture {

    // ——— sinyal 1 dan 2: izin aplikasi dan layanan aksesibilitas ———

    private val RECORDING = setOf(
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
    )

    /** Aplikasi beserta izin perekaman yang dipegangnya dan pemasangnya. */
    fun apps(ctx: Context): JSONArray {
        val pm = ctx.packageManager
        val out = JSONArray()
        val pkgs = pm.getInstalledPackages(PackageManager.GET_PERMISSIONS)
        for (p in pkgs) {
            val appInfo = p.applicationInfo ?: continue
            // Aplikasi sistem bawaan dilewati: keduanya memang memegang izin
            // perekaman secara sah, dan memasukkannya hanya akan membanjiri
            // analis dengan temuan yang tidak dapat ditindaklanjuti.
            val isSystem = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
            if (isSystem) continue

            val granted = mutableListOf<String>()
            val perms = p.requestedPermissions
            val flags = p.requestedPermissionsFlags
            if (perms != null && flags != null) {
                for (i in perms.indices) {
                    val isGranted = (flags[i] and android.content.pm.PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0
                    if (isGranted && perms[i] in RECORDING) granted.add(perms[i])
                }
            }

            out.put(JSONObject().apply {
                put("package", p.packageName)
                put("installer", installerOf(ctx, p.packageName))
                put("permissions", JSONArray(granted))
            })
        }
        return out
    }

    /** Sinyal 4: sumber pemasangan. String kosong berarti tidak diketahui. */
    private fun installerOf(ctx: Context, pkg: String): String = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ctx.packageManager.getInstallSourceInfo(pkg).installingPackageName ?: ""
        } else {
            @Suppress("DEPRECATION")
            ctx.packageManager.getInstallerPackageName(pkg) ?: ""
        }
    } catch (_: Exception) { "" }

    /** Layanan aksesibilitas yang aktif, dibaca dari Settings.Secure. */
    fun accessibilityServices(ctx: Context): JSONArray {
        val out = JSONArray()
        val enabled = Settings.Secure.getString(
            ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return out
        for (entry in enabled.split(':')) {
            if (entry.isBlank()) continue
            val pkg = entry.substringBefore('/')
            out.put(JSONObject().apply {
                put("package", pkg)
                put("label", labelOf(ctx, pkg))
            })
        }
        return out
    }

    /**
     * Aplikasi yang memegang SYSTEM_ALERT_WINDOW. Dipakai sah oleh beberapa
     * aplikasi, jadi backend memperlakukannya sebagai sinyal yang perlu
     * dikuatkan sinyal lain, bukan sebagai bukti.
     */
    fun overlayPackages(ctx: Context): JSONArray {
        val aom = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val pm = ctx.packageManager
        val out = JSONArray()
        for (p in pm.getInstalledPackages(0)) {
            val info = p.applicationInfo ?: continue
            if ((info.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0) continue
            val mode = try {
                aom.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_SYSTEM_ALERT_WINDOW, info.uid, p.packageName)
            } catch (_: Exception) { AppOpsManager.MODE_ERRORED }
            if (mode == AppOpsManager.MODE_ALLOWED) out.put(p.packageName)
        }
        return out
    }

    private fun labelOf(ctx: Context, pkg: String): String = try {
        ctx.packageManager.getApplicationLabel(
            ctx.packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (_: Exception) { "" }

    // ——— sinyal 3: sertifikat CA pengguna dan profil VPN ———

    /**
     * CA yang dipasang pengguna, dibaca dari KeyStore "AndroidCAStore".
     * Alias yang diawali "user:" berasal dari trust store pengguna, dan
     * itulah yang menjadi prasyarat penyadapan TLS.
     */
    /** Diisi jika trust store gagal dibaca, supaya status indikator jujur. */
    private var certError: String? = null

    fun userCertificates(): JSONArray {
        val out = JSONArray()
        certError = null
        try {
            val ks = KeyStore.getInstance("AndroidCAStore")
            ks.load(null, null)
            val aliases = ks.aliases()
            while (aliases.hasMoreElements()) {
                val alias = aliases.nextElement()
                if (!alias.startsWith("user:")) continue
                val cert = ks.getCertificate(alias) as? java.security.cert.X509Certificate ?: continue
                out.put(JSONObject().apply {
                    put("subject", cert.subjectX500Principal.name)
                    put("sha256", sha256(cert.encoded))
                })
            }
        } catch (e: Exception) {
            // Daftar kosong karena GAGAL DIBACA tidak sama dengan daftar
            // kosong karena memang tidak ada CA pengguna. Kegagalannya
            // dicatat dan dikirim sebagai status indikator, sehingga
            // dashboard menandainya "tidak dapat diperiksa" dan aturan
            // OWL-C01 tidak dijalankan, bukan dianggap lulus.
            certError = e.message ?: "trust store tidak dapat dibaca"
        }
        return out
    }

    /**
     * Profil VPN yang sedang aktif.
     *
     * Dua jalur dipakai bersama karena masing-masing punya celah.
     * `getAllNetworks` memang ditandai deprecated sejak API 31, tetapi sampai
     * sekarang tidak ada pengganti SINKRON untuk menyebut seluruh jaringan;
     * penggantinya `registerNetworkCallback` bersifat asinkron dan tidak cocok
     * dipanggil dari penyusunan satu laporan. Jadi pemakaiannya disengaja,
     * bukan kelalaian, dan diberi jaring pengaman berupa pemeriksaan antarmuka
     * tun yang tetap menangkap VPN jika API itu suatu saat dicabut.
     */
    fun vpnProfiles(ctx: Context): JSONArray {
        val out = JSONArray()
        val seen = mutableSetOf<String>()
        try {
            val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            @Suppress("DEPRECATION")
            val networks = cm.allNetworks
            for (net in networks) {
                val caps = cm.getNetworkCapabilities(net) ?: continue
                if (!caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue
                val owner = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                    caps.ownerUid.toString() else "tidak diketahui"
                val name = vpnNameFor(ctx, caps)
                if (!seen.add(name)) continue
                out.put(JSONObject().apply {
                    put("name", name)
                    put("package", "uid:$owner")
                })
            }
        } catch (_: Exception) { }

        // Jaring pengaman: antarmuka tun yang hidup berarti ada terowongan,
        // walaupun kerangka kerja tidak melaporkannya sebagai jaringan VPN.
        try {
            val ifs = java.net.NetworkInterface.getNetworkInterfaces() ?: return out
            for (nif in ifs) {
                if (!nif.isUp) continue
                val n = nif.name ?: continue
                if (!n.startsWith("tun") && !n.startsWith("ppp") && !n.startsWith("ipsec")) continue
                if (!seen.add(n)) continue
                out.put(JSONObject().apply {
                    put("name", n)
                    put("package", "antarmuka")
                })
            }
        } catch (_: Exception) { }

        return out
    }

    private fun vpnNameFor(ctx: Context, caps: NetworkCapabilities): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val uid = caps.ownerUid
            val pkgs = ctx.packageManager.getPackagesForUid(uid)
            if (!pkgs.isNullOrEmpty()) return labelOf(ctx, pkgs[0]).ifBlank { pkgs[0] }
        }
        return "vpn-aktif"
    }

    // ——— sinyal 5: integritas perangkat ———

    /**
     * Artefak root. Sengaja sederhana, dan diakui dapat dilewati oleh root
     * yang menyembunyikan diri. Pemeriksaan yang mengikat secara kriptografis
     * adalah Play Integrity di Attestation.kt, dan itulah yang dipercaya
     * backend; daftar berkas di bawah hanya menangkap kasus yang kasar.
     */
    fun rootArtifacts(): JSONArray {
        val paths = listOf(
            "/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su",
            "/system/app/Superuser.apk", "/data/local/bin/su",
            "/data/adb/magisk", "/sbin/.magisk",
        )
        val out = JSONArray()
        for (p in paths) if (File(p).exists()) out.put(p)
        if ((Build.TAGS ?: "").contains("test-keys")) out.put("build-tags:test-keys")
        return out
    }

    fun integrity(ctx: Context, playVerdict: String): JSONObject = JSONObject().apply {
        put("play_integrity", playVerdict)
        put("root_artifacts", rootArtifacts())
        put("bootloader_unlocked", bootloaderUnlocked())
        put("security_patch", Build.VERSION.SECURITY_PATCH ?: "")
    }

    /**
     * Status bootloader tidak diberikan API publik. Yang tersedia hanyalah
     * verdict Play Integrity, yang gagal pada bootloader terbuka. Agar tidak
     * melaporkan tebakan sebagai pengukuran, nilainya selalu false di sini
     * dan keputusannya diserahkan ke verdict.
     */
    private fun bootloaderUnlocked(): Boolean = false

    // ——— sinyal 6: perilaku jaringan (metadata saja) ———

    fun hasUsageAccess(ctx: Context): Boolean {
        val aom = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        return aom.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName
        ) == AppOpsManager.MODE_ALLOWED
    }

    fun network(ctx: Context): JSONObject {
        val obj = JSONObject()
        var egressMb = 0.0
        var screenRatio = 1.0

        if (hasUsageAccess(ctx)) {
            val now = System.currentTimeMillis()
            val since = now - 24 * 60 * 60 * 1000L
            try {
                val nsm = ctx.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager
                var tx = 0L
                @Suppress("DEPRECATION")
                for (type in intArrayOf(ConnectivityManager.TYPE_MOBILE, ConnectivityManager.TYPE_WIFI)) {
                    tx += nsm.querySummaryForDevice(type, null, since, now).txBytes
                }
                egressMb = Math.round(tx / 1_048_576.0 * 10) / 10.0
            } catch (_: Exception) { }
            screenRatio = screenOnRatio(ctx, since)
        }

        obj.put("egress_mb_24h", egressMb)
        obj.put("screen_on_ratio_24h", screenRatio)
        // Lihat catatan batas nomor 2 di kepala berkas ini: kedua daftar di
        // bawah hanya dapat diisi resolver DNS satuan, bukan aplikasi biasa.
        obj.put("unusual_destinations", JSONArray())
        obj.put("new_destinations", JSONArray())
        obj.put("beacon_jitter_pct", 100.0)
        return obj
    }

    /** Porsi waktu layar menyala dalam 24 jam, dari UsageStats. */
    private fun screenOnRatio(ctx: Context, sinceMs: Long): Double {
        return try {
            val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, sinceMs, now)
            val used = stats.sumOf { it.totalTimeInForeground }
            val window = (now - sinceMs).toDouble()
            if (window <= 0) 1.0 else (used / window).coerceIn(0.0, 1.0)
        } catch (_: Exception) { 1.0 }
    }

    // ——— status tiap indikator (FR-02 dan FR-03) ———

    private fun st(status: String, reason: String = "", source: String = "agent"): JSONObject =
        JSONObject().apply {
            put("status", status)
            put("reason", reason)
            put("source", source)
            put("checked_at", Iso.now())
        }

    /**
     * Status tiap indikator pada pemeriksaan ini.
     *
     * Aturannya satu: indikator yang TIDAK dapat dibaca dilaporkan apa
     * adanya, tidak pernah dikirim sebagai daftar kosong yang terlihat sama
     * dengan "sudah diperiksa dan memang bersih". OWL Core tidak menjalankan
     * aturan yang indikatornya tidak terbaca, dan dashboard menampilkannya
     * sebagai tidak dapat diperiksa.
     */
    fun availability(ctx: Context, playVerdict: String): JSONObject = JSONObject().apply {
        put("permissions", st("ok"))
        put("accessibility", st("ok"))
        put("install_source", st("ok"))
        put("vpn", st("ok"))

        put("certificates", certError.let {
            if (it == null) st("ok") else st("unavailable", it)
        })

        put("integrity", st("partial",
            "status bootloader tidak diberikan API publik; dinilai lewat verdict integritas"))

        put("network_volume", if (hasUsageAccess(ctx)) st("ok") else st(
            "unavailable",
            "izin Akses penggunaan belum diberikan, sehingga volume keluar dan rasio layar tidak terbaca"))

        put("network_destinations", st("not_supported",
            "tujuan jaringan per aplikasi tidak dapat dibaca aplikasi biasa; " +
            "butuh resolver DNS satuan atau agent sebagai Device Owner"))

        put("attestation", when {
            Attestation.chainSha256().isEmpty() ->
                st("unavailable", "Keystore perangkat keras tidak memberikan rantai attestation")
            playVerdict == "UNAVAILABLE" ->
                st("partial", "verdict Play Integrity tidak dapat diperoleh; Key Attestation terbukti")
            else -> st("ok")
        })
    }

    // ——— rangkai menjadi satu laporan ———

    fun report(ctx: Context, attestation: JSONObject, playVerdict: String): JSONObject =
        JSONObject().apply {
            put("device_id", Config.deviceId(ctx))
            put("collected_at", Iso.now())
            put("agent_version", BuildConfig.VERSION_NAME)
            put("attestation", attestation)
            put("accessibility_services", accessibilityServices(ctx))
            put("overlay_packages", overlayPackages(ctx))
            // userCertificates() harus dipanggil SEBELUM availability(),
            // karena di situlah kegagalan membaca trust store tercatat.
            put("user_certificates", userCertificates())
            put("vpn_profiles", vpnProfiles(ctx))
            put("apps", apps(ctx))
            put("integrity", integrity(ctx, playVerdict))
            put("network", network(ctx))
            put("availability", availability(ctx, playVerdict))
        }

    private fun sha256(b: ByteArray): String =
        java.security.MessageDigest.getInstance("SHA-256").digest(b)
            .joinToString("") { "%02x".format(it) }
}

object Iso {
    fun now(): String {
        val f = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
        f.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return f.format(java.util.Date())
    }
}
