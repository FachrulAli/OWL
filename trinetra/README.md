# TRINETRA — Mobile Threat Defense: Deteksi Zero-Click pada HP Prajurit

> *"Serangan yang paling berbahaya tidak meminta korbannya menekan apa pun."*

Prototype untuk **Kartika Cyber Hackathon 2026 (PUSSIBERAD × CODEPOLITAN)**.

**Masalah.** Spyware kelas Pegasus/Predator masuk ke HP tanpa korban mengklik
apa pun — tanpa tautan, tanpa lampiran dibuka, tanpa jejak di layar. Antivirus
tidak menolong: tidak ada berkas untuk dipindai, dan sampelnya tidak pernah
dipublikasikan. Bagi TNI AD, HP pejabat dan perwira intelijen adalah sasaran
bernilai tinggi, dan satu HP yang disadap membocorkan lebih banyak daripada
satu jaringan yang ditembus.

**Pendekatan TRINETRA.** Tidak mencari *apa* malware-nya, melainkan *apa yang
dilakukannya*. Satu indikator perilaku di HP selalu ambigu — HP panas bisa
karena main game, unggahan besar bisa karena backup, pesan dari nomor tak
dikenal bisa karena ojol. Yang **tidak** ambigu adalah beberapa indikator
menyala **berurutan**, pada satu perangkat, dalam jendela waktu pendek,
sementara pemiliknya tidak menyentuh HP sama sekali:

```
pesan senyap dari pengirim tak dikenal   (layar mati, tanpa notifikasi)
        ↓  11 detik
crash proses parser OS                   (IMTransferAgent / media.codec)
        ↓  34 detik
HP panas, baterai terkuras               (idle, tidak dicas)
        ↓  28 detik
unggahan keluar ke ASN non-arus-utama    (layar masih mati)
        ↓  19 detik
mikrofon aktif tanpa aplikasi di depan
```

Rantai itu praktis tidak punya padanan yang sah. Itulah yang dideteksi, dan
dinyatakan sebagai **satu temuan utuh** — bukan lima alarm terpisah.

Modul **insider threat** (domain endpoint) tetap ada di mesin yang sama:
jalankan dengan `SIM_MODE=endpoint`.

Implementasi penuh arsitektur PRD §17 sebagai service containerized —
**cloud-ready** (lokal via Docker Compose; produksi via Kubernetes / managed
services).

---

## Empat lapisan deteksi

Satu lapisan saja selalu bisa dikalahkan. Signature kalah oleh zero-day,
perilaku saja terlalu bising, intel saja kedaluwarsa.

| Lapisan | Teknologi | Menangkap | Lisensi |
|---|---|---|---|
| **1. Perilaku** ← inti | **Sigma** + correlation `temporal_ordered` | zero-click yang **belum dikenal siapa pun** | spec public domain |
| **2. Intel** | **STIX2** — 3.166 indikator, 15 kampanye | infrastruktur Pegasus/Predator **yang sudah diketahui** | MIT + CC-BY |
| **3. Konten** | **YARA-X** — pemindai APK | RAT sideload (SpyNote/CraxsRAT dsb.) | BSD-3 |
| **4. Anomali** | Isolation Forest + peer-group MAD | penyimpangan yang lolos ketiganya | BSD |

Semua gratis dan open source. Rincian atribusi:
[`infra/indicators/ATTRIBUTION.md`](infra/indicators/ATTRIBUTION.md).

### Aturan deteksi sebagai kode

26 aturan dalam **format Sigma asli** (spec v2), bisa dibaca dan diaudit
langsung, serta dibagikan antar satuan:

- [`mobile_atomic.yml`](services/backend/app/rules/sigma/mobile_atomic.yml) —
  16 aturan atomik, severity sengaja **rendah** (8–45). Satu aturan tidak
  pernah cukup untuk menuduh.
- [`mobile_correlation.yml`](services/backend/app/rules/sigma/mobile_correlation.yml) —
  10 correlation rule (`temporal_ordered` / `temporal` / `event_count`),
  severity 30–85. Di sinilah tuduhan zero-click lahir.

Dipetakan ke **MITRE ATT&CK Mobile** (T1203, T1660, T1429, T1512, T1626,
T1430, T1557, T1437, T1639, T1476 …). Dievaluasi engine streaming TRINETRA
sendiri ([`sigma_loader.py`](services/backend/app/rules/sigma_loader.py),
[`correlation.py`](services/backend/app/rules/correlation.py)) — bukan
diterjemahkan ke backend SIEM eksternal, karena penilaian dilakukan
*per-event di dalam arus* sebelum data disimpan.

---

## Arsitektur

```
 simulator ──telemetry──▶ Redpanda (Kafka) ──▶ backend ──┬─▶ ClickHouse (events + risk)
 (pengganti agent                                         ├─▶ Postgres (roles/cases/corr)
  eBPF/ETW utk demo)                                      ├─▶ ml  (UEBA: IsolationForest + peer-group)
                                                          └─▶ WebSocket ──▶ frontend (command center)
```

| Service      | Peran (PRD)                                              | Port  |
|--------------|---------------------------------------------------------|-------|
| `redpanda`   | Ingestion & buffer (Kafka API) — §8.2                   | 9092  |
| `console`    | Redpanda UI (lihat topik telemetri)                     | 8085  |
| `clickhouse` | Time-series telemetri + risk score — §17                | 8123  |
| `postgres`   | Role/identitas, baseline meta, cases, korelasi          | 5432  |
| `ml`         | ML/UEBA engine — Isolation Forest + peer-group — §10.3  | 8001  |
| `backend`    | OCSF normalize → enrich → rule engine → risk scoring → orkestrasi — §9.1 | 8000 |
| `simulator`  | Generator telemetri fleet HP (29 HP, 8 skenario ancaman) | —     |
| `frontend`   | Dashboard command center (React)                        | 5173  |

Pipeline deteksi: `normalize (OCSF) → enrich (identitas + IOC STIX2) →
[aturan Sigma ∥ UEBA] → korelasi kill-chain → risk scoring (0–100) →
case management → korelasi lintas node`.

**Agent nyata:** [`agent/android`](agent/README.md) — agent MTD Kotlin yang
mengirim metadata perilaku ke `POST /ingest/mobile`, bentuk event identik
dengan simulator sehingga pipeline tidak bisa membedakannya. Kode lengkap,
**belum dikompilasi** (perlu Android SDK) dan **belum diuji di perangkat**.

**Hasil uji deteksi** (`selftest_mobile.py`, tanpa Docker/Kafka, 12.400 event):
**6/6 rantai terdeteksi, 0 false positive korelasi, 23 HP normal nol alarm.**
Sekitar 0,3% event normal menyalakan satu indikator atomik — dan tidak satu
pun menjadi kasus. Itu perilaku yang dirancang, bukan kebetulan.

---

## Menjalankan (Lokal)

Prasyarat: **Docker Desktop** (`brew install --cask docker`), lalu buka Docker Desktop.

```bash
cd trinetra
docker compose up --build
```

Tunggu ~1–2 menit (build image + warm-up baseline). Lalu buka:

- **Dashboard** → http://localhost:5173
- **API docs (Swagger)** → http://localhost:8000/docs
- **ML engine** → http://localhost:8001/health
- **Redpanda console** → http://localhost:8085

Simulator otomatis mengirim telemetri. Entity berisiko muncul di dashboard dalam
beberapa detik setelah warm-up. Klik entity untuk melihat **baseline vs aktual**,
**investigation timeline**, dan event terakhir. Beri **verdict TP/FP** pada case
untuk memicu *feedback loop* ke ML (§9.1).

### Mematikan / reset
```bash
docker compose down          # stop
docker compose down -v        # stop + hapus data (ClickHouse/Postgres)
```

### Knobs (env di docker-compose.yml)
| Var | Default | Efek |
|-----|---------|------|
| `EVENTS_PER_SECOND` | 40 | throughput simulator |
| `ANOMALY_RATE` | 0.03 | proporsi event anomali |
| `ALERT_THRESHOLD` | 50 | risk minimum untuk membuka case |
| `CRITICAL_THRESHOLD` | 70 | risk untuk eskalasi kritis |

---

## 8 Kategori Anomali (§10.3 FR-10)

`data_exfiltration` · `privilege_abuse` · `lateral_movement` · `logon_anomaly` ·
`suspicious_process` · `mass_file_access` · `usb_exfiltration` · `config_tampering`

Dideteksi lewat **dua mesin paralel** lalu difusikan:
1. **Rule engine** (Sigma-like, `services/backend/app/rules/catalog.yml`) — deterministik, dipetakan ke MITRE ATT&CK.
2. **UEBA** (`services/ml`) — Isolation Forest per role + peer-group robust z-score (MAD).

Risk scoring (§10.4): fusi `0.6·rule + 0.4·ml`, boost bila kedua mesin setuju (kurangi false positive), tertimbang bobot role, dengan **decay** seiring waktu.

---

## Catatan Keamanan & Scope

- Simulator menghasilkan **telemetri sintetis yang mendeskripsikan** perilaku
  berbahaya untuk menguji detektor (blue-team). **Bukan** alat serang nyata.
- Agent endpoint produksi (eBPF/ETW/Osquery) ada di roadmap; untuk demo diganti
  simulator agar reprodusibel tanpa menyentuh endpoint nyata.
- Privasi personel: data minimisasi & pseudonimisasi (§16) — entity memakai id,
  bukan PII.

Pemetaan lengkap ke PRD ada di [`DEMO.md`](./DEMO.md) dan [`deploy/README.md`](./deploy/README.md) (jalur ke cloud).
