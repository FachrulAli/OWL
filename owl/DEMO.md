# Naskah Demo — Dua Perangkat, Satu Gerbang

Tiga menit. Satu layar. Tidak ada slide di tengahnya.

## Sebelum mulai

```bash
cd owl
docker compose up --build       # atau: make backend + make frontend
```

Buka halaman depan, lalu tekan **Buka dashboard**. Layar kunci muncul:
masukkan kata sandi `adminowl` (bawaan; `OWL_API_KEY` pada penggelaran
satuan), atau tekan **Masuk sebagai tamu**. Setelah terbuka, biarkan di tab
**Gerbang**. Jangan tekan apa pun dulu.

Siapkan satu terminal di samping, sudah berada di folder `owl/`.

---

## 0:00 — Dua perangkat datang

> "Dua perangkat dinas. Satu milik bintara di satuan tempur, satu milik
> perwira menengah di staf komando. Keduanya baru saja mengirim laporan
> postur ke OWL."

Tekan **Muat dua perangkat contoh**.

Dua kartu muncul. Tunjuk cincin skornya: **18** dan **87**.

> "Angka itu tidak ditulis tangan. Keduanya dihitung dari telemetri yang
> bentuknya persis sama dengan yang dikirim agent Android."

## 0:30 — Dari mana angkanya

Tunjuk daftar kontributor di kartu kanan.

> "Delapan temuan. Layanan aksesibilitas di luar daftar izin, nilainya 19.
> Aplikasi yang dipasang manual dari berkas, 12,5, dan aplikasi yang sama
> memegang izin mikrofon dan kamera, 12,5 lagi. Sertifikat CA yang dipasang
> pengguna, 12. Jumlah seluruhnya 87, persis skornya. Setiap poin dapat
> ditunjuk asalnya."

Tarik **lidah "Aturan & bobot"** di tepi kiri layar sebentar.

> "Dan ini seluruh aturannya, beserta bobot dan tingkat keyakinan tiap
> metode. Yang keyakinannya rendah ditulis rendah."

Sekarang buka tab **Perangkat**, klik salah satu baris.

> "Dan ini yang jarang ada di produk sejenis: status tiap indikator. Yang
> tidak dapat dibaca ditulis Unavailable atau Not Supported, bukan dikirim
> sebagai daftar kosong yang terlihat seperti bersih. Aturan yang
> indikatornya tidak terbaca dilewati, dan tidak dihitung lulus. Perangkat
> yang tidak dapat diperiksa bukan perangkat yang aman."

Kembali ke **Gerbang**.

## 1:30 — Gerbangnya

Pastikan **Sistem terklasifikasi** terpilih. Tekan **Jalankan gerbang**.

Kartu kiri menjadi hijau: **LOLOS**.
Kartu kanan menjadi amber: **DITOLAK**, dengan baris karantina di bawahnya.

> "Perangkat bintara lolos. Perangkat perwira ditolak dan dikarantina,
> eskalasi naik ke komando. Inilah gerbangnya."

Jika juri bertanya apakah ini benar-benar memblokir:

> "Yang kami keluarkan adalah rekomendasi keputusan akses. Pemblokirannya
> dilakukan gateway, IAM, atau MDM satuan lewat integrasi, dan itu belum
> terpasang di purwarupa. Kami menyebutnya rekomendasi, dan dashboard pun
> menulisnya begitu di layar."

Sekarang tekan **Jaringan biasa**, lalu **Jalankan gerbang** sekali lagi.

Kartu kanan berubah menjadi **TERBATAS**.

> "Perangkat yang sama, sumber daya yang berbeda, keputusan yang berbeda.
> Ambang deny-nya 70 untuk sistem terklasifikasi dan 90 untuk jaringan biasa.
> Itulah Zero Trust: tidak ada satu ambang tunggal untuk segalanya."

## 2:00 — Yang keluar ke SOC

Buka tab **SOC / CSIRT**. Klik satu baris STIX.

> "Setiap penilaian mengeluarkan bundle STIX 2.1 ke Kartika CSIRT lewat
> webhook bertanda tangan HMAC, dan satu baris CEF ke SIEM. Ini payload yang
> benar-benar dikirim, diambil kembali dari basis datanya, bukan contoh yang
> ditulis untuk slide."

Terakhir, buka tab **Operasi** dan cabut satu perangkat.

> "Dan ini yang dikerjakan orang, bukan mesin. Perangkat yang hilang
> dicabut di sini, dan gerbang langsung menolaknya dengan alasan itu,
> mendahului skor. Pengecualian pun ada, tetapi hanya menutup skor, dan
> hanya sampai waktunya habis: ia tidak dapat meloloskan perangkat yang
> dicabut, laporan yang kedaluwarsa, attestation yang gagal, atau aturan
> penentu."

Tunjuk status *tersimpan lokal*.

> "Statusnya belum terkirim karena ini mode air-gapped, dan tidak ada tujuan
> yang dikonfigurasi. Event tetap tersimpan untuk diambil petugas. Tidak ada
> satu paket pun yang keluar dari jaringan ini."

## 2:45 — Penutup

> "Kita tidak bisa melindungi apa yang tidak bisa kita nilai. OWL memberi
> penilaian itu, di dalam tembok kedaulatan kita sendiri."

---

## Jika ditanya: "bagaimana dengan perangkat yang skornya rendah tetapi jelas berbahaya?"

> "Skor hanya menimbang yang ambigu. Yang pasti tidak ditimbang: aplikasi di
> daftar larangan, perangkat ber-root, attestation yang gagal, dan laporan
> yang sudah kedaluwarsa ditolak tanpa melihat skor. Kami menemukan perlunya
> lapis ini saat OWL dijalankan pada HP sungguhan yang membawa payload uji:
> skornya hanya 40, dan versi lama meloloskannya dengan MFA."

Buktinya dapat diperlihatkan tanpa browser:

```bash
curl -s -X POST localhost:8000/api/telemetry -H 'X-OWL-Token: owl-demo-token' \
     -H 'Content-Type: application/json' -d @samples/perangkat-berisiko.json
```

## Jika demonya macet

| Gejala | Tindakan |
|---|---|
| Kartu kosong, muncul "Backend tidak terjangkau" | `make backend`, tunggu baris `[owl] 12 aturan dimuat` |
| Skor bukan 18 dan 87 | `make test`; uji akan menyebut aturan mana yang berubah |
| Tab SOC kosong | Jalankan gerbang lebih dahulu, event dibuat saat penilaian |
| Semuanya mati | `make demo` menjalankan seluruh alur di terminal, tanpa browser |

## Angka yang disebut, dan dari mana

| Angka | Asal |
|---|---|
| 18 | 10 (satu aplikasi bawaan tanpa sumber tercatat) + 6 (patch 75 hari) + 2 (tujuan jaringan baru) |
| 87 | 30 (runtime, jenuh) + 25 (aplikasi, jenuh) + 20 (konfigurasi, jenuh) + 6 (patch) + 6 (unggahan saat idle) |
| 70 dan 90 | ambang deny, `app/config.py`, dapat disetel satuan lewat variabel lingkungan |

Keduanya dikunci oleh `tests/test_scoring.py`. Jika seseorang menyetel bobot
tanpa memperbarui naskah ini, uji itulah yang memberi tahu, bukan juri.
