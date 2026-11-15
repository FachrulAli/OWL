# OWL — On Device Watch Layer

> *"Melihat dan mendengar dalam gelap."*
> Gerbang risiko perangkat untuk lingkungan TNI AD, berjalan on-prem dan
> air-gapped. Purwarupa untuk Kartika Cyber Hackathon 2026 (PUSSIBERAD ×
> CODEPOLITAN).

**Masalah.** SOC dan CSIRT satuan memagari server dan jaringan, tetapi ponsel
yang dibawa prajurit ke lapangan dan ponsel di meja perwira tinggi tidak
terlihat oleh pertahanan mana pun. MDM seperti Knox dan Intune pandai
*mengelola* perangkat: ia tahu perangkat terdaftar atau tidak. Yang tidak
dijawabnya adalah pertanyaan yang sebenarnya penting, yaitu apakah perangkat
ini aman dipercaya menyentuh sistem satuan hari ini. Keduanya pun berjalan di
cloud vendor luar negeri.

**Pendekatan OWL.** Membaca enam sinyal yang sudah tersedia di perangkat,
mengorelasikannya menjadi satu skor risiko yang dapat ditelusuri sampai ke
aturan penyebabnya, lalu memakai skor itu sebagai keputusan akses. Bukan
antivirus, bukan anti-sadap total. Sebuah gerbang.

```
Registrasi → Telemetri → Korelasi multi-sinyal → Skor 0-100 → Keputusan akses
```

---

## Enam sinyal

| # | Sinyal | Aturan | Bobot kategori |
|---|---|---|---|
| 1 | Izin mikrofon, kamera, lokasi pada aplikasi dari luar toko | OWL-A02 | 25 (integritas aplikasi) |
| 2 | Layanan aksesibilitas dan hamparan jendela | OWL-R01, R02 | 30 (perilaku runtime) |
| 3 | Sertifikat CA pengguna dan profil VPN | OWL-C01, C02 | 20 (konfigurasi) |
| 4 | Sumber pemasangan aplikasi, dan daftar larangan | OWL-A01, A03 | 25 (integritas aplikasi) |
| 5 | Integritas perangkat dan tingkat patch | OWL-D01, D02 | 15 (integritas perangkat) |
| 6 | Perilaku jaringan, metadata saja | OWL-N01, N02, N03 | 10 (perilaku jaringan) |

Ditambah OWL-X01, yang bukan sinyal perangkat melainkan syarat agar laporan
perangkat dipercaya sama sekali: attestation agent.

Katalog lengkapnya, beserta severitas, pemetaan MITRE ATT&CK Mobile, dan
tingkat keyakinan tiap metode, ada di
[`services/backend/rules/rules.yaml`](services/backend/rules/rules.yaml) dan
tampil apa adanya pada panel **Aturan & bobot**, yang ditarik dari lidah di
tepi kiri dashboard.

## Status indikator: yang tidak terbaca tidak dianggap lulus

Setiap laporan membawa status tiap indikator, bukan hanya nilainya. Daftar
kosong karena "sudah diperiksa dan memang bersih" tidak boleh terlihat sama
dengan daftar kosong karena "tidak dapat dibaca sama sekali".

| Status | Artinya | Akibatnya pada penilaian |
|---|---|---|
| `ok` | terbaca penuh | aturannya dijalankan |
| `partial` | sebagian terbaca | aturannya dijalankan atas bagian yang terbaca |
| `unavailable` | gagal dibaca saat itu | aturannya **dilewati**, dicatat di `skipped_rules` |
| `not_supported` | memang di luar jangkauan API | aturannya **dilewati**, dicatat di `skipped_rules` |

Aturan yang dilewati tidak dihitung lulus. Dashboard menampilkannya sebagai
indikator yang tidak dapat diperiksa, karena perangkat yang tidak dapat
diperiksa bukan perangkat yang aman.

Contoh nyata dari agent di emulator: `network_destinations` dilaporkan
`not_supported`, sebab tujuan jaringan per aplikasi memang tidak dapat dibaca
aplikasi biasa. OWL-N02 dan OWL-N03 karena itu tidak dijalankan.

## Skor yang dapat ditelusuri

Tiga sifat dijaga mesin skor, dan ketiganya dikunci oleh uji:

1. **Jumlah kontributor sama dengan skor.** Setiap poin dapat ditunjuk
   asalnya sampai ke aturan penyebabnya. Tidak ada bobot tersembunyi.
2. **Kategori jenuh pada bobotnya.** Sepuluh aplikasi sideload tidak lebih
   merah daripada tiga, sehingga satu kategori yang berisik tidak dapat
   memerahkan perangkat sendirian.
3. **Skor meluruh 5 poin per hari.** Temuan lama tidak menghukum perangkat
   selamanya, dan satu laporan bersih tidak langsung menghapus temuan berat.

Satu indikator di perangkat hampir selalu ambigu. Aturan yang bertanda
`corroborate` karena itu diturunkan satu tingkat severitas jika ia
satu-satunya yang menyala.

## Kepercayaan pada laporan: dibuktikan, bukan diklaim

Seluruh penilaian di bawah bergantung pada satu hal: bahwa laporan itu memang
datang dari agent asli pada perangkat yang belum dibongkar. Itu dibuktikan
dengan Android Key Attestation dan diperiksa **di OWL Core**, sepenuhnya luring.

```
agent                         OWL Core
  │  GET /api/enroll/challenge   │
  │ ───────────────────────────► │  tantangan acak, sekali pakai, 5 menit
  │  buat kunci EC di TEE atau   │
  │  StrongBox UNTUK tantangan   │
  │  POST /api/devices + rantai  │
  │ ───────────────────────────► │  verifikasi rantai sampai akar Google yang
  │                              │  disematkan; baca tingkat keamanan, keadaan
  │                              │  boot, dan identitas aplikasi; simpan kunci
  │  POST /api/telemetry         │
  │  + X-OWL-Signature           │
  │ ───────────────────────────► │  tanda tangan ECDSA atas badan laporan
```

| Yang dibuktikan rantai | Akibat jika tidak |
|---|---|
| Berujung pada akar attestation Google (`rules/google-attestation-roots.pem`) | OWL-X01, ditolak |
| Kunci lahir di TEE atau StrongBox, bukan perangkat lunak | OWL-X01, ditolak |
| Dibuat untuk tantangan yang baru diberikan | pendaftaran tidak diakui |
| Diminta paket agent OWL, dan penanda tangannya jika `OWL_AGENT_SIGNERS` diisi | pendaftaran tidak diakui |
| Boot terverifikasi dan bootloader terkunci, menurut perangkat keras | OWL-D01, ditolak |

Sesudah itu setiap laporan harus bertanda tangan kunci yang sama. Laporan
tanpa tanda tangan, bertanda tangan kunci lain, atau yang waktu pengumpulannya
tidak maju ditolak dan dicatat. Kunci yang sudah terbukti tidak dapat ditimpa
pendaftaran ulang yang tidak membawa rantai sah.

Klaim agent tentang dirinya (`key_attestation` pada telemetri) tidak lagi
dipakai untuk perangkat yang punya catatan attestation. `OWL_ATTESTATION`
mengatur perangkat yang belum punya:

| Nilai | Perangkat tanpa rantai sah |
|---|---|
| `verify` (bawaan) | tidak dipercaya, OWL-X01, ditolak |
| `claim` | klaim agent dipercaya. Untuk emulator, yang tidak punya kunci attestation Google, dan untuk telemetri contoh lewat curl |

**Terbukti pada perangkat fisik.** Infinix X6515 (Android 12) mendaftar dengan
rantai yang lolos sampai akar Google: kunci di TEE, boot terverifikasi,
bootloader terkunci. Laporan palsu atas nama perangkat itu, dengan token yang
benar tetapi tanpa tanda tangan atau dengan tanda tangan karangan, ditolak 401;
pendaftaran ulang tanpa rantai ditolak 409.

**Yang belum.** Masa berlaku sertifikat tidak ditegakkan, sebab rantai di
lapangan sering bertanggal aneh. Daftar pencabutan Google untuk kunci
attestation yang bocor belum diperiksa; pada jaringan tertutup daftar itu harus
dibawa masuk lewat berkas. Baru satu merek yang diuji.

## Dua lapis keputusan

Skor hanya menimbang yang ambigu. Empat keadaan diputus **sebelum** skor
dilihat, karena keempatnya pasti, bukan indikasi:

| Keadaan | Aturan | Akibat |
|---|---|---|
| Laporan kedaluwarsa (lebih tua dari `max_report_age_minutes`, bawaan 60) | gerbang | ditolak, tanpa karantina |
| Attestation agent tidak sah | OWL-X01 critical | ditolak dan dikarantina |
| Aplikasi di daftar larangan, lewat nama paket atau sidik penanda tangan | OWL-A03 | ditolak dan dikarantina |
| Integritas perangkat gagal: root, bootloader terbuka | OWL-D01 | ditolak dan dikarantina |

Aturan semacam ini bertanda `decisive` di `rules.yaml`. Tanpa lapis ini
perangkat ber-root hanya memperoleh 15 poin dan lolos, dan perangkat yang
berhenti melapor mempertahankan skor terakhirnya selamanya.

Lapis ini lahir dari uji pada perangkat fisik (Infinix X6515, Android 12)
yang membawa satu payload uji. Mesin versi pertama memberinya skor 40 dan
rekomendasi Step-up, sama persis dengan perangkat itu tanpa payload: aturan
sideload meloloskan APK yang dipasang manual, dan izin perekaman pada
WhatsApp serta Telegram mengisi kategori yang sama sampai jenuh. Sekarang
perangkat itu ditolak, dan tanpa payload skornya 25 dan lolos. Kedua sifat
itu dikunci uji.

## Keputusan akses

Keluarannya adalah **rekomendasi keputusan akses**. Pemblokiran yang
sungguh-sungguh menuntut integrasi dengan gateway, IAM, atau MDM satuan, dan
itu belum terpasang pada purwarupa ini. Dashboard menyebutnya demikian di
layar, bukan hanya di dokumen.

| Skor | Jaringan biasa | Sistem terklasifikasi |
|---|---|---|
| 0 sampai 29 | lolos | lolos |
| 30 sampai 69 | lolos dengan MFA | lolos dengan MFA |
| 70 sampai 89 | akses terbatas | **ditolak dan dikarantina** |
| 90 ke atas | **ditolak dan dikarantina** | **ditolak dan dikarantina** |

Ambang deny berbeda menurut kepekaan sumber daya, dan itulah yang dimaksud
Zero Trust: tidak ada satu ambang tunggal untuk seluruh sistem. Lihat catatan
di kepala [`app/pdp.py`](services/backend/app/pdp.py).

Nama resmi keputusannya, mengikuti Requirements §3.3: **Allow**, **Step-up**,
**Restrict**, **Deny / Quarantine**.

Attestation agent yang gagal mendahului seluruh perhitungan. Laporan
"perangkat bersih" dari agent yang tidak dapat membuktikan dirinya build asli
tidak berarti apa-apa, dan ditolak tanpa melihat skornya.

---

## Tampilan

Hitam dengan emas, mengikuti lambang. Satu warna aksen saja dengan tiga
tingkat terang; jingga dan merah dipertahankan **hanya** untuk risiko tinggi
dan kritis, sebab skala yang seluruhnya emas membuat perangkat kritis
terlihat sama dengan perangkat bersih. Lambangnya berkas PNG beralfa di
`frontend/src/assets/`, dipakai ulang sebagai favicon tanpa tulisan.

## Halaman depan dan dashboard

Latar bergerak digambar kanvas, bukan video: jaring sinyal emas dengan satu
pita pemindai yang turun. Berkas video berukuran megabyte akan merusak janji
yang paling sering diucapkan produk ini, yaitu berjalan di jaringan satuan
yang terisolasi. Latar berhenti ketika tab tidak terlihat, mengecil sendiri
pada layar kecil, diam pada `prefers-reduced-motion`, dan diredupkan di
dashboard supaya angka dan tabel tetap yang paling terbaca.

Kunjungan pertama pada satu sesi dibuka layar pembuka tiga detik; kunjungan
berikutnya melewatinya, sebab demo menuntut halaman dimuat ulang berkali-kali.
Perpindahan antara halaman depan dan dashboard meredup lebih dahulu, dan
seluruh gerak dimatikan pada `prefers-reduced-motion`.

Yang terbuka pertama kali adalah halaman depan di `/`: masalah, enam sinyal,
cara kerja, hasil gerbang, dan batas klaim yang dinyatakan di depan. Dashboard
ada di `/dashboard`, di belakang layar kunci. Jalur `/dashboard` yang dibuka
langsung tetap sampai, sebab nginx dan `vercel.json` mengarahkan setiap jalur
ke `index.html`.

## Menjalankan

### Cara cepat, Docker

```bash
cd owl
docker compose up --build
```

Dashboard di <http://localhost:8080>, API di <http://localhost:8000/docs>.

### Cara pengembangan

```bash
cd owl
make setup
make backend     # terminal 1, :8000
make frontend    # terminal 2, :5173
```

Buka <http://localhost:5173>, tekan **Muat dua perangkat contoh**, lalu
**Jalankan gerbang**.

### Demo tanpa browser

```bash
make demo
```

Memuat dua perangkat, menjalankan gerbang terhadap keduanya, lalu mencetak
baris CEF yang dikirim ke SIEM.

### Uji

```bash
make test
```

---

## Arsitektur

```
    Perangkat                  OWL Core (on-prem)                Integrasi
 ┌──────────────┐         ┌───────────────────────────┐      ┌──────────────┐
 │ Agent Kotlin │  HTTPS  │  API  ──►  Mesin aturan   │      │ Kartika      │
 │  6 sinyal    │ ──────► │   │        12 aturan      │ ───► │ CSIRT        │
 │  attestation │  token  │   │            │          │ STIX │              │
 └──────────────┘         │   │        Skor risiko    │ CEF  └──────────────┘
                          │   │         0 - 100       │      ┌──────────────┐
                          │   │            │          │ ───► │ SIEM satuan  │
                          │   ▼            ▼          │      └──────────────┘
                          │ SQLite  ◄─ Zero Trust PDP │      ┌──────────────┐
                          │ perangkat    rekomendasi  │ ───► │ Analitik     │
                          │ penilaian    akses        │ skor │ insider      │
                          │ keputusan        │        │      └──────────────┘
                          │ penolakan        ▼        │
                          │ audit        Dashboard    │
                          └───────────────────────────┘
```

Diagram yang lebih rinci, termasuk komponen yang belum dibangun, ada di
[`docs/OWL-deepdive.md`](../docs/OWL-deepdive.md) §8.1.

## API

Dokumentasi OpenAPI otomatis tersedia di `/docs` saat backend berjalan.
Ringkasnya:

| Metode | Jalur | Guna | Autentikasi |
|---|---|---|---|
| GET | `/health` | status layanan, mode air-gapped, keadaan autentikasi | terbuka |
| GET | `/api/enroll/challenge?device_id=` | tantangan sekali pakai untuk Key Attestation | `X-OWL-Token` |
| POST | `/api/devices` | registrasi perangkat, membawa rantai attestation | `X-OWL-Token` |
| POST | `/api/telemetry` | kirim laporan postur | `X-OWL-Token`, dan `X-OWL-Signature` jika perangkat punya kunci |
| GET | `/api/devices` | daftar perangkat dengan skor terakhir | `X-OWL-Api-Key` |
| GET | `/api/devices/{id}` | detail, riwayat, status indikator | `X-OWL-Api-Key` |
| POST | `/api/gate/{id}?resource=` | minta rekomendasi keputusan akses | `X-OWL-Api-Key` |
| GET | `/api/devices/{id}/stix` | bundle STIX 2.1 | `X-OWL-Api-Key` |
| GET | `/api/devices/{id}/cef` | baris CEF | `X-OWL-Api-Key` |
| POST | `/api/demo/seed`, `/api/demo/reset` | muat atau kosongkan data contoh; hilang jika `OWL_DEMO=false` | `X-OWL-Api-Key` |
| GET | `/api/rejects` | telemetri yang ditolak beserta alasannya | `X-OWL-Api-Key` |
| GET | `/api/policy` | bobot, ambang, dan riwayat perubahannya | `X-OWL-Api-Key` |
| PUT | `/api/policy/weight` | ubah bobot kategori | `X-OWL-Admin` |
| PUT | `/api/policy/threshold` | ubah ambang keputusan | `X-OWL-Admin` |
| GET | `/api/catalog` | katalog aturan dan bobot | `X-OWL-Api-Key` |
| GET | `/api/retention` | kebijakan retensi dan cacah baris tersimpan | `X-OWL-Api-Key` |
| POST | `/api/retention/sweep` | hapus data lampau sekarang | `X-OWL-Admin` |
| WS | `/ws?key=` | siaran perubahan ke dashboard | kunci baca lewat kueri |

`X-OWL-Api-Key` hanya ditegakkan jika `OWL_API_KEY` diisi. Dibiarkan kosong,
API baca terbuka, dan `/health` menyatakannya sebagai `api_auth: terbuka`.
Itu hanya sah untuk purwarupa di jaringan terisolasi.

## Kata sandi dashboard

Dashboard dibuka lewat layar kunci. Kata sandi yang diketik diteruskan apa
adanya sebagai `X-OWL-Api-Key`, jadi yang memutuskan benar atau salah adalah
OWL Core: kata sandi yang keliru membuat seluruh API baca menjawab 401 dan
tidak ada data yang keluar. Kuncinya disimpan di `sessionStorage`, sehingga
tab yang ditutup menutup sesinya.

Bawaannya `adminowl`, disetel lewat `OWL_API_KEY` di `docker-compose.yml` dan
`Makefile`. **Ganti pada penggelaran satuan.**

Tombol **Keluar** di bilah atas menghapus kunci dari `sessionStorage` lalu
melempar kembali ke halaman depan, bukan menyodorkan kotak kata sandi pada
orang yang baru saja pamit. Kartu kata sandi juga punya tombol tutup dan
menerima Esc, dan keduanya berakhir di halaman depan. Kata sandi yang benar
tidak langsung menyingkap layar: ada layar pendek "membuka dashboard", lalu
buram di belakangnya luruh.

Layar kunci juga punya tombol **Masuk sebagai tamu**, dan tamu memperoleh akses
yang sama dengan admin: tombol itu memakai kunci baca bawaan. Jadi pada
purwarupa ini layar kunci menahan tampilan, bukan membatasi hak, dan layarnya
mengatakan itu sendiri. Begitu `OWL_API_KEY` diganti, kunci bawaannya ditolak
OWL Core dan mode tamu berhenti bekerja tanpa perlu dicabut. Pemisahan peran
pada antarmuka dan daftar pengguna per orang belum dibangun.

Pada tautan publik yang hanya memuat rekaman, tidak ada OWL Core yang
menjawab, sehingga layar kunci di sana hanya menahan tampilan dan tidak
melindungi apa pun. Layar itu menyatakannya sendiri ketika hal itu terjadi.

## Retensi data dan pencatatan

| Variabel | Bawaan | Guna |
|---|---|---|
| `OWL_RETENTION_DAYS` | `90` | umur maksimum penilaian, keputusan, event SOC, dan penolakan |
| `OWL_RETENTION_SWEEP_HOURS` | `6` | jarak antar penyapuan; satu penyapuan juga jalan saat layanan mulai |
| `OWL_LOG_FILE` | `owl.log` | berkas log JSON per baris, berputar pada 5 MB, 3 salinan |

Penyapuan menghapus baris dari `assessments`, `decisions`, `soc_events`, dan
`rejects`. Yang **tidak** dihapus: identitas perangkat yang masih terdaftar,
dan `policy_audit`, sebab kewajiban audit perubahan kebijakan justru menuntut
jejak itu tetap ada.

Log tidak pernah memuat isi telemetri, kunci API, token administrasi, atau
tanda tangan webhook, dan sifat itu dikunci uji.

## Dukungan Android

| Hal | Nilai |
|---|---|
| minSdk | 29 (Android 10) |
| compileSdk dan targetSdk | 35 (Android 15) |
| Diuji pada | Emulator Android 15, API 35, arm64-v8a; Infinix X6515, Android 12, API 31 (perangkat fisik) |
| Belum diuji | StrongBox sungguhan (Infinix itu memakai TEE), merek lain, Android 13 sampai 15 pada perangkat fisik |

Izin yang diminta dan alasan tiap izin ada di `agent/android/app/src/main/AndroidManifest.xml`,
dan batas yang tidak dapat dilampaui aplikasi biasa ada di [`agent/README.md`](agent/README.md).

## Hasil pengujian

```
81 uji lulus     (cd owl && make test)
```

| Berkas | Cakupan |
|---|---|
| `tests/test_scoring.py` | angka demo 18 dan 87, kejenuhan kategori, peluruhan, korelasi multi-sinyal, attestation, sumber pemasangan, aturan penentu, laporan kedaluwarsa |
| `tests/test_attestation.py` | verifikasi rantai (akar, tantangan, tingkat keamanan, rantai yang diubah), laporan bertanda tangan, putar ulang, bootloader terbuka menurut perangkat keras, identitas aplikasi, pengambilalihan lewat daftar ulang |
| `tests/test_export.py` | bentuk bundle STIX 2.1, pelolosan karakter CEF, stabilitas tanda tangan HMAC |
| `tests/test_api.py` | registrasi bertoken, validasi dan pencatatan penolakan, empat tingkat risiko, reproduksibilitas skor, autentikasi gerbang dan ekspor, mode demo, kebijakan yang bertahan melewati restart |
| `tests/test_retention.py` | data lampau benar-benar terhapus, jejak audit selamat, penyapuan menuntut token admin, log JSON tanpa rahasia |

Pemetaan lengkap tiap kebutuhan ke kode dan buktinya ada di
[`docs/PEMENUHAN-REQUIREMENTS.md`](../docs/PEMENUHAN-REQUIREMENTS.md).

## Struktur

```
owl/
  services/backend/      OWL Core: FastAPI, SQLite
    app/rules.py         mesin aturan, satu fungsi per id aturan
    app/scoring.py       skor 0-100, kejenuhan kategori, peluruhan
    app/policy.py        bobot dan ambang yang dapat diubah saat berjalan
    app/pdp.py           Policy Decision Point
    app/stix.py app/cef.py app/soc.py   ekspor ke CSIRT dan SIEM
    rules/rules.yaml     katalog aturan, parameter, daftar izin
  agent/android/         agent Kotlin, enam sinyal, attestation
  frontend/              dashboard React: gerbang, perangkat, aturan, SOC
  tests/                 uji skor, gerbang, dan ekspor
docs/                    proposal, analisis mendalam, deck
```

## Integrasi

**Kartika CSIRT.** Setiap penilaian menghasilkan bundle STIX 2.1 yang dikirim
lewat webhook bertanda tangan HMAC-SHA256, dan satu baris CEF lewat Syslog.
Pada mode air-gapped keduanya tetap dicatat di basis data lokal dengan status
belum terkirim, bukan dibuang diam-diam.

**Analitik insider threat satuan.** Skor risiko perangkat menjadi input
penilaian insider threat: perangkat yang terkompromi adalah indikator awal
akun atau personel yang terkompromi. OWL berperan sebagai sensor endpoint,
sedangkan korelasi perilaku dan orkestrasinya dikerjakan sistem analitik
satuan lewat jalur STIX dan CEF yang sama.

**MDM.** OWL melengkapi Knox dan Intune, tidak menggantikannya. MDM mengelola
dan menegakkan; OWL menilai dan memutuskan.

## Batas yang dinyatakan di depan

OWL bekerja pada lapisan aplikasi. Implan baseband, IMSI catcher, rootkit
firmware, dan intersepsi RF berada di bawah lapisan itu dan di luar jangkauan
API mana pun yang dapat dipanggil aplikasi. Keduanya ditangani sistem lain.

Daftar batas yang lebih rinci, termasuk apa yang tidak dapat dibaca agent
tanpa hak istimewa, ada di [`agent/README.md`](agent/README.md) dan
[`docs/OWL-deepdive.md`](../docs/OWL-deepdive.md) §2.2 dan §6.2.
