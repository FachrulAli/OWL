import { PetaKomando, useGelaran } from '../components/PetaGelaran'
import type { DeviceRow } from '../lib/types'

/**
 * Ikhtisar gelaran: peta komando selebar halaman.
 *
 * Layar yang dibuka pertama kali menjawab "di mana ini dipakai, dan apa yang
 * ada di sana". Itu pertanyaan situasi, bukan pertanyaan keputusan, dan
 * peta adalah bentuk yang paling jujur untuk menjawabnya: satu pandangan,
 * dua puluh satu komando daerah, dan perangkat yang terdaftar di bawah
 * masing-masing.
 *
 * Keputusan akses dan angka-angkanya pindah ke tab Gerbang. Pembagiannya
 * mengikuti pertanyaan, bukan mengikuti bentuk tabel di basis data: layar
 * ini tidak punya tombol yang mengubah apa pun, dan memang tidak perlu.
 */
export function Gelaran({ devices }: { devices: DeviceRow[] }) {
  const titik = useGelaran(devices)
  return <PetaKomando titik={titik} />
}
