package id.tniad.owl.agent

import android.content.Context
import android.os.Build
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object AgentState { val lock = Mutex() }

/** Pekerjaan persisten; kunci baru aktif setelah backend menerimanya. */
class PostureWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        AgentState.lock.withLock {
            val ctx = applicationContext
            Attestation.initialize(ctx)
            fun status(message: String, response: Uploader.Result? = null) {
                val edit = ctx.getSharedPreferences("monitoring", Context.MODE_PRIVATE).edit()
                    .putString("status", message).putLong("status_updated_at", System.currentTimeMillis())
                if (response?.ok == true) {
                    try {
                        val decision = JSONObject(response.body).getJSONObject("decision")
                        edit.putString("last_decision", decision.getString("decision"))
                            .putInt("last_score", decision.getDouble("score").toInt().coerceIn(0, 100))
                            .putString("last_reason", decision.getString("reason"))
                            .putLong("last_report_at", System.currentTimeMillis())
                    } catch (_: Exception) { /* A successful upload need not contain a decision. */ }
                }
                edit.apply()
            }
            fun send(): Uploader.Result {
                val verdict = Attestation.playVerdict(ctx)
                return Uploader.send(ctx, Posture.report(ctx, Attestation.block(verdict), verdict))
            }
            fun enroll(): Boolean {
                val id = Config.deviceId(ctx)
                val challenge = Uploader.challenge(ctx, id) ?: return false
                if (!Attestation.createKey(ctx, challenge)) return false
                val res = Uploader.enroll(ctx, id, "${Build.MANUFACTURER} ${Build.MODEL}",
                    Build.MODEL, "Android ${Build.VERSION.RELEASE}")
                if (!res.ok || !JSONObject(res.body).optBoolean("attested")) return false
                Attestation.activate(ctx)
                Provisioning.consumed(ctx)
                return true
            }
            try {
                // Pulihkan respons enrollment yang hilang setelah token dikonsumsi.
                if (Attestation.selectPending(ctx)) {
                    val recovered = send()
                    if (recovered.ok && JSONObject(recovered.body).getJSONObject("assessment").optBoolean("attestation_ok")) {
                        Attestation.activate(ctx)
                        Provisioning.consumed(ctx)
                        status("Laporan terkirim; pendaftaran dipulihkan", recovered)
                        return@withLock Result.success()
                    }
                    if (recovered.code == -1 || recovered.code >= 500) return@withLock Result.retry()
                }
                Attestation.selectActive()
                if (Provisioning.token(ctx) != null || !Attestation.hasKey()) {
                    if (!enroll()) {
                        Attestation.selectActive()
                        if (Attestation.hasKey()) send()
                        status("Pendaftaran belum berhasil. Periksa token dan koneksi ke server.")
                        return@withLock Result.retry()
                    }
                }
                var res = send()
                if (res.code in listOf(401, 404) && enroll()) res = send()
                status(if (res.ok) "Laporan terkirim" else "Laporan gagal (${res.code}); periksa token atau server", res)
                if (res.ok) Result.success() else Result.retry()
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (_: Exception) {
                status("Laporan belum terkirim; akan dicoba lagi")
                Result.retry()
            } finally { Attestation.selectActive() }
        }
    }
}

object PostureSchedule {
    fun start(ctx: Context) {
        ctx.getSharedPreferences("monitoring", Context.MODE_PRIVATE).edit().putBoolean("enabled", true).apply()
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val manager = WorkManager.getInstance(ctx)
        manager.enqueueUniquePeriodicWork("owl-periodic", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<PostureWorker>(15, TimeUnit.MINUTES)
                .setInitialDelay(15, TimeUnit.MINUTES).setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build())
        manager.enqueueUniqueWork("owl-now", ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<PostureWorker>().setConstraints(constraints).build())
    }
}
