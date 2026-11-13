# OWL — On Device Watch Layer

> Gerbang risiko perangkat untuk lingkungan TNI AD. On-prem, air-gapped.
> Kartika Cyber Hackathon 2026 (PUSSIBERAD × CODEPOLITAN), kategori 02
> Defensive Shield dan 03 Core Infra.

*"Melihat dan mendengar dalam gelap."*

SOC dan CSIRT satuan memagari server dan jaringan, tetapi ponsel yang dibawa
prajurit ke lapangan dan ponsel di meja perwira tinggi tidak terlihat oleh
pertahanan mana pun. MDM tahu perangkat terdaftar atau tidak; ia tidak
menjawab apakah perangkat itu aman dipercaya menyentuh sistem satuan hari
ini. OWL menjawab pertanyaan itu, lalu memakai jawabannya sebagai keputusan
akses.

```
Registrasi → Telemetri → Korelasi multi-sinyal → Skor 0-100 → Keputusan akses
```

## Mulai dari mana

| Berkas | Isi |
|---|---|
| [`owl/README.md`](owl/README.md) | cara menjalankan, struktur, enam sinyal, mesin skor |
| [`owl/DEMO.md`](owl/DEMO.md) | naskah demo tiga menit, lengkap dengan apa yang harus diucapkan |
| [`docs/OWL-PROPOSAL-FINAL.md`](docs/OWL-PROPOSAL-FINAL.md) | proposal submission |
| [`docs/OWL-deepdive.md`](docs/OWL-deepdive.md) | analisis mendalam: threat model, arsitektur, scope jujur |
| [`docs/OWL-deck.html`](docs/OWL-deck.html) | deck presentasi, buka langsung di peramban |
| [`DEPLOY.md`](DEPLOY.md) | penggelaran on-prem dan tautan publik |

Tautan publik: **<https://owl-id.vercel.app>** (dashboard saja, mode luring).

## Jalan tercepat

```bash
cd owl
docker compose up --build       # dashboard :8080, API :8000
```

Atau tanpa Docker:

```bash
cd owl
make setup
make backend      # terminal 1
make frontend     # terminal 2, buka http://localhost:5173
```

Di dashboard: **Muat dua perangkat contoh**, lalu **Jalankan gerbang**.
Satu perangkat lolos di 18, satu ditolak di 87.

## Struktur

```
owl/
  services/backend/   OWL Core: mesin aturan, skor risiko, PDP, ekspor STIX/CEF
  agent/android/      agent Kotlin, enam sinyal, attestation perangkat keras
  frontend/           dashboard: gerbang, perangkat, aturan, SOC
  samples/            telemetri contoh yang dapat dikirim dengan curl
  tests/              uji skor, gerbang, dan ekspor
docs/                 proposal, analisis mendalam, deck
```

## Yang OWL bukan

Bukan antivirus, bukan pengganti MDM, dan bukan anti-sadap total. OWL bekerja
pada lapisan aplikasi; implan baseband, IMSI catcher, rootkit firmware, dan
intersepsi RF berada di bawah lapisan itu dan ditangani sistem lain. Batasnya
dinyatakan di depan, bukan disembunyikan: lihat `docs/OWL-deepdive.md` §2.2.
