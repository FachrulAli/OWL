# Telemetri contoh

Dua berkas di folder ini adalah telemetri yang bentuknya persis sama dengan
yang dikirim agent Android. Keduanya dapat dikirim langsung ke OWL Core,
sehingga skor pada demo dapat diperiksa ulang tanpa perangkat fisik.

OWL Core harus dijalankan dengan `OWL_ATTESTATION=claim` untuk cara ini
(`make backend OWL_ATTESTATION=claim`). Pada mode bawaan, `verify`, perangkat
yang didaftarkan lewat curl tidak membawa rantai attestation, jadi laporannya
tidak dipercaya dan gerbang menolaknya, apa pun isi telemetrinya. Itu memang
maksudnya.

```bash
# daftarkan perangkatnya lebih dahulu
curl -s -X POST localhost:8000/api/devices \
  -H 'Content-Type: application/json' \
  -H 'X-OWL-Token: owl-demo-token' \
  -d '{"device_id":"KOMANDO-02","label":"HP dinas perwira","unit":"Staf Komando"}'

# kirim telemetrinya
curl -s -X POST localhost:8000/api/telemetry \
  -H 'Content-Type: application/json' \
  -H 'X-OWL-Token: owl-demo-token' \
  --data-binary @samples/perangkat-berisiko.json | python3 -m json.tool
```

Ubah satu ruas lalu kirim ulang untuk melihat skornya bergerak. Contoh yang
paling kentara:

| Ubahan | Akibat |
|---|---|
| `accessibility_services` dikosongkan | kategori runtime turun dari 30 ke 18, skor 87 menjadi 75 |
| `integrity.root_artifacts` diisi `["/system/xbin/su"]` | integritas perangkat jenuh di 15, skor naik ke 96, dan karena OWL-D01 aturan penentu, gerbang menolak di kedua tingkat sumber daya |
| `apps` pada perangkat **bersih** ditambah `{"package":"com.metasploit.stage","installer":"com.google.android.packageinstaller"}` | OWL-A03 menyala; skornya hanya 33, tetapi gerbang menolak di kedua tingkat sumber daya tanpa melihat skor |
| `attestation.key_attestation` dijadikan `false` | OWL-X01 menyala, skor 96, dan gerbang menolak tanpa melihat skor sama sekali |

Angka pada kolom akibat berasal dari mesin yang sama, bukan dari perkiraan.
Jalankan sendiri untuk memastikannya.
