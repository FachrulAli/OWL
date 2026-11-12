export function sevClass(sev: string) {
  return `pill sev-${sev}`;
}

export function riskColor(r: number) {
  if (r >= 70) return "#e2424a";
  if (r >= 50) return "#e8732c";
  if (r >= 30) return "#d7a21a";
  return "#3f8f5b";
}

export function sevFromRisk(r: number) {
  if (r >= 70) return "critical";
  if (r >= 50) return "high";
  if (r >= 30) return "medium";
  return "low";
}

export function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export const ROLE_LABEL: Record<string, string> = {
  // pangkat/jabatan pemegang HP dinas (domain MTD)
  pati: "Perwira Tinggi",
  pamen_intel: "Pamen Intelijen",
  pamen_ops: "Pamen Operasi",
  pama_siber: "Pama Satsiber",
  bintara_komlek: "Bintara Komlek",
  ajudan: "Ajudan",
  prajurit: "Prajurit",
  // peran domain endpoint (modul insider threat)
  admin_satsiber: "Admin Satsiber",
  csirt_analyst: "CSIRT Analyst",
  team_lead: "Team Lead",
  operator: "Operator",
  data_custodian: "Data Custodian",
  personel: "Personel",
  auditor: "Auditor",
};

export const CAT_LABEL: Record<string, string> = {
  // kategori ancaman HP (MTD)
  zero_click_delivery: "Pengiriman Senyap",
  zero_click_exploit: "Eksploitasi Zero-Click",
  spyware_implant: "Implan Spyware",
  covert_surveillance: "Penyadapan Tersembunyi",
  covert_exfiltration: "Eksfiltrasi Tersembunyi",
  c2_beacon: "Denyut Kendali (C2)",
  malicious_app: "Aplikasi Jahat",
  device_tampering: "Perangkat Dimanipulasi",
  mitm: "Penyadapan TLS",
  radio_attack: "Serangan Radio / IMSI",
  vulnerable_posture: "Postur Rentan",
  // kategori domain endpoint (insider threat)
  data_exfiltration: "Eksfiltrasi Data",
  privilege_abuse: "Privilege Abuse",
  lateral_movement: "Lateral Movement",
  logon_anomaly: "Anomali Logon",
  suspicious_process: "Proses Mencurigakan",
  mass_file_access: "Mass File Access",
  usb_exfiltration: "USB Exfiltration",
  config_tampering: "Config Tampering",
};


// Tahap kill-chain zero-click, dalam urutan terjadinya.
export const STAGE_LABEL: Record<string, string> = {
  posture: "Postur Rentan",
  delivery: "Pengiriman",
  exploit: "Eksploitasi",
  install: "Pemasangan",
  privilege: "Eskalasi Izin",
  persistence: "Persistensi",
  implant: "Implan Aktif",
  tampering: "Manipulasi",
  mitm: "Penyadapan TLS",
  c2: "Kendali Jarak Jauh",
  collection: "Pengumpulan Data",
  radio: "Serangan Radio",
};

export const STAGE_ORDER = ["posture", "delivery", "exploit", "install",
  "privilege", "persistence", "implant", "tampering", "mitm", "c2",
  "collection", "radio"];

// Tindakan yang disarankan engine untuk sebuah rantai terbukti.
export const RESPONSE_LABEL: Record<string, string> = {
  isolate: "Isolasi perangkat",
  quarantine: "Karantina aplikasi",
  investigate: "Periksa manual",
  patch: "Prioritaskan patch",
};

export const RESPONSE_HINT: Record<string, string> = {
  isolate: "Putuskan dari jaringan dinas, amankan perangkat untuk forensik, "
    + "ganti kredensial yang pernah dipakai di HP ini.",
  quarantine: "Nonaktifkan paket lewat MDM, tarik berkas APK untuk analisis.",
  investigate: "Verifikasi dengan pemegang perangkat sebelum tindakan teknis.",
  patch: "Dorong pembaruan OS/keamanan lewat MDM, naikkan prioritas perangkat.",
};

export function platformIcon(platform: string) {
  const p = (platform || "").toLowerCase();
  if (p.includes("ios")) return "iOS";
  if (p.includes("android")) return "AND";
  return "—";
}

// Jendela waktu rantai dalam bahasa manusia.
export function fmtSpan(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} detik`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} menit ${r} detik` : `${m} menit`;
}

// Umur patch -> tingkat kerentanan postur.
export function patchRisk(days: number) {
  if (days >= 180) return { label: "kedaluwarsa", color: "#e2424a" };
  if (days >= 90) return { label: "tertinggal", color: "#e8732c" };
  if (days >= 45) return { label: "perlu update", color: "#d7a21a" };
  return { label: "mutakhir", color: "#3f8f5b" };
}


/**
 * Sudah berapa lama perangkat tidak melapor.
 *
 * Pada sistem pemantauan, perangkat yang senyap BUKAN berarti aman — itu
 * titik buta. Karena itu keheningan ditampilkan, bukan disembunyikan.
 * Ambang 10 menit dipilih dari interval sampel agent (30 detik) dengan
 * kelonggaran besar untuk jaringan seluler yang putus-nyambung.
 */
export function silence(lastSeen?: string | null) {
  if (!lastSeen) return { stale: true, label: "belum pernah melapor", mins: Infinity };
  const mins = (Date.now() - new Date(lastSeen).getTime()) / 60000;
  if (mins < 10) return { stale: false, label: "", mins };
  if (mins < 60) return { stale: true, label: `senyap ${Math.round(mins)} mnt`, mins };
  if (mins < 1440) return { stale: true, label: `senyap ${Math.round(mins / 60)} jam`, mins };
  return { stale: true, label: `senyap ${Math.round(mins / 1440)} hari`, mins };
}

/** Nama perangkat ringkas untuk kolom sempit. */
export function deviceLabel(e: { device_model?: string; platform?: string; os_version?: string }) {
  const m = e.device_model || "perangkat tidak dikenal";
  const os = e.platform ? `${platformIcon(e.platform)} ${e.os_version ?? ""}`.trim() : "";
  return { model: m, os };
}

/** Nama pemegang perangkat; jatuh kembali ke display_name bila belum terdaftar. */
export function holderLabel(e: {
  holder_rank?: string; holder_name?: string; display_name?: string;
}) {
  const r = (e.holder_rank || "").trim();
  const n = (e.holder_name || "").trim();
  if (n) return { rank: r, name: n };
  return { rank: "", name: e.display_name || "—" };
}

/* ────────────────────────────────────────────────────────────────────
   Label dua bahasa.

   Peta di atas (ROLE_LABEL, CAT_LABEL, STAGE_LABEL, RESPONSE_LABEL) tetap
   dipakai sebagai sumber bahasa Indonesia. Di bawah ini padanannya dalam
   bahasa Inggris, lalu `labels(lang)` memilih pasangan yang tepat.

   Nama satuan dan pangkat TIDAK diterjemahkan: Kodam, Pussiberad, NRP, dan
   jenjang kepangkatan adalah nama lembaga, bukan kosakata umum. Yang
   diterjemahkan hanya jabatan fungsionalnya.
   ──────────────────────────────────────────────────────────────────── */

const ROLE_EN: Record<string, string> = {
  pati: "General officer", pamen_intel: "Intelligence officer",
  pamen_ops: "Operations officer", pama_siber: "Cyber officer",
  bintara_komlek: "Signals NCO", ajudan: "Aide-de-camp", prajurit: "Enlisted",
  admin_satsiber: "Cyber admin", csirt_analyst: "CSIRT analyst",
  team_lead: "Team lead", operator: "Operator",
  data_custodian: "Data custodian", personel: "Personnel", auditor: "Auditor",
};

const CAT_EN: Record<string, string> = {
  zero_click_delivery: "Silent Delivery", zero_click_exploit: "Zero-Click Exploit",
  spyware_implant: "Spyware Implant", covert_surveillance: "Covert Surveillance",
  covert_exfiltration: "Covert Exfiltration", c2_beacon: "C2 Beacon",
  malicious_app: "Malicious App", device_tampering: "Device Tampering",
  mitm: "TLS Interception", radio_attack: "Radio / IMSI Attack",
  vulnerable_posture: "Vulnerable Posture",
  data_exfiltration: "Data Exfiltration", privilege_abuse: "Privilege Abuse",
  lateral_movement: "Lateral Movement", logon_anomaly: "Logon Anomaly",
  suspicious_process: "Suspicious Process", mass_file_access: "Mass File Access",
  usb_exfiltration: "USB Exfiltration", config_tampering: "Config Tampering",
};

const STAGE_EN: Record<string, string> = {
  posture: "Vulnerable Posture", delivery: "Delivery", exploit: "Exploitation",
  install: "Installation", privilege: "Privilege Escalation",
  persistence: "Persistence", implant: "Implant Active", tampering: "Tampering",
  mitm: "TLS Interception", c2: "Command & Control", collection: "Collection",
  radio: "Radio Attack",
};

const RESPONSE_EN: Record<string, string> = {
  isolate: "Isolate device", quarantine: "Quarantine app",
  investigate: "Investigate manually", patch: "Prioritise patching",
};

export function labels(lang: "en" | "id") {
  const id = lang === "id";
  return {
    role: id ? ROLE_LABEL : ROLE_EN,
    cat: id ? CAT_LABEL : CAT_EN,
    stage: id ? STAGE_LABEL : STAGE_EN,
    response: id ? RESPONSE_LABEL : RESPONSE_EN,
  };
}

/** Keheningan perangkat dalam bahasa yang dipilih. */
export function silenceL(lastSeen: string | null | undefined, lang: "en" | "id") {
  const s = silence(lastSeen);
  if (!s.stale) return s;
  const id = lang === "id";
  if (s.mins === Infinity) return { ...s, label: id ? "belum pernah melapor" : "never reported" };
  const m = s.mins;
  const n = m < 60 ? Math.round(m) : m < 1440 ? Math.round(m / 60) : Math.round(m / 1440);
  const unit = m < 60 ? (id ? "mnt" : "min") : m < 1440 ? (id ? "jam" : "h") : (id ? "hari" : "d");
  return { ...s, label: `${id ? "senyap" : "silent"} ${n} ${unit}` };
}
