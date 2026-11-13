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

| Skor | Jaringan biasa | Sistem terklasifikasi |
|---|---|---|
| 0 sampai 29 | lolos | lolos |
| 30 sampai 69 | lolos dengan MFA | lolos dengan MFA |
| 70 sampai 89 | akses terbatas | **ditolak dan dikarantina** |
| 90 ke atas | **ditolak dan dikarantina** | **ditolak dan dikarantina** |

Ambang deny berbeda menurut kepekaan sumber daya, dan itulah yang dimaksud
Zero Trust: tidak ada satu ambang tunggal untuk seluruh sistem. Lihat catatan
di kepala [`app/pdp.py`](services/backend/app/pdp.py).

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

## Struktur

```
owl/
  services/backend/      OWL Core: FastAPI, SQLite
    app/rules.py         mesin aturan, satu fungsi per id aturan
    app/scoring.py       skor 0-100, kejenuhan kategori, peluruhan
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

**TRINETRA.** Skor risiko perangkat menjadi input penilaian insider threat:
perangkat yang terkompromi adalah indikator awal akun atau personel yang
terkompromi. OWL menjadi sensor endpoint, TRINETRA mengerjakan korelasi
perilaku dan orkestrasinya.

**MDM.** OWL melengkapi Knox dan Intune, tidak menggantikannya. MDM mengelola
dan menegakkan; OWL menilai dan memutuskan.

## Batas yang dinyatakan di depan

OWL bekerja pada lapisan aplikasi. Implan baseband, IMSI catcher, rootkit
firmware, dan intersepsi RF berada di bawah lapisan itu dan di luar jangkauan
API mana pun yang dapat dipanggil aplikasi. Keduanya ditangani sistem lain.

Daftar batas yang lebih rinci, termasuk apa yang tidak dapat dibaca agent
tanpa hak istimewa, ada di [`agent/README.md`](agent/README.md) dan
[`docs/OWL-deepdive.md`](../docs/OWL-deepdive.md) §2.2 dan §6.2.
