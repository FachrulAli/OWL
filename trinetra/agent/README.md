# TRINETRA · Agent MTD (Android)

Agent yang dipasang di HP dinas prajurit. Mengirim **metadata perilaku** ke
`POST /ingest/mobile`, lalu backend TRINETRA yang menormalisasi, menjalankan
aturan Sigma, dan mengkorelasikan rantai kill-chain. Agent **tidak** mengambil
keputusan deteksi apa pun — itu disengaja, supaya perangkat yang sudah dikuasai
penyerang tidak bisa memanipulasi hasil deteksi tentang dirinya sendiri.

## Status kejujuran

| Hal | Status |
|---|---|
| Kode | Lengkap (Kotlin, 925 baris) |
| Kompilasi | **Belum pernah dikompilasi.** Tidak ada APK. |
| Uji di perangkat / emulator | **Belum, nol eksekusi.** |
| Gradle wrapper (`gradlew`) | **Belum ada** — lihat di bawah |
| Dipakai di demo | Opsional. Demo utama memakai simulator. |

**Jangan sebut agent ini "sudah jalan" atau "sudah teruji" di hadapan juri
sebelum benar-benar dijalankan di perangkat.** Yang sudah terbukti di proyek
ini adalah mesin deteksinya, bukan sensor ini.

Konsekuensi yang paling mungkin ketika pertama kali dikompilasi: ada beberapa
galat kompilasi yang harus dibereskan (impor, tanda tangan API, varian
`minSdk`). Itu normal untuk kode yang belum pernah dilewatkan kompilator —
sediakan waktu, jangan jadwalkan tepat sebelum tampil.

## Membangun

Proyek ini **belum punya Gradle wrapper**, jadi `./gradlew` belum bisa
dipakai. Pilih salah satu:

**Cara 1 — Android Studio (paling mudah, disarankan)**

Buka folder `agent/android` di Android Studio. Saat *Gradle sync* pertama,
Studio membuat `gradlew` dan mengunduh seluruh dependensi sendiri. Setelah itu
isi tiga parameter build di `gradle.properties`:

```properties
trinetraBase=http://10.0.2.2:8000
trinetraDeviceId=hp-kodam-5-01
trinetraToken=trinetra-demo-token
```

lalu **Run** ke emulator atau perangkat.

**Cara 2 — baris perintah**

Perlu JDK 17 dan Gradle terpasang lebih dulu (`brew install openjdk@17 gradle`),
lalu buat wrapper-nya sekali:

```bash
cd agent/android
gradle wrapper --gradle-version 8.9      # sekali saja, membuat ./gradlew
./gradlew assembleDebug \
  -PtrinetraBase=http://10.0.2.2:8000 \
  -PtrinetraDeviceId=hp-kodam-5-01 \
  -PtrinetraToken=trinetra-demo-token
```

`10.0.2.2` adalah alamat host dari dalam emulator Android. Untuk HP fisik,
pakai alamat LAN laptop (`http://192.168.x.x:8000`) atau terowongan
(Cloudflare Tunnel / ngrok) bila HP di jaringan seluler.

`trinetraDeviceId` **harus** sudah ada di tabel `entities` backend. Perangkat
yang tidak terdaftar ditolak dengan HTTP 403 — pendaftaran adalah keputusan
satuan, bukan klaim aplikasi.

## Setelah dipasang

Tiga izin tidak bisa diberikan lewat manifest dan harus diaktifkan manual —
tombolnya ada di layar utama aplikasi:

1. **Akses Penggunaan** (`PACKAGE_USAGE_STATS`) — tanpa ini trafik keluar dan
   aplikasi-di-depan **tidak terbaca**, dan sinyal deteksi utama mati.
2. **Akses Notifikasi** — tanpa ini agent tidak tahu apakah sebuah pesan
   memunculkan notifikasi, sehingga "pengiriman senyap" tidak terdeteksi.
3. **SMS & status telepon** — dialog izin biasa saat aplikasi dibuka.

## Sinyal yang dikumpulkan

| Sinyal | API | Tahap kill-chain |
|---|---|---|
| Layar nyala/mati, aplikasi depan | `PowerManager`, `UsageStatsManager` | konteks (dasar semua deteksi) |
| Byte naik/turun per selang | `NetworkStatsManager` | C2 / eksfiltrasi |
| Status termal 0–4 | `PowerManager.currentThermalStatus` | implan aktif |
| Penurunan baterai antar sampel | `BatteryManager` | implan aktif |
| Mikrofon aktif | `AudioManager.activeRecordingConfigurations` | pengumpulan data |
| Kamera dipakai proses lain | `CameraManager.AvailabilityCallback` | pengumpulan data |
| Pesan masuk tanpa notifikasi | `SMS_RECEIVED` + `NotificationListenerService` | **pengiriman zero-click** |
| Aplikasi baru + sumber pemasang | `PACKAGE_ADDED` + `getInstallSourceInfo` | sideload RAT |
| Generasi jaringan (2G) | `TelephonyManager.dataNetworkType` | IMSI catcher |
| Root / test-keys | pemeriksaan berkas + `Build.TAGS` | manipulasi perangkat |
| Umur patch keamanan | `Build.VERSION.SECURITY_PATCH` | postur rentan |

### Cara "pengiriman senyap" dideteksi

Agent tidak pernah membaca isi pesan. Yang dibandingkan adalah dua fakta:

1. ada pesan masuk pada detik **T** (`SmsWatcher`);
2. ada notifikasi muncul antara **T** dan **T+12s** (`NotificationWatcher`).

Bila (1) terjadi tanpa (2), event dikirim dengan `notified = 0`. Backend-lah
yang memutuskan apakah itu bagian dari rantai. Pengirim hanya dikirim sebagai
hash SHA-256 terpotong 8 byte, dan `sender_known` ditentukan dari apakah hash
itu pernah terlihat sebelumnya — jadi agent tidak perlu izin membaca kontak.

## Yang TIDAK bisa dilakukan tanpa root / system app

**Crash proses sistem** (`mediaserver`, `media.codec`, `com.android.phone`) —
yaitu tahap *eksploitasi* pada rantai zero-click. Android hanya memberi
riwayat keluar proses **milik aplikasi sendiri**
(`getHistoricalProcessExitReasons`). Agent ini melaporkan **proksinya**:
lonjakan termal/CPU saat perangkat idle.

Versi presisi memerlukan agent dipasang sebagai **system app** pada perangkat
yang di-provision sebagai **Device Owner** — sah secara teknis untuk fleet
milik organisasi seperti HP dinas, dan tercatat sebagai roadmap. Jangan
klaim kemampuan ini sudah ada.

Juga tidak dilakukan: inspeksi isi lalu lintas (butuh `VpnService`, dan hanya
boleh ada satu VPN aktif di perangkat — berbenturan dengan VPN dinas).

## Privasi — ini bagian dari produk

Tidak pernah diambil: isi pesan, isi notifikasi, isi berkas, nomor telepon,
daftar kontak, lokasi, riwayat peramban, tangkapan layar, rekaman mikrofon
atau kamera.

Agent berjalan **terbuka**: ada notifikasi tetap di status bar, dan pemegang
HP bisa menghentikannya dari layar aplikasi. Menyembunyikan agent akan
menjadikannya berperilaku seperti stalkerware yang justru ia deteksi.

Prinsip ini mengikuti *Consensual Use Restriction* pada lisensi MVT — tidak
diwajibkan untuk kami (kami hanya memakai data indikatornya yang berlisensi
MIT/CC-BY), tetapi diadopsi sukarela. Lihat
[`infra/indicators/ATTRIBUTION.md`](../infra/indicators/ATTRIBUTION.md).

## Menguji tanpa HP fisik

Emulator Android Studio bisa menguji sebagian besar jalur:

| Sinyal | Di emulator |
|---|---|
| Layar nyala/mati, aplikasi depan | ✅ |
| Trafik jaringan | ✅ |
| Aplikasi baru terpasang | ✅ (`adb install`) |
| SMS masuk | ✅ (`adb emu sms send 555 test`, atau Extended Controls) |
| Generasi jaringan | ✅ (Extended Controls → Cellular → ganti ke GSM) |
| Status termal | ⚠️ selalu `NONE` |
| Mikrofon / kamera | ⚠️ terbatas |
| Penurunan baterai | ⚠️ bisa diatur manual, bukan alami |

Jadi rantai yang bisa diuji penuh di emulator: **pengiriman senyap → aplikasi
sideload → trafik keluar saat layar mati**. Tahap termal perlu HP asli.
