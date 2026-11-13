package id.tniad.owl.uji

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.widget.TextView

class UjiActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            text = "Aplikasi Uji Indikator\n\n" +
                "Aplikasi ini tidak melakukan apa pun. Ia hanya mendeklarasikan " +
                "layanan aksesibilitas dan izin hamparan jendela, supaya aturan " +
                "OWL-R01 dan OWL-R02 dapat dibuktikan menyala dari keadaan " +
                "perangkat yang sungguhan.\n\n" +
                "Hapus aplikasi ini setelah pengujian selesai."
            textSize = 15f
            setPadding(56, 120, 56, 56)
            setTextColor(Color.parseColor("#F8FAFC"))
            setBackgroundColor(Color.parseColor("#0B1F3A"))
            setLineSpacing(8f, 1f)
        })
    }
}
