package id.tniad.trinetra.agent

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Antrean + pengiriman batch ke `POST /ingest/mobile`.
 *
 * Mengapa HTTPS dan bukan klien Kafka di HP: perangkat tidak boleh memegang
 * kredensial broker, dan jaringan seluler terlalu sering terputus untuk
 * sesi Kafka yang panjang. Backend yang menaruh event ke topik.
 *
 * Antrean bertahan terhadap jaringan mati: event ditahan di memori sampai
 * MAX_QUEUE, lalu yang paling tua dibuang (lebih baik kehilangan sampel lama
 * daripada agent mati karena kehabisan memori).
 */
object Uploader {
    private const val TAG = "TrinetraUploader"
    private val queue = ConcurrentLinkedQueue<JSONObject>()

    @Volatile var lastResult: String = "belum pernah mengirim"
    @Volatile var sentTotal: Int = 0
    @Volatile var droppedTotal: Int = 0

    fun enqueue(ev: JSONObject) {
        queue.add(ev)
        while (queue.size > Config.MAX_QUEUE) {
            queue.poll()
            droppedTotal++
        }
    }

    fun pending(): Int = queue.size

    /** Kirim seluruh antrean. Bila gagal, event dikembalikan ke antrean. */
    fun flush(ctx: Context): Boolean {
        if (queue.isEmpty()) return true
        if (!Config.isConfigured(ctx)) {
            lastResult = "belum dikonfigurasi (device_id / alamat backend kosong)"
            return false
        }

        val batch = ArrayList<JSONObject>()
        while (batch.size < 200) {
            val e = queue.poll() ?: break
            batch.add(e)
        }
        if (batch.isEmpty()) return true

        val body = JSONObject().apply {
            put("device_id", Config.deviceId(ctx))
            put("events", JSONArray(batch))
        }.toString()

        return try {
            val url = URL(Config.baseUrl(ctx) + "/ingest/mobile")
            val con = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 12_000
                readTimeout = 12_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("X-Trinetra-Token", Config.token(ctx))
            }
            con.outputStream.use { it.write(body.toByteArray()) }
            val code = con.responseCode
            val text = try {
                (if (code in 200..299) con.inputStream else con.errorStream)
                    ?.bufferedReader()?.use(BufferedReader::readText) ?: ""
            } catch (_: Exception) { "" }
            con.disconnect()

            if (code in 200..299) {
                sentTotal += batch.size
                lastResult = "OK $code · ${batch.size} event terkirim"
                true
            } else {
                // 401/403 = masalah konfigurasi, bukan jaringan: mengulang
                // tidak akan menolong, jadi batch dibuang agar antrean tidak
                // tersumbat selamanya.
                if (code == 401 || code == 403) {
                    droppedTotal += batch.size
                    lastResult = "DITOLAK $code · ${text.take(120)}"
                } else {
                    batch.reversed().forEach { queue.add(it) }
                    lastResult = "GAGAL $code · dicoba lagi nanti"
                }
                Log.w(TAG, "ingest gagal: $code $text")
                false
            }
        } catch (e: Exception) {
            batch.reversed().forEach { queue.add(it) }
            lastResult = "jaringan: ${e.javaClass.simpleName}"
            false
        }
    }
}
