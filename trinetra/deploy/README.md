# TRINETRA — Jalur ke Cloud (Production)

Docker Compose di root hanya untuk **lokal/demo**. Karena semua service sudah
**containerized + config via env var**, naik ke cloud **tidak mengubah kode** —
cukup ganti endpoint infrastruktur.

## Pemetaan Compose → Cloud

| Komponen lokal (Compose) | Setara produksi (managed)                         |
|--------------------------|---------------------------------------------------|
| `redpanda`               | Redpanda Cloud / Confluent Cloud / AWS MSK        |
| `clickhouse`             | ClickHouse Cloud                                  |
| `postgres`               | AWS RDS / GCP Cloud SQL / Supabase                |
| `ml`, `backend`          | Image sama di GKE/EKS, Cloud Run, atau ECS        |
| `frontend`               | GKE/CDN (S3+CloudFront, Cloudflare Pages, Vercel) |

Hanya env var yang berubih: `KAFKA_BOOTSTRAP`, `PG_DSN`, `CLICKHOUSE_HOST`,
`ML_URL` → arahkan ke endpoint managed (pakai Secret, bukan nilai literal).

## Kubernetes

Manifest contoh ada di folder ini (`k8s/`). Deploy:

```bash
kubectl create namespace trinetra
kubectl -n trinetra apply -f deploy/k8s/
```

Yang disediakan:
- `secrets.example.yaml` — kredensial infra (ganti sebelum apply; jangan commit yang asli).
- `backend.yaml`, `ml.yaml`, `frontend.yaml` — Deployment + Service.
- Backend/ML di-scale horizontal (replicas); Kafka consumer-group membagi partisi otomatis.

## Topologi multi-tier produksi (§8)

Di produksi, tiap **Kodam (Tier 1)** menjalankan node deteksi sendiri (backend+ml+ClickHouse
lokal) agar **offline-first** saat terputus dari pusat; **Pusat (Tier 0)** menjalankan
orchestrator + korelasi lintas node. Pola ini dipetakan ke namespace/cluster per Kodam
dengan replikasi alert+risk ke cluster pusat. Compose lokal mensimulasikan ketiganya
dalam satu host untuk demo.

## Keamanan produksi (§12 NFR)

- mTLS antar service (service mesh / Kafka SASL+TLS).
- Secret via Vault / cloud secret manager — bukan env literal.
- RBAC ketat + audit trail (sudah ada tabel `cases`/`feedback`; tambah audit log sink).
- Enkripsi at-rest (managed DB) & in-transit (TLS).
