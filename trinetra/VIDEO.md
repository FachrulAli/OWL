# Video Demo — 60 Detik

Naskah shot-by-shot. Dirancang untuk ditonton **tanpa suara** juga (banyak juri
menonton sambil menilai berkas lain), karena itu setiap shot punya teks layar.

**Satu aturan:** jangan menjelaskan arsitektur di video 60 detik. Tunjukkan
satu serangan tertangkap, lalu buktikan sistemnya tidak berisik. Arsitektur
ada di README dan di demo langsung.

---

## Persiapan (5 menit sebelum merekam)

```bash
./scripts/demo-cepat.sh
```

Skrip itu memperpendek fase belajar baseline dan memperbanyak frekuensi rantai.
**Aturan deteksi, ambang risiko, bobot, dan logika korelasi tidak diubah** —
yang dipercepat hanya kedatangan data. Kembalikan dengan
`./scripts/demo-cepat.sh normal`.

Diukur pada setelan itu (5 seed berbeda, hasilnya konsisten):

| | waktu |
|---|---|
| fase belajar baseline (300 event @ 80 eps) | 3,8 detik |
| rantai pertama terdeteksi setelahnya | +0,3 detik |
| **total sampai dashboard merah** | **≈ 4,1 detik** |
| rantai yang muncul dalam 20 detik berikutnya | ≈ 12 |

Artinya: jalankan skrip, tunggu lima detik, mulai merekam. Tidak perlu
menunggu dan tidak perlu memotong bagian kosong.

Lalu buka:

```
http://localhost:5173/?nointro#/console
```

`?nointro` melewati animasi boot 4,2 detik — seperlima dari durasi video.

**Tanpa Docker?** Pakai <https://trinetra-id.vercel.app/?nointro#/console>.
Mesin demo in-browser menjalankan skenario yang sama. Badge **DEMO LANGSUNG**
akan muncul di topbar; itu jujur dan tidak perlu disembunyikan.

Kebersihan layar: tutup tab lain, sembunyikan bookmark bar (`Cmd+Shift+B`),
nyalakan Do Not Disturb, zoom 100% (`Cmd+0`), jendela penuh (`Cmd+Ctrl+F`).

Rekam dengan `Cmd+Shift+5` → **Record Selected Portion** → pilih jendela
browser. Matikan *Show Mouse Clicks* kecuali memang mau menunjukkan klik.

---

## Shot 1 · 0:00–0:08 · Masalahnya

**Layar:** halaman beranda `#/` (bukan console). Diam, jangan scroll.

**Teks layar:** `Pegasus masuk tanpa korban menekan apa pun`

**Narasi:**
> "Spyware kelas Pegasus masuk ke HP tanpa korban menekan apa pun. Tidak ada
> tautan diklik. Antivirus tidak menolong — tidak ada berkas untuk dipindai."

---

## Shot 2 · 0:08–0:18 · Sebarannya

**Layar:** klik **Buka console** → peta Indonesia dengan 21 Kodam. Biarkan
aliran langsung di rail kanan bergerak 3–4 detik. Jangan klik apa pun.

**Teks layar:** `29 HP dinas · 21 Kodam · pemantauan perilaku`

**Narasi:**
> "TRINETRA memantau HP dinas di 21 Kodam. Yang dicari bukan malware-nya,
> tapi urutan perilakunya."

---

## Shot 3 · 0:18–0:38 · Inti video — rantai tertangkap

**Ini 20 detik terpenting. Jangan dipercepat.**

**Layar:** scroll ke panel **Rantai Terbaru — Rinci**. Gerakkan kursor
menuruni tahap satu per satu, seirama narasi. Berhenti di blok merah
*"perangkat idle"* dan biarkan terbaca 2 detik penuh.

**Teks layar:** muncul bertahap —
`Pengiriman → Eksploitasi → Implan → Kendali → Penyadapan`
lalu `92 detik · layar mati sepanjang itu`

**Narasi:**
> "Pesan senyap dari nomor tak dikenal. Sebelas detik kemudian proses parser
> sistem operasi crash. Lalu HP panas padahal tidak dipakai. Lalu data
> terkirim keluar. Lalu mikrofon menyala.
>
> Sembilan puluh dua detik — dan layar mati sepanjang itu. Pemegang HP tidak
> melakukan apa pun.
>
> Satu indikator masih bisa dijelaskan. Urutan ini tidak."

---

## Shot 4 · 0:38–0:50 · Buktinya tidak berisik

**Layar:** scroll ke tabel **HP Dinas Berisiko Tertinggi**. Tunjukkan enam
baris merah di atas, lalu baris-baris di bawahnya yang skornya 0.

Opsional dan kuat: potong ke terminal dan jalankan
`python3 tests/selftest_mobile.py` — 12 detik, dan outputnya muncul sendiri.

**Teks layar:** `6 terdeteksi · 23 bersih · 0 alarm palsu`

**Narasi:**
> "Dua puluh sembilan HP dipantau. Enam merah — dan tepat enam itulah yang
> kami suntik serangan. Dua puluh tiga sisanya nol. Nol alarm palsu."

---

## Shot 5 · 0:50–1:00 · Terbuka dan bisa diaudit

**Layar:** klik **Aturan deteksi →** di topbar → halaman `#/deteksi`. Scroll
pelan melewati kartu correlation rule.

**Teks layar:** `26 aturan format Sigma · standar terbuka · Rp 0 lisensi`

**Narasi:**
> "Dua puluh enam aturan dalam format Sigma — standar terbuka. Bisa diaudit,
> bisa dibagikan antar satuan sebagai berkas teks. Nol rupiah lisensi."

**Frame penutup (2 detik terakhir):** kembali ke beranda, logo TRINETRA
terlihat, diam.

---

## Daftar periksa sebelum mengirim

- [ ] Durasi 60 detik atau kurang
- [ ] Terbaca saat **tanpa suara** — setiap shot punya teks layar
- [ ] Teks di layar terbaca pada rekaman 1080p (jangan zoom-out)
- [ ] Tidak ada notifikasi, tab pribadi, atau nama berkas pribadi terlihat
- [ ] Blok *"perangkat idle"* terbaca penuh — itu bukti zero-click-nya
- [ ] Angka **0 alarm palsu** muncul di layar, bukan hanya diucapkan
- [ ] Bila memakai URL Vercel, badge **DEMO LANGSUNG** terlihat (biarkan)

## Yang sengaja TIDAK masuk video

Empat lapisan deteksi, 3.166 indikator STIX2, pemindai YARA-X, sweep forensik
iOS, dan agent Android. Semuanya ada dan bisa ditunjukkan di demo langsung
(lihat `DEMO.md`), tetapi memasukkannya ke 60 detik akan mengubah video dari
*satu bukti yang jelas* menjadi *daftar fitur yang tidak ada yang ingat*.

Satu hal yang **wajib** disebut bila video dipakai menggantikan presentasi:
agent Android belum diuji di perangkat. Jangan merekam klaim itu.
