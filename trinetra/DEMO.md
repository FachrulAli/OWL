# TRINETRA — Panduan Demo (untuk Video & Juri)

Durasi target: **4–6 menit**. Alur ini membuktikan MVP end-to-end (§18 Fungsionalitas Purwarupa).

## 0. Persiapan (sebelum rekam)
```bash
cd trinetra && docker compose up --build
```
Tunggu sampai log `backend` menampilkan `startup complete` dan `simulator` masuk
fase `streaming live traffic`. Buka http://localhost:5173.

## 1. Pembuka — Paradigma (30 dtk)
> "Pertahanan siber konvensional menjaga pagar. TRINETRA adalah **mata ketiga** —
> mengawasi ke dalam. Ini command center-nya, data mengalir real-time."

Tunjuk **StatBar** (events/detik naik) dan **status LIVE** (WebSocket).

## 2. Orkestrasi 3 Tier (45 dtk)
Panel **Orkestrasi Berjenjang**: Pusat → 3 Kodam → 5 Satuan, tiap node punya
agregasi risk. Jelaskan telemetri naik, policy turun (§9.3).

## 3. Deteksi Role-Based + UEBA (60 dtk)
Panel **Entity Berisiko**: entity naik ke atas saat berperilaku menyimpang.
Klik satu entity → **drawer**:
- **Baseline vs Aktual** — bar merah = lewat threshold role (§11).
- **Investigation Timeline** — evolusi risk score (§10.7).
- **Event Terakhir** — baris merah = event anomali (label kategori).

> "Setiap role punya baseline sendiri. Admin kirim 2 GB padahal normalnya <100 MB —
> rule engine + UEBA sepakat, skor melonjak."

## 4. Live Feed & 8 Kategori (45 dtk)
Panel **Live Detection Feed**: alert streaming dengan kategori (eksfiltrasi,
privilege abuse, lateral movement, dst). Tunjuk chip kategori + skor UEBA.
Panel **Tren per Kategori** menunjukkan distribusi 8 kategori (§10.3 FR-10).

## 5. Korelasi Lintas Node (40 dtk)
Panel **Korelasi Lintas Node (Tier 0)**: saat kategori sama muncul di ≥2 Kodam,
pusat menggabungkannya jadi satu pola ancaman terdistribusi (§8, §10.5 FR-17).

> "Inilah yang tak terlihat satu node: insider terkoordinasi lintas Kodam."

## 6. Case Management + Feedback Loop (40 dtk)
Panel **Case Management**: klik **TP/FP** pada sebuah case.
> "Verdict analis dikirim balik ke ML untuk tuning — menurunkan false positive
> seiring waktu (§9.1)."

## 7. Heatmap + Penutup (30 dtk)
Panel **Risk Heatmap (Node × Role)** untuk postur risiko satu layar.
> "Beyond Access Control, Toward Continuous Trust Verification."

---

## Pemetaan ke Kriteria Penilaian (§18)

| Kriteria (bobot) | Dibuktikan oleh |
|---|---|
| Relevansi & Manfaat (25%) | Insider threat di ekosistem CSIRT TNI AD; role & tier sesuai struktur |
| Inovasi Teknis (25%) | Role-based baseline + fusi rule∥UEBA + korelasi 3 tier |
| Fungsionalitas Purwarupa (25%) | Stack jalan end-to-end: telemetri→deteksi→skor→dashboard→orkestrasi |
| Kelayakan Implementasi (15%) | Standar terbuka (OCSF, Sigma, MITRE), containerized, cloud-ready (`deploy/`) |
| Kualitas Dokumentasi (10%) | PRD + README + DEMO + deploy notes + diagram |

## Pemetaan Kode → PRD

| PRD | File |
|---|---|
| §10.1 OCSF normalize | `services/backend/app/ocsf.py` |
| §10.2 Baseline per role | `infra/postgres/init.sql` (role_baselines) + `services/ml/app/baseline.py` |
| §10.3 Rule engine (Sigma) | `services/backend/app/rules/` |
| §10.3 UEBA (Isolation Forest + peer-group) | `services/ml/app/baseline.py` |
| §10.4 Risk scoring 0–100 | `services/backend/app/scoring.py` |
| §10.5 Orkestrasi + korelasi | `services/backend/app/orchestration.py` |
| §10.6 Case management + feedback | `services/backend/app/cases.py`, `api/routes.py` |
| §10.7 Dashboard | `frontend/src/` |
| §11 Baseline parameters | `infra/postgres/init.sql`, `rules/catalog.yml` |
