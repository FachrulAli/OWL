package id.tniad.owl.agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Menjadwalkan ulang pelaporan sesudah perangkat dinyalakan.
 *
 * Penerima ini TIDAK memulai foreground service: pada Android 15 service
 * bertipe `dataSync` dilarang dimulai dari BOOT_COMPLETED. Ia hanya
 * mendaftarkan pekerjaan ke WorkManager, yang diizinkan, dan hanya bila
 * pemilik perangkat sudah menyalakan pemantauan.
 */
class BootWatcher : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val enabled = ctx.getSharedPreferences("monitoring", Context.MODE_PRIVATE)
            .getBoolean("enabled", false)
        if (enabled) PostureSchedule.start(ctx)
    }
}
