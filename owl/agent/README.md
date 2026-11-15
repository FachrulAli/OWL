# OWL Agent (Android)

Agent membaca enam sinyal dari API Android publik, membuktikan dirinya lewat
Key Attestation, lalu mengirim laporan postur bertanda tangan ke OWL Core.
Saat mendaftar ia meminta tantangan, membuat kunci di perangkat keras untuk
tantangan itu, dan mengirim rantai sertifikatnya utuh; OWL Core yang
memutuskan sah tidaknya. Pada emulator rantai itu tidak berujung pada akar
Google, sehingga OWL Core harus dijalankan dengan `OWL_ATTESTATION=claim`. Penilaian risikonya
dikerjakan backend, bukan di perangkat: definisi aturan harus satu untuk
seluruh armada, dan tidak boleh dapat diubah oleh perangkat yang sudah
dikuasai penyerang.

## Membangun

```bash
cd owl/agent/android
./gradlew assembleDebug \
  -PowlBase=http://10.0.2.2:8000 \
  -PowlToken=owl-demo-token \
  -PowlDeviceId=TACTICAL-07
```

APK keluar di `app/build/outputs/apk/debug/app-debug.apk`.

`10.0.2.2` adalah alamat host dari dalam emulator Android. Untuk perangkat
fisik, isi alamat IP mesin yang menjalankan OWL Core di jaringan yang sama.

## Memasang dan menjalankan

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Buka aplikasinya, lalu:

1. Tekan **Beri izin Akses penggunaan**, cari OWL Agent di daftar, aktifkan.
   Tanpa izin ini sinyal keenam (volume keluar dan rasio layar menyala)
   dikirim kosong, dan OWL Core tidak akan menyalakan aturan yang
   bergantung padanya.
2. Tekan **Mulai pemantauan**.

Pelaporan dijadwalkan dengan WorkManager setiap minimal 15 menit, dengan
retry saat jaringan putus. Android dapat menunda jadwal ketika menghemat
daya. Tombol **Lihat status laporan** menampilkan hasil terakhir; tombol
**Uji akses sistem satuan** meminta sesi berbukti kunci perangkat, lalu
mengakses aplikasi uji melalui gateway.

## Enrollment per perangkat dan build rilis

Admin menerbitkan token dari tab SOC, lalu pemilik HP membuka tautan
`owl://enroll?base=...&device=...&token=...` dan mengonfirmasi server serta ID.
Token dibawa di header `X-OWL-Enroll` pada tantangan dan pendaftaran saja.
Token ingest harus tetap sesuai dengan backend (`-PowlToken=...`, atau
variabel `ORG_GRADLE_PROJECT_owlToken` saat build).

Kunci aktif tidak dihapus saat mulai. Pendaftaran ulang membuat kunci
cadangan; kunci lama dipertahankan sampai backend menerima kunci baru.
Jika respons hilang setelah token digunakan, agent mencoba laporan dengan
kunci cadangan untuk memulihkan pendaftaran. Untuk build lama gunakan
`OWL_ENROLL=shared` hanya selama migrasi.

Build rilis membutuhkan HTTPS dan CA satuan:

```powershell
services/backend/.venv/Scripts/python.exe services/backend/tools/build_agent_release.py `
  --base https://owl.satuan:8443 --ca infra/tls/ca.pem `
  --out ../docs/evidence/release-build.json
```

Jalankan dari `owl/` setelah mengisi `JAVA_HOME` dan `ANDROID_HOME`.
Helper membuat kunci penanda tangan lokal di `.local/` (diabaikan Git).
Gunakan kunci resmi satuan untuk penggelaran; sidik sertifikat harus dimasukkan
ke `OWL_AGENT_SIGNERS`. HTTPS rilis hanya mempercayai CA yang disematkan,
menolak cleartext, dan tidak mengikuti redirect. APK debug tetap mendukung
HTTP untuk pengembangan. APK rilis dengan penanda tangan berbeda tidak bisa
dipasang sebagai pembaruan APK debug; migrasi ke rilis perlu direncanakan
agar identitas dan enrollment perangkat tidak hilang.

## Enam sinyal dan API yang dipakai

| # | Sinyal | API |
|---|---|---|
| 1 | Izin aplikasi | `PackageManager.getInstalledPackages(GET_PERMISSIONS)` |
| 2 | Layanan aksesibilitas dan hamparan | `Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES`, `AppOpsManager` |
| 3 | Sertifikat CA pengguna dan VPN | `KeyStore("AndroidCAStore")`, `ConnectivityManager` |
| 4 | Sumber pemasangan | `PackageManager.getInstallSourceInfo` |
| 5 | Integritas perangkat | keadaan boot dari Key Attestation (diperiksa OWL Core), artefak root, `Build.VERSION.SECURITY_PATCH` |
| 6 | Perilaku jaringan | `NetworkStatsManager`, `UsageStatsManager` |

## Batas yang jujur

Tiga hal tidak dapat dibaca aplikasi tanpa hak istimewa, dan karena itu tidak
diklaim di mana pun:

1. **Isi lalu lintas jaringan.** Agent hanya membaca metadata volume.
   Membacanya menuntut `VpnService`, dan hanya boleh ada satu VPN aktif pada
   perangkat, sehingga memasangnya justru akan mematikan VPN satuan.
2. **Tujuan jaringan per aplikasi.** Ruas `unusual_destinations` dan
   `new_destinations` pada skema telemetri diisi oleh resolver DNS satuan
   atau oleh agent yang di-provision sebagai Device Owner. Pada versi ini
   keduanya dikirim kosong, bukan diisi tebakan.
3. **Implan baseband, IMSI catcher, rootkit firmware, intersepsi RF.**
   Semuanya berada di bawah lapisan aplikasi. Lihat `docs/OWL-deepdive.md`
   §2.2 dan §6.2.

Versi presisi dari nomor 1 dan 2 menuntut agent dipasang sebagai system app
atau Device Owner pada perangkat dinas yang di-provision satuan. Itu sah
secara teknis untuk armada milik organisasi, dan tercatat sebagai roadmap
fase 5, bukan diklaim sudah ada.
