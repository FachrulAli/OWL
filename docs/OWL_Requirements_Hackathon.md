# OWL (On-Device Watch Layer) — Requirements Hackathon

**Tagline:** *Velox et Exactus — Fast Detection, Precise Assessment*
**Event:** Kartika Cyber Hackathon 2026
**Submission deadline:** 15 November 2026

## 1. Ringkasan Karya

OWL (On-Device Watch Layer) adalah solusi pengamanan smartphone yang membantu mengidentifikasi dan menilai indikasi potensi penyadapan maupun kompromi perangkat. OWL mengumpulkan dan mengorelasikan indikator keamanan yang tersedia pada perangkat, menghasilkan skor risiko yang dapat dijelaskan, lalu menyediakan rekomendasi tindakan atau keputusan akses berdasarkan tingkat risiko.

OWL ditujukan sebagai lapisan perlindungan tambahan bagi smartphone yang digunakan prajurit dan pimpinan di lingkungan pertahanan. Solusi dirancang dengan pendekatan **on-premise** dan mendukung skenario **air-gapped**, sehingga data penilaian keamanan dapat tetap dikelola dalam kendali institusi.

> **Batasan klaim:** OWL menilai indikator risiko dan potensi kompromi. OWL tidak boleh diklaim mampu memastikan seluruh bentuk penyadapan, mendeteksi semua spyware, atau menggantikan antivirus maupun Mobile Device Management (MDM).

## 2. Tujuan Produk

1. Mengurangi titik buta keamanan pada smartphone yang digunakan untuk komunikasi dan aktivitas kedinasan.
2. Mengidentifikasi konfigurasi atau perilaku perangkat yang dapat mengindikasikan risiko penyadapan maupun kompromi.
3. Menggabungkan beberapa indikator menjadi satu skor risiko yang transparan dan dapat dijelaskan.
4. Menyediakan rekomendasi tindakan dan mendukung keputusan akses secara adaptif.
5. Menjaga data dan proses penilaian tetap berada di lingkungan institusi melalui deployment on-premise.

## 3. Ruang Lingkup MVP

MVP difokuskan pada **satu alur Android end-to-end**: pengumpulan indikator perangkat, analisis risiko, penyajian hasil, dan demonstrasi keputusan akses.

### 3.1 Indikator Keamanan

| No. | Indikator | Data atau kondisi yang dinilai | Catatan implementasi |
|---|---|---|---|
| 1 | Izin aplikasi | Izin sensitif seperti mikrofon, kamera, dan lokasi yang tidak sesuai kebutuhan aplikasi | Gunakan informasi yang dapat diakses secara sah melalui Android API |
| 2 | Accessibility Service | Layanan aksesibilitas aktif dan aplikasi yang menggunakannya | Tandai sebagai indikator risiko, bukan bukti otomatis adanya penyalahgunaan |
| 3 | Sertifikat dan VPN | Sertifikat CA yang dipasang pengguna serta konfigurasi VPN yang terdeteksi | Jelaskan batas visibilitas berdasarkan versi Android dan hak akses |
| 4 | Sumber instalasi aplikasi | Aplikasi yang dipasang dari luar sumber tepercaya atau melalui sideload | Perlakukan sebagai sinyal risiko, bukan vonis malware |
| 5 | Integritas perangkat | Indikasi root, bootloader terbuka, tampering, dan tingkat patch keamanan | Dokumentasikan metode pemeriksaan dan keterbatasannya |
| 6 | Anomali aktivitas jaringan | Metadata jaringan yang tersedia, misalnya perubahan koneksi atau tujuan/volume yang tidak lazim | Jangan mengklaim inspeksi payload terenkripsi atau pemantauan menyeluruh atas aplikasi lain |

### 3.2 Alur Utama

```text
Registrasi perangkat
        |
Pengumpulan indikator keamanan
        |
Normalisasi dan korelasi indikator
        |
Perhitungan skor risiko (0–100)
        |
Penjelasan faktor pembentuk skor
        |
Rekomendasi / keputusan akses
        |
Dashboard dan pencatatan event
```

### 3.3 Kategori Skor Risiko

Rentang berikut merupakan rancangan awal dan harus dapat dikonfigurasi serta diuji menggunakan skenario demo.

| Skor | Kategori | Rekomendasi tindakan |
|---|---|---|
| 0–29 | Rendah | Allow — perangkat dapat melanjutkan akses sesuai kebijakan |
| 30–69 | Sedang | Step-up — minta verifikasi tambahan atau MFA |
| 70–89 | Tinggi | Restrict — batasi akses ke resource sensitif |
| 90–100 | Kritis | Deny / Quarantine — tolak akses dan minta pemeriksaan |

Skor harus disertai alasan yang dapat dipahami, misalnya indikator yang terdeteksi, bobotnya, waktu pemeriksaan, dan rekomendasi mitigasi. Jangan hanya menampilkan angka akhir.

## 4. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas | Kriteria penerimaan |
|---|---|---|---|
| FR-01 | Agent Android dapat melakukan registrasi perangkat ke backend OWL | Must | Perangkat uji berhasil terdaftar dan memiliki identitas perangkat yang konsisten |
| FR-02 | Agent mengumpulkan indikator keamanan yang termasuk dalam ruang lingkup MVP | Must | Hasil pengumpulan ditampilkan dan setiap indikator memiliki status serta waktu pemeriksaan |
| FR-03 | Agent menangani indikator yang tidak dapat diakses oleh API Android | Must | Sistem menampilkan `Unavailable` atau `Not Supported`, bukan mengarang nilai |
| FR-04 | Backend menerima dan memvalidasi data telemetri perangkat | Must | Data valid diproses; data tidak valid ditolak dan dicatat |
| FR-05 | Rule engine mengorelasikan indikator dan menghitung skor risiko 0–100 | Must | Skor dapat direproduksi dari input dan aturan yang sama |
| FR-06 | Sistem menampilkan alasan pembentuk skor | Must | Pengguna dapat melihat indikator, bobot, dan alasan rekomendasi |
| FR-07 | Sistem menghasilkan rekomendasi Allow, Step-up, Restrict, atau Deny/Quarantine | Must | Rekomendasi sesuai ambang skor yang dikonfigurasi |
| FR-08 | Dashboard menampilkan daftar perangkat, status, skor, dan waktu pemeriksaan terakhir | Must | Dua atau lebih perangkat uji dapat dibandingkan |
| FR-09 | Dashboard menampilkan detail indikator setiap perangkat | Must | Juri dapat menelusuri alasan perangkat memperoleh skor tertentu |
| FR-10 | Sistem mencatat perubahan status dan keputusan sebagai event audit | Should | Event berisi waktu, perangkat, skor, keputusan, dan alasan |
| FR-11 | Sistem dapat mengirim event keamanan ke Kartika CSIRT | Should | Event uji berhasil dikirim dalam format yang disepakati; jika integrasi belum tersedia, sediakan demonstrasi payload |
| FR-12 | Administrator dapat mengubah bobot atau ambang risiko melalui konfigurasi | Could | Perubahan konfigurasi memengaruhi hasil penilaian berikutnya dan tercatat |

## 5. Kebutuhan Nonfungsional

### 5.1 Keamanan dan Privasi

- OWL tidak mengumpulkan isi pesan, rekaman suara, gambar kamera, atau konten pribadi pengguna.
- Pengumpulan data dibatasi pada indikator keamanan yang diperlukan untuk penilaian risiko.
- Komunikasi agent dan backend harus menggunakan kanal terenkripsi ketika jaringan mendukungnya.
- Akses dashboard dan API harus menggunakan autentikasi dan otorisasi.
- Data sensitif harus diminimalkan, dilindungi, dan memiliki kebijakan retensi.
- Aktivitas administrator dan perubahan kebijakan harus dapat diaudit.

### 5.2 Kedaulatan dan Deployment

- Backend dapat dijalankan pada infrastruktur lokal/on-premise.
- Fungsi inti penilaian risiko tidak bergantung pada layanan cloud eksternal.
- Sistem harus dapat diuji dalam lingkungan jaringan terisolasi sesuai kebutuhan demo.
- Integrasi eksternal bersifat opsional dan tidak boleh menjadi ketergantungan fungsi inti.

### 5.3 Kinerja dan Keandalan

- Pemeriksaan indikator dan pengiriman hasil tidak boleh mengganggu fungsi utama smartphone secara signifikan.
- Dashboard harus menampilkan waktu pembaruan data agar status lama tidak disalahartikan sebagai kondisi terkini.
- Kegagalan pengumpulan indikator harus ditampilkan secara eksplisit.
- Sistem harus memiliki pencatatan error untuk membantu troubleshooting.

### 5.4 Kompatibilitas

- MVP memprioritaskan Android.
- Versi Android dan jenis perangkat yang didukung harus disebutkan secara eksplisit.
- Fitur yang dibatasi oleh Android API, permission, atau kebijakan sistem harus didokumentasikan.

## 6. Arsitektur Teknis MVP

| Komponen | Teknologi yang direncanakan | Tanggung jawab |
|---|---|---|
| Android Agent | Kotlin | Mengumpulkan indikator keamanan yang tersedia pada perangkat |
| Backend API | Python / FastAPI | Registrasi perangkat, penerimaan telemetri, autentikasi, dan API |
| Risk Engine | Rule-based scoring | Korelasi indikator, pembobotan, skor, dan rekomendasi |
| Database | Database relasional | Menyimpan identitas perangkat, hasil pemeriksaan, kebijakan, dan event |
| Dashboard | React | Menampilkan perangkat, skor risiko, detail indikator, dan keputusan |
| Deployment | On-premise | Menjalankan backend dan dashboard di lingkungan lokal |

## 7. Skenario Demonstrasi Prototype

### Demo: Dua Perangkat, Satu Gerbang

**Perangkat A — Risiko Rendah**
- Tidak ditemukan indikator berisiko tinggi pada pemeriksaan yang didukung.
- Memperoleh skor contoh 18/100.
- Rekomendasi: Allow.

**Perangkat B — Risiko Tinggi**
- Memiliki kombinasi indikator uji, misalnya aplikasi sideload, Accessibility Service yang tidak diharapkan, dan konfigurasi sertifikat yang perlu ditinjau.
- Memperoleh skor contoh 87/100.
- Rekomendasi: Restrict.

**Urutan demonstrasi:**
1. Daftarkan dua perangkat uji.
2. Jalankan pemeriksaan indikator pada masing-masing perangkat.
3. Tampilkan hasil telemetri yang diterima backend.
4. Perlihatkan perhitungan skor dan faktor penyusunnya.
5. Tampilkan perbedaan rekomendasi akses pada dashboard.
6. Tunjukkan event audit atau payload integrasi CSIRT.

> Skor 18 dan 87 adalah nilai ilustratif untuk skenario demo. Nilai aktual harus dihasilkan oleh rule engine berdasarkan indikator dan bobot yang benar-benar diterapkan.

## 8. Batasan dan Risiko Teknis

- Android membatasi aplikasi dalam mengakses informasi aplikasi lain dan aktivitas jaringan secara menyeluruh. Desain harus mengikuti API dan permission resmi.
- Izin mikrofon atau kamera yang aktif tidak otomatis berarti penyadapan sedang terjadi.
- Accessibility Service, sideload, sertifikat CA pengguna, VPN, root, dan patch usang merupakan indikator yang perlu dikorelasikan, bukan bukti tunggal kompromi.
- Deteksi zero-click exploit, kompromi baseband, IMSI catcher, dan penyadapan pada level operator seluler berada di luar cakupan MVP.
- Keputusan akses yang benar-benar memblokir resource memerlukan integrasi dengan mekanisme enforcement, misalnya gateway, IAM, atau sistem akses yang dikendalikan institusi. Jika belum tersedia, prototype harus menyebut hasilnya sebagai rekomendasi keputusan akses.

## 9. Kriteria Penilaian Hackathon dan Strategi Pemenuhan

| Kriteria | Bobot | Bukti yang perlu disiapkan |
|---|---|---|
| Relevansi dan manfaat | 25% | Rumusan masalah, target pengguna, skenario penggunaan, dan manfaat perlindungan smartphone prajurit |
| Fungsionalitas prototype | 25% | Demo agent Android, backend, risk scoring, dashboard, dan hasil keputusan |
| Inovasi teknis | 25% | Korelasi enam indikator, explainable risk scoring, dan pendekatan on-premise/air-gapped |
| Kelayakan implementasi | 15% | Arsitektur, batasan Android, kebutuhan infrastruktur, keamanan, dan roadmap |
| Kualitas dokumentasi | 10% | README, diagram arsitektur, dokumentasi API, metode scoring, hasil pengujian, dan panduan demo |

## 10. Checklist Sebelum Submission

### Produk dan Prototype

- [ ] Agent Android dapat dijalankan pada perangkat uji.
- [ ] Indikator yang didukung berhasil dikumpulkan.
- [ ] Indikator yang tidak tersedia ditandai secara eksplisit.
- [ ] Backend menerima dan memvalidasi telemetri.
- [ ] Risk engine menghasilkan skor 0–100.
- [ ] Alasan dan faktor pembentuk skor dapat dilihat.
- [ ] Dashboard menampilkan minimal dua perangkat dengan kondisi berbeda.
- [ ] Rekomendasi akses sesuai hasil penilaian.
- [ ] Demo berjalan tanpa ketergantungan pada cloud eksternal.

### Pengujian dan Keamanan

- [ ] Uji skenario risiko rendah, sedang, tinggi, dan kritis.
- [ ] Uji data kosong, tidak valid, dan indikator tidak tersedia.
- [ ] Uji autentikasi dan otorisasi API.
- [ ] Pastikan tidak ada pengumpulan isi pesan, audio, atau gambar.
- [ ] Dokumentasikan versi Android dan batasan permission.
- [ ] Dokumentasikan bobot, ambang skor, dan alasan keputusan.

### Dokumentasi dan Submission

- [ ] Repository dapat diakses oleh juri.
- [ ] README menjelaskan masalah, solusi, arsitektur, instalasi, dan penggunaan.
- [ ] Diagram arsitektur tersedia.
- [ ] Dokumentasi API tersedia.
- [ ] Metode risk scoring dijelaskan.
- [ ] Hasil pengujian dan batasan prototype dicantumkan.
- [ ] Slide presentasi tersedia.
- [ ] Video demo tersedia.
- [ ] Proposal/dokumentasi proyek lengkap.
- [ ] Seluruh materi disiapkan sebelum **15 November 2026**.

## 11. Definisi Keberhasilan MVP

MVP OWL dinyatakan berhasil apabila tim dapat mendemonstrasikan satu alur yang berjalan dari awal hingga akhir: dua smartphone Android mengirimkan indikator keamanan ke backend lokal, rule engine menghasilkan skor risiko yang dapat dijelaskan, dan dashboard menampilkan rekomendasi tindakan yang berbeda sesuai kondisi masing-masing perangkat.

**Prinsip produk:** Perangkat yang terdaftar belum tentu aman. Setiap perangkat perlu dinilai berdasarkan indikator risikonya sebelum dipercaya untuk mengakses sistem strategis.
