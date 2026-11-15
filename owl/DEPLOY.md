# Penggelaran OWL dengan TLS dan gateway

Gunakan satu proses backend (`uvicorn --workers 1`). Koneksi SQLite memakai
WAL dan busy timeout; operasi HTTP dan pemeriksaan alarm diantrikan dalam
proses agar pemeriksaan token, replay, dan pembaruan tidak saling menyela.
Beberapa proses atau replika belum didukung oleh penguncian ini.

## TLS dan agent

1. Pada mesin petugas, buat sertifikat untuk DNS/IP yang akan dipakai HP:

   ```powershell
   services/backend/.venv/Scripts/python.exe services/backend/tools/create_tls.py --out infra/tls --hosts owl.satuan 192.168.1.10
   ```

   Direktori harus baru. Kunci CA disimpan oleh petugas; gateway hanya
   membutuhkan `server.pem` dan `server-key.pem`. Jangan mengirim kunci
   privat CA ke HP. Pada sistem dengan CA satuan yang sudah ada, gunakan
   sertifikat server dari CA tersebut dan SAN yang sesuai alamat server.

2. Build agent rilis dengan `-PowlCa=<CA publik.pem>` dan
   `-PowlBase=https://owl.satuan:8443`. Token ingest diisi lewat
   `ORG_GRADLE_PROJECT_owlToken`; penanda tangan dapat disediakan melalui
   `OWL_SIGNING_STORE_FILE`, `OWL_SIGNING_STORE_PASSWORD`,
   `OWL_SIGNING_KEY_ALIAS`, dan `OWL_SIGNING_KEY_PASSWORD`. Helper
   `build_agent_release.py` tersedia untuk kunci lokal pengujian.

3. Isi variabel lingkungan sebelum Compose dijalankan:
   `OWL_INGEST_TOKEN`, `OWL_ADMIN_TOKEN`, `OWL_API_KEY`,
   `OWL_AGENT_SIGNERS` (sidik sertifikat APK SHA-256 heksadesimal),
   dan `OWL_PUBLIC_BASE_URL=https://owl.satuan:8443`.

4. Jalankan:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.secure.yml up --build
   ```

   Backend 8000 hanya terbuka di localhost. nginx melayani TLS di 8443;
   8080 mengarahkan ke HTTPS. Agent rilis menolak HTTP sebelum redirect.
   Compose aman mematikan demo, memakai attestation `verify`, dan mewajibkan
   enrollment `token`. mTLS sertifikat klien belum dipasang: identitas
   perangkat dibuktikan dengan tanda tangan kunci attestation dan sesi
   singkat. Penilaian A5 menggunakan TLS + CA yang disematkan sesuai rencana;
   mTLS tetap pilihan penguatan di penggelaran berikutnya.

## Enrollment dan pencabutan

Tab SOC menyediakan penerbitan token per perangkat dan tautan provisioning.
HP yang sudah terdaftar mencoba melapor dengan kuncinya. Untuk migrasi
build lama sementara gunakan `OWL_ENROLL=shared` pada backend pengembangan;
konfigurasi aman di atas tetap memakai mode token.

Impor daftar Google lewat `POST /api/attestation/revocations` dengan header
`X-OWL-Admin` dan objek JSON Google. Parameter `source_date=YYYY-MM-DD`
menyatakan tanggal sumber; umur daftar memakai yang lebih tua antara
tanggal sumber dan waktu impor. Tanpa tanggal sumber, umur dihitung dari
impor saja. Dashboard menunjukkan umur tersebut. Daftar baru diperiksa
juga saat akses gateway. Metrik `revocation_unchecked_devices` menunjukkan
perangkat lama yang belum menyimpan nomor seri; perangkat itu perlu
enrollment ulang agar sertifikatnya benar-benar diperiksa.

## Bukti akses B6

`GET /api/access/challenge?device_id=...` mengembalikan `signing_payload`.
Tandatangani byte UTF-8 tersebut dengan kunci laporan, lalu kirim
`POST /api/access/sessions` dengan `device_id`, `challenge`, `signature`.
Tantangan berlaku satu menit dan sekali pakai. Respons berisi bearer token
berumur lima menit. Yang disimpan di server hanya hash token.

Gunakan `Authorization: Bearer ...` pada `/protected/standard` atau
`/protected/classified`. nginx memakai `auth_request` ke endpoint verifikasi
internal pada setiap permintaan. Keputusan menggunakan laporan terakhir
dengan umur asli dan aturan terkini; pencabutan perangkat/sertifikat, rotasi
kunci, dan daftar larangan baru langsung berlaku meski sesi belum habis.
Allow dan Step-up diteruskan sesuai rencana demo. Ini belum menyediakan MFA;
penggelaran yang memerlukan MFA harus mengintegrasikannya dengan IAM.
Restrict boleh mengakses jalur standard; jalur classified ditolak. Deny
mendapat 403 beserta alasan yang dapat dibaca.

Demo otomatis tanpa HP, memakai attestation buatan dan HTTP/TLS sungguhan:

```powershell
services/backend/.venv/Scripts/python.exe services/backend/tools/gateway_demo.py --nginx <nginx.exe> --out ../docs/evidence/gateway-tls.json
```

## SOC, kasus, dan daftar dinamis

`GET /api/cases` membaca kasus. Admin memperbaruinya lewat
`PUT /api/cases/{device_id}` dengan `status`, `note`, `ttl_minutes`.
Pengecualian paling lama 24 jam. Pengecualian hanya membatalkan penolakan
berdasarkan skor; pencabutan, attestation gagal, laporan basi, dan aturan
penentu tetap menolak. Kedaluwarsa dicatat oleh pemeriksaan alarm dan
jalur akses, beserta audit aktor `system`.

`POST /api/blocklist/import` mengganti seluruh daftar larangan hasil impor.
Daftar bawaan di YAML tetap berlaku dan ditampilkan terpisah oleh
`GET /api/blocklist`. Bundle STIX mendukung indicator dengan pola tepat:

```text
[software:name = 'nama.paket']
[x-android-app:signer_sha256 = '<64 digit heksadesimal>']
```

Pola lain ditolak supaya tidak tampak berhasil diimpor tanpa diterapkan.
Indicator dengan `revoked: true` dilewati. Impor bundle kosong menghapus
seluruh entri hasil impor. Perubahan tercatat di audit dan bertahan restart.

`PUT /api/factory-allowlist` menerima daftar
`{manufacturer, package, signer_sha256}`. Ketiganya harus cocok. Jangan
mengarang pengecualian merek tanpa mengambil sidik dari perangkat inventaris.

`GET /api/metrics` dilindungi kunci baca. Metriknya meliputi status perangkat,
umur laporan, dan penolakan per alasan. Pemeriksaan alarm berjalan setiap
60 detik; perangkat senyap dan minimal 10 laporan ditolak dalam lima menit
menghasilkan event SOC, dengan deduplikasi sampai keadaan pulih. Admin dapat
menjalankan pemeriksaan segera lewat `POST /api/alarms/scan`.
Webhook membawa HMAC; syslog membawa CEF. Perubahan keputusan membawa
keputusan lama/baru dan aturan penyebab, termasuk pemulihan ke Allow.

## Pemeriksaan penerimaan di HP

Sediakan Android 13/14/15, perangkat StrongBox, dan merek tambahan. Catat
model, versi, security level, rantai, installer, serta izin usage access.
Untuk D14, jalankan pelaporan lebih dari enam jam pada Android 15, restart
HP, lalu pastikan laporan berikutnya diterima. Untuk C10, periksa telemetri
per aplikasi pada pemakaian wajar dan skenario unggahan tersembunyi. Untuk
C11, kumpulkan pasangan paket/penanda tangan dari tiga merek sebelum
mengesahkan allowlist. Build dan uji simulasi belum menggantikan bukti ini.
