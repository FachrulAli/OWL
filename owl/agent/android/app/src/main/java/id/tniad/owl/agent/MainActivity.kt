package id.tniad.owl.agent

import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Layar satu halaman untuk prajurit pemilik perangkat.
 *
 * Isinya tiga hal: apa yang dibaca OWL, apa yang TIDAK dibaca OWL, dan satu
 * tombol untuk memberikan izin Akses penggunaan yang tidak dapat diminta
 * lewat dialog biasa. Keterbukaan ini bukan hiasan; tanpa itu agent
 * pemantau pada perangkat pribadi dinas sulit dipertanggungjawabkan.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 64)
            setBackgroundColor(Color.parseColor("#0B1F3A"))
        }

        fun title(s: String) = TextView(this).apply {
            text = s; textSize = 22f; setTextColor(Color.parseColor("#F8FAFC"))
            setPadding(0, 0, 0, 8)
        }
        fun body(s: String) = TextView(this).apply {
            text = s; textSize = 14f; setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 0, 0, 18); setLineSpacing(6f, 1f)
        }

        root.addView(title("OWL Agent"))
        root.addView(body("Perangkat: ${Config.deviceId(this)}\n" +
            "${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE}\n" +
            "OWL Core: ${Config.baseUrl}"))

        root.addView(title("Yang dibaca"))
        root.addView(body(
            "1. Izin mikrofon, kamera, dan lokasi yang dipegang tiap aplikasi\n" +
            "2. Layanan aksesibilitas dan hamparan jendela yang aktif\n" +
            "3. Sertifikat CA yang dipasang pengguna dan profil VPN aktif\n" +
            "4. Sumber pemasangan tiap aplikasi\n" +
            "5. Status integritas perangkat dan tingkat patch keamanan\n" +
            "6. Volume data keluar 24 jam, sebagai angka total"))

        root.addView(title("Yang tidak dibaca"))
        root.addView(body(
            "Isi pesan, isi berkas, daftar kontak, riwayat panggilan, lokasi " +
            "presisi, dan isi lalu lintas jaringan. Tidak ada izin untuk itu " +
            "yang diminta, jadi secara teknis pun tidak dapat dilakukan."))

        root.addView(Button(this).apply {
            text = "Beri izin Akses penggunaan"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            }
        })

        root.addView(Button(this).apply {
            text = "Mulai pemantauan"
            setOnClickListener {
                val svc = Intent(this@MainActivity, PostureService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    startForegroundService(svc) else startService(svc)
                text = "Pemantauan berjalan"
                isEnabled = false
            }
        })

        root.addView(TextView(this).apply {
            text = if (Posture.hasUsageAccess(this@MainActivity))
                "Akses penggunaan: sudah diberikan"
            else "Akses penggunaan: belum diberikan. Sinyal jaringan akan kosong."
            textSize = 12f
            setTextColor(Color.parseColor(
                if (Posture.hasUsageAccess(this@MainActivity)) "#5EEAD4" else "#F59E0B"))
            setPadding(0, 24, 0, 0)
            gravity = Gravity.START
        })

        setContentView(ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#0B1F3A"))
            addView(root, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        })
    }
}
