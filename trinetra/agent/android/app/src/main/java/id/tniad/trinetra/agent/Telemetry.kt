package id.tniad.trinetra.agent

import android.os.Build
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Satu event telemetri + aturan privasi yang mengikatnya.
 *
 * Kontrak dengan backend: bentuk event di sini HARUS sama dengan yang dihasilkan
 * `services/simulator/mobile_sim.py`, karena keduanya masuk ke pipeline yang
 * sama lewat `POST /ingest/mobile`. Backend juga menyaring ulang dengan daftar
 * putih field (`services/backend/app/ingest.py`), jadi field tak dikenal yang
 * dikirim dari sini akan dibuang, bukan diam-diam diterima.
 *
 * ATURAN PRIVASI (dipaksakan oleh desain kelas ini, bukan oleh niat baik):
 *  - tidak ada isi pesan, isi notifikasi, judul, atau isi berkas;
 *  - tidak ada nomor telepon mentah — pengirim hanya hash terpotong;
 *  - tidak ada lokasi, tidak ada daftar kontak, tidak ada riwayat peramban;
 *  - identitas perangkat tidak dikirim dari sini: backend yang menentukannya
 *    dari registri, sehingga HP yang sudah dikuasai penyerang tidak bisa
 *    mengaku sebagai HP perwira lain.
 */
object Telemetry {

    private val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("UTC") }

    fun now(): String = iso.format(Date())

    /** Hash satu arah terpotong — cukup untuk mengenali pengirim yang sama
     *  berulang, tidak cukup untuk memulihkan nomornya. */
    fun pseudonym(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        val md = MessageDigest.getInstance("SHA-256")
        val h = md.digest(("trinetra:" + raw.trim()).toByteArray())
        return h.take(8).joinToString("") { "%02x".format(it) }
    }

    /** Umur patch keamanan dalam hari, dari Build.VERSION.SECURITY_PATCH. */
    fun patchAgeDays(): Int {
        val p = Build.VERSION.SECURITY_PATCH
        if (p.isNullOrBlank()) return 0
        return try {
            val f = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val d = f.parse(p) ?: return 0
            ((System.currentTimeMillis() - d.time) / 86_400_000L).toInt().coerceAtLeast(0)
        } catch (_: Exception) { 0 }
    }

    /**
     * Rangka event. `category` mengikuti taksonomi backend:
     * net | power | msg | media | proc | pkg | integrity | radio
     */
    fun event(category: String, activity: String): JSONObject = JSONObject().apply {
        put("ts", now())
        put("category", category)
        put("activity", activity)
        put("platform", "android")
        put("os_version", Build.VERSION.RELEASE ?: "")
        put("device_model", "${Build.MANUFACTURER} ${Build.MODEL}")
        put("patch_age_days", patchAgeDays())
    }
}
