package id.tniad.owl.agent

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.util.Date

/** Satu layar native. Tidak ada polling, font unduhan, atau web view. */
class MainActivity : Activity(), SharedPreferences.OnSharedPreferenceChangeListener {
    private val ink = Color.rgb(16, 45, 67)
    private val paper = Color.rgb(245, 247, 249)
    private val muted = Color.rgb(91, 107, 121)
    private val line = Color.rgb(220, 227, 233)
    private val gold = Color.rgb(211, 173, 105)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var prefs: SharedPreferences
    private lateinit var monitoring: TextView
    private lateinit var verdict: TextView
    private lateinit var score: TextView
    private lateinit var checked: TextView
    private lateinit var message: TextView
    private lateinit var permission: TextView
    private lateinit var primary: Button

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun text(value: String, size: Float, color: Int = ink, medium: Boolean = false) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        typeface = Typeface.create(if (medium) "sans-serif-medium" else "sans-serif", Typeface.NORMAL)
        includeFontPadding = false
        setLineSpacing(dp(3).toFloat(), 1f)
    }
    private fun shape(color: Int, radius: Int = 12, border: Int? = null) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
        border?.let { setStroke(dp(1), it) }
    }
    private fun button(label: String, filled: Boolean = false, action: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 15f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(if (filled) Color.WHITE else ink)
        background = RippleDrawable(ColorStateList.valueOf(Color.argb(35, 160, 180, 195)),
            shape(if (filled) ink else Color.WHITE, 12, if (filled) null else line), null)
        minHeight = dp(52)
        minimumHeight = dp(52)
        setPadding(dp(16), dp(10), dp(16), dp(10))
        stateListAnimator = null
        setOnClickListener { action() }
    }
    private fun LinearLayout.add(view: View, height: Int = ViewGroup.LayoutParams.WRAP_CONTENT, top: Int = 0) {
        addView(view, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
            if (height >= 0) dp(height) else height).apply { topMargin = dp(top) })
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // The launcher theme supplies the native starting window; the app itself
        // immediately uses its light theme, without a second splash Activity.
        setTheme(R.style.Theme_Owl)
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("monitoring", MODE_PRIVATE)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        @Suppress("DEPRECATION")
        window.statusBarColor = paper
        @Suppress("DEPRECATION")
        window.navigationBarColor = paper
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(paper)
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(12), dp(24), dp(20))
        }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(ImageView(this).apply {
            setImageResource(R.drawable.owl_emblem)
            background = shape(Color.BLACK, 12)
            contentDescription = null
        }, LinearLayout.LayoutParams(dp(44), dp(44)))
        header.addView(text("OWL", 23f, medium = true), LinearLayout.LayoutParams(0,
            ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(12) })
        monitoring = text("", 12f, muted).apply { maxWidth = dp(150); maxLines = 2; gravity = Gravity.END }
        header.addView(monitoring)
        content.add(header, 52)
        content.add(text("Keamanan perangkat", 26f, medium = true), top = 22)
        content.add(text(Build.MODEL, 14f, muted), top = 7)

        val status = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = shape(ink, 18)
            setPadding(dp(22), dp(21), dp(22), dp(21))
        }
        status.add(text("Hasil terakhir", 12f, Color.rgb(188, 203, 215)))
        verdict = text("Belum diperiksa", 24f, Color.WHITE, true)
        verdict.accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        status.add(verdict, top = 10)
        score = text("", 14f, Color.rgb(225, 233, 239))
        status.add(score, top = 10)
        checked = text("", 12f, Color.rgb(188, 203, 215))
        status.add(checked, top = 12)
        content.add(status, top = 22)

        primary = button("Periksa sekarang", true) {
            PostureSchedule.start(applicationContext)
            message.text = "Pemeriksaan dijadwalkan. Hasil diperbarui setelah laporan diterima."
            primary.isEnabled = false
            primary.alpha = .65f
            primary.postDelayed({
                primary.isEnabled = true
                primary.alpha = 1f
            }, 1000)
        }
        primary.id = R.id.check_now
        content.add(primary, top = 20)
        message = text("", 13f, muted).apply {
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        content.add(message, top = 10)

        val actions = LinearLayout(this)
        val access = button("Uji akses") { checkAccess() }.apply { id = R.id.check_access }
        actions.addView(access, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { rightMargin = dp(5) })
        actions.addView(button("Rincian") { showDetails() },
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(5) })
        content.add(actions, top = 16)

        val permissionRow = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(14), 0, dp(14))
            isClickable = true
            isFocusable = true
            setOnClickListener { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
        }
        permissionRow.addView(text("Akses penggunaan", 14f), LinearLayout.LayoutParams(0,
            ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        permission = text("", 13f, medium = true)
        permissionRow.addView(permission)
        content.add(View(this).apply { setBackgroundColor(line) }, 1, 22)
        content.add(permissionRow)
        content.add(View(this).apply { setBackgroundColor(line) }, 1)
        content.add(text("Isi pesan dan berkas tidak dibaca.", 13f, muted), top = 17)
        content.add(button("Apa yang diperiksa?") { showPrivacy() }, top = 10)
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            addView(content)
        }
        root.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
        renderStatus()
        handleEnrollment(intent)
    }

    override fun onStart() {
        super.onStart()
        prefs.registerOnSharedPreferenceChangeListener(this)
    }
    override fun onResume() {
        super.onResume()
        renderStatus()
    }
    override fun onStop() {
        prefs.unregisterOnSharedPreferenceChangeListener(this)
        super.onStop()
    }
    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
    override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences?, key: String?) {
        renderStatus()
    }
    private fun renderStatus() {
        if (!::verdict.isInitialized) return
        monitoring.text = if (prefs.getBoolean("enabled", false)) "Pemantauan aktif" else "Belum aktif"
        permission.text = if (Posture.hasUsageAccess(this)) "Diberikan" else "Atur izin"
        permission.setTextColor(if (Posture.hasUsageAccess(this)) Color.rgb(35, 109, 89) else Color.rgb(138, 88, 28))
        val decision = prefs.getString("last_decision", null)
        verdict.text = when (decision) {
            "allow" -> "Akses diizinkan"
            "step_up" -> "Verifikasi diperlukan"
            "limited" -> "Akses dibatasi"
            "deny" -> "Akses ditolak"
            else -> "Belum diperiksa"
        }
        verdict.setTextColor(when (decision) {
            "deny" -> Color.rgb(255, 181, 170)
            "step_up", "limited" -> gold
            else -> Color.WHITE
        })
        score.text = if (decision != null) "Skor risiko ${prefs.getInt("last_score", 0)} / 100" else "Jalankan pemeriksaan untuk melihat hasil."
        val at = prefs.getLong("last_report_at", 0)
        checked.text = if (at > 0) "Laporan diterima pukul " + android.text.format.DateFormat.getTimeFormat(this).format(Date(at))
            else "Belum ada hasil penilaian tersimpan."
        message.text = prefs.getString("status", "Hasil pemeriksaan diputuskan OWL Core.")
    }
    private fun showDetails() {
        val reason = prefs.getString("last_reason", "Belum ada alasan penilaian tersimpan.")
        AlertDialog.Builder(this).setTitle("Rincian perangkat").setMessage(
            "${Build.MANUFACTURER} ${Build.MODEL}\nAndroid ${Build.VERSION.RELEASE}\n\n" +
            "Identitas perangkat\n${Config.deviceId(this)}\n\nServer satuan\n${Provisioning.base(this)}\n\n" +
            "Penilaian terakhir\n$reason\n\nPelaporan berkala\nInterval minimum 15 menit; Android dapat menunda.\n\nVersi ${BuildConfig.VERSION_NAME}")
            .setPositiveButton("Tutup", null).show()
    }
    private fun showPrivacy() {
        AlertDialog.Builder(this).setTitle("Yang diperiksa OWL").setMessage(
            "• Izin aplikasi, aksesibilitas, dan hamparan layar\n" +
            "• Sumber pemasangan dan penanda tangan aplikasi\n" +
            "• Sertifikat pengguna, VPN, dan integritas perangkat\n" +
            "• Volume data keluar dan waktu pemakaian aplikasi\n\n" +
            "Isi pesan, isi berkas, kontak, riwayat panggilan, lokasi presisi, dan isi lalu lintas jaringan tidak dibaca.")
            .setPositiveButton("Mengerti", null).show()
    }
    private fun checkAccess() {
        val view = findViewById<Button>(R.id.check_access)
        view.isEnabled = false
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    AgentState.lock.withLock {
                        Attestation.initialize(applicationContext)
                        Uploader.checkAccess(applicationContext)
                    }
                }
                val detail = when {
                    result.ok -> "Perangkat dapat mengakses sistem satuan."
                    result.code == -1 -> "Server belum dapat dihubungi. Periksa koneksi perangkat dan alamat server bersama admin."
                    else -> try { JSONObject(result.body).optString("detail", "Akses belum diizinkan oleh OWL Core.") }
                        catch (_: Exception) { result.body.take(1200).ifBlank { "Akses belum diizinkan oleh OWL Core." } }
                }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle(if (result.ok) "Akses diterima" else if (result.code == -1) "Belum terhubung" else "Akses ditolak")
                    .setMessage(detail).setPositiveButton("Tutup", null).show()
            } finally { view.isEnabled = true }
        }
    }
    private fun handleEnrollment(incoming: Intent) {
        if (incoming.action != Intent.ACTION_VIEW) return
        val link = EnrollmentLink.parse(incoming.data?.toString() ?: "", BuildConfig.DEBUG)
        if (link == null) {
            AlertDialog.Builder(this).setTitle("Tautan tidak valid")
                .setMessage("Minta tautan pendaftaran baru dari admin satuan.").setPositiveButton("Tutup", null).show()
            return
        }
        AlertDialog.Builder(this).setTitle("Daftarkan perangkat?")
            .setMessage("Server\n${link.base}\n\nIdentitas perangkat\n${link.device}\n\nGunakan tautan dari admin satuan.")
            .setNegativeButton("Batal", null)
            .setPositiveButton("Daftarkan") { _, _ ->
                scope.launch {
                    val accepted = withContext(Dispatchers.IO) {
                        AgentState.lock.withLock { Provisioning.accept(applicationContext, incoming.data!!) }
                    }
                    if (accepted) {
                        PostureSchedule.start(applicationContext)
                        message.text = "Pendaftaran dijadwalkan. Menunggu hasil pemeriksaan."
                    } else {
                        message.text = "Pendaftaran belum berhasil. Minta tautan baru dari admin."
                    }
                }
            }.show()
    }
}
