package id.tniad.trinetra.agent

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat

/**
 * Satu layar: konfigurasi + transparansi.
 *
 * Layar ini sengaja memuat daftar APA yang dikumpulkan dan APA yang tidak.
 * Pada perangkat dinas, pemantauan yang tidak diberitahukan kepada pemegangnya
 * bukan hanya soal etika — itu juga membuat program tidak layak digelar ke
 * pasukan. Kejelasan di sini adalah bagian dari produk, bukan hiasan.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val base = EditText(this).apply {
            hint = "Alamat backend (mis. https://trinetra.example/)"
            setText(Config.baseUrl(this@MainActivity))
        }
        val dev = EditText(this).apply {
            hint = "ID perangkat terdaftar (mis. hp-kodam-5-01)"
            setText(Config.deviceId(this@MainActivity))
        }
        val tok = EditText(this).apply {
            hint = "Token penggelaran"
            setText(Config.token(this@MainActivity))
        }
        status = TextView(this).apply { textSize = 12f }

        val save = Button(this).apply {
            text = "Simpan & mulai pemantauan"
            setOnClickListener {
                Config.save(this@MainActivity, base.text.toString(),
                    tok.text.toString(), dev.text.toString())
                if (!Config.isConfigured(this@MainActivity)) {
                    toast("Alamat backend dan ID perangkat wajib diisi")
                } else {
                    TelemetryService.start(this@MainActivity)
                    toast("Pemantauan dimulai")
                    refresh()
                }
            }
        }
        val stop = Button(this).apply {
            text = "Hentikan pemantauan"
            setOnClickListener {
                TelemetryService.stop(this@MainActivity)
                toast("Pemantauan dihentikan")
                refresh()
            }
        }
        val usage = Button(this).apply {
            text = "Beri izin Akses Penggunaan"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            }
        }
        val notif = Button(this).apply {
            text = "Beri izin Akses Notifikasi"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        }

        val privacy = TextView(this).apply {
            textSize = 12f
            text = """
                YANG DIKUMPULKAN (metadata perilaku):
                • layar nyala/mati, aplikasi yang sedang di depan
                • jumlah byte naik/turun per selang waktu
                • suhu perangkat, persen baterai, status pengisian
                • mikrofon/kamera aktif atau tidak
                • generasi jaringan (2G/3G/4G/5G)
                • aplikasi baru terpasang + sumber pemasangnya
                • ADA/TIDAK notifikasi setelah pesan masuk
                • hash pengirim pesan (satu arah, terpotong)

                YANG TIDAK PERNAH DIAMBIL:
                • isi pesan, isi notifikasi, isi berkas
                • nomor telepon, daftar kontak
                • lokasi, riwayat peramban, tangkapan layar
                • rekaman mikrofon atau kamera

                Pemantauan ini berjalan terbuka: notifikasi tetap di status bar
                menandakan agent aktif, dan dapat dihentikan dari layar ini.
            """.trimIndent()
        }

        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 60, 40, 40)
            addView(TextView(context).apply {
                text = "TRINETRA · Agent MTD"
                textSize = 20f
            })
            addView(base); addView(dev); addView(tok)
            addView(save); addView(stop); addView(usage); addView(notif)
            addView(status); addView(privacy)
        })

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        ActivityCompat.requestPermissions(
            this, arrayOf(Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_PHONE_STATE), 2)
        refresh()
    }

    override fun onResume() { super.onResume(); refresh() }

    private fun refresh() {
        val usageOk = Collectors.hasUsageAccess(this)
        status.text = buildString {
            append("Izin Akses Penggunaan: ")
            append(if (usageOk) "AKTIF" else "BELUM — trafik & aplikasi depan tidak terbaca")
            append("\nAntrean: ${Uploader.pending()}")
            append(" · terkirim: ${Uploader.sentTotal}")
            append(" · dibuang: ${Uploader.droppedTotal}")
            append("\nPengiriman terakhir: ${Uploader.lastResult}")
            append("\nPatch keamanan: ${Build.VERSION.SECURITY_PATCH ?: "?"}")
            append(" (${Telemetry.patchAgeDays()} hari)")
        }
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()
}
