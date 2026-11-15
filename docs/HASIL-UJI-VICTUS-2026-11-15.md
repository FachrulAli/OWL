# Hasil pengujian sistem pada HP fisik di Victus

Tanggal: 15 November 2026. Seluruh build, browser, dan pengujian berjalan di
Victus (`E:\kartika\OWL`), memakai Infinix X6515 / SMART 7, Android 12.
Commit kode: `2a7480b`. Agent 1.1.0 dipasang sebagai pembaruan
dengan penanda tangan test yang sama, sehingga data dan identitas Keystore
dipertahankan. Tahap HTTPS memakai build **release/non-debuggable**, dengan
CA pengujian yang disematkan; ini belum sertifikat rilis resmi satuan.

## Hasil nyata

| Pengujian | Hasil |
|---|---|
| Enrollment lewat `owl://enroll` | Berhasil di HP; token diterbitkan admin dan dipakai sekali. |
| Attestation | Terverifikasi sampai akar Google; kunci di TEE, boot terverifikasi dan terkunci. |
| Pencabutan Google | Empat nomor seri rantai tersimpan dan diperiksa terhadap 1775 entri; tidak tercabut. |
| Pengikatan penanda tangan | Aktif; sidik APK test diikat oleh OWL Core, mode demo dimatikan. |
| Token enrollment bekas | Ditolak 401. |
| Laporan palsu dengan token ingest benar | Ditolak 401 karena tanda tangan tidak sah. |
| Paket terlarang ada | Agent ditolak 403, walaupun skor awal hanya 34. |
| Paket uji dikeluarkan sementara | Skor 19, Allow, akses dari agent 200. Data paket tetap disimpan. |
| Paket uji dikembalikan dari APK backup | Laporan berikutnya memicu Deny; akses dari agent kembali 403. Paket tidak diluncurkan oleh pengujian. |
| Pencabutan admin saat perangkat tanpa paket uji | Akses 403; setelah pencabutan dibuka, akses kembali 200. |
| Gateway nyata | **403 -> 200 -> 403** lewat HTTPS nginx `auth_request`, memakai bukti kunci perangkat asli. |
| CA pinning pada HP | CA tersemat: koneksi sampai gerbang; CA asing: koneksi gagal (-1); sertifikat asli dikembalikan: koneksi pulih. |
| Volume per aplikasi | 39 entri terbaca, indikator `network_volume=ok`, N01 tidak aktif pada pemakaian yang teramati. |
| Pemulihan proses agent | PID 9608 dihentikan; proses baru PID 10088 mengirim laporan WorkManager atas permintaan dengan kunci yang sama. |
| Restart OWL Core | Berhasil; identitas, daftar pencabutan dan laporan bertahan, laporan baru diterima setelah restart. |
| Dashboard alert | Event `decision_changed`, keputusan lama/baru, dan pembaruan langsung dari laporan HP terlihat di SOC/CSIRT. Chrome headless: 0 error JavaScript. |

Screenshot: [dashboard alert](evidence/victus-dashboard-alert.png).
Dashboard yang sudah berjalan: http://100.78.61.8:5173/dashboard.
Alert yang diuji berupa event pada tab SOC; pengujian ini tidak membuktikan
popup lintas tab atau notifikasi OS. Webhook/syslog eksternal tidak diuji;
event disimpan secara lokal pada konfigurasi air-gapped ini.

## Temuan dashboard saat pengujian (commit 2a7480b)

Kartu **Needs action** menghitung `level=tinggi/kritis` di
`owl/frontend/src/views/Ikhtisar.tsx`, sehingga dapat menampilkan 0 saat
perangkat berlevel skor sedang sudah **Deny** akibat aturan penentu A03.
Ini terlihat pada pengujian browser. Gerbang tetap menolak dan event Deny
muncul di SOC. Penghitung tersebut perlu memperhitungkan keputusan akses
agar ringkasan tidak membuat operator melewatkan penolakan. Perubahan UI
belum dilakukan pada sesi pengujian ini.

## Jadwal WorkManager dan batas pengujian

Job periodik yang dipaksa sebelum waktunya tidak mengirim laporan karena
WorkManager menegakkan `TIMING_DELAY`. Ini dicatat sebagai pemeriksaan
jadwal yang belum memenuhi syarat, bukan bukti pelaporan periodik gagal
atau berhasil. Uji yang berhasil adalah pemulihan proses dan laporan atas
permintaan saat launcher ditampilkan. Belum ada penerimaan interval alami,
restart HP, atau uji Android 15 lebih dari enam jam. C12 dan pengujian tiga
merek/StrongBox tetap memerlukan perangkat tambahan. Skenario unggahan
tersembunyi C10 masih memakai bukti uji otomatis, bukan upload tersembunyi
terkontrol pada HP ini.

## Pengujian lain di Victus

Backend: 123 tes lulus. Unit test Android: 12 lulus pada debug dan 12 pada
release. Build frontend dan APK berhasil; lint Android tanpa error.
Uji 500 perangkat tiruan, 1.500 laporan dan konkurensi 50: 0 kegagalan,
101.02 laporan/detik, p95 517.96 ms.
Uji beban memakai ASGI satu proses dan signature verification; tidak
mencakup jaringan atau enrollment serentak.

## Keadaan setelah tes

- Agent release test 1.1.0, OWL Core, nginx TLS dan server ADB tetap aktif.
- Paket `com.metasploit.stage` dikembalikan seperti keadaan awal; tidak
  diluncurkan. Perangkat saat ini **Deny**, dan pencabutan admin tidak aktif.
- Koneksi HP memakai USB reverse untuk port 8000/8443; mencabut USB akan
  memutus jalur pengujian ini. Penggelaran LAN perlu base URL dan SAN yang sesuai.
- CA/key test serta backup database/APK berada di
  `E:\kartika\owl-system-test\20261115`, di luar repo. Rahasia tidak
  disertakan dalam berkas bukti. Bukti JSON dan screenshot ada di `docs/evidence`.

Uji ini memperkuat bukti A1/A3/A4/A5/B6/B7/C10 pada satu HP nyata; tidak
menyatakan seluruh roadmap lapangan selesai.

## Pembaruan setelah pengujian awal

Tampilan dashboard kemudian diperbarui melalui commit ed5e36a beserta pendahulunya. Temuan UI di atas mengacu pada commit 2a7480b saat pengujian awal, sehingga perlu divalidasi kembali pada dashboard terbaru. Agent Android kini diperbarui ke 1.2.1 dengan UI native minimal dan logo dari aset asli pemilik. Uji fisik UI berhasil menampilkan keputusan server, membuka rincian/privasi, menguji akses, dan mempertahankan identitas hardware. APK 6.207.974 byte; dependency runtime tambahan: nol. Bukti UI berada di docs/evidence/victus-android-*.png dan victus-android-ui-checks.json.
