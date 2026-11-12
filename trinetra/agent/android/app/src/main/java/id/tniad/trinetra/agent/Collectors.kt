package id.tniad.trinetra.agent

import android.app.AppOpsManager
import android.app.usage.NetworkStatsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.media.AudioRecordingConfiguration
import android.hardware.camera2.CameraManager
import android.net.ConnectivityManager
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.telephony.TelephonyManager
import org.json.JSONObject
import java.io.File

/**
 * Pengumpul sinyal perilaku dari API Android publik.
 *
 * BATAS YANG JUJUR — apa yang TIDAK bisa dibaca aplikasi biasa tanpa root
 * atau tanpa dipasang sebagai system app / Device Owner:
 *
 *  1. Crash proses SISTEM (mediaserver, media.codec, com.android.phone).
 *     `ActivityManager.getHistoricalProcessExitReasons()` hanya mengembalikan
 *     riwayat proses APLIKASI SENDIRI. Jadi tahap "eksploitasi" pada rantai
 *     zero-click TIDAK terlihat langsung dari sini; agent ini melaporkan
 *     proksinya (lonjakan termal/CPU saat idle). Versi presisi memerlukan
 *     agent sebagai system app pada perangkat dinas yang di-provision sebagai
 *     Device Owner — itu sah secara teknis untuk fleet milik organisasi, dan
 *     tercatat sebagai roadmap, bukan diklaim sudah ada.
 *  2. Daftar proses berjalan milik aplikasi lain (dibatasi sejak Android 8).
 *  3. Isi lalu lintas jaringan (butuh VpnService; tidak dipakai di versi ini
 *     karena hanya boleh ada satu VPN aktif di perangkat).
 *
 * Yang DI BAWAH ini semuanya nyata dan berjalan tanpa root.
 */
object Collectors {

    // ——— status interaksi: inti pembeda zero-click ———

    /** Layar menyala? Tidak sama dengan "dipakai", tapi prasyaratnya. */
    fun screenOn(ctx: Context): Boolean =
        (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive

    /**
     * Aplikasi yang sedang di depan, lewat UsageStats.
     * Mengembalikan "" bila tidak ada (layar mati) atau izin belum diberikan.
     */
    fun foregroundApp(ctx: Context): String {
        if (!hasUsageAccess(ctx)) return ""
        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - 60_000, now)
        var last = ""
        val e = android.app.usage.UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            if (e.eventType == android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED) {
                last = e.packageName ?: ""
            }
        }
        return last
    }

    /** Izin "Akses penggunaan" — harus diberikan manual di Setelan. */
    fun hasUsageAccess(ctx: Context): Boolean {
        val aom = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = aom.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    // ——— daya & beban: proksi untuk beban komputasi tersembunyi ———

    /** Status termal 0..4 (NONE..SHUTDOWN). API 29+. */
    fun thermalState(ctx: Context): Int =
        (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).currentThermalStatus

    data class Battery(val level: Int, val charging: Boolean)

    fun battery(ctx: Context): Battery {
        val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val intent = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        return Battery(level, charging)
    }

    // ——— jaringan: trafik keluar, terutama saat perangkat idle ———

    data class Traffic(val txBytes: Long, val rxBytes: Long)

    /**
     * Trafik perangkat DI DALAM jendela [sinceMs, sekarang], lewat
     * NetworkStatsManager. Butuh izin PACKAGE_USAGE_STATS ("Akses penggunaan").
     *
     * Catatan penting: `querySummaryForDevice` sudah mengembalikan jumlah byte
     * untuk jendela yang diminta, BUKAN penghitung kumulatif sejak boot. Jadi
     * nilainya dipakai langsung — menguranginya dengan sampel sebelumnya akan
     * menghasilkan nol atau negatif, dan justru mematikan sinyal
     * "trafik keluar saat idle" yang menjadi inti deteksi.
     *
     * TYPE_MOBILE/TYPE_WIFI memang ditandai deprecated di ConnectivityManager,
     * tetapi NetworkStatsManager masih memakai konstanta yang sama.
     */
    fun traffic(ctx: Context, sinceMs: Long): Traffic {
        if (!hasUsageAccess(ctx)) return Traffic(0, 0)
        return try {
            val nsm = ctx.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager
            var tx = 0L; var rx = 0L
            val now = System.currentTimeMillis()
            for (type in intArrayOf(ConnectivityManager.TYPE_MOBILE, ConnectivityManager.TYPE_WIFI)) {
                val b = nsm.querySummaryForDevice(type, null, sinceMs, now)
                tx += b.txBytes; rx += b.rxBytes
            }
            Traffic(tx, rx)
        } catch (_: Exception) {
            Traffic(0, 0)
        }
    }

    // ——— radio: deteksi penurunan paksa ke 2G (indikasi IMSI catcher) ———

    data class Radio(val gen: String, val cellId: String)

    fun radio(ctx: Context): Radio {
        return try {
            val tm = ctx.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val gen = when (tm.dataNetworkType) {
                TelephonyManager.NETWORK_TYPE_NR -> "5G"
                TelephonyManager.NETWORK_TYPE_LTE,
                TelephonyManager.NETWORK_TYPE_IWLAN -> "4G"
                TelephonyManager.NETWORK_TYPE_UMTS,
                TelephonyManager.NETWORK_TYPE_HSPA,
                TelephonyManager.NETWORK_TYPE_HSPAP,
                TelephonyManager.NETWORK_TYPE_HSDPA,
                TelephonyManager.NETWORK_TYPE_HSUPA -> "3G"
                TelephonyManager.NETWORK_TYPE_GPRS,
                TelephonyManager.NETWORK_TYPE_EDGE,
                TelephonyManager.NETWORK_TYPE_CDMA,
                TelephonyManager.NETWORK_TYPE_1xRTT -> "2G"
                else -> "unknown"
            }
            // Identitas sel di-hash: cukup untuk mengenali "sel yang belum
            // pernah terlihat", tidak dipakai untuk melacak posisi.
            Radio(gen, Telemetry.pseudonym(tm.networkOperator + ":" + gen))
        } catch (_: SecurityException) {
            Radio("unknown", "")
        } catch (_: Exception) {
            Radio("unknown", "")
        }
    }

    // ——— integritas perangkat ———

    /**
     * Pemeriksaan root dasar. Sengaja sederhana dan diakui bisa dilewati:
     * pemeriksaan yang benar-benar kuat memakai Play Integrity API yang
     * memerlukan backend verifikasi token Google — itu roadmap.
     */
    fun integrityFail(): Boolean {
        val suPaths = listOf(
            "/system/bin/su", "/system/xbin/su", "/sbin/su",
            "/system/app/Superuser.apk", "/data/local/bin/su",
        )
        if (suPaths.any { File(it).exists() }) return true
        if ((Build.TAGS ?: "").contains("test-keys")) return true
        return false
    }

    // ——— sensor: mikrofon & kamera dipakai tanpa aplikasi di depan ———

    /** Jumlah konfigurasi perekaman audio aktif di perangkat (API 29+). */
    fun micActive(ctx: Context): Boolean {
        return try {
            val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val configs: List<AudioRecordingConfiguration> = am.activeRecordingConfigurations
            configs.isNotEmpty()
        } catch (_: Exception) { false }
    }

    /**
     * Kamera dianggap terpakai bila sistem melaporkannya "tidak tersedia".
     * Dipantau lewat callback di TelemetryService (CameraManager hanya
     * memberi tahu lewat callback, bukan kueri langsung).
     */
    fun cameraManager(ctx: Context): CameraManager =
        ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager

    // ——— rangkai menjadi satu sampel ———

    /**
     * Satu sampel periodik. Field `idle`, `silent_inbound`, `parser_crash`,
     * dan `covert_sensor` TIDAK dihitung di sini — itu dihitung oleh backend
     * pada tahap normalisasi, supaya definisinya satu dan tidak bisa
     * dipalsukan oleh perangkat yang sudah dikuasai penyerang.
     *
     * FIELD YANG SENGAJA TIDAK DIKIRIM: `cpu_pct`.
     * Aplikasi tanpa hak istimewa tidak dapat membaca pemakaian CPU
     * perangkat pada Android modern (/proc dibatasi sejak Android 8, dan
     * dikunci lebih jauh sesudahnya). Mengirimkan nilai 0 akan tampil di
     * dashboard sebagai "CPU 0%" — sebuah angka yang terlihat seperti hasil
     * pengukuran padahal tidak pernah diukur. Lebih baik field itu kosong
     * dan jelas tidak tersedia. Tidak ada aturan deteksi yang bergantung
     * padanya; beban komputasi tersembunyi diukur lewat status termal dan
     * penurunan baterai, yang keduanya memang bisa dibaca.
     */
    fun sample(ctx: Context, state: AgentState): JSONObject {
        val screen = screenOn(ctx)
        val fg = if (screen) foregroundApp(ctx) else ""
        val bat = battery(ctx)
        val t = traffic(ctx, state.lastSampleMs)
        val r = radio(ctx)

        val drop = if (state.lastBatteryLevel in 1..100 && bat.level in 0..100)
            (state.lastBatteryLevel - bat.level).coerceAtLeast(0) else 0

        val ev = Telemetry.event("power", "periodic_sample").apply {
            put("screen_on", if (screen) 1 else 0)
            // Interaksi pengguna: hanya dihitung bila layar menyala DAN ada
            // aplikasi di depan. Ini sengaja konservatif — menganggap ada
            // interaksi padahal tidak akan menutupi serangan.
            put("user_interaction", if (screen && fg.isNotEmpty()) 1 else 0)
            put("foreground_app", fg)
            put("thermal_state", thermalState(ctx))
            put("battery_drop_pct", drop)
            put("charging", if (bat.charging) 1 else 0)
            put("egress_mb", bytesToMb(t.txBytes))
            put("ingress_mb", bytesToMb(t.rxBytes))
            put("net_gen", r.gen)
            put("cell_unknown", if (r.cellId.isNotEmpty() && !state.seenCells.contains(r.cellId)) 1 else 0)
            // Enkripsi radio tidak dapat dibaca aplikasi biasa; 2G dilaporkan
            // apa adanya dan backend memperlakukan 2G sebagai sinyal lemah,
            // bukan bukti. Nilai konservatif: anggap terenkripsi.
            put("cell_encryption", if (r.gen == "2G") 0 else 1)
            put("radio_anomaly", if (r.gen == "2G") 1 else 0)
            put("mic_active", if (micActive(ctx)) 1 else 0)
            put("cam_active", if (state.cameraInUse) 1 else 0)
            put("integrity_fail", if (integrityFail()) 1 else 0)
        }

        if (r.cellId.isNotEmpty()) state.seenCells.add(r.cellId)
        state.lastBatteryLevel = bat.level
        state.lastSampleMs = System.currentTimeMillis()
        return ev
    }

    private fun bytesToMb(b: Long): Double =
        if (b <= 0) 0.0 else Math.round(b / 1_048_576.0 * 1000.0) / 1000.0
}

/**
 * Status antar-sampel yang harus diingat agent.
 *
 * `lastSampleMs` menandai awal jendela trafik berikutnya; `lastBatteryLevel`
 * dipakai menghitung penurunan baterai antar sampel (Android hanya memberi
 * level saat ini, bukan laju pengurasan); `seenCells` membuat agent bisa
 * mengenali sel seluler yang belum pernah terlihat tanpa menyimpan lokasi.
 */
class AgentState {
    var lastSampleMs: Long = System.currentTimeMillis() - Config.SAMPLE_INTERVAL_MS
    var lastBatteryLevel: Int = -1
    var cameraInUse: Boolean = false
    val seenCells: MutableSet<String> = mutableSetOf()
}
