package id.tniad.owl.agent

import java.net.URI
import java.net.URLDecoder

data class EnrollmentLink(val base: String, val device: String, val token: String) {
    companion object {
        fun parse(raw: String, allowCleartext: Boolean): EnrollmentLink? = try {
            val uri = URI(raw)
            require(uri.scheme == "owl" && uri.host == "enroll" && uri.rawUserInfo == null &&
                uri.port == -1 && uri.fragment == null && uri.path.isNullOrEmpty())
            val pairs = (uri.rawQuery ?: "").split('&').map {
                val parts = it.split('=', limit = 2)
                require(parts.size == 2)
                URLDecoder.decode(parts[0], "UTF-8") to URLDecoder.decode(parts[1], "UTF-8")
            }
            require(pairs.map { it.first }.distinct().size == pairs.size)
            val values = pairs.toMap()
            val base = values.getValue("base").trimEnd('/')
            val server = URI(base)
            require(server.scheme == "https" || (allowCleartext && server.scheme == "http"))
            require(!server.host.isNullOrBlank() && server.userInfo == null && server.query == null &&
                server.fragment == null && server.path.isNullOrEmpty() && server.port in -1..65535)
            val device = values.getValue("device")
            val token = values.getValue("token")
            require(device.isNotBlank() && device.length <= 64 && device.none { it.isISOControl() })
            require(token.matches(Regex("[A-Za-z0-9_-]{16,256}")))
            EnrollmentLink(base, device, token)
        } catch (_: Exception) { null }
    }
}
