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
        versionCode = 4
        versionName = "1.2.1"

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
    signingConfigs {
        create("unit") {
            System.getenv("OWL_SIGNING_STORE_FILE")?.let { storeFile = file(it) }
            storePassword = System.getenv("OWL_SIGNING_STORE_PASSWORD")
            keyAlias = System.getenv("OWL_SIGNING_KEY_ALIAS") ?: "owl-agent"
            keyPassword = System.getenv("OWL_SIGNING_KEY_PASSWORD")
        }
    }
    sourceSets.getByName("release").res.srcDir(layout.buildDirectory.dir("generated/owlTrust/res"))
    buildTypes {
        release {
            isMinifyEnabled = false
            if (System.getenv("OWL_SIGNING_STORE_FILE") != null) signingConfig = signingConfigs.getByName("unit")
        }
    }
}

val validateReleaseConfiguration by tasks.registering {
    doLast {
        val ca = providers.gradleProperty("owlCa")
        require(ca.isPresent && file(ca.get()).isFile) { "Build rilis membutuhkan -PowlCa=<sertifikat CA satuan.pem>" }
        require((project.findProperty("owlBase")?.toString() ?: "").startsWith("https://")) {
            "Build rilis membutuhkan -PowlBase=https://..."
        }
    }
}
val prepareReleaseTrust by tasks.registering(Copy::class) {
    dependsOn(validateReleaseConfiguration)
    from(providers.gradleProperty("owlCa").orElse("MISSING-CA"))
    into(layout.buildDirectory.dir("generated/owlTrust/res/raw"))
    rename { "owl_ca.pem" }
}
tasks.matching { it.name == "preReleaseBuild" }.configureEach { dependsOn(prepareReleaseTrust) }

dependencies {
    testImplementation("junit:junit:4.13.2")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    // Play Integrity tidak lagi dipakai: tokennya tidak dapat diverifikasi
    // tanpa menghubungi Google. Lihat catatan di kepala Attestation.kt.
}
