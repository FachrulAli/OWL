package id.tniad.owl.agent

import org.junit.Assert.*
import org.junit.Test
import java.net.URLEncoder

class EnrollmentLinkTest {
    private fun link(base: String = "https://owl.unit:8443", device: String = "HP-01") =
        "owl://enroll?base=${URLEncoder.encode(base, "UTF-8")}&device=${URLEncoder.encode(device, "UTF-8")}&token=" + "a".repeat(32)

    @Test fun validHttps() {
        val parsed = EnrollmentLink.parse(link(), false)!!
        assertEquals("https://owl.unit:8443", parsed.base)
        assertEquals("HP-01", parsed.device)
    }
    @Test fun releaseRefusesCleartext() { assertNull(EnrollmentLink.parse(link("http://owl.unit"), false)) }
    @Test fun debugAllowsCleartext() { assertNotNull(EnrollmentLink.parse(link("http://10.0.2.2:8000"), true)) }
    @Test fun credentialsRefused() { assertNull(EnrollmentLink.parse(link("https://admin:secret@owl.unit"), false)) }
    @Test fun queryRefused() { assertNull(EnrollmentLink.parse(link("https://owl.unit?token=x"), false)) }
    @Test fun fragmentRefused() { assertNull(EnrollmentLink.parse(link("https://owl.unit#x"), false)) }
    @Test fun pathRefused() { assertNull(EnrollmentLink.parse(link("https://owl.unit/path"), false)) }
    @Test fun duplicateDeviceRefused() { assertNull(EnrollmentLink.parse(link() + "&device=other", false)) }
    @Test fun missingTokenRefused() { assertNull(EnrollmentLink.parse(link().substringBefore("&token"), false)) }
    @Test fun oversizedDeviceRefused() { assertNull(EnrollmentLink.parse(link(device="a".repeat(65)), false)) }
    @Test fun opaqueUriRefused() { assertNull(EnrollmentLink.parse("owl:enroll", false)) }
    @Test fun invalidEncodingRefused() { assertNull(EnrollmentLink.parse(link() + "&bad=%ZZ", false)) }
}
