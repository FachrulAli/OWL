plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "id.tniad.trinetra.agent"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.tniad.trinetra.agent"
        // minSdk 29: di bawah ini API termal, callback perekaman audio, dan
        // NetworkStats per-aplikasi tidak tersedia — tiga sinyal yang justru
        // menjadi inti deteksi, jadi menurunkannya hanya akan menghasilkan
        // agent yang terpasang tapi tidak berguna.
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // Diisi saat build: alamat backend + token penggelaran.
        //   ./gradlew assembleDebug -PtrinetraBase=https://… -PtrinetraToken=…
        buildConfigField("String", "BASE_URL",
            "\"${project.findProperty("trinetraBase") ?: "http://10.0.2.2:8000"}\"")
        buildConfigField("String", "INGEST_TOKEN",
            "\"${project.findProperty("trinetraToken") ?: "trinetra-demo-token"}\"")
        buildConfigField("String", "DEVICE_ID",
            "\"${project.findProperty("trinetraDeviceId") ?: ""}\"")
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
