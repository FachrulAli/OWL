plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "id.tniad.owl.agent"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.tniad.owl.agent"
        // minSdk 29: di bawah itu Play Integrity, StrongBox, dan pembacaan
        // profil VPN tidak tersedia. Menurunkannya hanya menghasilkan agent
        // yang terpasang tetapi tidak dapat membuktikan apa pun.
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // Diisi saat build:
        //   ./gradlew assembleDebug -PowlBase=https://owl.satuan.mil.id -PowlToken=…
        buildConfigField("String", "BASE_URL",
            "\"${project.findProperty("owlBase") ?: "http://10.0.2.2:8000"}\"")
        buildConfigField("String", "INGEST_TOKEN",
            "\"${project.findProperty("owlToken") ?: "owl-demo-token"}\"")
        buildConfigField("String", "DEVICE_ID",
            "\"${project.findProperty("owlDeviceId") ?: ""}\"")
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildTypes { release { isMinifyEnabled = false } }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    // Play Integrity dipakai untuk attestation agent (deepdive §7.4).
    implementation("com.google.android.play:integrity:1.4.0")
}
