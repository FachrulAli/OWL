package id.tniad.owl.agent

import android.util.Base64
import android.content.Context
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

    /** Sesi gerbang diterbitkan hanya setelah bukti kepemilikan kunci. */
    fun checkAccess(ctx: Context): Result {
        var conn: HttpURLConnection? = null
        return try {
            val id = Config.deviceId(ctx)
            conn = open(ctx, "/api/access/challenge?device_id=" + URLEncoder.encode(id, "UTF-8"), "GET")
            val challenge = finish(conn)
            conn.disconnect()
            if (!challenge.ok) return challenge
            val parsed = JSONObject(challenge.body)
            val body = JSONObject().apply {
                put("device_id", id)
                put("challenge", parsed.getString("challenge"))
                put("signature", Attestation.sign(parsed.getString("signing_payload").toByteArray(Charsets.UTF_8)))
            }
            conn = open(ctx, "/api/access/sessions", "POST").apply {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val session = finish(conn)
            conn.disconnect()
            if (!session.ok) return session
            conn = open(ctx, "/protected/classified", "GET").apply {
                setRequestProperty("Authorization", "Bearer " + JSONObject(session.body).getString("token"))
            }
            finish(conn)
        } catch (_: Exception) { Result(false, -1, "Gerbang belum terjangkau") }
        finally { conn?.disconnect() }
    }

    private fun open(ctx: Context, path: String, method: String, enrollment: Boolean = false): HttpURLConnection =
        (URL("${Provisioning.base(ctx)}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            instanceFollowRedirects = false
            if (!BuildConfig.DEBUG && url.protocol != "https") error("HTTPS diperlukan pada build rilis")
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("X-OWL-Token", Config.token)
            if (enrollment) Provisioning.token(ctx)?.let { setRequestProperty("X-OWL-Enroll", it) }
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
    fun send(ctx: Context, report: JSONObject): Result {
        var conn: HttpURLConnection? = null
        return try {
            val bytes = report.toString().toByteArray(Charsets.UTF_8)
            conn = open(ctx, "/api/telemetry", "POST").apply {
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
    fun challenge(ctx: Context, deviceId: String): ByteArray? {
        var conn: HttpURLConnection? = null
        return try {
            conn = open(ctx, "/api/enroll/challenge?device_id=" + URLEncoder.encode(deviceId, "UTF-8"), "GET", true)
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
    fun enroll(ctx: Context, deviceId: String, label: String, model: String, osVersion: String): Result {
        var conn: HttpURLConnection? = null
        val body = JSONObject().apply {
            put("device_id", deviceId)
            put("label", label)
            put("model", model)
            put("os_version", osVersion)
            put("attestation_chain", Attestation.chain())
        }
        return try {
            conn = open(ctx, "/api/devices", "POST", true).apply {
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
