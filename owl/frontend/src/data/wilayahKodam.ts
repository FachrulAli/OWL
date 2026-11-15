/**
 * Provinsi yang dinaungi tiap Kodam.
 *
 * Nama provinsinya mengikuti NAMA DI BERKAS PETA (`provinsi.ts`, Natural
 * Earth 50m), bukan nama resmi terbaru, sebab pasangan ini dipakai untuk
 * mewarnai bentuk di peta. Natural Earth 50m masih memakai pembagian 33
 * provinsi, sehingga Kalimantan Utara, Papua Selatan, Papua Tengah, Papua
 * Pegunungan, dan Papua Barat Daya belum punya bentuknya sendiri di sana.
 *
 * Akibatnya ada dua Kodam yang sengaja tidak memegang provinsi mana pun:
 *
 *   XXIV/Mandala Trikora  Papua Selatan belum terpisah dari Papua di berkas
 *                         peta, dan memberikannya ke XXIV berarti mengambil
 *                         wilayah XVII/Cenderawasih.
 *   Mabes TNI AD          markas besar, bukan komando kewilayahan.
 *
 * Pinnya tetap ada di peta; yang tidak ada hanya bidang warnanya. Lebih
 * baik satu wilayah tidak diwarnai daripada diwarnai dengan batas yang
 * tidak dapat dipertanggungjawabkan.
 */
export const WILAYAH_KODAM: Record<string, string[]> = {
  im: ['Aceh'],
  i: ['Sumatera Utara'],
  xix: ['Riau', 'Kepulauan Riau'],
  xx: ['Sumatera Barat', 'Jambi'],
  ii: ['Sumatera Selatan', 'Bangka-Belitung'],
  xxi: ['Lampung', 'Bengkulu'],

  jaya: ['Jakarta Raya'],
  iii: ['Jawa Barat', 'Banten'],
  iv: ['Jawa Tengah', 'Yogyakarta'],
  v: ['Jawa Timur'],
  ix: ['Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur'],

  xii: ['Kalimantan Barat'],
  xxii: ['Kalimantan Tengah', 'Kalimantan Selatan'],
  vi: ['Kalimantan Timur'],

  xxiii: ['Sulawesi Tengah', 'Sulawesi Barat'],
  xiii: ['Sulawesi Utara', 'Gorontalo'],
  xiv: ['Sulawesi Selatan', 'Sulawesi Tenggara'],

  xvi: ['Maluku', 'Maluku Utara'],
  xviii: ['Papua Barat'],
  xvii: ['Papua'],
}

/** Kebalikannya: dari nama provinsi di peta ke id Kodam yang menaunginya. */
export const KODAM_PROVINSI: Record<string, string> = Object.fromEntries(
  Object.entries(WILAYAH_KODAM).flatMap(([id, ps]) => ps.map((p) => [p, id])),
)
