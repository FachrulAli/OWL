# Pemenuhan Requirements OWL

Dokumen ini memetakan tiap kebutuhan pada `OWL_Requirements_Hackathon.md` ke
tempatnya di kode, dan ke bukti bahwa kebutuhan itu memang berjalan. Status
ditulis apa adanya: yang belum selesai disebut belum selesai.

Diperiksa 14 November 2026. Uji otomatis: **47 lulus**
(`cd owl && make test`).

## Kebutuhan fungsional

| ID | Status | Tempatnya di kode | Bukti |
|---|---|---|---|
| FR-01 registrasi perangkat | **Selesai** | `agent/.../PostureService.kt` memanggil `Uploader.enroll`; `POST /api/devices` | Emulator Android 15 mendaftar sebagai `TACTICAL-07`, identitasnya tetap antar laporan. Uji `test_registrasi_perangkat` |
| FR-02 mengumpulkan indikator MVP | **Selesai** | `agent/.../Posture.kt`, enam sinyal | Tiap indikator punya status dan waktu pemeriksaan di tab Perangkat. Laporan nyata memuat sembilan entri status |
| FR-03 indikator tidak dapat diakses | **Selesai** | `Posture.availability()`, `rules.indicator_ok()`, `RiskAssessment.skipped_rules` | Agent nyata melaporkan `network_destinations: not_supported` dan `integrity: partial`; OWL-N02 dan OWL-N03 **dilewati**, bukan dianggap lulus. Uji `test_indikator_tidak_terbaca_melewati_aturannya` |
| FR-04 validasi telemetri | **Selesai** | `main.on_invalid`, `api.telemetry`, tabel `rejects`, `GET /api/rejects` | Badan kosong dan tanggal rusak ditolak 422 dan tercatat; token salah ditolak 401 dan tercatat. Tiga uji |
| FR-05 skor 0 sampai 100 | **Selesai** | `app/scoring.py`, `app/rules.py` | Input yang sama menghasilkan skor yang sama tiga kali berturut-turut (`test_skor_dapat_direproduksi`). Jumlah kontributor selalu sama dengan skor |
| FR-06 alasan pembentuk skor | **Selesai** | `Finding.points`, `CategoryScore`, komponen `Contributors` | Tiap temuan membawa poin, severitas, bukti, dan pemetaan MITRE. Tab Aturan menampilkan seluruh bobot |
| FR-07 Allow, Step-up, Restrict, Deny | **Selesai** | `app/pdp.py` | Keempat keputusan terjangkau; `test_empat_tingkat_risiko_terjangkau` menguji keempat tingkat dengan perangkat terpisah |
| FR-08 daftar perangkat dan waktu periksa | **Selesai** | tab Gerbang dan Perangkat | Dua perangkat tampil berdampingan dengan skor, tingkat, dan waktu pemeriksaan |
| FR-09 detail indikator per perangkat | **Selesai** | komponen `Indicators` dan `Contributors` | Tab Perangkat menampilkan status sembilan indikator dan rincian poin tiap temuan |
| FR-10 event audit | **Selesai** | tabel `decisions`, `GET /api/decisions` | Tiap keputusan menyimpan waktu, perangkat, skor, keputusan, dan alasan. Uji `test_keputusan_tercatat_sebagai_event_audit` |
| FR-11 kirim event ke Kartika CSIRT | **Selesai sebagai demonstrasi payload** | `app/stix.py`, `app/cef.py`, `app/soc.py` | STIX 2.1 bertanda tangan HMAC-SHA256 dan baris CEF dibuat untuk tiap penilaian. Integrasi sungguhan belum tersedia, jadi payload disimpan dan ditampilkan di tab SOC, sesuai bunyi FR-11 |
| FR-12 ubah bobot dan ambang | **Selesai** | `app/policy.py`, `PUT /api/policy/weight`, `PUT /api/policy/threshold`, tabel `policy_audit` | Perubahan menuntut token administrasi, berlaku pada penilaian berikutnya, dan tercatat beserta nilai lama. Empat uji |

## Kebutuhan nonfungsional

| Butir | Status | Catatan |
|---|---|---|
| Tidak mengumpulkan konten pribadi | **Selesai** | Skema telemetri tidak punya tempat untuk isi pesan, berkas, kontak, atau lokasi presisi, dan manifest agent tidak meminta izinnya. Layar pertama agent menyebutkan keduanya kepada pemilik perangkat |
| Pengumpulan data dibatasi | **Selesai** | Hanya indikator yang dipakai aturan. Aplikasi sistem dilewati saat membaca izin |
| Kanal terenkripsi | **Sebagian** | Agent memakai HTTP biasa ke `10.0.2.2` untuk demo lokal. mTLS tercatat di arsitektur dan belum dipasang pada purwarupa. `usesCleartextTraffic` harus dimatikan sebelum penggelaran |
| Autentikasi dashboard dan API | **Sebagian** | Dashboard dibuka lewat layar kunci; kata sandinya diteruskan sebagai `OWL_API_KEY`, jadi yang menolak adalah OWL Core, bukan browser. `OWL_ADMIN_TOKEN` untuk perubahan kebijakan dan penyapuan retensi, `OWL_INGEST_TOKEN` untuk telemetri. Tiga peran terpisah (baca, administrasi, penerimaan telemetri), tetapi **belum ada daftar pengguna**: satu kata sandi dipakai bersama. Dibiarkan kosong, API baca terbuka, dan keadaan itu dinyatakan di `/health` |
| Retensi data | **Selesai** | `app/retention.py`. Penilaian beserta telemetri mentahnya, keputusan, event SOC, dan penolakan dihapus setelah `OWL_RETENTION_DAYS` (bawaan 90). Penyapuan jalan sekali saat layanan mulai, lalu tiap `OWL_RETENTION_SWEEP_HOURS`, dan dapat dipaksa lewat `POST /api/retention/sweep` dengan token administrasi. Identitas perangkat dan `policy_audit` sengaja tidak ikut dihapus, sebab kewajiban audit menuntut jejaknya tetap ada. Enam uji, termasuk satu yang memastikan telemetri lampau hilang dari tabelnya, bukan hanya dari API |
| Audit perubahan kebijakan | **Selesai** | Tabel `policy_audit` menyimpan waktu, pelaku, ruas, nilai lama, dan nilai baru |
| On-premise dan air-gapped | **Selesai** | Dua kontainer, SQLite, tanpa panggilan keluar. `/health` menyatakan `air_gapped` |
| Inti tidak bergantung cloud | **Selesai** | Penilaian risiko tidak memanggil layanan luar. Play Integrity bersifat opsional dan ketiadaannya tidak membatalkan penilaian |
| Menampilkan waktu pembaruan | **Selesai** | Kartu gerbang dan tabel perangkat menampilkan waktu pemeriksaan terakhir |
| Kegagalan pengumpulan ditampilkan | **Selesai** | Lihat FR-03 |
| Pencatatan error | **Selesai** | `app/applog.py`. Satu baris JSON per kejadian ke keluaran standar dan ke `OWL_LOG_FILE`, berputar pada 5 MB dengan 3 salinan. Tercatat: layanan menyala dan berhenti, telemetri tidak valid, kegagalan kunci API dan token administrasi, kegagalan webhook dan syslog, serta penyapuan retensi. Isi telemetri, kunci, token, dan tanda tangan webhook tidak pernah masuk log, dan sifat itu dikunci uji |
| Versi Android disebutkan | **Selesai** | minSdk 29 (Android 10), compileSdk 35, diuji pada Android 15 API 35. Batasnya ada di `owl/agent/README.md` |

## Checklist submission

### Produk dan prototype

- [x] Agent Android dapat dijalankan pada perangkat uji — emulator Android 15 API 35
- [x] Indikator yang didukung berhasil dikumpulkan
- [x] Indikator yang tidak tersedia ditandai secara eksplisit
- [x] Backend menerima dan memvalidasi telemetri
- [x] Risk engine menghasilkan skor 0 sampai 100
- [x] Alasan dan faktor pembentuk skor dapat dilihat
- [x] Dashboard menampilkan dua perangkat dengan kondisi berbeda
- [x] Rekomendasi akses sesuai hasil penilaian
- [x] Demo berjalan tanpa ketergantungan pada cloud eksternal

### Pengujian dan keamanan

- [x] Uji skenario risiko rendah, sedang, tinggi, dan kritis
- [x] Uji data kosong, tidak valid, dan indikator tidak tersedia
- [x] Uji autentikasi dan otorisasi API
- [x] Tidak ada pengumpulan isi pesan, audio, atau gambar
- [x] Versi Android dan batasan permission terdokumentasi
- [x] Bobot, ambang skor, dan alasan keputusan terdokumentasi

### Dokumentasi dan submission

- [x] Repository dapat diakses juri
- [x] README menjelaskan masalah, solusi, arsitektur, instalasi, penggunaan
- [x] Diagram arsitektur tersedia — `owl/README.md` dan `docs/OWL-deepdive.md` §8.1
- [x] Dokumentasi API tersedia — OpenAPI di `/docs`, ringkasannya di `owl/README.md`
- [x] Metode risk scoring dijelaskan
- [x] Hasil pengujian dan batasan prototype dicantumkan
- [ ] Slide presentasi — deck 12 slide ada, belum memuat hasil build
- [ ] Video demo — naskahnya siap di `owl/DEMO.md`, belum direkam
- [x] Proposal dan dokumentasi proyek lengkap

## Perbedaan yang disengaja terhadap dokumen

Tiga hal di bawah berbeda dari bunyi dokumen, dan alasannya dicatat supaya
tidak terbaca sebagai kelalaian.

**1. Ambang deny bergantung pada kepekaan sumber daya.** Requirements §3.3
menaruh Deny di 90, dan §7 memberi Perangkat B skor 87 dengan rekomendasi
Restrict. Keduanya diikuti: pada jaringan biasa, perangkat berskor 87
mendapat Restrict. Deck proposal menolak perangkat yang sama di gerbang
sistem terklasifikasi, dan untuk itu ambang deny turun ke 70 **khusus**
sumber daya terklasifikasi. Satu ambang tunggal tidak dapat memenuhi
keduanya. Alasannya ada di `owl/services/backend/app/pdp.py`.

**2. Satu aturan tambahan di luar enam indikator.** OWL-N03 menandai tujuan
jaringan yang belum pernah terlihat pada riwayat perangkat itu sendiri,
severitas rendah, dan turun lagi jika menyala sendirian. Aturan ini masih di
dalam indikator keenam, dan diperlukan supaya perangkat contoh mendarat
tepat di 18 sebagaimana skenario demo, tanpa angka yang ditulis tangan.

**3. Ketiadaan verdict Play Integrity bukan kegagalan attestation.** Token
Play Integrity hanya dapat dibuka dengan menghubungi Google, dan itu mustahil
pada jaringan air-gapped. Menyamakan ketiadaan verdict dengan agent palsu
membuat seluruh perangkat ditolak pada mode penggelaran utama produk ini;
hal itu benar-benar terjadi saat agent pertama kali dijalankan. Sekarang
kunci yang tidak terbukti di perangkat keras dan verdict `FAILED` tetap
kritis, sedangkan verdict yang tidak dapat diperoleh sementara Key
Attestation terbukti bernilai sah pada air-gapped.

## Yang masih terbuka

| Hal | Keterangan |
|---|---|
| Uji pada perangkat fisik | Baru diuji di emulator. Emulator tidak dapat menguji StrongBox sungguhan, verdict Play Integrity yang sah, dan perilaku termal |
| mTLS agent ke backend | Tercatat di arsitektur, belum dipasang. Agent masih `usesCleartextTraffic` |
| Daftar pengguna pada dashboard | Sudah ada layar kunci dan tiga peran terpisah, tetapi kata sandinya tunggal dan dipakai bersama. Belum ada pengguna per orang, jadi log tidak dapat menyebut siapa yang membuka apa |
| Validasi korpus Drebin dan AndroZoo | Tercatat sebagai rencana pada deepdive §10.4, belum dijalankan |

