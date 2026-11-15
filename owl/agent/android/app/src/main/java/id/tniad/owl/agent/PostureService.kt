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

    private fun enroll(): Boolean = Uploader.enroll(
        Config.deviceId(this), "${Build.MANUFACTURER} ${Build.MODEL}",
        Build.MODEL, "Android ${Build.VERSION.RELEASE}").ok

    /**
     * Pendaftaran TIDAK lagi dicoba sekali saja. Versi pertama mendaftar satu
     * kali saat mulai; jika jaringan belum siap pada detik itu, setiap laporan
     * sesudahnya ditolak 404 sampai agent dimatikan dan dinyalakan lagi.
     * Ditemukan 2026-11-15 pada HP uji. Sekarang pendaftaran diulang sampai
     * berhasil, dan diulang lagi kapan pun OWL Core menjawab 404, misalnya
     * setelah basis datanya dikosongkan.
     */
    private suspend fun loop() {
        var enrolled = false
        while (scope.isActive) {
            var retrySoon = false
            try {
                if (!enrolled) enrolled = enroll()
                if (!enrolled) {
                    retrySoon = true
                    notify("OWL Core belum terjangkau. Pendaftaran dicoba lagi sebentar lagi.")
                } else {
                    val verdict = Attestation.playVerdict(this)
                    val report = Posture.report(this, Attestation.block(verdict), verdict)
                    var res = withContext(Dispatchers.IO) { Uploader.send(report) }
                    if (res.code == 404) {
                        // Perangkat tidak dikenal OWL Core: daftar ulang, kirim sekali lagi.
                        enrolled = enroll()
                        if (enrolled) res = withContext(Dispatchers.IO) { Uploader.send(report) }
                    }
                    retrySoon = !res.ok
                    notify(
                        if (res.ok) "Laporan terkirim. Penilaian dilakukan OWL Core."
                        else "Belum terkirim (${res.code}). Dicoba lagi sebentar lagi."
                    )
                }
            } catch (e: Exception) {
                retrySoon = true
                notify("Gagal menyusun laporan: ${e.message}")
            }
            delay(if (retrySoon) Config.RETRY_INTERVAL_MS else Config.POSTURE_INTERVAL_MS)
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
