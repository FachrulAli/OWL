# Laporan pengerjaan dan pengujian roadmap OWL

Tanggal: 15 November 2026. Pengerjaan dilakukan pada workspace Windows lokal.
Implementasi perangkat lunak untuk seluruh butir yang belum ada sudah
ditambahkan. Roadmap **belum selesai secara penerimaan lapangan** karena
beberapa kriteria menuntut HP fisik, data tiga merek, dan uji enam jam.
Tidak ada HP yang tampil pada `adb devices -l`; backend Victus dan HP
Infinix belum menerima perubahan ini dalam sesi ini.

## Status per butir

| Butir | Implementasi dan bukti | Status penerimaan |
|---|---|---|
| A1 | Impor daftar Google, cek nomor seri rantai, penerapan langsung di gateway, umur sumber/impor dan dashboard. Uji daftar buatan lulus. | Teruji lokal; sertifikat HP Infinix lama masih perlu enrollment ulang agar nomor seri tersimpan. Daftar asli di Victus merupakan informasi dari pengguna, belum diperiksa di sesi ini. |
| A2 | Pencabutan/pembukaan perangkat, audit, laporan ditolak, sesi aktif langsung ditolak. | Teruji lokal. |
| A3 | Guard pengikatan penanda tangan di backend, konfigurasi signing Gradle, APK rilis bertanda tangan dan `apksigner verify` lulus. | Teruji lokal; aktivasi sidik resmi satuan dan pemasangan HP belum dilakukan. |
| A4 | Token sekali pakai backend, parser `owl://enroll`, konfirmasi pemilik, header enrollment, penghapusan token setelah diterima, penerbitan tautan di dashboard. Kunci cadangan menjaga kunci aktif saat enrollment gagal. | Backend dan parser teruji; alur Android nyata masih perlu HP. |
| A5 | nginx TLS, CA satuan disematkan ke rilis Android, HTTP/redirect ditolak oleh rilis, build tanpa CA/HTTPS ditolak. Sertifikat CA tak dikenal ditolak pada demo TLS. | Gateway teruji; pinning Android masih perlu HP. mTLS klien belum diterapkan; bukti identitas memakai tanda tangan kunci perangkat dan sesi singkat, sesuai opsi pada rencana A5. |
| B6 | Sesi berbukti tanda tangan perangkat, nonce sekali pakai satu menit, token hash berumur lima menit, verifikasi postur tiap request, nginx `auth_request`, aplikasi uji. | Demo HTTP/TLS nyata lulus: **200 → 403 → 200**, disertai alasan penolakan. Attestation perangkat pada demo dibuat untuk pengujian. |
| B7 | Event perubahan keputusan membawa keadaan lama/baru, resource, alasan dan aturan; webhook HMAC dan syslog CEF; deduplikasi per perangkat/resource. | Uji satu transisi satu event dan pengulangan laporan lulus. |
| B8 | Kasus baru/diperiksa/diselesaikan/dikecualikan, catatan, pelaku, audit, pengecualian maksimal 24 jam, kedaluwarsa otomatis. | Uji pembukaan berbasis skor, kedaluwarsa, dan larangan melewati root/attestation/pencabutan lulus. |
| B9 | Impor bundle STIX untuk nama paket atau sidik penanda tangan, penggantian tanpa restart, audit dan pemulihan saat startup. | Uji tambah/hapus entri dan efek langsung pada sesi aktif lulus. Daftar bawaan YAML tetap terpisah. |
| C10 | Telemetri jaringan per UID/paket dan waktu foreground, penanganan shared UID, status keterbacaan; fallback total perangkat diberi severitas low. | Simulasi pemakaian wajar tidak menyalakan N01 ketika data per aplikasi tersedia; unggahan tersembunyi terdeteksi. Telemetri nyata HP masih diperlukan. |
| C11 | Allowlist dinamis dengan kecocokan tiga unsur: merek, paket, penanda tangan. | Uji tiga merek simulasi lulus. Daftar pabrik dan skor tiga HP bersih nyata belum tersedia. |
| C12 | Panduan pemeriksaan lintas versi/merek/StrongBox di `owl/DEPLOY.md`. | **Belum diuji**: perlu Android 13, 14, 15, StrongBox dan merek tambahan. |
| D13 | SQLite WAL, busy timeout, antrean operasi satu proses, alat uji laporan bertanda tangan dan artefak angka beban. | Terukur lokal sampai 500 perangkat tiruan/1.500 laporan/konkurensi 50, tanpa kegagalan. Batas produksi belum disertifikasi; bukan uji jaringan atau ketahanan berjam-jam. |
| D14 | Foreground service dataSync diganti WorkManager, pemulihan setelah boot, pekerjaan segera atas permintaan, backoff, status laporan. | Build/lint lulus; **uji Android 15 lebih dari enam jam dan restart masih diperlukan**. |
| D15 | Metrik JSON dilindungi kunci baca, pemeriksaan alarm tiap 60 detik, perangkat senyap dan 10 penolakan/5 menit, deduplikasi dan event pemulihan keputusan. | Uji alarm tanpa dashboard dan tanpa pengulangan event lulus. |

## Hasil pengujian

| Pemeriksaan | Hasil |
|---|---|
| Backend pytest | **123 lulus**, satu peringatan deprecation dari dependensi TestClient. |
| Parser enrollment Android | **12 lulus pada debug + 12 pada release**; ini 12 skenario yang dijalankan pada kedua varian. |
| APK debug | Build berhasil. |
| APK release | Build bertanda tangan berhasil; `apksigner verify` berhasil. |
| Android lint debug / release | 0 error; 15 / 14 peringatan, termasuk target SDK dan lokalisasi. |
| Rilis tanpa CA | Gagal sebagaimana diharapkan pada validasi build. |
| Rilis dengan base HTTP | Gagal sebagaimana diharapkan pada validasi build. |
| Frontend | TypeScript dan Vite production build berhasil. |
| Compose | Konfigurasi gabungan standar + secure valid. Docker engine tidak berjalan; container belum diuji di mesin ini. |
| Gateway nginx + TLS | 200 → 403 → 200, akses tanpa sesi 401, endpoint auth internal 404, HTTP 308, CA tak dikenal ditolak. |
| Whitespace diff | Pemeriksaan lulus dengan pengenalan CRLF Windows. |

Bukti tersimpan di [evidence/backend-tests.xml](evidence/backend-tests.xml),
[evidence/gateway-tls.json](evidence/gateway-tls.json),
[evidence/release-build.json](evidence/release-build.json), dan
[evidence/android-checks.json](evidence/android-checks.json).
Laporan lint dan unit test lengkap juga berada di
`owl/agent/android/app/build/reports/`.

## Angka beban setelah perubahan terakhir

| Perangkat tiruan | Konkurensi | Laporan | Gagal | Laporan/detik | p95 |
|---:|---:|---:|---:|---:|---:|
| 100 | 20 | 300 | 0 | 113,78 | 185,66 ms |
| 500 | 50 | 1.500 | 0 | 107,54 | 511,61 ms |

Bukti: [load-100.json](evidence/load-100.json) dan
[load-500.json](evidence/load-500.json). Pengujian memakai ASGI TestClient,
satu proses, SQLite WAL, verifikasi tanda tangan EC, dan penyimpanan laporan
serta event. Enrollment, latensi jaringan, pengiriman ke SOC eksternal,
dan beberapa replika tidak tercakup. Pengujian memakai kunci perangkat
lunak tiruan yang dipersiapkan di database, bukan attestation perangkat keras.
Gunakan satu worker. Dengan angka yang diukur, migrasi PostgreSQL belum
dibutuhkan untuk demo lokal ini; penggelaran lain perlu pengukuran sendiri.

## Artefak dan penggelaran

APK rilis berada di
`owl/agent/android/app/build/outputs/apk/release/app-release.apk`.
Build ini memakai alamat **https://localhost:8443** dan CA lokal untuk
pengujian. Untuk HP, build ulang dengan alamat server yang dapat dijangkau,
SAN sertifikat yang cocok, token ingest, CA serta penanda tangan satuan.
Sidik penanda tangan lokal dan hash APK terdapat di `release-build.json`.
Kunci privat dan konfigurasi signing disimpan di `.local/`, diabaikan Git.

Petunjuk lengkap: [owl/DEPLOY.md](../owl/DEPLOY.md) dan
[owl/agent/README.md](../owl/agent/README.md). Keputusan Step-up diteruskan
oleh demo sebagaimana roadmap meminta; integrasi MFA/IAM belum disediakan.
Sistem ini tetap bekerja pada lapisan aplikasi, dengan keterbatasan firmware,
baseband, dan RF yang dinyatakan roadmap awal.

## Bukti yang masih harus dikumpulkan

1. Pasang agent yang sesuai konfigurasi Victus, terbitkan token baru,
   lakukan enrollment ulang Infinix, dan pastikan `chain_serials` tersimpan.
   Periksa sertifikat terhadap daftar pencabutan asli yang sudah diimpor.
2. Jalankan alur token, CA pinning, pelaporan, serta tombol uji akses pada HP.
3. Rekam hasil Android 13/14/15, StrongBox dan merek tambahan; kumpulkan
   allowlist pabrik yang benar dari tiga merek.
4. Jalankan Android 15 lebih dari enam jam, restart, lalu buktikan laporan
   berikutnya tetap masuk. Gunakan mode penghematan daya yang dipakai satuan.
5. Jalankan stack Compose aman dan pengiriman SOC pada lingkungan tujuan.

## Rujukan teknis

- [Batas foreground service Android](https://developer.android.com/develop/background-work/services/fgs/timeout).
- [NetworkStatsManager](https://developer.android.com/reference/android/app/usage/NetworkStatsManager).
- [nginx auth_request](https://nginx.org/en/docs/http/ngx_http_auth_request_module.html).
- [PyYAML 6.0.3, dukungan wheel Python 3.14](https://pypi.org/project/PyYAML/6.0.3/).

## Sinkronisasi ke Victus

Source digabung tanpa konflik ke E:\kartika\OWL di Victus. Commit dasar 72186bf; perubahan roadmap tetap working tree, belum di-commit.
Salinan sebelum sinkronisasi: E:\kartika\owl-sync-backups\20261115-roadmap.

Pemeriksaan di Victus: 123 tes backend lulus, 12 unit test Android debug lulus, build frontend dan APK debug berhasil, lint Android 0 error dan 15 peringatan.
Bukti: evidence/victus-backend-tests.xml dan evidence/victus-sync.json.
ADB tersedia tetapi daftar perangkat masih kosong pada pemeriksaan ini.
Proses backend belum direstart; perubahan runtime belum dinyatakan aktif. Database dan konfigurasi launcher dipertahankan.
