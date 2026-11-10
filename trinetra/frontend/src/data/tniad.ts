// Reference data: TNI Angkatan Darat (Indonesian Army) organisation, reflecting
// the 2025 reorganisation that expanded the Kodam from 15 to 21 (six new Kodam
// XIX–XXIV inaugurated 10 August 2025). node_id keys match the console/map.
// Sources: TNI AD, Wikipedia, Indonesian press (2025). Territories are the
// primary provinces each Kodam oversees.

export interface Kodam {
  id: string;         // node_id (matches the map / console)
  numeral: string;    // "V", "XIX", "—" (Jaya / Iskandar Muda have no numeral pairing)
  name: string;       // full designation, e.g. "Kodam V/Brawijaya"
  nick: string;       // julukan, e.g. "Brawijaya"
  hq: string;         // headquarters city
  territory: string;  // provinces covered
  isNew?: boolean;    // formed in the 2025 expansion
}

export interface Kotama {
  acr: string;
  name: string;
  role: string;
  hq?: string;
}

export const LEADERSHIP = {
  org: "Tentara Nasional Indonesia Angkatan Darat",
  orgEn: "Indonesian Army",
  head: "Kepala Staf TNI Angkatan Darat (Kasad)",
  headEn: "Chief of Staff of the Army",
  holder: "Jenderal TNI Tandyo Budi Revita",
  holderNote: "menjabat sejak Oktober 2026",
  deputy: "Wakil Kepala Staf TNI AD (Wakasad)",
  hq: "Markas Besar TNI AD (Mabesad), Jakarta",
};

// Army general staff (Staf Umum Angkatan Darat)
export const STAF_UMUM: { acr: string; name: string }[] = [
  { acr: "Irjenad", name: "Inspektorat Jenderal AD" },
  { acr: "Srenad", name: "Staf Perencanaan dan Anggaran" },
  { acr: "Sintelad", name: "Staf Intelijen" },
  { acr: "Sopsad", name: "Staf Operasi" },
  { acr: "Spersad", name: "Staf Personel" },
  { acr: "Slogad", name: "Staf Logistik" },
  { acr: "Sterad", name: "Staf Teritorial" },
];

// Komando Utama & Badan Pelaksana Pusat (main commands)
export const KOTAMA: Kotama[] = [
  { acr: "Kostrad", name: "Komando Cadangan Strategis Angkatan Darat", role: "Pasukan pemukul strategis — 3 Divisi Infanteri", hq: "Jakarta" },
  { acr: "Kopassus", name: "Komando Pasukan Khusus", role: "Operasi khusus, antiteror (Sat-81), sandi yudha", hq: "Jakarta" },
  { acr: "Kodiklatad", name: "Komando Pembinaan Doktrin, Pendidikan & Latihan AD", role: "Doktrin, pendidikan, dan latihan", hq: "Bandung" },
  { acr: "Puspomad", name: "Pusat Polisi Militer AD", role: "Penegakan hukum & disiplin militer" },
  { acr: "Pusterad", name: "Pusat Teritorial AD", role: "Pembinaan teritorial" },
  { acr: "Pussenif", name: "Pusat Kesenjataan Infanteri", role: "Pembinaan kecabangan infanteri", hq: "Bandung" },
  { acr: "Pussenarmed", name: "Pusat Kesenjataan Artileri Medan", role: "Pembinaan artileri medan", hq: "Cimahi" },
  { acr: "Pussenarhanud", name: "Pusat Kesenjataan Artileri Pertahanan Udara", role: "Pembinaan artileri pertahanan udara", hq: "Cimahi" },
  { acr: "Pussenkav", name: "Pusat Kesenjataan Kavaleri", role: "Pembinaan kecabangan kavaleri", hq: "Bandung" },
  { acr: "Pusziad", name: "Pusat Zeni AD", role: "Pembinaan kecabangan zeni" },
  { acr: "Pushubad", name: "Pusat Perhubungan AD", role: "Komunikasi & elektronika militer" },
  { acr: "Puspenerbad", name: "Pusat Penerbangan AD", role: "Penerbangan & helikopter angkatan darat" },
  { acr: "Akmil", name: "Akademi Militer", role: "Pendidikan pembentukan perwira TNI AD", hq: "Magelang" },
  { acr: "Seskoad", name: "Sekolah Staf dan Komando AD", role: "Pendidikan staf & komando perwira menengah", hq: "Bandung" },
];

// Pusat Siber Angkatan Darat — the home of the TRINETRA programme
export const PUSSIBERAD = {
  acr: "Pussiberad",
  name: "Pusat Siber Angkatan Darat",
  role: "Satuan pusat pembinaan dan operasi siber TNI AD: pertahanan jaringan, deteksi ancaman insider, dan koordinasi siber lintas Kodam.",
  parent: "Markas Besar TNI AD (Mabesad)",
};

// All 21 Kodam. node_id matches the console nodes & map coordinates.
export const KODAM: Kodam[] = [
  { id: "kodam-im", numeral: "—", name: "Kodam Iskandar Muda", nick: "Iskandar Muda", hq: "Banda Aceh", territory: "Aceh" },
  { id: "kodam-1", numeral: "I", name: "Kodam I/Bukit Barisan", nick: "Bukit Barisan", hq: "Medan", territory: "Sumatera Utara" },
  { id: "kodam-19", numeral: "XIX", name: "Kodam XIX/Tuanku Tambusai", nick: "Tuanku Tambusai", hq: "Pekanbaru", territory: "Riau & Kepulauan Riau", isNew: true },
  { id: "kodam-20", numeral: "XX", name: "Kodam XX/Tuanku Imam Bonjol", nick: "Tuanku Imam Bonjol", hq: "Padang", territory: "Sumatera Barat & Jambi", isNew: true },
  { id: "kodam-2", numeral: "II", name: "Kodam II/Sriwijaya", nick: "Sriwijaya", hq: "Palembang", territory: "Sumsel & Bangka Belitung" },
  { id: "kodam-21", numeral: "XXI", name: "Kodam XXI/Radin Inten", nick: "Radin Inten", hq: "Bandar Lampung", territory: "Lampung & Bengkulu", isNew: true },
  { id: "kodam-jaya", numeral: "Jaya", name: "Kodam Jaya/Jayakarta", nick: "Jayakarta", hq: "Jakarta", territory: "DKI Jakarta & sekitarnya" },
  { id: "kodam-3", numeral: "III", name: "Kodam III/Siliwangi", nick: "Siliwangi", hq: "Bandung", territory: "Jawa Barat & Banten" },
  { id: "kodam-4", numeral: "IV", name: "Kodam IV/Diponegoro", nick: "Diponegoro", hq: "Semarang", territory: "Jawa Tengah & DI Yogyakarta" },
  { id: "kodam-5", numeral: "V", name: "Kodam V/Brawijaya", nick: "Brawijaya", hq: "Surabaya", territory: "Jawa Timur" },
  { id: "kodam-9", numeral: "IX", name: "Kodam IX/Udayana", nick: "Udayana", hq: "Denpasar", territory: "Bali, NTB, NTT" },
  { id: "kodam-12", numeral: "XII", name: "Kodam XII/Tanjungpura", nick: "Tanjungpura", hq: "Pontianak", territory: "Kalimantan Barat" },
  { id: "kodam-22", numeral: "XXII", name: "Kodam XXII/Tambun Bungai", nick: "Tambun Bungai", hq: "Palangka Raya", territory: "Kalimantan Tengah & Selatan", isNew: true },
  { id: "kodam-6", numeral: "VI", name: "Kodam VI/Mulawarman", nick: "Mulawarman", hq: "Balikpapan", territory: "Kalimantan Timur & Utara" },
  { id: "kodam-13", numeral: "XIII", name: "Kodam XIII/Merdeka", nick: "Merdeka", hq: "Manado", territory: "Sulawesi Utara & Gorontalo" },
  { id: "kodam-23", numeral: "XXIII", name: "Kodam XXIII/Palaka Wira", nick: "Palaka Wira", hq: "Palu", territory: "Sulawesi Tengah & Barat", isNew: true },
  { id: "kodam-14", numeral: "XIV", name: "Kodam XIV/Hasanuddin", nick: "Hasanuddin", hq: "Makassar", territory: "Sulawesi Selatan & Tenggara" },
  { id: "kodam-16", numeral: "XVI", name: "Kodam XVI/Pattimura", nick: "Pattimura", hq: "Ambon", territory: "Maluku & Maluku Utara" },
  { id: "kodam-18", numeral: "XVIII", name: "Kodam XVIII/Kasuari", nick: "Kasuari", hq: "Manokwari", territory: "Papua Barat & Papua Barat Daya" },
  { id: "kodam-17", numeral: "XVII", name: "Kodam XVII/Cenderawasih", nick: "Cenderawasih", hq: "Jayapura", territory: "Papua, Papua Tengah & Pegunungan" },
  { id: "kodam-24", numeral: "XXIV", name: "Kodam XXIV/Mandala Trikora", nick: "Mandala Trikora", hq: "Merauke", territory: "Papua Selatan", isNew: true },
];

export const KODAM_BY_ID: Record<string, Kodam> = Object.fromEntries(KODAM.map((k) => [k.id, k]));
