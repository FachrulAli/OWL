# Catatan penggelaran

## Dua bentuk penggelaran, dan keduanya disengaja

| Bentuk | Untuk siapa | Yang berjalan |
|---|---|---|
| On-prem, air-gapped | satuan | OWL Core + dashboard + agent, seluruhnya di dalam jaringan satuan |
| Tautan publik Vercel | juri dan penilai | dashboard saja, mode luring, memakai rekaman hasil penilaian |

Produk ini dirancang untuk tidak menyentuh internet. Tautan publik ada hanya
supaya penilai dapat melihat antarmukanya tanpa menjalankan apa pun, dan
antarmuka itu menyatakan dirinya sedang luring lewat spanduk di halaman.

## On-prem

```bash
cd owl
docker compose up --build
```

Dashboard di <http://localhost:8080>, API di <http://localhost:8000/docs>.

Variabel lingkungan yang diisi saat penggelaran satuan:

| Variabel | Arti | Bawaan |
|---|---|---|
| `OWL_INGEST_TOKEN` | token penggelaran agent | `owl-demo-token` |
| `OWL_API_KEY` | kunci baca dashboard dan API; kosong berarti terbuka | kosong |
| `OWL_ADMIN_TOKEN` | token untuk mengubah bobot dan ambang | `owl-demo-admin` |
| `OWL_SOC_WEBHOOK` | alamat webhook Kartika CSIRT | kosong |
| `OWL_SOC_SECRET` | kunci HMAC-SHA256 untuk tanda tangan payload | `owl-demo-secret` |
| `OWL_SYSLOG_HOST` | kolektor Syslog SIEM | kosong |
| `OWL_AIR_GAPPED` | menyatakan mode penggelaran di API dan dashboard | `true` |
| `OWL_T_HIGH`, `OWL_T_CRITICAL` | ambang keputusan akses | 70, 90 |

Dibiarkan kosong, kedua tujuan SOC tidak dihubungi dan event tetap dicatat
di basis data lokal dengan status belum terkirim, untuk diambil petugas.
**Ganti `OWL_INGEST_TOKEN`, `OWL_ADMIN_TOKEN`, dan `OWL_SOC_SECRET`, serta isi
`OWL_API_KEY`, sebelum perangkat pertama didaftarkan.** Selama `OWL_API_KEY`
kosong, API baca terbuka, dan `/health` menyatakannya sebagai
`api_auth: terbuka`. Keduanya sengaja diberi nilai bawaan yang jelas-jelas nilai
demo, supaya kelalaian mengisinya terlihat, bukan tersembunyi.

## Mengapa `vercel.json` ada di root repositori

Aplikasi web berada di `owl/frontend`, sedangkan projek Vercel membangun dari
**root repositori**. Tanpa berkas ini, setiap deploy dari GitHub gagal dalam
dua detik:

```
npm error Could not read package.json: /vercel/path0/package.json
Command "npm run build" exited with 254
```

Kegagalan ini berbahaya justru karena tidak terlihat seperti kegagalan: push
sukses, commit masuk ke GitHub, tetapi situs publik diam di build lama dan
tidak ada yang menyadarinya. Pada 2026-11-12 seluruh pekerjaan satu hari tidak
pernah tayang karena ini.

Perbaikan ditaruh di repositori, bukan di setelan dasbor, supaya perilaku
deploy ikut terbawa bersama kode dan tidak bergantung pada konfigurasi yang
hanya ada di satu akun.

Catatan: `vercel.json` memakai skema ketat, dan **properti tambahan ditolak**,
termasuk kunci yang dimaksudkan sebagai komentar. JSON tidak punya komentar,
jadi penjelasan apa pun harus ada di berkas seperti ini.

## Mode luring pada tautan publik

Dashboard yang dibangun Vercel tidak punya backend. Pada keadaan itu ia
memakai `owl/frontend/src/data/snapshot.json`, yaitu rekaman keluaran mesin
aturan dan mesin skor yang sungguhan. Rekaman itu dibuat ulang dengan:

```bash
cd owl && make snapshot
```

**Jalankan perintah itu setiap kali bobot, severitas, atau aturan diubah**,
lalu commit berkasnya. Jika tidak, tautan publik akan memperlihatkan angka
lama sementara backend memperlihatkan angka baru, dan juri yang membandingkan
keduanya akan menemukan selisih yang tidak dapat dijelaskan.

## Satu alamat publik

Hanya **<https://owl-id.vercel.app>**.

URL lain yang muncul di dasbor Vercel adalah alamat pratinjau per-deploy.
Membagikannya berarti membagikan versi yang akan kedaluwarsa tanpa
pemberitahuan, dan juri yang membukanya seminggu kemudian akan menemukan
halaman mati.

Alamat pratinjau per-deploy yang muncul di dasbor bukan alamat yang
dibagikan.
