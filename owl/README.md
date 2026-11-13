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
| 1 | Izin mikrofon, kamera, lokasi yang berlebihan | OWL-A02 | 25 (integritas aplikasi) |
| 2 | Layanan aksesibilitas dan hamparan jendela | OWL-R01, R02 | 30 (perilaku runtime) |
| 3 | Sertifikat CA pengguna dan profil VPN | OWL-C01, C02 | 20 (konfigurasi) |
| 4 | Sumber pemasangan aplikasi | OWL-A01 | 25 (integritas aplikasi) |
| 5 | Integritas perangkat dan tingkat patch | OWL-D01, D02 | 15 (integritas perangkat) |
| 6 | Perilaku jaringan, metadata saja | OWL-N01, N02, N03 | 10 (perilaku jaringan) |

Ditambah OWL-X01, yang bukan sinyal perangkat melainkan syarat agar laporan
perangkat dipercaya sama sekali: attestation agent.

Katalog lengkapnya, beserta severitas, pemetaan MITRE ATT&CK Mobile, dan
tingkat keyakinan tiap metode, ada di
[`services/backend/rules/rules.yaml`](services/backend/rules/rules.yaml) dan
tampil apa adanya di tab **Aturan & bobot** pada dashboard.

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
| POST | `/api/devices` | registrasi perangkat | terbuka |
| POST | `/api/telemetry` | kirim laporan postur | `X-OWL-Token` |
| GET | `/api/devices` | daftar perangkat dengan skor terakhir | `X-OWL-Api-Key` |
| GET | `/api/devices/{id}` | detail, riwayat, status indikator | `X-OWL-Api-Key` |
| POST | `/api/gate/{id}?resource=` | minta rekomendasi keputusan akses | terbuka |
| GET | `/api/devices/{id}/stix` | bundle STIX 2.1 | terbuka |
| GET | `/api/devices/{id}/cef` | baris CEF | terbuka |
| GET | `/api/rejects` | telemetri yang ditolak beserta alasannya | `X-OWL-Api-Key` |
| GET | `/api/policy` | bobot, ambang, dan riwayat perubahannya | `X-OWL-Api-Key` |
| PUT | `/api/policy/weight` | ubah bobot kategori | `X-OWL-Admin` |
| PUT | `/api/policy/threshold` | ubah ambang keputusan | `X-OWL-Admin` |
| GET | `/api/catalog` | katalog aturan dan bobot | `X-OWL-Api-Key` |
| WS | `/ws` | siaran perubahan ke dashboard | terbuka |

`X-OWL-Api-Key` hanya ditegakkan jika `OWL_API_KEY` diisi. Dibiarkan kosong,
API baca terbuka, dan `/health` menyatakannya sebagai `api_auth: terbuka`.
Itu hanya sah untuk purwarupa di jaringan terisolasi.

## Dukungan Android

| Hal | Nilai |
|---|---|
| minSdk | 29 (Android 10) |
| compileSdk dan targetSdk | 35 (Android 15) |
| Diuji pada | Emulator Android 15, API 35, arm64-v8a |
| Belum diuji | perangkat fisik, StrongBox sungguhan, verdict Play Integrity yang sah |

Izin yang diminta dan alasan tiap izin ada di `agent/android/app/src/main/AndroidManifest.xml`,
dan batas yang tidak dapat dilampaui aplikasi biasa ada di [`agent/README.md`](agent/README.md).

## Hasil pengujian

```
38 uji lulus     (cd owl && make test)
```

| Berkas | Cakupan |
|---|---|
| `tests/test_scoring.py` | angka demo 18 dan 87, kejenuhan kategori, peluruhan, korelasi multi-sinyal, attestation |
| `tests/test_export.py` | bentuk bundle STIX 2.1, pelolosan karakter CEF, stabilitas tanda tangan HMAC |
| `tests/test_api.py` | registrasi, validasi dan pencatatan penolakan, empat tingkat risiko, reproduksibilitas skor, autentikasi, perubahan kebijakan |

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
