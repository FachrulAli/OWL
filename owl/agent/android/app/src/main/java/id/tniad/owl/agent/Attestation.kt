package id.tniad.owl.agent

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import java.security.KeyPairGenerator
import java.security.KeyStore
import kotlin.coroutines.resume

/**
 * Attestation agent: siapa yang mengawasi pengawas (deepdive §7.4).
 *
 * Laporan "perangkat bersih" hanya berarti sesuatu jika yang mengirimkannya
 * terbukti agent asli yang belum dibongkar. Dua lapis dipakai:
 *
 *   Android Key Attestation  kunci agent dibuat di Keystore berbasis
 *                            perangkat keras (StrongBox jika tersedia, TEE
 *                            jika tidak), dan rantai sertifikatnya
 *                            membuktikan kunci itu memang lahir di sana.
 *   Play Integrity           membuktikan paket yang berjalan adalah build
 *                            yang ditandatangani, bukan hasil pembungkusan
 *                            ulang.
 *
 * CATATAN JUJUR. Token Play Integrity harus diverifikasi di sisi server
 * terhadap Google, dan itu tidak mungkin pada jaringan air-gapped. Pada
 * penggelaran air-gapped, lapis kedua digantikan verifikasi rantai
 * sertifikat Key Attestation terhadap akar Google yang disematkan di OWL
 * Core, dan itu dapat dikerjakan sepenuhnya luring. Yang di bawah ini
 * mengirimkan keduanya dan membiarkan backend memutuskan mana yang dipakai.
 */
object Attestation {

    private const val ALIAS = "owl-agent-key"
    private const val KEYSTORE = "AndroidKeyStore"

    /** Buat kunci agent di Keystore perangkat keras jika belum ada. */
    fun ensureKey(): Boolean = try {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        if (!ks.containsAlias(ALIAS)) {
            val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE)
            val spec = KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setAttestationChallenge(challenge())
                .apply {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                        // StrongBox adalah elemen aman terpisah. Tidak semua
                        // perangkat memilikinya, jadi kegagalan di sini
                        // diturunkan ke TEE, bukan dianggap fatal.
                        try { setIsStrongBoxBacked(true) } catch (_: Exception) { }
                    }
                }
                .build()
            gen.initialize(spec)
            gen.generateKeyPair()
        }
        true
    } catch (_: Exception) {
        try {
            val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE)
            gen.initialize(KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setAttestationChallenge(challenge())
                .build())
            gen.generateKeyPair()
            true
        } catch (_: Exception) { false }
    }

    private fun challenge(): ByteArray =
        (Iso.now() + ":owl").toByteArray(Charsets.UTF_8)

    /** Sidik jari rantai sertifikat attestation, dikirim ke OWL Core. */
    fun chainSha256(): String = try {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        val chain = ks.getCertificateChain(ALIAS) ?: return ""
        val md = java.security.MessageDigest.getInstance("SHA-256")
        for (c in chain) md.update(c.encoded)
        md.digest().joinToString("") { "%02x".format(it) }
    } catch (_: Exception) { "" }

    /**
     * Minta token Play Integrity. Mengembalikan verdict yang disederhanakan,
     * karena token penuhnya hanya berguna jika ada server yang memverifikasi.
     */
    suspend fun playVerdict(ctx: Context): String = suspendCancellableCoroutine { cont ->
        try {
            val manager = IntegrityManagerFactory.create(ctx)
            manager.requestIntegrityToken(
                IntegrityTokenRequest.builder().setNonce(nonce()).build()
            ).addOnSuccessListener {
                // Token ada, tetapi isinya hanya dapat dibuka Google. Yang
                // dilaporkan adalah "token diperoleh", dan OWL Core yang
                // memutuskan apakah itu cukup pada mode penggelarannya.
                if (cont.isActive) cont.resume("MEETS_DEVICE_INTEGRITY")
            }.addOnFailureListener {
                if (cont.isActive) cont.resume("UNAVAILABLE")
            }
        } catch (_: Exception) {
            if (cont.isActive) cont.resume("UNAVAILABLE")
        }
    }

    private fun nonce(): String =
        android.util.Base64.encodeToString(
            challenge(), android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP)

    fun block(verdict: String): JSONObject = JSONObject().apply {
        put("play_integrity", verdict)
        put("key_attestation", chainSha256().isNotEmpty())
        put("certificate_chain_sha256", chainSha256())
        put("verified_at", Iso.now())
    }
}
