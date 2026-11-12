package id.tniad.trinetra.agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Deteksi "pengiriman senyap" — tahap pertama rantai zero-click.
 *
 * GAGASANNYA: sebuah pesan masuk yang sah hampir selalu memunculkan
 * notifikasi. Pesan yang dipakai untuk mengirim eksploit justru dirancang
 * agar TIDAK memunculkan apa pun. Jadi agent tidak menilai isi pesan
 * (dan memang tidak boleh) — agent membandingkan dua fakta:
 *
 *    (1) ada pesan masuk pada detik T  — dari SmsWatcher
 *    (2) ada notifikasi muncul antara T dan T+N detik — dari NotificationWatcher
 *
 * Bila (1) terjadi tanpa (2), event dikirim dengan `notified = 0`, dan
 * backend-lah yang memutuskan apakah itu bagian dari rantai.
 *
 * Yang dikirim dari pesan: nama paket aplikasi, hash pengirim terpotong,
 * apakah biner, dan panjangnya. Isi pesan tidak pernah dibaca.
 */
object SilentDelivery {
    private const val NOTIFY_WINDOW_MS = 12_000L

    // pesan yang menunggu keputusan "muncul notifikasi atau tidak"
    private val pending = mutableListOf<Pending>()
    private data class Pending(val at: Long, val ev: JSONObject, val app: String)

    /** Pengirim yang pernah terlihat — dasar untuk `sender_known`.
     *  Disimpan sebagai hash, bukan nomor. */
    private val knownSenders = mutableSetOf<String>()

    @Synchronized
    fun onInboundMessage(ctx: Context, app: String, senderHash: String,
                         binary: Boolean) {
        val known = senderHash.isNotEmpty() && knownSenders.contains(senderHash)
        if (senderHash.isNotEmpty()) knownSenders.add(senderHash)

        val ev = Telemetry.event("msg",
            if (binary) "inbound_binary_sms" else "inbound_message").apply {
            put("inbound_msg", 1)
            put("sender_known", if (known) 1 else 0)
            put("msg_app", app)
            put("msg_binary", if (binary) 1 else 0)
            put("notified", 0)          // diperbarui bila notifikasi muncul
            put("screen_on", if (Collectors.screenOn(ctx)) 1 else 0)
            put("user_interaction", 0)
        }
        pending.add(Pending(System.currentTimeMillis(), ev, app))
        sweep(ctx)
    }

    @Synchronized
    fun onNotificationPosted(pkg: String) {
        val now = System.currentTimeMillis()
        // Notifikasi dari aplikasi pesan apa pun dianggap menjawab pesan yang
        // sedang menunggu. Ini longgar dengan sengaja: lebih baik melewatkan
        // satu kasus daripada menuduh pemegang HP karena notifikasinya
        // sedang dibisukan.
        pending.firstOrNull { it.app == pkg || pkg.contains("mms") || pkg.contains("messag") }
            ?.let { it.ev.put("notified", 1) }
    }

    /** Kirim pesan yang jendela notifikasinya sudah lewat. */
    @Synchronized
    fun sweep(ctx: Context) {
        val now = System.currentTimeMillis()
        val due = pending.filter { now - it.at >= NOTIFY_WINDOW_MS }
        due.forEach {
            Uploader.enqueue(it.ev)
            pending.remove(it)
        }
    }
}

/** Menangkap SMS/WAP-push masuk — METADATA saja. */
class SmsWatcher : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        try {
            val binary = intent.action == Telephony.Sms.Intents.WAP_PUSH_RECEIVED_ACTION
            var senderHash = ""
            if (!binary) {
                val msgs = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                // Hanya pengirim yang di-hash. messageBody TIDAK diakses.
                senderHash = Telemetry.pseudonym(msgs?.firstOrNull()?.originatingAddress)
            }
            SilentDelivery.onInboundMessage(
                ctx, if (binary) "wap.push" else "com.android.mms", senderHash, binary)
        } catch (_: Exception) {
            // Kegagalan membaca metadata tidak boleh mematikan penerima.
        }
    }
}

/** Mengetahui bahwa sebuah notifikasi MUNCUL. Isi notifikasi tidak dibaca. */
class NotificationWatcher : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        SilentDelivery.onNotificationPosted(sbn.packageName ?: "")
    }
}

/** Aplikasi baru terpasang + dari mana pemasangnya (sideload atau toko resmi). */
class PackageWatcher : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val pkg = intent.data?.schemeSpecificPart ?: return
        if (pkg == ctx.packageName) return
        val pm = ctx.packageManager
        val installer = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                pm.getInstallSourceInfo(pkg).installingPackageName ?: "unknown"
            else "unknown"
        } catch (_: Exception) { "unknown" }

        val sensitive = try {
            val info = pm.getPackageInfo(pkg, android.content.pm.PackageManager.GET_PERMISSIONS)
            val perms = info.requestedPermissions?.toSet() ?: emptySet()
            val watch = setOf(
                "android.permission.RECORD_AUDIO", "android.permission.CAMERA",
                "android.permission.READ_SMS", "android.permission.READ_CONTACTS",
                "android.permission.ACCESS_FINE_LOCATION",
                "android.permission.READ_CALL_LOG",
            )
            perms.intersect(watch).size >= 3
        } catch (_: Exception) { false }

        Uploader.enqueue(Telemetry.event("pkg", "app_installed").apply {
            put("pkg_added", 1)
            put("pkg_name", pkg)
            put("installer_source", installer)
            put("perm_sensitive", if (sensitive) 1 else 0)
            put("screen_on", if (Collectors.screenOn(ctx)) 1 else 0)
            put("user_interaction", if (Collectors.screenOn(ctx)) 1 else 0)
        })
    }
}

/** Menyalakan agent kembali setelah perangkat dinyalakan ulang. */
class BootWatcher : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED &&
            Config.isConfigured(ctx)) {
            TelemetryService.start(ctx)
        }
    }
}
