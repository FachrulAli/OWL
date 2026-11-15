package id.tniad.owl.agent

import android.content.Context
import android.provider.Settings

object Config {
    const val POSTURE_INTERVAL_MS = 15 * 60 * 1000L   // satu laporan tiap 15 menit
    const val RETRY_INTERVAL_MS = 60 * 1000L          // setelah gagal: coba lagi semenit kemudian
    const val NOTIF_CHANNEL = "owl-posture"
    const val NOTIF_ID = 1001

    val baseUrl: String get() = BuildConfig.BASE_URL.trimEnd('/')
    val token: String get() = BuildConfig.INGEST_TOKEN

    /**
     * Identitas perangkat. Diisi saat penggelaran lewat -PowlDeviceId supaya
     * cocok dengan nomor inventaris satuan. Jika kosong, dipakai ANDROID_ID
     * yang stabil per perangkat per aplikasi, dan bukan identitas perangkat
     * keras yang dapat dipakai melacak pemiliknya di luar OWL.
     */
    @Suppress("HardwareIds")
    fun deviceId(ctx: Context): String {
        val fixed = Provisioning.device(ctx) ?: BuildConfig.DEVICE_ID
        if (fixed.isNotBlank()) return fixed
        val aid = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID)
        return "AND-" + (aid ?: "unknown").take(12).uppercase()
    }
}
