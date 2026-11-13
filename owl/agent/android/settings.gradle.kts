pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositories { google(); mavenCentral() }
}
rootProject.name = "OwlAgent"
include(":app")
// Aplikasi uji indikator. Dipakai untuk membuktikan aturan OWL-R01 dan
// OWL-R02 menyala dari keadaan perangkat yang sungguhan, bukan dari
// telemetri yang disusun tangan. Tidak pernah ikut dalam build agent.
include(":uji")
