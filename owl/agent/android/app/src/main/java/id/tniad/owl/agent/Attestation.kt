package id.tniad.owl.agent

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature

/**
 * Attestation agent: siapa yang mengawasi pengawas (deepdive §7.4).
 *
 * Laporan "perangkat bersih" hanya berarti sesuatu jika yang mengirimkannya
 * terbukti agent asli pada perangkat yang belum dibongkar. Buktinya dibuat di
 * sini dan DIPERIKSA di OWL Core, bukan diklaim dari sini:
 *
 *   1. OWL Core memberi tantangan sekali pakai.
 *   2. Agent membuat kunci EC di Keystore perangkat keras DENGAN tantangan
 *      itu. Perangkat keras menerbitkan rantai sertifikat yang menyatakan:
 *      kunci ini lahir di TEE atau StrongBox, untuk tantangan ini, diminta
 *      aplikasi ini, pada perangkat yang boot-nya terverifikasi atau tidak.
 *   3. Agent mengirim rantai itu UTUH. OWL Core memverifikasinya sampai akar
 *      Google yang disematkan, sepenuhnya luring.
 *   4. Setiap laporan sesudahnya ditandatangani kunci yang sama, dan kunci
 *      privatnya tidak pernah dapat dikeluarkan dari perangkat keras.
 *
 * Versi pertama hanya mengirim SIDIK rantai dan satu boolean. Sidik tidak
 * dapat diverifikasi, dan boolean dapat ditulis siapa saja; OWL Core waktu
 * itu memercayai keduanya. Itu sudah diganti.
 *
 * Play Integrity tidak lagi diminta. Tokennya hanya dapat dibuka dengan
 * menghubungi Google, dan versi pertama melaporkan "token berhasil diminta"
 * sebagai MEETS_DEVICE_INTEGRITY, padahal isinya tidak pernah dibaca. Klaim
 * yang tidak diperiksa lebih buruk daripada tidak ada klaim.
 */
object Attestation {

    private const val ALIAS = "owl-agent-key"
    private const val KEYSTORE = "AndroidKeyStore"

    private fun spec(challenge: ByteArray, strongBox: Boolean): KeyGenParameterSpec =
        KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
            .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setAttestationChallenge(challenge)
            .apply { if (strongBox) setIsStrongBoxBacked(true) }
            .build()

    /**
     * Buat kunci baru untuk tantangan dari OWL Core, menggantikan kunci lama.
     * StrongBox dicoba lebih dahulu; tidak semua perangkat memilikinya, jadi
     * kegagalannya diturunkan ke TEE, bukan dianggap fatal.
     */
    fun createKey(challenge: ByteArray): Boolean {
        try {
            KeyStore.getInstance(KEYSTORE).apply { load(null) }.deleteEntry(ALIAS)
        } catch (_: Exception) { }
        for (strongBox in listOf(true, false)) {
            try {
                val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE)
                gen.initialize(spec(challenge, strongBox))
                gen.generateKeyPair()
                return true
            } catch (_: Exception) { }
        }
        return false
    }

    fun hasKey(): Boolean = try {
        KeyStore.getInstance(KEYSTORE).apply { load(null) }.containsAlias(ALIAS)
    } catch (_: Exception) { false }

    /** Rantai sertifikat attestation, DER berbasis64, daun lebih dahulu. */
    fun chain(): JSONArray {
        val out = JSONArray()
        try {
            val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
            for (c in ks.getCertificateChain(ALIAS) ?: emptyArray()) {
                out.put(Base64.encodeToString(c.encoded, Base64.NO_WRAP))
            }
        } catch (_: Exception) { }
        return out
    }

    /** Sidik rantai, hanya untuk ditampilkan; OWL Core menghitungnya sendiri. */
    fun chainSha256(): String = try {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        val chain = ks.getCertificateChain(ALIAS) ?: return ""
        val md = java.security.MessageDigest.getInstance("SHA-256")
        for (c in chain) md.update(c.encoded)
        md.digest().joinToString("") { "%02x".format(it) }
    } catch (_: Exception) { "" }

    /**
     * Tanda tangan ECDSA-SHA256 atas badan laporan. Kosong jika kunci tidak
     * ada; OWL Core akan menolak laporannya dan agent mendaftar ulang.
     */
    fun sign(body: ByteArray): String = try {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        val key = ks.getKey(ALIAS, null) as PrivateKey
        val s = Signature.getInstance("SHA256withECDSA")
        s.initSign(key)
        s.update(body)
        Base64.encodeToString(s.sign(), Base64.NO_WRAP)
    } catch (_: Exception) { "" }

    /** Lihat catatan di kepala berkas: verdict tidak diminta, jadi tidak diklaim. */
    @Suppress("UNUSED_PARAMETER")
    fun playVerdict(ctx: Context): String = "UNAVAILABLE"

    /**
     * Blok attestation pada laporan. Nilai `key_attestation` di sini hanya
     * menyatakan agent MEMILIKI rantai; sah tidaknya diputuskan OWL Core dari
     * rantai yang dikirim saat pendaftaran, dan keputusan itulah yang dipakai.
     */
    fun block(verdict: String): JSONObject = JSONObject().apply {
        put("play_integrity", verdict)
        put("key_attestation", chainSha256().isNotEmpty())
        put("certificate_chain_sha256", chainSha256())
        put("verified_at", Iso.now())
    }
}
