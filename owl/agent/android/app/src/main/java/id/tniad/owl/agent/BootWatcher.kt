package id.tniad.owl.agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootWatcher : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED &&
            ctx.getSharedPreferences("monitoring", Context.MODE_PRIVATE).getBoolean("enabled", false))
            PostureSchedule.start(ctx)
    }
}