# TRINETRA — Insider Threat Detection & Zero Trust Intelligence Platform

> *"Musuh yang sesungguhnya bukan di balik pagar — ia sudah berada di dalam, di antara kita."*

Prototype untuk **Kartika Cyber Hackathon 2026 (PUSSIBERAD × CODEPOLITAN)**.
Deteksi *insider threat* berbasis **role-based behavioral baseline + UEBA** dengan
**orkestrasi 3 tier** (Pusat → Kodam → Satuan).

Implementasi penuh dari arsitektur PRD §17 sebagai service containerized —
**cloud-ready** (lokal via Docker Compose; produksi via Kubernetes / managed services).

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
| `simulator`  | Synthetic telemetry generator (normal + 8 anomali)      | —     |
| `frontend`   | Dashboard command center (React)                        | 5173  |

Pipeline deteksi (§9.1): `normalize (OCSF) → enrich (role) → [rule engine ∥ UEBA] → risk scoring (0–100) → case management → korelasi lintas node`.

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
