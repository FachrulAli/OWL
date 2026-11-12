# Catatan penggelaran

## Mengapa `vercel.json` ada di root repositori

Aplikasi web berada di `trinetra/frontend`, sedangkan projek Vercel membangun
dari **root repositori**. Tanpa berkas ini, setiap deploy dari GitHub gagal
dalam dua detik:

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

Catatan: `vercel.json` memakai skema ketat — **properti tambahan ditolak**,
termasuk kunci yang dimaksudkan sebagai komentar. JSON tidak punya komentar;
penjelasan apa pun harus ada di berkas seperti ini.

## Satu alamat publik

Hanya **<https://trinetra-id.vercel.app>**. URL lain yang muncul di dasbor
(`trinetra-viclatess.vercel.app`, `trinetra-<hash>-viclatess.vercel.app`)
dibuat otomatis oleh Vercel untuk setiap projek dan setiap deploy; itu bukan
alamat yang dibagikan.

Setelah deploy produksi, pastikan alias menunjuk ke build terbaru:

```bash
vercel alias set <url-deployment-terbaru> trinetra-id.vercel.app
```

## Yang dilayani situs publik

Frontend saja. Tidak ada backend di Vercel, sehingga dashboard otomatis
beralih ke mesin demo dalam browser (`frontend/src/lib/demo.ts`) dan menampilkan
badge **DEMO LANGSUNG**. Stack penuh dijalankan lokal dengan Docker Compose.

APK agent dilayani dari `frontend/public/trinetra-agent.apk` di
`/trinetra-agent.apk`.
