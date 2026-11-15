package id.tniad.owl.agent

import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

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

    private fun open(path: String, method: String): HttpURLConnection =
        (URL("${Config.baseUrl}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("X-OWL-Token", Config.token)
        }

    private fun finish(conn: HttpURLConnection): Result {
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
        return Result(code in 200..299, code, body)
    }

    /**
     * Kirim satu laporan, ditandatangani kunci perangkat keras agent.
     *
     * Yang ditandatangani adalah byte yang persis dikirim. Token penggelaran
     * sama untuk seluruh armada, jadi tanpa tanda tangan ini siapa pun yang
     * memegang token dapat mengirim laporan atas nama perangkat lain.
     */
    fun send(report: JSONObject): Result {
        var conn: HttpURLConnection? = null
        return try {
            val bytes = report.toString().toByteArray(Charsets.UTF_8)
            conn = open("/api/telemetry", "POST").apply {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                val sig = Attestation.sign(bytes)
                if (sig.isNotEmpty()) setRequestProperty("X-OWL-Signature", sig)
            }
            conn.outputStream.use { it.write(bytes) }
            finish(conn)
        } catch (e: Exception) {
            Result(false, -1, e.message ?: "gagal menghubungi OWL Core")
        } finally {
            conn?.disconnect()
        }
    }

    /** Tantangan sekali pakai untuk Key Attestation. Null jika tidak terjangkau. */
    fun challenge(deviceId: String): ByteArray? {
        var conn: HttpURLConnection? = null
        return try {
            conn = open("/api/enroll/challenge?device_id=" + URLEncoder.encode(deviceId, "UTF-8"), "GET")
            val res = finish(conn)
            if (!res.ok) null
            else Base64.decode(JSONObject(res.body).getString("challenge"), Base64.DEFAULT)
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    /**
     * Pendaftaran perangkat, membawa rantai attestation utuh. Idempoten di
     * sisi OWL Core, jadi aman diulang: dipanggil saat agent mulai, dan lagi
     * setiap kali laporan ditolak karena perangkat atau kuncinya tidak dikenal.
     */
    fun enroll(deviceId: String, label: String, model: String, osVersion: String): Result {
        var conn: HttpURLConnection? = null
        val body = JSONObject().apply {
            put("device_id", deviceId)
            put("label", label)
            put("model", model)
            put("os_version", osVersion)
            put("attestation_chain", Attestation.chain())
        }
        return try {
            conn = open("/api/devices", "POST").apply {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            finish(conn)
        } catch (e: Exception) {
            Result(false, -1, e.message ?: "")
        } finally {
            conn?.disconnect()
        }
    }
}
