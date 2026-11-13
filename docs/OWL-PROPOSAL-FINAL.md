# OWL — On Device Watch Layer
### Proposal Final — Gerbang Risiko Perangkat untuk Pertahanan Siber TNI AD

> **Satu kalimat yang harus diingat juri:**
> *"OWL adalah gerbang risiko perangkat yang berjalan air-gapped di lingkungan TNI AD — menilai risiko perangkat **sebelum** ia menyentuh jaringan atau area operasi."*

| | |
|---|---|
| **Produk** | OWL — On Device Watch Layer |
| **Posisi** | Gerbang Risiko Perangkat (Device Risk Gate) — on-prem, air-gapped |
| **Kompetisi** | Kartika Cyber Hackathon 2026 (PUSSIBERAD × CODEPOLITAN) |
| **Kategori** | 02 — Defensive Shield + 03 — Core Infra |
| **Target** | TNI AD (perangkat komunikasi personel & sistem satuan) |
| **Status** | Final — siap submission |

---

## Narasi Pembuka (Cerita)

Bayangkan seorang prajurit atau perwira berangkat ke satuan atau ke lapangan. Di sakunya ada satu benda yang menyimpan hampir seluruh hidup dan tugasnya: pesan kedinasan, dokumen rahasia, akses ke sistem satuan, lokasi real-time, mikrofon, kamera. Benda itu kecil, tapi di situlah semua hal penting berada.

Benda yang sama juga ada di tangan para pimpinan — perwira tinggi yang percakapannya memuat keputusan strategis, perintah operasi, dan koordinasi yang tidak boleh bocor. Komunikasi merekalah target yang paling berharga.

Sekarang lihat ke sisi lain — ke ruang SOC, ke tim CSIRT. Mereka sibuk mengamankan server dan jaringan. Firewall, IDS, monitoring trafik. Semua mata tertuju ke infrastruktur. Tapi tidak ada satu pun mata yang tertuju ke benda kecil di saku prajurit, atau ke ponsel di meja perwira tinggi itu.

Itulah celahnya. **Titik buta.**

Dan musuh tahu itu. Mereka tidak menyerang server yang sudah dipagari rapat — mereka menyerang ponsel. **Penyadapan smartphone kini nyata dan jumlahnya meningkat.** Ada spyware komersial seperti Pegasus yang terdokumentasi menyasar jurnalis, aktivis, pejabat, dan tokoh strategis di banyak negara. Ada trojan perbankan yang melonjak 196% setahun. Ada malware yang diam-diam merekam mikrofon, kamera, dan lokasi. Mereka masuk lewat satu aplikasi yang kelihatannya biasa — meminta izin berlebihan, mengaktifkan aksesibilitas, memalsukan sertifikat — lalu diam-diam mendengar dan melihat.

Masalahnya: sistem keamanan yang ada — Knox, Intune, MDM — itu pandai **mengelola** perangkat. Mereka tahu perangkat terdaftar atau tidak. Tapi mereka **tidak menilai risiko**. Mereka tidak menjawab pertanyaan paling penting: *"Perangkat ini, detik ini, sedang disadap atau tidak — dan amankah ia masuk ke area operasi dan menyentuh sistem satuan?"*

Belum lagi satu hal yang lebih dalam: MDM itu berjalan di **cloud vendor luar negeri**. Untuk institusi pertahanan, itu berarti data dan keputusan keamanannya mengalir keluar dari tembok kedaulatan sendiri.

Di sinilah **OWL** masuk.

OWL adalah lapisan pengawas yang menempel langsung di perangkat — seperti burung hantu yang duduk diam di bahu prajurit, melihat dan mendengar dalam gelap. Ia tidak membaca isi pesan, tidak menyadap — ia justru **melihat tanda-tanda penyadapan**: izin mikrofon dan kamera yang mencurigakan, aksesibilitas yang disalahgunakan, sertifikat palsu, VPN gelap, aplikasi dari luar, root, patch yang usang.

Enam sinyal itu dikorelasikan menjadi **satu skor risiko**. Dan di situlah momennya: **sebuah gerbang**.

Perangkat itu datang ke gerbang — entah milik prajurit di lapangan, atau milik perwira tinggi di ruang komando. OWL menilai dalam hitungan detik. Kalau skornya bersih — **lolos**, diberikan akses. Kalau berisiko — **ditolak**, dikarantina, dinaikkan ke komando.

Dan semuanya terjadi **di dalam tembok sendiri** — on-prem, air-gapped, terhubung langsung ke Kartika CSIRT. Bukan di cloud orang lain.

Jadi ceritanya bukan "kami membuat antivirus". Ceritanya adalah: *"Di tengah penyadapan yang meningkat, setiap perangkat — dari prajurit sampai pimpinan — harus melewati gerbang. OWL adalah gerbang itu."*

Dari satu perangkat yang lolos atau ditolak — di situlah cerita soal kedaulatan, keamanan, melindungi data prajurit, dan menjaga komunikasi para pimpinan menjadi satu. Sederhana, emosional, dan bisa dibuktikan di depan juri dalam tiga menit.

---

## 1. Inti Proposal (30 detik)

Kasus penyadapan smartphone **nyata dan meningkat** — dari spyware mercenary (Pegasus) yang menyasar individu hingga pejabat dan **petinggi militer**, sampai malware mobile yang merekam mic, kamera, dan lokasi. Sementara itu MDM seperti Knox/Intune hanya **mengelola** perangkat tanpa **menilai risiko lintas-indikator**, dan keduanya **berjalan di cloud vendor luar negeri**.

OWL adalah lapisan penilaian risiko **on-device** yang berjalan **on-prem/air-gapped** di lingkungan TNI AD — mengubah enam sinyal keamanan perangkat menjadi **satu skor risiko yang dapat dijelaskan**, lalu memakainya sebagai **keputusan akses Zero Trust** dan **feed ke Kartika CSIRT**.

**Penyadapan modern meninggalkan jejak di level aplikasi** — izin mic/kamera berlebihan, aksesibilitas disalahgunakan, sertifikat palsu, VPN gelap. OWL menilai jejak-jejak itu. Bukan antivirus, bukan anti-sadap total — melainkan **gerbang yang menilai indikator penyadapan** sebelum perangkat menyentuh sistem.

---

## 2. Masalah — Penyadapan Smartphone Prajurit & Perangkat Petinggi Militer yang Meningkat

Perangkat komunikasi adalah titik buta pertahanan satuan: SOC/CSIRT memantau server dan jaringan, tetapi tidak melihat smartphone yang dibawa prajurit ke lapangan. Perangkat ini menyimpan **data penting**, menjadi saluran **komunikasi penting** (pesan kedinasan, koordinasi operasi), dan dipakai oleh **petinggi militer** yang menjadi target utama penyadapan. Satu perangkat yang disadap = kebocoran operasi + pivot ke jaringan taktis/OT.

**Bukti penyadapan & ancaman pengawasan yang meningkat (angka terverifikasi):**

- **Spyware mercenary Pegasus** terdokumentasi menyasar jurnalis, aktivis, pejabat, dan tokoh strategis di banyak negara (Amnesty Security Lab / Citizen Lab) — bukti penyadapan canggih yang nyata dan berkelanjutan; menjadikan **petinggi militer target bernilai tinggi**.
- **>33 juta** serangan malware mobile global (Securelist, 2024) — sebagian besar berfungsi memata-matai: merekam mic, kamera, dan lokasi.
- **+196%** lonjakan trojan perbankan mobile (Kaspersky, 2024) — pencurian kredensial & pemantauan transaksi.
- **403,9 juta** anomali trafik nasional (BSSN, 2023) — skala permukaan serangan.
- **>36 juta** ancaman lokal Indonesia (Kaspersky, 2024).

> **Catatan jujur:** Indonesia tidak menerbitkan statistik nasional jumlah kasus penyadapan ponsel terverifikasi. Proposal ini memakai **bukti spyware & malware mobile** sebagai proksi yang dapat diverifikasi — bukan angka penyadapan yang dikarang.

---

## 3. Tiga Celah (why now, why us)

| Celah | Penjelasan |
|---|---|
| **1. Visibility gap** | Endpoint adalah blind spot pertahanan perimeter satuan |
| **2. Scoring gap** | MDM tahu "terdaftar/tidak", bukan "berisiko/tidak" lintas-indikator |
| **3. Sovereignty gap** | Intune/Knox cloud-hosted di luar negeri; tidak bisa air-gapped & kedaulatan penuh |

**Pembeda yang tidak bisa diserang:** OWL berjalan **on-prem/air-gapped** dan terintegrasi langsung ke **Kartika CSIRT** — kedaulatan data penuh. Ini yang tidak dimiliki Intune/Knox.

---

## 4. Solusi — Enam Sinyal → Satu Keputusan

OWL membaca **enam sinyal yang sudah tersedia di perangkat** (bukan konten pribadi, bukan trafik terenkripsi):

| # | Sinyal | Indikator |
|---|---|---|
| 1 | Izin aplikasi | Izin mic/kamera/lokasi yang berlebihan |
| 2 | Accessibility Service | Abuse `BIND_ACCESSIBILITY_SERVICE` (pencurian kredensial) |
| 3 | CA & VPN | CA user-installed / VPN rogue (indikator MITM) |
| 4 | Sumber instalasi | Sideload / aplikasi luar toko resmi |
| 5 | Integritas perangkat | Root/jailbreak, tamper, patch usang |
| 6 | Perilaku jaringan | Metadata volume/DNS/destinasi tak wajar |

**Alur (5 langkah):**

```
Registrasi → Telemetri → Korelasi multi-sinyal → Skor risiko 0–100 → Keputusan akses
```

**Keputusan akses (Zero Trust):**

| Skor | Keputusan |
|---|---|
| 0–29 | Allow |
| 30–69 | Allow + step-up (MFA) |
| 70–89 | Akses terbatas |
| 90–100 | Deny + kuarantin |

> **Catatan implementasi.** Ambang di atas berlaku untuk sumber daya biasa. Untuk sistem terklasifikasi, ambang deny turun ke 70 — perangkat berskor 70–89 ditolak di gerbang itu, sesuai use case pre-deployment screening. Lihat `owl/services/backend/app/pdp.py`.

---

## 5. Scope Jujur (kepercayaan dibangun di sini)

| OWL ADALAH | OWL BUKAN |
|---|---|
| Lapisan penilaian risiko konfigurasi & perilaku | Antivirus / deteksi malware signature |
| Zero Trust Policy Decision Point input | Anti-sadap total |
| Komplemen MDM (Knox/Intune) | Pengganti MDM |
| Sensor ke SOC/CSIRT | Detektor baseband/IMSI catcher/RF |

> **Kalimat untuk juri teknis:** *"OWL menilai indikator risiko — bukan mengklaim mendeteksi malware. Ia mengubah sinyal yang sudah ada menjadi keputusan akses yang bisa diaudit."*

---

## 6. Killer Demo — "Dua Perangkat, Satu Gerbang"

Momen yang membuat juri ingat (3 menit):

1. Dua perangkat: **bersih** vs **berisiko** (indikator: aksesibilitas + CA + sideload).
2. OWL menilai dalam < 60 detik → **18/100** vs **87/100**.
3. **Gerbang memutuskan:** bersih **lolos**, berisiko **ditolak**.
4. Event **STIX/CEF** keluar ke SOC (payload nyata ditampilkan).

> Ini bukan "admin lihat dashboard" — ini **gerbang yang menolak perangkat berisiko di depan mata juri**.

---

## 7. Posisi Kompetitif (vs pemain besar)

| Aspek | Intune / Knox | OWL |
|---|---|---|
| Kelola perangkat | Ya | Tidak menggantikan |
| Conditional access berbasis risiko | Ya (cloud) | Ya (**air-gapped**) |
| **Kedaulatan data / on-prem** | Tidak (cloud vendor) | **Ya — inti pembeda** |
| **Integrasi Kartika CSIRT** | Tidak | **Ya** |
| **Skor risiko lintas-indikator yang explainable** | Parsial | **Ya — inti** |

**Satu pembeda utama yang dikunci:** *kedaulatan + on-prem + integrasi CSIRT* — resonan dengan juri PUSSIBERAD dan tidak bisa ditiru vendor asing.

---

## 8. Use Case (TNI AD)

| # | Use Case | Dampak |
|---|---|---|
| 1 | **Screening prajurit sebelum operasi** | Cegah perangkat berisiko masuk area operasi |
| 2 | **Akses sistem terklasifikasi** | Conditional access untuk data sensitif |
| 3 | **Pivot ke jaringan OT/SCADA** | Blokir perangkat berisiko dari sistem vital |
| 4 | **Perwira berisiko tinggi** | Peringatan dini indikator kompromi |
| 5 | **Sensor Kartika CSIRT** | Perangkat terinfeksi = indikator awal insider threat |

---

## 9. MVP — Dipangkas ke Satu Slice

**Yang dibangun (dan hanya ini):**
- Agent Kotlin membaca 6 sinyal
- Backend FastAPI + rule engine + risk scoring
- Dashboard React: 2 perangkat + skor + allow/deny

**Yang jadi roadmap (bukan kode):** ML/anomali, iOS/Windows, auto-remediation penuh, integrasi MDM penuh.

---

## 10. Roadmap

| Fase | Fokus |
|---|---|
| 1 Foundation | MVP Android end-to-end (gerbang risiko) |
| 2 Detection | Rule + threat intel |
| 3 Behavioral | Baseline + anomali + ML |
| 4 Response | Playbook + MDM/IAM |
| 5 Multi-Platform | iOS + Windows |
| 6 Deployment | Satuan & pemerintah |

---

## 11. Mengapa Ini Menang (pemetaan ke kriteria)

| Kriteria (bobot) | Jawaban OWL |
|---|---|
| Relevansi & Manfaat (25%) | Gerbang risiko untuk perangkat prajurit & IT/OT satuan |
| Inovasi Teknis (25%) | Korelasi lintas-indikator + keputusan akses explainable, on-prem |
| Fungsionalitas Purwarupa (25%) | Satu slice yang buildable + demo deny/allow + STIX |
| Kelayakan Implementasi (15%) | Komplemen MDM, standar terbuka, air-gapped |
| Kualitas Dokumentasi (10%) | Proposal + slide + video |

---

## 12. Pitch Scripts

**30 detik:** *"MDM mengelola perangkat, tapi tidak menilai risiko — dan berjalan di cloud luar negeri. OWL adalah gerbang risiko perangkat on-prem untuk TNI AD: membaca enam sinyal keamanan, mengubahnya menjadi skor risiko, dan memutuskan — lolos atau ditolak — sebelum perangkat menyentuh jaringan. Melihat & mendengar dalam gelap."*

**2 menit:** Masalah → tiga celah → solusi (6 sinyal → 1 keputusan) → demo gerbang → pembeda (kedaulatan + CSIRT) → adopsi.

**5 menit:** 1) Masalah & data · 2) Solusi & scope jujur · 3) Demo gerbang · 4) Arsitektur + diferensiasi · 5) Dampak & ajakan.

**Closing:** *"Kita tidak bisa melindungi apa yang tidak bisa kita nilai — OWL memberi penilaian itu, di dalam tembok kedaulatan kita sendiri."*

---

## 13. Checklist Submission (15 Nov)

- [ ] Link repository yang bisa diakses
- [ ] Video presentasi (demo gerbang 3 menit)
- [ ] Slide (deck OWL)
- [ ] Proposal ini sebagai dokumentasi

---

*Proposal ini menyatukan cerita emosional ("lindungi prajurit") dan produk jujur ("gerbang risiko") — tanpa overclaim, dengan satu pembeda kedaulatan yang tidak bisa diserang, dan satu demo yang bisa dibuktikan. Itulah yang membawa OWL ke final.*
