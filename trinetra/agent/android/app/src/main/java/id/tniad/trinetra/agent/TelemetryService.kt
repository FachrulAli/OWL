package id.tniad.trinetra.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Layanan latar depan yang menjalankan agent.
 *
 * Harus latar depan, bukan WorkManager atau job periodik: zero-click bekerja
 * ketika HP tidak dipakai, sementara pembatasan latar belakang Android
 * (Doze, App Standby) justru paling agresif tepat pada kondisi itu. Agent
 * yang boleh "ditidurkan" akan buta pada saat yang paling penting.
 *
 * Konsekuensinya jujur: ada notifikasi tetap di status bar. Itu bukan
 * kekurangan teknis melainkan keputusan: pemegang HP harus tahu bahwa
 * perangkatnya dipantau. Menyembunyikannya akan menjadikan agent ini
 * berperilaku seperti stalkerware yang justru ia deteksi.
 */
class TelemetryService : Service() {

    private var job: Job? = null
    private val state = AgentState()
    private var cameraCb: CameraManager.AvailabilityCallback? = null

    companion object {
        private const val CHANNEL = "trinetra_agent"
        private const val NOTIF_ID = 4201

        fun start(ctx: Context) {
            val i = Intent(ctx, TelemetryService::class.java)
            ctx.startForegroundService(i)
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, TelemetryService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIF_ID, buildNotification("memulai…"))
        registerCameraCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (job?.isActive != true) job = loop()
        return START_STICKY
    }

    private fun loop(): Job = CoroutineScope(Dispatchers.IO).launch {
        var lastFlush = 0L
        while (isActive) {
            try {
                // 1) sampel periodik
                Uploader.enqueue(Collectors.sample(applicationContext, state))
                // 2) putuskan pesan mana yang terbukti tidak memunculkan notifikasi
                SilentDelivery.sweep(applicationContext)

                // 3) kirim batch secara berkala
                val now = System.currentTimeMillis()
                if (now - lastFlush >= Config.FLUSH_INTERVAL_MS) {
                    Uploader.flush(applicationContext)
                    lastFlush = now
                }

                notify(
                    "antre ${Uploader.pending()} · terkirim ${Uploader.sentTotal}" +
                        " · ${Uploader.lastResult}")
            } catch (e: Exception) {
                // Agent tidak boleh mati karena satu sampel gagal.
                notify("galat: ${e.javaClass.simpleName}")
            }
            delay(Config.SAMPLE_INTERVAL_MS)
        }
    }

    /**
     * Kamera: Android tidak menyediakan kueri "apakah kamera sedang dipakai".
     * Yang ada adalah callback ketersediaan — ketika proses lain memakai
     * kamera, perangkat itu dilaporkan "tidak tersedia" bagi kita.
     */
    private fun registerCameraCallback() {
        try {
            val cm = Collectors.cameraManager(applicationContext)
            val cb = object : CameraManager.AvailabilityCallback() {
                override fun onCameraUnavailable(cameraId: String) {
                    state.cameraInUse = true
                    // Kamera menyala saat layar mati = kejadian penting;
                    // dilaporkan segera, tidak menunggu sampel berikutnya.
                    if (!Collectors.screenOn(applicationContext)) {
                        Uploader.enqueue(
                            Telemetry.event("media", "covert_cam_access").apply {
                                put("cam_active", 1)
                                put("screen_on", 0)
                                put("user_interaction", 0)
                                put("foreground_app", "")
                            })
                    }
                }

                override fun onCameraAvailable(cameraId: String) {
                    state.cameraInUse = false
                }
            }
            cameraCb = cb
            cm.registerAvailabilityCallback(cb, null)
        } catch (_: Exception) {
            // perangkat tanpa kamera atau API dibatasi: lanjut tanpa sinyal ini
        }
    }

    override fun onDestroy() {
        job?.cancel()
        cameraCb?.let {
            try { Collectors.cameraManager(applicationContext)
                .unregisterAvailabilityCallback(it) } catch (_: Exception) {}
        }
        // upaya terakhir mengirim sisa antrean
        try { Uploader.flush(applicationContext) } catch (_: Exception) {}
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        val ch = NotificationChannel(
            CHANNEL, "TRINETRA Agent", NotificationManager.IMPORTANCE_LOW)
        ch.description = "Pemantauan keamanan perangkat dinas"
        nm.createNotificationChannel(ch)
    }

    private fun buildNotification(text: String): Notification =
        Notification.Builder(this, CHANNEL)
            .setContentTitle("TRINETRA · pemantauan aktif")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .build()

    private fun notify(text: String) {
        try {
            getSystemService(NotificationManager::class.java)
                .notify(NOTIF_ID, buildNotification(text))
        } catch (_: Exception) {}
    }
}
