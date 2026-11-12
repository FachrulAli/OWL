# Indikator Kompromi (IOC) pihak ketiga

TRINETRA memakai indikator spyware yang dipublikasikan secara terbuka untuk
melengkapi deteksi berbasis perilaku. Lapisan ini **tidak pernah berdiri
sendiri**: kecocokan IOC selalu dikorelasikan dengan perilaku perangkat sebelum
sebuah kasus dibuka (lihat `mob_ioc_domain` di
`services/backend/app/rules/sigma/mobile_atomic.yml`).

## Sumber dan lisensi

| Berkas | Sumber | Lisensi |
|---|---|---|
| `stix2/pegasus.stix2` | [AmnestyTech/investigations](https://github.com/AmnestyTech/investigations) — Amnesty International Security Lab | **CC-BY 2.0** (wajib atribusi) |
| 14 berkas `stix2/*.stix2` lainnya | [mvt-project/mvt-indicators](https://github.com/mvt-project/mvt-indicators) | **MIT** |

Atribusi: indikator Pegasus diekstraksi dari investigasi teknis Amnesty
International terhadap ancaman tertarget pada pembela hak asasi manusia, dibagikan
di bawah lisensi CC-BY. Kampanye lain berasal dari proyek Mobile Verification
Toolkit (MVT).

## Catatan penting

- Program **MVT** sendiri **tidak** dipakai di TRINETRA. Program itu berlisensi
  "MVT License 1.1" yang memuat pasal *Consensual Use Restriction*. Yang dipakai
  di sini hanyalah **data indikator** (MIT / CC-BY), bukan kodenya.
- Walaupun tidak diwajibkan oleh lisensi data, TRINETRA **mengadopsi prinsip
  pasal tersebut secara sukarela**: pemegang perangkat diberi tahu apa yang
  dipantau, hanya metadata yang dikumpulkan (tidak ada isi pesan), dan ada
  kebijakan retensi yang jelas.
- IOC bersifat **historis**. Domain yang dulu dipakai spyware bisa kembali
  dipakai secara sah, dan temuan lama bisa mencerminkan kompromi yang sudah
  tidak aktif. Karena itu bobotnya di TRINETRA tidak pernah 100%.

## Memperbarui

    ./infra/indicators/fetch.sh

Skrip hanya mengunduh berkas `.stix2` dan tidak menjalankan apa pun dari sumber.
