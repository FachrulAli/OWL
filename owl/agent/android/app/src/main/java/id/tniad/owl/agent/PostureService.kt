package id.tniad.owl.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Layanan latar depan yang mengirim satu laporan postur tiap siklus.
 *
 * Berjalan di latar depan dengan notifikasi tetap, dan itu disengaja: prajurit
 * pemilik perangkat harus dapat melihat bahwa OWL aktif. Pemantauan yang
 * disembunyikan dari pemiliknya sendiri akan menjadi hal yang sedang dilawan
 * produk ini.
 */
class PostureService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + Job())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(Config.NOTIF_ID, buildNotification(getString(R.string.svc_text)))
        Attestation.ensureKey()
        scope.launch { loop() }
    }

    private suspend fun loop() {
        val id = Config.deviceId(this)
        Uploader.enroll(id, "${Build.MANUFACTURER} ${Build.MODEL}",
            Build.MODEL, "Android ${Build.VERSION.RELEASE}")

        while (scope.isActive) {
            try {
                val verdict = Attestation.playVerdict(this)
                val report = Posture.report(this, Attestation.block(verdict), verdict)
                val res = withContext(Dispatchers.IO) { Uploader.send(report) }
                notify(
                    if (res.ok) "Laporan terkirim. Penilaian dilakukan OWL Core."
                    else "Belum terkirim (${res.code}). Dicoba lagi pada siklus berikutnya."
                )
            } catch (e: Exception) {
                notify("Gagal menyusun laporan: ${e.message}")
            }
            delay(Config.POSTURE_INTERVAL_MS)
        }
    }

    private fun notify(text: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(Config.NOTIF_ID, buildNotification(text))
    }

    private fun buildNotification(text: String): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(NotificationChannel(
                Config.NOTIF_CHANNEL, getString(R.string.svc_channel),
                NotificationManager.IMPORTANCE_LOW))
        }
        return Notification.Builder(this, Config.NOTIF_CHANNEL)
            .setContentTitle(getString(R.string.svc_title))
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
