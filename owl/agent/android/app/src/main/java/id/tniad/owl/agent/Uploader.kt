package id.tniad.owl.agent

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Pengirim laporan ke OWL Core.
 *
 * Tidak ada pustaka HTTP pihak ketiga. Satu panggilan POST per laporan, dan
 * kegagalan dicatat lalu dicoba lagi pada siklus berikutnya. Agent tidak
 * menyimpan antrean di disk: laporan postur menggambarkan keadaan SEKARANG,
 * sehingga laporan lama yang akhirnya terkirim justru menyesatkan analis.
 */
object Uploader {

    data class Result(val ok: Boolean, val code: Int, val body: String)

    fun send(report: JSONObject): Result {
        val url = URL("${Config.baseUrl}/api/telemetry")
        var conn: HttpURLConnection? = null
        return try {
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 15_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("X-OWL-Token", Config.token)
            }
            conn.outputStream.use { it.write(report.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            Result(code in 200..299, code, body)
        } catch (e: Exception) {
            Result(false, -1, e.message ?: "gagal menghubungi OWL Core")
        } finally {
            conn?.disconnect()
        }
    }

    /**
     * Pendaftaran perangkat. Idempoten di sisi OWL Core, jadi aman diulang:
     * dipanggil saat agent mulai, dan lagi setiap kali laporan ditolak 404.
     */
    fun enroll(deviceId: String, label: String, model: String, osVersion: String): Result {
        val url = URL("${Config.baseUrl}/api/devices")
        var conn: HttpURLConnection? = null
        val body = JSONObject().apply {
            put("device_id", deviceId)
            put("label", label)
            put("model", model)
            put("os_version", osVersion)
        }
        return try {
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 15_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                // OWL Core menuntut token penggelaran untuk pendaftaran juga.
                setRequestProperty("X-OWL-Token", Config.token)
            }
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            Result(code in 200..299, code, "")
        } catch (e: Exception) {
            Result(false, -1, e.message ?: "")
        } finally {
            conn?.disconnect()
        }
    }
}
