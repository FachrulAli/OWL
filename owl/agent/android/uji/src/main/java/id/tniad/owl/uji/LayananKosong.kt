package id.tniad.owl.uji

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

/**
 * Layanan aksesibilitas yang tidak melakukan apa pun.
 *
 * Kedua fungsi di bawah sengaja kosong. Yang sedang diuji adalah kemampuan
 * OWL melihat bahwa sebuah layanan aksesibilitas aktif di luar daftar izin
 * satuan. Untuk itu layanan ini cukup ADA; ia tidak perlu, dan tidak boleh,
 * menyentuh satu pun isi layar.
 */
class LayananKosong : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit
}
