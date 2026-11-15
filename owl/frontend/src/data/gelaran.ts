/**
 * Gelaran satuan TNI AD, untuk peta sebaran di halaman gerbang.
 *
 * Dua puluh satu Kodam, yaitu 15 yang lama ditambah 6 yang diresmikan
 * 10 Agustus 2025 di Batujajar, beserta Mabes TNI AD. Nama dan markasnya
 * data sungguhan, bukan karangan; ejaan "Radin Inten" dan "Palaka Wira"
 * sengaja ditulis begitu sebab itulah ejaan resminya.
 *
 * Koordinatnya adalah koordinat kota markas, dibulatkan secukupnya untuk
 * menaruh pin. Ini peta GELARAN, yaitu cakupan wilayah komando, bukan peta
 * posisi perangkat: OWL tidak membaca lokasi presisi perangkat mana pun,
 * dan skema telemetrinya memang tidak punya tempat untuk itu. Jangan
 * "lengkapi" berkas ini dengan koordinat perangkat.
 *
 * Lapisan Kodim sengaja tidak dipetakan. Ada ratusan Kodim dan koordinat
 * markasnya tidak dapat diverifikasi satu per satu, jadi yang ditampilkan
 * adalah wilayah yang dinaungi tiap Kodam. Menaruh pin yang tidak dapat
 * dipertanggungjawabkan pada peta militer adalah cacat, bukan kelengkapan.
 */

export interface Satuan {
  id: string
  nama: string
  singkat: string
  markas: string
  wilayah: string
  lon: number
  lat: number
  /** Kodam hasil penataan 2025. */
  baru?: boolean
  /** Mabes TNI AD, digambar berbeda dari Kodam. */
  pusat?: boolean
  /**
   * Geseran label, dalam satuan viewBox.
   *
   * Jakarta, Bandung, dan Mabesad berjarak kurang dari 20 satuan di peta,
   * sehingga ketiga labelnya saling menimpa dan tidak satu pun terbaca.
   * Geseran ini memisahkan ketiganya; pinnya sendiri tetap di koordinat
   * sebenarnya, hanya tulisannya yang menyingkir.
   */
  dx?: number
  dy?: number
}

export const GELARAN: Satuan[] = [
  {
    id: 'mabesad', nama: 'Mabes TNI AD', singkat: 'MABESAD',
    markas: 'Jakarta Pusat', wilayah: 'Markas Besar Angkatan Darat',
    lon: 106.83, lat: -6.18, pusat: true, dy: -13,
  },

  {
    id: 'im', nama: 'Kodam Iskandar Muda', singkat: 'IM',
    markas: 'Banda Aceh', wilayah: 'Aceh',
    lon: 95.32, lat: 5.55,
  },
  {
    id: 'i', nama: 'Kodam I/Bukit Barisan', singkat: 'I',
    markas: 'Medan', wilayah: 'Sumatera Utara',
    lon: 98.67, lat: 3.59,
  },
  {
    id: 'xix', nama: 'Kodam XIX/Tuanku Tambusai', singkat: 'XIX',
    markas: 'Pekanbaru', wilayah: 'Riau dan Kepulauan Riau',
    lon: 101.45, lat: 0.51, baru: true,
  },
  {
    id: 'xx', nama: 'Kodam XX/Tuanku Imam Bonjol', singkat: 'XX',
    markas: 'Padang', wilayah: 'Sumatera Barat dan Jambi',
    lon: 100.37, lat: -0.95, baru: true,
  },
  {
    id: 'ii', nama: 'Kodam II/Sriwijaya', singkat: 'II',
    markas: 'Palembang', wilayah: 'Sumatera Selatan dan Bangka Belitung',
    lon: 104.75, lat: -2.98,
  },
  {
    id: 'xxi', nama: 'Kodam XXI/Radin Inten', singkat: 'XXI',
    markas: 'Bandar Lampung', wilayah: 'Lampung dan Bengkulu',
    lon: 105.27, lat: -5.43, baru: true,
  },

  {
    id: 'jaya', nama: 'Kodam Jaya/Jayakarta', singkat: 'JAYA',
    markas: 'Jakarta Timur', wilayah: 'DKI Jakarta dan sekitarnya',
    lon: 106.9, lat: -6.25, dx: 30, dy: 4,
  },
  {
    id: 'iii', nama: 'Kodam III/Siliwangi', singkat: 'III',
    markas: 'Bandung', wilayah: 'Jawa Barat dan Banten',
    lon: 107.62, lat: -6.91, dy: 15,
  },
  {
    id: 'iv', nama: 'Kodam IV/Diponegoro', singkat: 'IV',
    markas: 'Semarang', wilayah: 'Jawa Tengah dan DI Yogyakarta',
    lon: 110.42, lat: -6.97,
  },
  {
    id: 'v', nama: 'Kodam V/Brawijaya', singkat: 'V',
    markas: 'Surabaya', wilayah: 'Jawa Timur',
    lon: 112.75, lat: -7.26,
  },
  {
    id: 'ix', nama: 'Kodam IX/Udayana', singkat: 'IX',
    markas: 'Denpasar', wilayah: 'Bali, NTB, dan NTT',
    lon: 115.22, lat: -8.65,
  },

  {
    id: 'xii', nama: 'Kodam XII/Tanjungpura', singkat: 'XII',
    markas: 'Kubu Raya', wilayah: 'Kalimantan Barat',
    lon: 109.33, lat: -0.05,
  },
  {
    id: 'xxii', nama: 'Kodam XXII/Tambun Bungai', singkat: 'XXII',
    markas: 'Palangka Raya', wilayah: 'Kalimantan Tengah dan Selatan',
    lon: 113.92, lat: -2.21, baru: true,
  },
  {
    id: 'vi', nama: 'Kodam VI/Mulawarman', singkat: 'VI',
    markas: 'Balikpapan', wilayah: 'Kalimantan Timur dan Utara',
    lon: 116.83, lat: -1.27,
  },

  {
    id: 'xxiii', nama: 'Kodam XXIII/Palaka Wira', singkat: 'XXIII',
    markas: 'Palu', wilayah: 'Sulawesi Tengah dan Barat',
    lon: 119.87, lat: -0.9, baru: true,
  },
  {
    id: 'xiii', nama: 'Kodam XIII/Merdeka', singkat: 'XIII',
    markas: 'Manado', wilayah: 'Sulawesi Utara dan Gorontalo',
    lon: 124.84, lat: 1.47,
  },
  {
    id: 'xiv', nama: 'Kodam XIV/Hasanuddin', singkat: 'XIV',
    markas: 'Makassar', wilayah: 'Sulawesi Selatan dan Tenggara',
    lon: 119.43, lat: -5.15,
  },

  {
    id: 'xvi', nama: 'Kodam XVI/Pattimura', singkat: 'XVI',
    markas: 'Ambon', wilayah: 'Maluku dan Maluku Utara',
    lon: 128.19, lat: -3.7,
  },
  {
    id: 'xviii', nama: 'Kodam XVIII/Kasuari', singkat: 'XVIII',
    markas: 'Manokwari', wilayah: 'Papua Barat dan Papua Barat Daya',
    lon: 134.07, lat: -0.86,
  },
  {
    id: 'xvii', nama: 'Kodam XVII/Cenderawasih', singkat: 'XVII',
    markas: 'Jayapura', wilayah: 'Papua, Papua Tengah, dan Papua Pegunungan',
    lon: 140.7, lat: -2.53,
  },
  {
    id: 'xxiv', nama: 'Kodam XXIV/Mandala Trikora', singkat: 'XXIV',
    markas: 'Merauke', wilayah: 'Papua Selatan',
    lon: 140.4, lat: -8.49, baru: true,
  },
]

/** Jumlah Kodam, tanpa menghitung Mabesad. */
export const JUMLAH_KODAM = GELARAN.filter((s) => !s.pusat).length
