package id.tniad.owl.agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/** Menghidupkan kembali layanan sesudah perangkat dinyalakan ulang. */
class BootWatcher : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val svc = Intent(ctx, PostureService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(svc)
        } else {
            ctx.startService(svc)
        }
    }
}
