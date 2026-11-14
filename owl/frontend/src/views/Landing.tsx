import { Lockup } from '../components/Logo'
import { useT } from '../lib/i18n'

/**
 * Halaman depan.
 *
 * Yang dibuka pertama kali bukan dashboard, melainkan halaman yang
 * menjelaskan apa yang dinilai OWL dan apa yang TIDAK diklaimnya. Naskahnya
 * mengikuti proposal dan deck, termasuk batas klaimnya, sebab halaman depan
 * yang menjanjikan lebih daripada yang dapat dibuktikan purwarupa justru
 * merusak kepercayaan yang hendak dibangun dashboard di belakangnya.
 *
 * Angka 18 dan 87 di bawah bukan hiasan: keduanya keluaran mesin aturan yang
 * sama dengan yang dipakai dashboard, dan dikunci oleh uji.
 */
interface Kartu {
  judul: string
  isi: string
}

interface Copy {
  kicker: string
  judul1: string
  judul2: string
  lead: string
  ctaDashboard: string
  ctaRepo: string
  batasKlaim: string

  butaKicker: string
  butaJudul: string
  butaLead: string

  ancamanKicker: string
  ancamanJudul: string
  statistik: { angka: string; isi: string }[]
  ancamanCatatan: string

  sinyalKicker: string
  sinyalJudul: string
  sinyalLead: string
  sinyal: Kartu[]

  kerjaKicker: string
  kerjaJudul: string
  langkah: Kartu[]

  gerbangKicker: string
  gerbangJudul: string
  lolos: string
  ditolak: string
  lolosIsi: string
  ditolakIsi: string
  gerbangCatatan: string

  daulatKicker: string
  daulatJudul: string
  daulat: Kartu[]

  jujurKicker: string
  jujurJudul: string
  adalah: string[]
  bukan: string[]

  tutupJudul: string
  tutupLead: string
  footer: string
}

const ID: Copy = {
  kicker: 'Kartika Cyber Hackathon 2026 · Defensive Shield · TNI AD',
  judul1: 'Gerbang risiko perangkat',
  judul2: 'untuk data & komunikasi prajurit.',
  lead: 'OWL membaca enam sinyal keamanan yang sudah tersedia di perangkat, '
    + 'mengubahnya menjadi satu skor risiko yang dapat ditelusuri, lalu memakainya '
    + 'sebagai rekomendasi keputusan akses. Berjalan on-prem dan siap air-gapped.',
  ctaDashboard: 'Buka dashboard',
  ctaRepo: 'Lihat kode di GitHub',
  batasKlaim: 'OWL menilai indikator risiko dan potensi kompromi. OWL tidak '
    + 'mengklaim memastikan seluruh bentuk penyadapan, mendeteksi semua spyware, '
    + 'atau menggantikan antivirus maupun MDM.',

  butaKicker: 'Titik buta',
  butaJudul: 'Server dipagari rapat. Ponsel di saku tidak.',
  butaLead: 'SOC dan CSIRT memantau server dan jaringan, sedangkan perangkat yang '
    + 'dibawa prajurit ke lapangan tidak terlihat oleh pertahanan mana pun. Di '
    + 'perangkat itulah pesan kedinasan, dokumen, akses sistem satuan, mikrofon, '
    + 'dan kamera berada sekaligus.',

  ancamanKicker: 'Lanskap ancaman',
  ancamanJudul: 'Penyadapan ponsel bukan perkiraan.',
  statistik: [
    { angka: 'Pegasus', isi: 'spyware mercenary terdokumentasi menyasar jurnalis, aktivis, dan pejabat — Amnesty Security Lab, Citizen Lab' },
    { angka: '+196%', isi: 'lonjakan trojan perbankan mobile sepanjang 2024 — Kaspersky' },
    { angka: '>33 jt', isi: 'serangan malware mobile global 2024, banyak di antaranya merekam mikrofon, kamera, dan lokasi — Securelist' },
  ],
  ancamanCatatan: 'Indonesia tidak menerbitkan statistik nasional kasus penyadapan '
    + 'ponsel terverifikasi, jadi yang dipakai di sini adalah bukti spyware dan '
    + 'malware mobile yang dapat diperiksa sumbernya, bukan angka yang dikarang.',

  sinyalKicker: 'Yang dibaca',
  sinyalJudul: 'Enam sinyal, bukan isi pesanmu.',
  sinyalLead: 'OWL tidak membaca isi pesan, rekaman suara, gambar kamera, atau '
    + 'lokasi presisi. Skema telemetrinya bahkan tidak punya tempat untuk itu.',
  sinyal: [
    { judul: '1. Izin aplikasi', isi: 'Gabungan izin mikrofon, kamera, dan lokasi yang tidak sejalan dengan fungsi aplikasinya.' },
    { judul: '2. Layanan aksesibilitas', isi: 'Aplikasi yang dapat membaca seluruh layar dan menekan tombol menggantikan pengguna. Jalur utama pencurian kredensial.' },
    { judul: '3. Sertifikat & VPN', isi: 'CA yang dipasang pengguna dan profil VPN di luar daftar izin satuan. Prasyarat penyadapan TLS.' },
    { judul: '4. Sumber pemasangan', isi: 'Aplikasi yang dipasang dari luar toko resmi. Sinyal risiko, bukan vonis malware.' },
    { judul: '5. Integritas perangkat', isi: 'Artefak root, bootloader terbuka, dan tingkat patch keamanan yang tertinggal.' },
    { judul: '6. Perilaku jaringan', isi: 'Metadata volume dan tujuan keluar. Isi lalu lintas tidak pernah dibaca.' },
  ],

  kerjaKicker: 'Cara kerja',
  kerjaJudul: 'Dari perangkat ke keputusan akses.',
  langkah: [
    { judul: 'Registrasi', isi: 'Perangkat terdaftar dengan identitas yang tetap.' },
    { judul: 'Telemetri', isi: 'Agent Android melaporkan enam sinyal beserta status keterbacaannya.' },
    { judul: 'Korelasi', isi: 'Beberapa aturan harus menyala bersama sebelum dianggap pola, bukan kebetulan.' },
    { judul: 'Skor 0–100', isi: 'Bobot kategori, severitas, dan peluruhan. Tiap poin dapat dibuka asalnya.' },
    { judul: 'Keputusan', isi: 'Allow, step-up, akses terbatas, atau tolak dan karantina.' },
  ],

  gerbangKicker: 'Hasilnya',
  gerbangJudul: 'Dua perangkat, satu gerbang.',
  lolos: 'LOLOS',
  ditolak: 'DITOLAK',
  lolosIsi: 'Perangkat bersih: temuan ringan, akses penuh direkomendasikan.',
  ditolakIsi: 'Aksesibilitas tak dikenal, CA pengguna, sideload, dan VPN gelap sekaligus. Ditolak untuk sistem terklasifikasi.',
  gerbangCatatan: 'Kedua angka dihitung mesin aturan, bukan ditulis tangan ke '
    + 'halaman ini, dan dikunci oleh uji otomatis. Keluarannya adalah rekomendasi '
    + 'keputusan akses; pemblokiran sebenarnya menuntut integrasi dengan gateway, '
    + 'IAM, atau MDM satuan.',

  daulatKicker: 'Kedaulatan',
  daulatJudul: 'Semuanya di dalam tembok sendiri.',
  daulat: [
    { judul: 'On-prem, siap air-gapped', isi: 'Penilaian risiko tidak memanggil layanan cloud mana pun. Dua kontainer, satu basis data.' },
    { judul: 'Feed ke Kartika CSIRT', isi: 'STIX 2.1 lewat webhook bertanda tangan HMAC, dan CEF lewat Syslog.' },
    { judul: 'Data yang berumur', isi: 'Telemetri dan hasil pemeriksaan dihapus otomatis setelah masa retensi; jejak audit kebijakan tetap disimpan.' },
  ],

  jujurKicker: 'Batas yang dinyatakan di depan',
  jujurJudul: 'Apa yang OWL kerjakan, dan apa yang tidak.',
  adalah: [
    'Lapisan penilaian risiko konfigurasi dan perilaku app-layer',
    'Masukan keputusan akses Zero Trust yang dapat ditelusuri',
    'Komplemen MDM seperti Knox atau Intune',
    'Sensor endpoint untuk SOC dan CSIRT satuan',
  ],
  bukan: [
    'Antivirus atau deteksi malware berbasis signature',
    'Anti-sadap total',
    'Pengganti MDM',
    'Detektor implant baseband, IMSI catcher, atau intersepsi RF',
  ],

  tutupJudul: 'Perangkat yang terdaftar belum tentu aman.',
  tutupLead: 'Setiap perangkat perlu dinilai berdasarkan indikator risikonya '
    + 'sebelum dipercaya menyentuh sistem strategis.',
  footer: 'Purwarupa Kartika Cyber Hackathon 2026 · PUSSIBERAD × CODEPOLITAN',
}

const EN: Copy = {
  kicker: 'Kartika Cyber Hackathon 2026 · Defensive Shield · Indonesian Army',
  judul1: 'A device risk gate',
  judul2: 'for soldiers’ data and communications.',
  lead: 'OWL reads six security signals already present on the device, turns them '
    + 'into one traceable risk score, and uses that score as an access decision '
    + 'recommendation. It runs on-premise and is ready for air-gapped deployment.',
  ctaDashboard: 'Open the dashboard',
  ctaRepo: 'See the code on GitHub',
  batasKlaim: 'OWL assesses risk indicators and signs of possible compromise. It '
    + 'does not claim to catch every form of interception, to detect all spyware, or '
    + 'to replace antivirus or MDM.',

  butaKicker: 'The blind spot',
  butaJudul: 'Servers are fenced in. The phone in the pocket is not.',
  butaLead: 'SOC and CSIRT teams watch servers and networks, while the device a '
    + 'soldier carries into the field is visible to no defence at all. That device '
    + 'holds official messages, documents, unit system access, a microphone and a '
    + 'camera, all at once.',

  ancamanKicker: 'Threat landscape',
  ancamanJudul: 'Phone surveillance is not a guess.',
  statistik: [
    { angka: 'Pegasus', isi: 'mercenary spyware documented targeting journalists, activists and officials — Amnesty Security Lab, Citizen Lab' },
    { angka: '+196%', isi: 'rise in mobile banking trojans through 2024 — Kaspersky' },
    { angka: '>33M', isi: 'global mobile malware attacks in 2024, many of them recording microphone, camera and location — Securelist' },
  ],
  ancamanCatatan: 'Indonesia publishes no verified national count of phone '
    + 'interception cases, so the evidence used here is spyware and mobile malware '
    + 'reporting whose sources can be checked, not invented figures.',

  sinyalKicker: 'What it reads',
  sinyalJudul: 'Six signals, not your messages.',
  sinyalLead: 'OWL never reads message content, audio, camera images or precise '
    + 'location. Its telemetry schema has no place to put them.',
  sinyal: [
    { judul: '1. App permissions', isi: 'Combinations of microphone, camera and location permissions that do not match what the app is for.' },
    { judul: '2. Accessibility services', isi: 'Apps able to read the whole screen and press buttons for the user. The primary route for credential theft.' },
    { judul: '3. Certificates & VPN', isi: 'User-installed CAs and VPN profiles outside the unit allowlist. A precondition for TLS interception.' },
    { judul: '4. Install source', isi: 'Apps installed from outside the official store. A risk signal, not a malware verdict.' },
    { judul: '5. Device integrity', isi: 'Root artefacts, unlocked bootloader, and a security patch level left behind.' },
    { judul: '6. Network behaviour', isi: 'Egress volume and destination metadata. Traffic content is never read.' },
  ],

  kerjaKicker: 'How it works',
  kerjaJudul: 'From device to access decision.',
  langkah: [
    { judul: 'Enrolment', isi: 'The device registers with an identity that stays consistent.' },
    { judul: 'Telemetry', isi: 'The Android agent reports six signals and whether each one could be read.' },
    { judul: 'Correlation', isi: 'Several rules must fire together before a pattern counts as more than coincidence.' },
    { judul: 'Score 0–100', isi: 'Category weights, severity and decay. Every point can be traced to its source.' },
    { judul: 'Decision', isi: 'Allow, step-up, limited access, or deny and quarantine.' },
  ],

  gerbangKicker: 'The result',
  gerbangJudul: 'Two devices, one gate.',
  lolos: 'ALLOWED',
  ditolak: 'DENIED',
  lolosIsi: 'A clean device: light findings, full access recommended.',
  ditolakIsi: 'An unknown accessibility service, a user CA, a sideloaded app and a rogue VPN at once. Denied for classified systems.',
  gerbangCatatan: 'Both numbers come out of the rule engine rather than being typed '
    + 'into this page, and automated tests keep them there. The output is an access '
    + 'decision recommendation; real blocking requires integration with the unit '
    + 'gateway, IAM or MDM.',

  daulatKicker: 'Sovereignty',
  daulatJudul: 'All of it inside your own walls.',
  daulat: [
    { judul: 'On-prem, air-gapped ready', isi: 'Risk assessment calls no cloud service at all. Two containers, one database.' },
    { judul: 'Feed to Kartika CSIRT', isi: 'STIX 2.1 over an HMAC-signed webhook, and CEF over Syslog.' },
    { judul: 'Data that expires', isi: 'Telemetry and assessment results are deleted automatically after the retention window; the policy audit trail is kept.' },
  ],

  jujurKicker: 'Limits stated up front',
  jujurJudul: 'What OWL does, and what it does not.',
  adalah: [
    'A risk assessment layer over app-layer configuration and behaviour',
    'A traceable input to Zero Trust access decisions',
    'A complement to MDM such as Knox or Intune',
    'An endpoint sensor for the unit SOC and CSIRT',
  ],
  bukan: [
    'Antivirus or signature-based malware detection',
    'Complete protection against interception',
    'A replacement for MDM',
    'A detector for baseband implants, IMSI catchers or RF interception',
  ],

  tutupJudul: 'An enrolled device is not automatically a safe one.',
  tutupLead: 'Every device needs to be judged on its own risk indicators before it '
    + 'is trusted with strategic systems.',
  footer: 'Kartika Cyber Hackathon 2026 prototype · PUSSIBERAD × CODEPOLITAN',
}

const REPO = 'https://github.com/MrPrinceAli/OWL'

export function Landing({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  const { lang } = useT()
  const c = lang === 'en' ? EN : ID

  return (
    <div className="land">
      <section className="land-hero">
        <div className="land-hero-copy">
          <div className="kicker">{c.kicker}</div>
          <h1>{c.judul1}<br /><span className="accent">{c.judul2}</span></h1>
          <p className="land-lead">{c.lead}</p>
          <div className="land-cta">
            <button className="btn" onClick={onOpenDashboard}>{c.ctaDashboard}</button>
            <a className="btn ghost" href={REPO} target="_blank" rel="noreferrer">{c.ctaRepo}</a>
          </div>
          <p className="land-claim">{c.batasKlaim}</p>
        </div>
        <div className="land-hero-logo">
          <Lockup width={430} />
        </div>
      </section>

      <section className="land-sec">
        <div className="kicker">{c.butaKicker}</div>
        <h2>{c.butaJudul}</h2>
        <p className="land-lead">{c.butaLead}</p>
      </section>

      <section className="land-sec">
        <div className="kicker">{c.ancamanKicker}</div>
        <h2>{c.ancamanJudul}</h2>
        <div className="land-grid cols-3">
          {c.statistik.map((s) => (
            <div key={s.angka} className="card">
              <div className="land-num">{s.angka}</div>
              <p>{s.isi}</p>
            </div>
          ))}
        </div>
        <p className="land-note">{c.ancamanCatatan}</p>
      </section>

      <section className="land-sec">
        <div className="kicker">{c.sinyalKicker}</div>
        <h2>{c.sinyalJudul}</h2>
        <p className="land-lead">{c.sinyalLead}</p>
        <div className="land-grid cols-3">
          {c.sinyal.map((s) => (
            <div key={s.judul} className="card">
              <h3>{s.judul}</h3>
              <p>{s.isi}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-sec">
        <div className="kicker">{c.kerjaKicker}</div>
        <h2>{c.kerjaJudul}</h2>
        <div className="land-flow">
          {c.langkah.map((s, i) => (
            <div key={s.judul} className="land-step">
              <div className="n">{String(i + 1).padStart(2, '0')}</div>
              <h3>{s.judul}</h3>
              <p>{s.isi}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-sec">
        <div className="kicker">{c.gerbangKicker}</div>
        <h2>{c.gerbangJudul}</h2>
        <div className="land-gate">
          <div className="lane allow">
            <div className="v">{c.lolos}</div>
            <div className="score">18 <span>/ 100</span></div>
            <p>{c.lolosIsi}</p>
          </div>
          <div className="lane deny">
            <div className="v">{c.ditolak}</div>
            <div className="score">87 <span>/ 100</span></div>
            <p>{c.ditolakIsi}</p>
          </div>
        </div>
        <p className="land-note">{c.gerbangCatatan}</p>
      </section>

      <section className="land-sec">
        <div className="kicker">{c.daulatKicker}</div>
        <h2>{c.daulatJudul}</h2>
        <div className="land-grid cols-3">
          {c.daulat.map((s) => (
            <div key={s.judul} className="card">
              <h3>{s.judul}</h3>
              <p>{s.isi}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-sec">
        <div className="kicker">{c.jujurKicker}</div>
        <h2>{c.jujurJudul}</h2>
        <div className="land-grid cols-2">
          <div className="card land-is">
            <h3>{lang === 'en' ? 'OWL is' : 'OWL adalah'}</h3>
            <ul>{c.adalah.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="card land-isnt">
            <h3>{lang === 'en' ? 'OWL is not' : 'OWL bukan'}</h3>
            <ul>{c.bukan.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="land-sec land-close">
        <h2>{c.tutupJudul}</h2>
        <p className="land-lead">{c.tutupLead}</p>
        <div className="land-cta">
          <button className="btn" onClick={onOpenDashboard}>{c.ctaDashboard}</button>
        </div>
      </section>

      <footer className="land-foot">{c.footer}</footer>
    </div>
  )
}
