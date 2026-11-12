package id.tniad.trinetra.agent

import android.content.Context

/**
 * Konfigurasi penggelaran.
 *
 * `deviceId` harus sudah terdaftar di registri backend (tabel `entities`).
 * Backend menolak batch dari perangkat yang tidak terdaftar — ini disengaja:
 * pendaftaran perangkat adalah keputusan satuan, bukan sesuatu yang boleh
 * diklaim sendiri oleh aplikasi di HP.
 */
object Config {
    private const val PREFS = "trinetra_agent"

    fun baseUrl(ctx: Context): String =
        prefs(ctx).getString("base_url", null)?.takeIf { it.isNotBlank() }
            ?: BuildConfig.BASE_URL

    fun token(ctx: Context): String =
        prefs(ctx).getString("token", null)?.takeIf { it.isNotBlank() }
            ?: BuildConfig.INGEST_TOKEN

    fun deviceId(ctx: Context): String =
        prefs(ctx).getString("device_id", null)?.takeIf { it.isNotBlank() }
            ?: BuildConfig.DEVICE_ID

    fun save(ctx: Context, baseUrl: String, token: String, deviceId: String) {
        prefs(ctx).edit()
            .putString("base_url", baseUrl.trim().trimEnd('/'))
            .putString("token", token.trim())
            .putString("device_id", deviceId.trim())
            .apply()
    }

    fun isConfigured(ctx: Context): Boolean =
        baseUrl(ctx).isNotBlank() && deviceId(ctx).isNotBlank()

    /** Interval pengambilan sampel. 30 detik: cukup rapat untuk menangkap
     *  rantai yang berjalan dalam menit, cukup longgar untuk tidak ikut
     *  menguras baterai yang justru sedang kita ukur. */
    const val SAMPLE_INTERVAL_MS = 30_000L

    /** Batch dikirim tiap 2 menit, atau lebih cepat bila ada event penting. */
    const val FLUSH_INTERVAL_MS = 120_000L
    const val MAX_QUEUE = 400

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
