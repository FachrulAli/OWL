package id.tniad.owl.agent

import android.content.Context
import android.net.Uri

object Provisioning {
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("enrollment", Context.MODE_PRIVATE)
    fun base(ctx: Context): String = prefs(ctx).getString("base", null) ?: Config.baseUrl
    fun device(ctx: Context): String? = prefs(ctx).getString("device", null)
    fun token(ctx: Context): String? = prefs(ctx).getString("token", null)
    fun accept(ctx: Context, uri: Uri): Boolean {
        val link = EnrollmentLink.parse(uri.toString(), BuildConfig.DEBUG) ?: return false
        return prefs(ctx).edit().putString("base", link.base).putString("device", link.device)
            .putString("token", link.token).commit()
    }
    fun consumed(ctx: Context) { prefs(ctx).edit().remove("token").apply() }
}
