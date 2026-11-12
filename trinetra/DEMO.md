# TRINETRA — Panduan Demo

Alur demo 7 menit untuk **Kartika Cyber Hackathon 2026**. Urutannya disusun
supaya pertanyaan juri terjawab sebelum ditanyakan.

---

## 0 · Sebelum mulai (5 menit sebelum tampil)

```bash
colima start --cpu 4 --memory 6 --disk 30      # mesin Docker (bukan Docker Desktop)
cd trinetra && docker compose up -d --build
```

Tunggu sampai warm-up selesai — backend melatih baseline pada **4.000 event
pertama tanpa menilai apa pun**:

```bash
docker compose logs -f backend | grep -E "warm-up|sigma|ioc|yara"
```

Yang harus terlihat:

```
[sigma] dimuat: 16 aturan atomik, 10 korelasi, 0 ditolak
[ioc] dimuat 3166 indikator dari 15 berkas (15 kampanye)
[yara] 9 aturan dimuat (YARA-X 1.23.0)
[consumer] warm-up complete (4000 events); baseline trained, scoring enabled
```

Buka: dashboard <http://localhost:5173> · API <http://localhost:8000/docs>

**Rencana cadangan:** kalau Docker bermasalah, buka
<https://trinetra-id.vercel.app> — frontend otomatis jatuh ke mesin demo
in-browser dengan skenario yang sama (badge **DEMO LANGSUNG** muncul di
console). Semua yang di bawah tetap bisa ditunjukkan kecuali endpoint API.

---

## 1 · Masalahnya, dalam 40 detik

Mulai dari beranda, bukan dari dashboard.

> "Spyware kelas Pegasus masuk ke HP **tanpa korban menekan apa pun**. Tidak
> ada tautan diklik, tidak ada lampiran dibuka. Antivirus tidak menolong:
> tidak ada berkas untuk dipindai, dan sampelnya tidak pernah dipublikasikan.
> Untuk TNI AD, HP pejabat dan perwira intelijen adalah sasaran bernilai
> tinggi — dan satu HP yang disadap membocorkan lebih banyak daripada satu
> jaringan yang ditembus."

---

## 2 · Gagasan intinya, sebelum menunjukkan apa pun

Ini bagian yang menentukan. Jangan lewati.

> "Satu indikator di HP **selalu** ambigu. HP panas? Mungkin main game.
> Unggahan besar tengah malam? Mungkin backup iCloud. Pesan dari nomor tak
> dikenal? Mungkin ojol.
>
> Yang **tidak** ambigu adalah beberapa indikator menyala **berurutan**, pada
> satu perangkat, dalam jendela waktu pendek, sementara pemiliknya tidak
> menyentuh HP sama sekali.
>
> TRINETRA tidak mencari *apa* malware-nya. TRINETRA mencari *urutan*."

---

## 3 · Dashboard — sebaran nasional (1 menit)

Buka **#/console**.

- Peta: 21 Kodam + Mabes. Node merah = ada HP bermasalah di komando itu.
- Rail kanan: **"Rantai kill-chain terbukti"** — tunjuk angka ini, bukan
  jumlah alarm. Bedanya penting dan juri akan menghargainya.
- Aliran langsung: baris merah bertanda **⛓ RANTAI TERBUKTI** menampilkan
  urutan tahap, misalnya
  `Pengiriman → Eksploitasi → Implan Aktif → Kendali Jarak Jauh → Pengumpulan Data`.

Klik salah satu node merah → kartu komando per-Kodam.

---

## 4 · Timeline kill-chain — inti demo (2 menit)

Scroll ke panel **"Rantai Terbaru — Rinci"**, atau klik HP Pangdam di tabel.

Tunjuk satu per satu:

| Yang ditunjuk | Yang dikatakan |
|---|---|
| Badge **BERURUTAN** | "Ini `temporal_ordered` — Sigma menuntut tahapnya terjadi dalam urutan ini, bukan sembarang urutan." |
| Jarak antar tahap (`+11s`, `+34s`) | "Jarak waktu nyata. Serangan ini berjalan dalam 92 detik." |
| `rantai 1 menit 32 detik dalam jendela 10 menit` | "Aturan mengizinkan 10 menit; yang terjadi jauh lebih rapat. Itu memperkuat temuan, bukan melemahkan." |
| Blok merah **"perangkat idle"** | "Seluruh tahap terjadi saat layar mati, tanpa sentuhan. Pemegang HP tidak melakukan apa pun. **Inilah definisi zero-click.**" |
| **Tindakan disarankan: Isolasi perangkat** | "Engine tidak berhenti di temuan — ia mengusulkan tindakan, dan MDM yang mengeksekusi." |
| Tag MITRE (T1203, T1660…) | "Dipetakan ke ATT&CK Mobile, jadi bisa dibandingkan dengan kerangka kerja mana pun." |

---

## 5 · Pembuktian: tidak berisik (1 menit)

Pertanyaan juri yang paling tajam biasanya: *"bagaimana kalian tahu ini bukan
alarm palsu?"* Jawab sebelum ditanya.

Buka tabel **HP Dinas Berisiko Tertinggi**:

> "29 HP dipantau. Hanya 6 yang merah — dan semuanya memang yang kami
> suntik serangan. 23 sisanya **nol**. Termasuk HP Pama Satsiber yang
> perilakunya memang berat dan aneh — banyak trafik, HP sering panas karena
> kompilasi dan VPN. Itu sengaja ada di data untuk menguji apakah detektor
> kami ikut menuduh orang yang kerjanya memang tidak biasa. Tidak."

Lalu jalankan uji di depan juri (12 detik):

```bash
python3 tests/selftest_mobile.py
```

```
HASIL: LULUS — 6/6 rantai terdeteksi, 0 false positive korelasi
```

> "0,3% event normal memang menyalakan satu indikator atomik. Tidak satu pun
> menjadi kasus. Itu bukan kebetulan — itu yang dirancang."

---

## 6 · Transparansi: aturan bisa diaudit (45 detik)

Buka **#/deteksi**.

> "Deteksi kami bukan kotak hitam. 26 aturan dalam **format Sigma** —
> standar terbuka, spesifikasinya domain publik. Setiap aturan mencantumkan
> bobotnya, field yang dibacanya, dan **false positive yang kami akui
> sendiri**. Aturan atomik bobotnya sengaja rendah, 8 sampai 45. Tuduhan
> hanya lahir dari correlation rule. Dan karena ini Sigma, aturannya bisa
> dibagikan antar satuan sebagai berkas teks biasa."

Klik satu chip tahap di kartu correlation rule → aturan atomik penyusunnya
terbuka lengkap dengan `condition`-nya.

---

## 7 · Empat lapisan + kejujuran batas (1 menit)

Scroll ke bagian **lapisan intel** di halaman yang sama.

> "Satu lapisan selalu bisa dikalahkan. Signature kalah oleh zero-day,
> perilaku saja terlalu bising, intel saja kedaluwarsa. Kami menumpuk empat:
>
> **perilaku** (Sigma) untuk yang belum dikenal siapa pun ·
> **intel** 3.166 indikator dari 15 kampanye nyata — Pegasus dari Amnesty
> International, Predator, Candiru, KingSpawn ·
> **konten** YARA-X untuk APK sideload ·
> **anomali** Isolation Forest untuk yang lolos ketiganya."

Lalu — dan ini penting — sebutkan batasnya lebih dulu daripada juri:

> "Dua hal yang kami **tidak** klaim.
>
> Satu: deteksi real-time di iPhone tidak mungkin dilakukan aplikasi App
> Store mana pun. iOS tidak memberi API untuk proses sistem. Jalur iOS kami
> **periodik dan retrospektif** — pemegang HP menarik bundel diagnostik, kami
> analisis. Itu cara kerja MVT Amnesty dan iShutdown Kaspersky, dan seluruh
> pengungkapan Pegasus di dunia dilakukan begitu.
>
> Dua: crash proses sistem Android butuh agent sebagai system app pada
> perangkat yang di-provision Device Owner. Di prototipe ini kami pakai
> proksinya — lonjakan termal saat idle. Versi presisi sah secara teknis
> untuk HP dinas milik organisasi, dan itu roadmap, bukan klaim."

Opsional, bila ada waktu — tunjukkan sweep iOS bekerja:

```bash
python3 tests/test_ios_sweep.py
```

```
putusan : COMPROMISED   skor: 86.5
  IOC  BTMOB      domain-name   arbsniper.com          di networkextension.log
  IOC  KingSpawn  process-name  com.apple.avcapture    di crash report
  CRASH parser IMTransferAgent  3× (EXC_BAD_ACCESS)
```

---

## 8 · Privasi — penutup (30 detik)

> "Terakhir, dan ini yang menentukan apakah program ini layak digelar ke
> pasukan. Agent kami **tidak pernah** mengambil isi pesan, nomor telepon,
> kontak, lokasi, atau rekaman apa pun. Pengirim pesan hanya hash satu arah.
> Agent berjalan **terbuka** — ada notifikasi tetap di status bar, dan
> prajurit bisa menghentikannya.
>
> Kami mengadopsi *Consensual Use Restriction* dari lisensi MVT secara
> sukarela, walaupun tidak diwajibkan. Alat pemantau yang bersembunyi dari
> pemakainya akan berperilaku persis seperti stalkerware yang ia deteksi."

---

## Lampiran A · Demo API (bila juri minta bukti teknis)

```bash
# katalog aturan — deteksi sebagai kode
curl -s localhost:8000/sigma/rules | jq '{atomik: (.atomic|length), korelasi: (.correlation|length)}'

# status lapisan intel
curl -s localhost:8000/indicators | jq '{indikator, kampanye: (.campaigns|length)}'

# rantai yang terbukti
curl -s 'localhost:8000/chains?limit=3' | jq '.[] | {corr_id, entity_id, span_s, kill_chain}'

# pindai APK dengan YARA-X
curl -s -X POST localhost:8000/scan/apk \
  -H 'X-Trinetra-Token: trinetra-demo-token' -F file=@contoh.apk | jq '{verdict, score, matches: [.matches[].rule]}'

# sweep forensik iOS
curl -s -X POST localhost:8000/sweep/ios \
  -H 'X-Trinetra-Token: trinetra-demo-token' -F file=@sysdiagnose.tar.gz | jq '{verdict, score, ioc_hits}'

# statistik pipeline
curl -s localhost:8000/stats | jq '{events, chains, signals, alerts}'
```

## Lampiran B · Agent Android nyata (opsional, nilai tambah besar)

```bash
cd agent/android
./gradlew assembleDebug \
  -PtrinetraBase=http://192.168.1.10:8000 \
  -PtrinetraDeviceId=hp-kodam-5-01 \
  -PtrinetraToken=trinetra-demo-token
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Di HP: buka aplikasi → aktifkan **Akses Penggunaan** dan **Akses Notifikasi**
(dua tombolnya ada di layar) → **Simpan & mulai pemantauan**.

Status dinaikkan oleh event nyata, dan `label_scenario` pada event dari agent
adalah `live_agent` — jadi di dashboard bisa dibedakan dari data simulator.

> **Catatan jujur:** agent ini **belum pernah dikompilasi maupun dijalankan** —
> tidak ada APK, dan belum ada wrapper Gradle-nya. Kompilasi pertama
> kemungkinan masih memunculkan beberapa galat yang harus dibereskan, jadi
> jangan dijadwalkan tepat sebelum tampil dan jangan dijanjikan ke juri sebelum
> benar-benar berjalan. Demo utama tetap simulator.
>
> **Tidak ada aplikasi iOS.** Jalur iOS adalah sweep berkala atas bundel
> diagnostik yang ditarik manual dari perangkat (`POST /sweep/ios`), bukan
> aplikasi yang dipasang. Itu batas iOS, bukan pilihan desain.

## Lampiran C · Mode insider threat (modul lama)

```bash
SIM_MODE=endpoint docker compose up -d --force-recreate simulator
```

Mesin yang sama, domain berbeda. Berguna bila juri bertanya apakah pendekatan
ini hanya berlaku untuk HP.

## Lampiran D · Pertanyaan yang mungkin muncul

**"Bagaimana membedakan backup iCloud tengah malam dari eksfiltrasi?"**
Backup berjalan ke ASN Apple/Google dan tidak didahului pesan senyap serta
crash parser. Aturan `mob_covert_egress_idle` punya filter eksplisit untuk
ASN penyedia awan arus utama, dan unggahan sendirian tidak membuka kasus.

**"Kalau penyerang tidak mengunggah data besar?"**
Itu justru yang kami temukan saat menguji sendiri. Rantai SMS biner berakhir
dengan beacon 0,12 MB dan **lolos** dari aturan pertama kami yang menuntut
≥8 MB. Celah itu kami tambal dengan `corr_zeroclick_beacon_chain`. Prosesnya
ada di riwayat repositori.

**"Berapa biaya lisensinya?"**
Nol. Sigma (spec domain publik), YARA-X (BSD-3), indikator MVT (MIT) dan
Amnesty (CC-BY), ClickHouse, Redpanda, FastAPI, React. Kewajiban satu-satunya
adalah atribusi, dan itu tercantum di `infra/indicators/ATTRIBUTION.md`.

**"Apakah ini sudah dipakai?"**
Belum. Ini prototipe hackathon. Yang sudah terbukti adalah mesin deteksinya
terhadap telemetri sintetis yang kami rancang mengikuti rantai serangan nyata,
dengan hasil 6/6 terdeteksi dan nol false positive. Penggelaran ke pasukan
memerlukan uji pada fleet nyata, dan itu bukan sesuatu yang bisa diklaim dari
sebuah hackathon.
