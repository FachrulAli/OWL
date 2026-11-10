// Landing-page copy in two languages. English is the default for visitors.
// Indonesian is written to read naturally, not as a literal translation.
export type Lang = "en" | "id";

export interface Copy {
  nav: { approach: string; capabilities: string; architecture: string; standards: string; openConsole: string };
  hero: {
    eyebrow: string; lead: string; hl: string; sub: string; quote: string;
    ctaPrimary: string; ctaGhost: string;
    liveTag: string; eps: string; entities: string; cases: string; nodes: string;
  };
  gap: {
    eyebrow: string; h: string; p: string;
    perimeterTitle: string; perimeter: string[];
    usTitle: string; us: string[];
  };
  eyes: { eyebrow: string; h: string; p: string; cards: { idx: string; title: string; body: string }[] };
  arch: {
    eyebrow: string; h: string; p: string; flow1: string; flow2: string;
    tiers: { tier: string; name: string; body: string; chips: string[] }[];
  };
  caps: { eyebrow: string; h: string; p: string; items: { mk: string; title: string; body: string }[] };
  standards: { eyebrow: string; h: string; badges: { n: string; d: string }[] };
  cta: { eyebrow: string; h: string; p: string; button: string };
  footer: { meta1: string; meta2: string };
}

export const C: Record<Lang, Copy> = {
  en: {
    nav: { approach: "Approach", capabilities: "Capabilities", architecture: "Architecture", standards: "Standards", openConsole: "Open console →" },
    hero: {
      eyebrow: "Insider Threat Detection · Zero Trust Intelligence",
      lead: "A valid credential is no proof of ",
      hl: "valid intent.",
      sub: "TRINETRA learns how each role normally works across the TNI AD CSIRT environment — administrators, analysts, operators, data custodians — then surfaces the activity that breaks from that pattern: data quietly leaving, access rights climbing, movement between systems that doesn't add up. The watch faces inward, not just at the outer wall.",
      quote: "\"The real adversary is not beyond the wall — it is already inside, among us.\"",
      ctaPrimary: "Open the command console →",
      ctaGhost: "See the architecture",
      liveTag: "LIVE",
      eps: "Events per second", entities: "Entities under watch", cases: "Open cases", nodes: "Federated nodes",
    },
    gap: {
      eyebrow: "Two ways to defend",
      h: "The perimeter inspects traffic. TRINETRA weighs behavior.",
      p: "Conventional security is built to hold back what hasn't entered yet. Once an account carries legitimate access, it passes almost unopposed. That is the moment the behavioral layer starts to matter.",
      perimeterTitle: "Perimeter defense",
      perimeter: [
        "Inspects packets and signatures at the network edge.",
        "Takes a legitimate account as trusted by default.",
        "Sees from one point only, bound to a single perimeter.",
        "Leans on static rules that someone has to update by hand.",
      ],
      usTitle: "TRINETRA behavioral layer",
      us: [
        "Weighs every action against the normal pattern for its role.",
        "Re-checks even a trusted account on each action it takes.",
        "Threads signals from the unit, through the Kodam, to the center.",
        "Pairs adaptive patterns with rules tied to MITRE ATT&CK.",
      ],
    },
    eyes: {
      eyebrow: "Three eyes",
      h: "Three angles of observation that lock together.",
      p: "TRINETRA means \"three eyes,\" and the three map onto the layers that separate ordinary work from the misuse of access.",
      cards: [
        { idx: "EYE 01", title: "Identity & Behavior", body: "A normal pattern is drawn per role from how much data leaves, when and where logins happen, how many files are opened, and which commands are run. A deviation is measured as distance from peers in the same role — not a hunch." },
        { idx: "EYE 02", title: "Data & Endpoint", body: "Process, file, network, logon, and removable-media activity is gathered from every Windows and Linux device, then standardized to the OCSF schema before it reaches the scoring engines." },
        { idx: "EYE 03", title: "Network & Command", body: "An anomaly caught in the field rises to the center. The same pattern appearing at once across several Kodam is joined into a single incident — something no node can see on its own." },
      ],
    },
    arch: {
      eyebrow: "Tiered architecture",
      h: "Three tiers, from the device in the field to the command center.",
      p: "Policy and reference patterns move down from the center; telemetry and risk move up from the field. Each Kodam node scores on its own and keeps running even when the link to the center drops.",
      flow1: "↑ telemetry · policy ↓",
      flow2: "↑ alerts & risk",
      tiers: [
        { tier: "TIER 2", name: "Units / Regions", body: "Endpoint agents and log sources stream raw behavioral traces to the nearest node.", chips: ["Windows", "Linux", "AD / LDAP", "Proxy", "Syslog"] },
        { tier: "TIER 1", name: "CSIRT Kodam", body: "Normalization, role enrichment, the rule engine, and UEBA produce a 0–100 risk score per entity. This layer stands alone when the uplink is lost.", chips: ["OCSF", "Sigma", "Isolation Forest", "Peer-group", "Risk Scoring"] },
        { tier: "TIER 0", name: "Satsiber TNI AD", body: "Cross-node correlation, central policy management, and a command center for triaging and escalating cases.", chips: ["Correlation", "Case Management", "Policy Manager"] },
      ],
    },
    caps: {
      eyebrow: "Detection coverage",
      h: "Eight classes of insider behavior, two engines that reinforce each other.",
      p: "A rule engine catches the clear signatures; UEBA catches the quiet drift away from normal. The two scores combine, so when both agree, confidence rises and false alarms fall.",
      items: [
        { mk: "T1567", title: "Data exfiltration", body: "Outbound data passes the role's reasonable limit or heads outside the network." },
        { mk: "T1548", title: "Privilege abuse", body: "Access rights change or climb outside any recorded procedure." },
        { mk: "T1021", title: "Lateral movement", body: "One account reaches many devices within a narrow window." },
        { mk: "T1078", title: "Logon anomaly", body: "A sign-in outside the role's hours or from an unlikely location." },
        { mk: "T1059", title: "Suspicious process", body: "A tool runs that matches a known offensive technique." },
        { mk: "T1119", title: "Mass file access", body: "Files are opened far above the habit of that role." },
        { mk: "T1052", title: "USB exfiltration", body: "A write to removable media by a role that should never use it." },
        { mk: "T1562", title: "Config tampering", body: "Configuration is changed or auditing switched off outside the maintenance window." },
      ],
    },
    standards: {
      eyebrow: "Reference foundation",
      h: "Built on recognized frameworks, not in-house definitions.",
      badges: [
        { n: "NIST SP 800-207", d: "Zero Trust Architecture" },
        { n: "NIST SP 800-53", d: "Security & Privacy Controls" },
        { n: "NIST SP 800-61", d: "Incident Handling" },
        { n: "MITRE ATT&CK", d: "Technique mapping" },
        { n: "MITRE Insider Threat", d: "Insider TTPs" },
        { n: "OCSF", d: "Open telemetry schema" },
        { n: "Sigma", d: "Detection as code" },
        { n: "CISA", d: "Insider Threat Mitigation" },
      ],
    },
    cta: {
      eyebrow: "Live prototype",
      h: "The console shows this same data, live.",
      p: "The figures on this page come from the pipeline that drives the console: telemetry in motion, risk scores shifting, correlations forming — refreshed every second.",
      button: "Enter the console →",
    },
    footer: {
      meta1: "Beyond Access Control, Toward Continuous Trust Verification",
      meta2: "Kartika Cyber Hackathon 2026 · PUSSIBERAD × CODEPOLITAN",
    },
  },

  id: {
    nav: { approach: "Pendekatan", capabilities: "Kapabilitas", architecture: "Arsitektur", standards: "Standar", openConsole: "Buka console →" },
    hero: {
      eyebrow: "Deteksi Ancaman Orang Dalam · Intelijen Zero Trust",
      lead: "Akses yang sah belum tentu ",
      hl: "niat yang sah.",
      sub: "TRINETRA mempelajari cara kerja normal setiap peran di lingkungan CSIRT TNI AD — admin, analis, operator, sampai pengelola data — lalu menyorot aktivitas yang keluar dari pola itu: data yang diam-diam dibawa keluar, hak akses yang tiba-tiba naik, perpindahan antar sistem yang tak masuk akal. Pengawasannya menghadap ke dalam, bukan cuma ke pagar luar.",
      quote: "\"Musuh yang sesungguhnya bukan di balik pagar — ia sudah berada di dalam, di antara kita.\"",
      ctaPrimary: "Buka command console →",
      ctaGhost: "Lihat arsitekturnya",
      liveTag: "LANGSUNG",
      eps: "Event per detik", entities: "Entitas yang diawasi", cases: "Kasus terbuka", nodes: "Node terhubung",
    },
    gap: {
      eyebrow: "Dua cara bertahan",
      h: "Perimeter memeriksa lalu lintas. TRINETRA menimbang perilaku.",
      p: "Keamanan konvensional dirancang untuk menahan yang belum masuk. Begitu sebuah akun sudah memegang izin yang sah, ia lewat nyaris tanpa hambatan. Di titik itulah lapisan perilaku mulai bekerja.",
      perimeterTitle: "Pertahanan perimeter",
      perimeter: [
        "Memeriksa paket dan signature di tepi jaringan.",
        "Menganggap akun berizin sah sudah pasti tepercaya.",
        "Melihat dari satu titik saja, sebatas satu perimeter.",
        "Bersandar pada aturan statis yang harus diperbarui manual.",
      ],
      usTitle: "Lapisan perilaku TRINETRA",
      us: [
        "Menimbang tiap tindakan terhadap pola normal perannya.",
        "Memeriksa ulang bahkan akun tepercaya di setiap tindakan.",
        "Merangkai sinyal dari satuan, lewat Kodam, sampai ke pusat.",
        "Memadukan pola adaptif dengan aturan yang mengacu ke MITRE ATT&CK.",
      ],
    },
    eyes: {
      eyebrow: "Tiga mata",
      h: "Tiga sudut pengamatan yang saling mengunci.",
      p: "TRINETRA berarti \"tiga mata\", dan ketiganya memang memetakan lapisan yang memisahkan pekerjaan wajar dari penyalahgunaan akses.",
      cards: [
        { idx: "MATA 01", title: "Identitas & Perilaku", body: "Pola normal disusun untuk tiap peran dari seberapa banyak data keluar, kapan dan dari mana login dilakukan, berapa berkas dibuka, dan perintah apa yang dijalankan. Penyimpangan dihitung sebagai jarak dari rekan seperan — bukan sekadar firasat." },
        { idx: "MATA 02", title: "Data & Endpoint", body: "Jejak proses, berkas, jaringan, login, dan media lepas dikumpulkan dari tiap perangkat Windows maupun Linux, lalu diseragamkan ke format OCSF sebelum masuk ke mesin penilai." },
        { idx: "MATA 03", title: "Jaringan & Komando", body: "Anomali yang tertangkap di lapangan naik ke pusat. Pola serupa yang muncul berbarengan di beberapa Kodam disatukan jadi satu insiden — hal yang tak terlihat kalau tiap node berdiri sendiri." },
      ],
    },
    arch: {
      eyebrow: "Arsitektur berjenjang",
      h: "Tiga jenjang, dari perangkat di satuan sampai pusat komando.",
      p: "Kebijakan dan pola acuan turun dari pusat; telemetri dan skor risiko naik dari satuan. Tiap node Kodam menilai sendiri dan tetap jalan meski putus dari pusat.",
      flow1: "↑ telemetri · kebijakan ↓",
      flow2: "↑ alert & risiko",
      tiers: [
        { tier: "TIER 2", name: "Satuan / Wilayah", body: "Agen di perangkat dan sumber log mengalirkan jejak perilaku mentah ke node terdekat.", chips: ["Windows", "Linux", "AD / LDAP", "Proxy", "Syslog"] },
        { tier: "TIER 1", name: "CSIRT Kodam", body: "Penyeragaman data, pengayaan peran, rule engine, dan UEBA menghasilkan skor risiko 0–100 per entitas. Lapisan ini berdiri sendiri saat sambungan ke pusat terputus.", chips: ["OCSF", "Sigma", "Isolation Forest", "Peer-group", "Risk Scoring"] },
        { tier: "TIER 0", name: "Satsiber TNI AD", body: "Korelasi antar-node, pengelolaan kebijakan terpusat, dan pusat komando untuk memilah serta meneruskan kasus.", chips: ["Korelasi", "Case Management", "Policy Manager"] },
      ],
    },
    caps: {
      eyebrow: "Cakupan deteksi",
      h: "Delapan pola perilaku orang dalam, dua mesin yang saling menguatkan.",
      p: "Rule engine menangkap tanda yang jelas; UEBA menangkap pergeseran halus dari pola normal. Kedua skor digabung, jadi ketika keduanya sepakat, keyakinan naik dan alarm palsu menurun.",
      items: [
        { mk: "T1567", title: "Eksfiltrasi data", body: "Data keluar melewati batas wajar peran atau mengarah ke luar jaringan." },
        { mk: "T1548", title: "Penyalahgunaan hak akses", body: "Hak akses berubah atau naik di luar prosedur yang tercatat." },
        { mk: "T1021", title: "Perpindahan lateral", body: "Satu akun menyentuh banyak perangkat dalam waktu singkat." },
        { mk: "T1078", title: "Login janggal", body: "Masuk di luar jam kerja peran atau dari lokasi yang tak lazim." },
        { mk: "T1059", title: "Proses mencurigakan", body: "Menjalankan perkakas yang cocok dengan teknik serangan dikenal." },
        { mk: "T1119", title: "Akses berkas massal", body: "Membuka berkas jauh di atas kebiasaan peran tersebut." },
        { mk: "T1052", title: "Eksfiltrasi lewat USB", body: "Menulis ke media lepas pada peran yang semestinya tak memakainya." },
        { mk: "T1562", title: "Utak-atik konfigurasi", body: "Mengubah konfigurasi atau mematikan audit di luar jadwal pemeliharaan." },
      ],
    },
    standards: {
      eyebrow: "Landasan rujukan",
      h: "Berpijak pada kerangka yang sudah diakui, bukan definisi bikinan sendiri.",
      badges: [
        { n: "NIST SP 800-207", d: "Arsitektur Zero Trust" },
        { n: "NIST SP 800-53", d: "Kontrol Keamanan & Privasi" },
        { n: "NIST SP 800-61", d: "Penanganan Insiden" },
        { n: "MITRE ATT&CK", d: "Pemetaan teknik" },
        { n: "MITRE Insider Threat", d: "TTP orang dalam" },
        { n: "OCSF", d: "Format telemetri terbuka" },
        { n: "Sigma", d: "Deteksi sebagai kode" },
        { n: "CISA", d: "Panduan Mitigasi Insider" },
      ],
    },
    cta: {
      eyebrow: "Purwarupa aktif",
      h: "Console menampilkan data yang sama, secara langsung.",
      p: "Angka di halaman ini diambil dari pipeline yang sama dengan console: telemetri yang mengalir, skor risiko yang bergerak, dan korelasi yang terbentuk — diperbarui tiap detik.",
      button: "Masuk ke console →",
    },
    footer: {
      meta1: "Bukan sekadar mengatur siapa yang boleh masuk, tetapi memastikan tiap aktivitas tetap dalam batas kewenangannya.",
      meta2: "Kartika Cyber Hackathon 2026 · PUSSIBERAD × CODEPOLITAN",
    },
  },
};
