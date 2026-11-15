import type { ReactNode } from 'react'
import { Lockup } from '../components/Logo'
import { useT } from '../lib/i18n'
import { UNDUH_AGENT } from '../lib/agent'
import { useCountUp, useReveal, useScrollProgress } from '../lib/motion'

/**
 * Halaman depan.
 *
 * Satu gagasan visual dipegang dari atas sampai bawah: halaman ini
 * MEMINDAI, persis seperti produknya. Garis emas menyapu, indikator menyala
 * satu per satu, angka dihitung naik dari nol, lalu pada bagian gerbang
 * keputusannya dicap di depan mata pembaca. Tidak ada efek yang dipakai
 * sekadar karena bisa.
 *
 * Naskahnya mengikuti proposal dan deck, termasuk batas klaimnya, sebab
 * halaman depan yang menjanjikan lebih daripada yang dapat dibuktikan
 * purwarupa justru merusak kepercayaan yang hendak dibangun dashboard di
 * belakangnya. Angka 18 dan 87 bukan hiasan: keduanya keluaran mesin aturan
 * yang sama dengan yang dipakai dashboard, dan dikunci oleh uji.
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
  ctaApk: string
  gulir: string
  batasKlaim: string

  marquee: string[]

  butaKicker: string
  butaJudul: string
  butaLead: string
  butaIndikator: string[]
  butaKeterangan: string

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
  kerjaLead: string
  langkah: Kartu[]

  gerbangKicker: string
  gerbangJudul: string
  lolos: string
  ditolak: string
  lolosNama: string
  ditolakNama: string
  lolosIsi: string
  ditolakIsi: string
  gerbangCatatan: string

  daulatKicker: string
  daulatJudul: string
  daulat: Kartu[]

  jujurKicker: string
  jujurJudul: string
  adalahJudul: string
  bukanJudul: string
  adalah: string[]
  bukan: string[]

  tutupJudul: string
  tutupLead: string
  footer: string
}

const ID: Copy = {
  kicker: 'Kartika Cyber Hackathon 2026 · Defensive Shield · TNI AD',
  judul1: 'Gerbang risiko',
  judul2: 'perangkat.',
  lead: 'OWL membaca enam sinyal keamanan yang sudah ada di perangkat, mengubahnya '
    + 'menjadi satu skor risiko yang dapat ditelusuri, lalu memakainya sebagai '
    + 'rekomendasi keputusan akses. On-prem, siap air-gapped.',
  ctaDashboard: 'Buka dashboard',
  ctaRepo: 'Kode di GitHub',
  ctaApk: 'Unduh agent Android',
  gulir: 'gulir',
  batasKlaim: 'OWL menilai indikator risiko dan potensi kompromi. OWL tidak '
    + 'mengklaim memastikan seluruh bentuk penyadapan, mendeteksi semua spyware, '
    + 'atau menggantikan antivirus maupun MDM.',

  marquee: ['izin aplikasi', 'aksesibilitas', 'sertifikat', 'vpn', 'sideload',
    'root', 'patch', 'perilaku jaringan'],

  butaKicker: 'Titik buta',
  butaJudul: 'Server dipagari rapat.\nPonsel di saku tidak.',
  butaLead: 'SOC dan CSIRT memantau server dan jaringan, sedangkan perangkat yang '
    + 'dibawa prajurit ke lapangan tidak terlihat oleh pertahanan mana pun. Di '
    + 'perangkat itulah pesan kedinasan, dokumen, akses sistem satuan, mikrofon, '
    + 'dan kamera berada sekaligus.',
  butaIndikator: ['izin mikrofon', 'layanan aksesibilitas', 'sertifikat CA',
    'profil VPN', 'sumber pemasangan', 'tingkat patch'],
  butaKeterangan: 'Yang dibaca OWL hanya konfigurasi dan perilaku, bukan isinya.',

  ancamanKicker: 'Lanskap ancaman',
  ancamanJudul: 'Penyadapan ponsel\nbukan perkiraan.',
  statistik: [
    { angka: 'Pegasus', isi: 'spyware mercenary terdokumentasi menyasar jurnalis, aktivis, dan pejabat — Amnesty Security Lab, Citizen Lab' },
    { angka: '+196%', isi: 'lonjakan trojan perbankan mobile sepanjang 2024 — Kaspersky' },
    { angka: '>33 jt', isi: 'serangan malware mobile global 2024, banyak di antaranya merekam mikrofon, kamera, dan lokasi — Securelist' },
  ],
  ancamanCatatan: 'Indonesia tidak menerbitkan statistik nasional kasus penyadapan '
    + 'ponsel terverifikasi, jadi yang dipakai di sini adalah bukti spyware dan '
    + 'malware mobile yang dapat diperiksa sumbernya, bukan angka yang dikarang.',

  sinyalKicker: 'Yang dibaca',
  sinyalJudul: 'Enam sinyal,\nbukan isi pesanmu.',
  sinyalLead: 'OWL tidak membaca isi pesan, rekaman suara, gambar kamera, atau '
    + 'lokasi presisi. Skema telemetrinya bahkan tidak punya tempat untuk itu.',
  sinyal: [
    { judul: 'Izin aplikasi', isi: 'Gabungan izin mikrofon, kamera, dan lokasi yang tidak sejalan dengan fungsi aplikasinya.' },
    { judul: 'Layanan aksesibilitas', isi: 'Aplikasi yang dapat membaca seluruh layar dan menekan tombol menggantikan pengguna. Jalur utama pencurian kredensial.' },
    { judul: 'Sertifikat & VPN', isi: 'CA yang dipasang pengguna dan profil VPN di luar daftar izin satuan. Prasyarat penyadapan TLS.' },
    { judul: 'Sumber pemasangan', isi: 'Aplikasi yang dipasang dari luar toko resmi. Sinyal risiko, bukan vonis malware.' },
    { judul: 'Integritas perangkat', isi: 'Artefak root, bootloader terbuka, dan tingkat patch keamanan yang tertinggal.' },
    { judul: 'Perilaku jaringan', isi: 'Metadata volume dan tujuan keluar. Isi lalu lintas tidak pernah dibaca.' },
  ],

  kerjaKicker: 'Cara kerja',
  kerjaJudul: 'Dari perangkat\nke keputusan akses.',
  kerjaLead: 'Lima langkah, dan tiap poin pada skornya dapat dibuka sampai ke '
    + 'aturan yang menyalakannya.',
  langkah: [
    { judul: 'Registrasi', isi: 'Perangkat terdaftar dengan identitas yang tetap antar laporan.' },
    { judul: 'Telemetri', isi: 'Agent Android melaporkan enam sinyal beserta status keterbacaannya.' },
    { judul: 'Korelasi', isi: 'Beberapa aturan harus menyala bersama sebelum dianggap pola, bukan kebetulan.' },
    { judul: 'Skor 0–100', isi: 'Bobot kategori, severitas, dan peluruhan lima poin per hari tanpa sinyal.' },
    { judul: 'Keputusan', isi: 'Allow, step-up, akses terbatas, atau tolak dan karantina.' },
  ],

  gerbangKicker: 'Momennya',
  gerbangJudul: 'Dua perangkat,\nsatu gerbang.',
  lolos: 'LOLOS',
  ditolak: 'DITOLAK',
  lolosNama: 'HP dinas satuan tempur',
  ditolakNama: 'HP dinas perwira',
  lolosIsi: 'Temuan ringan: izin perekaman pada aplikasi pesan, patch tertinggal, satu tujuan jaringan baru. Akses penuh direkomendasikan.',
  ditolakIsi: 'Aksesibilitas tak dikenal, hamparan, sideload, CA pengguna, dan VPN gelap sekaligus. Ditolak untuk sistem terklasifikasi.',
  gerbangCatatan: 'Kedua angka dihitung mesin aturan, bukan ditulis tangan ke '
    + 'halaman ini, dan dikunci uji otomatis. Keluarannya adalah rekomendasi '
    + 'keputusan akses; pemblokiran sebenarnya menuntut integrasi dengan gateway, '
    + 'IAM, atau MDM satuan.',

  daulatKicker: 'Kedaulatan',
  daulatJudul: 'Semuanya di dalam\ntembok sendiri.',
  daulat: [
    { judul: 'On-prem, siap air-gapped', isi: 'Penilaian risiko tidak memanggil layanan cloud mana pun. Dua kontainer, satu basis data.' },
    { judul: 'Feed ke Kartika CSIRT', isi: 'STIX 2.1 lewat webhook bertanda tangan HMAC, dan CEF lewat Syslog.' },
    { judul: 'Data yang berumur', isi: 'Telemetri dan hasil pemeriksaan dihapus otomatis setelah masa retensi; jejak audit kebijakan tetap disimpan.' },
  ],

  jujurKicker: 'Batas yang dinyatakan di depan',
  jujurJudul: 'Apa yang OWL kerjakan,\ndan apa yang tidak.',
  adalahJudul: 'OWL adalah',
  bukanJudul: 'OWL bukan',
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

  tutupJudul: 'Perangkat yang terdaftar\nbelum tentu aman.',
  tutupLead: 'Setiap perangkat perlu dinilai berdasarkan indikator risikonya '
    + 'sebelum dipercaya menyentuh sistem strategis.',
  footer: 'Purwarupa Kartika Cyber Hackathon 2026 · PUSSIBERAD × CODEPOLITAN',
}

const EN: Copy = {
  kicker: 'Kartika Cyber Hackathon 2026 · Defensive Shield · Indonesian Army',
  judul1: 'A device',
  judul2: 'risk gate.',
  lead: 'OWL reads six security signals already on the device, turns them into one '
    + 'traceable risk score, and uses that score as an access decision '
    + 'recommendation. On-premise, air-gapped ready.',
  ctaDashboard: 'Open the dashboard',
  ctaRepo: 'Code on GitHub',
  ctaApk: 'Download the Android agent',
  gulir: 'scroll',
  batasKlaim: 'OWL assesses risk indicators and signs of possible compromise. It '
    + 'does not claim to catch every form of interception, to detect all spyware, or '
    + 'to replace antivirus or MDM.',

  marquee: ['app permissions', 'accessibility', 'certificates', 'vpn', 'sideload',
    'root', 'patch level', 'network behaviour'],

  butaKicker: 'The blind spot',
  butaJudul: 'Servers are fenced in.\nThe phone in the pocket is not.',
  butaLead: 'SOC and CSIRT teams watch servers and networks, while the device a '
    + 'soldier carries into the field is visible to no defence at all. That device '
    + 'holds official messages, documents, unit system access, a microphone and a '
    + 'camera, all at once.',
  butaIndikator: ['microphone permission', 'accessibility service', 'CA certificate',
    'VPN profile', 'install source', 'patch level'],
  butaKeterangan: 'OWL reads configuration and behaviour only, never content.',

  ancamanKicker: 'Threat landscape',
  ancamanJudul: 'Phone surveillance\nis not a guess.',
  statistik: [
    { angka: 'Pegasus', isi: 'mercenary spyware documented targeting journalists, activists and officials — Amnesty Security Lab, Citizen Lab' },
    { angka: '+196%', isi: 'rise in mobile banking trojans through 2024 — Kaspersky' },
    { angka: '>33M', isi: 'global mobile malware attacks in 2024, many of them recording microphone, camera and location — Securelist' },
  ],
  ancamanCatatan: 'Indonesia publishes no verified national count of phone '
    + 'interception cases, so the evidence used here is spyware and mobile malware '
    + 'reporting whose sources can be checked, not invented figures.',

  sinyalKicker: 'What it reads',
  sinyalJudul: 'Six signals,\nnot your messages.',
  sinyalLead: 'OWL never reads message content, audio, camera images or precise '
    + 'location. Its telemetry schema has no place to put them.',
  sinyal: [
    { judul: 'App permissions', isi: 'Combinations of microphone, camera and location permissions that do not match what the app is for.' },
    { judul: 'Accessibility services', isi: 'Apps able to read the whole screen and press buttons for the user. The primary route for credential theft.' },
    { judul: 'Certificates & VPN', isi: 'User-installed CAs and VPN profiles outside the unit allowlist. A precondition for TLS interception.' },
    { judul: 'Install source', isi: 'Apps installed from outside the official store. A risk signal, not a malware verdict.' },
    { judul: 'Device integrity', isi: 'Root artefacts, unlocked bootloader, and a security patch level left behind.' },
    { judul: 'Network behaviour', isi: 'Egress volume and destination metadata. Traffic content is never read.' },
  ],

  kerjaKicker: 'How it works',
  kerjaJudul: 'From device\nto access decision.',
  kerjaLead: 'Five steps, and every point of the score can be opened down to the '
    + 'rule that fired it.',
  langkah: [
    { judul: 'Enrolment', isi: 'The device registers with an identity that stays consistent across reports.' },
    { judul: 'Telemetry', isi: 'The Android agent reports six signals and whether each one could be read.' },
    { judul: 'Correlation', isi: 'Several rules must fire together before a pattern counts as more than coincidence.' },
    { judul: 'Score 0–100', isi: 'Category weights, severity, and a five point decay per quiet day.' },
    { judul: 'Decision', isi: 'Allow, step-up, limited access, or deny and quarantine.' },
  ],

  gerbangKicker: 'The moment',
  gerbangJudul: 'Two devices,\none gate.',
  lolos: 'ALLOWED',
  ditolak: 'DENIED',
  lolosNama: 'Combat unit duty phone',
  ditolakNama: 'Officer duty phone',
  lolosIsi: 'Light findings: recording permissions on a messaging app, a patch left behind, one new network destination. Full access recommended.',
  ditolakIsi: 'An unknown accessibility service, an overlay, a sideloaded app, a user CA and a rogue VPN at once. Denied for classified systems.',
  gerbangCatatan: 'Both numbers come out of the rule engine rather than being typed '
    + 'into this page, and automated tests keep them there. The output is an access '
    + 'decision recommendation; real blocking requires integration with the unit '
    + 'gateway, IAM or MDM.',

  daulatKicker: 'Sovereignty',
  daulatJudul: 'All of it inside\nyour own walls.',
  daulat: [
    { judul: 'On-prem, air-gapped ready', isi: 'Risk assessment calls no cloud service at all. Two containers, one database.' },
    { judul: 'Feed to Kartika CSIRT', isi: 'STIX 2.1 over an HMAC-signed webhook, and CEF over Syslog.' },
    { judul: 'Data that expires', isi: 'Telemetry and assessment results are deleted automatically after the retention window; the policy audit trail is kept.' },
  ],

  jujurKicker: 'Limits stated up front',
  jujurJudul: 'What OWL does,\nand what it does not.',
  adalahJudul: 'OWL is',
  bukanJudul: 'OWL is not',
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

  tutupJudul: 'An enrolled device\nis not a safe one.',
  tutupLead: 'Every device needs to be judged on its own risk indicators before it '
    + 'is trusted with strategic systems.',
  footer: 'Kartika Cyber Hackathon 2026 prototype · PUSSIBERAD × CODEPOLITAN',
}

/* Repo yang dibagikan ke juri. Akun MrPrinceAli ditandai GitHub dan
   seluruh repo-nya menjawab 404 bagi siapa pun selain dirinya, jadi tautan
   lama mengirim pembaca ke halaman kosong. */
const REPO = 'https://github.com/FachrulAli/OWL'

/** Judul yang memuat baris baru ditulis sebagai beberapa baris sungguhan. */
function Baris({ teks }: { teks: string }) {
  const baris = teks.split('\n')
  return (
    <>
      {baris.map((b, i) => (
        <span key={b} className="ld-baris" style={{ ['--d' as string]: `${i * 90}ms` }}>
          {b}
        </span>
      ))}
    </>
  )
}

/** Satu bab: nomor, kicker, judul besar, lalu isinya. */
function Bab({
  n, kicker, judul, children, lebar,
}: {
  n: string
  kicker: string
  judul: string
  children: ReactNode
  lebar?: boolean
}) {
  const { ref, masuk } = useReveal<HTMLElement>()
  return (
    <section ref={ref} className={`ld-sec${masuk ? ' is-in' : ''}${lebar ? ' is-wide' : ''}`}>
      <div className="ld-sec-head">
        <span className="ld-n">{n}</span>
        <span className="ld-kicker">{kicker}</span>
      </div>
      <h2 className="ld-h2"><Baris teks={judul} /></h2>
      {children}
    </section>
  )
}

/** Perangkat di gerbang: cincin skor yang terisi dan keputusan yang dicap. */
function Lajur({
  skor, nama, vonis, isi, lolos,
}: {
  skor: number
  nama: string
  vonis: string
  isi: string
  lolos: boolean
}) {
  const { ref, masuk } = useReveal<HTMLDivElement>()
  const nilai = useCountUp(skor, masuk, lolos ? 1000 : 1500)
  const keliling = 2 * Math.PI * 86

  return (
    <div ref={ref} className={`ld-lajur ${lolos ? 'ok' : 'no'}${masuk ? ' is-in' : ''}`}>
      <div className="ld-ring">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="86" className="rel" />
          <circle
            cx="100" cy="100" r="86" className="isi"
            strokeDasharray={`${(keliling * skor) / 100} ${keliling}`}
            style={{ strokeDashoffset: masuk ? 0 : keliling }}
          />
        </svg>
        <div className="ld-skor">
          <span className="angka">{Math.round(nilai)}</span>
          <span className="per">/ 100</span>
        </div>
      </div>
      <div className="ld-vonis">{vonis}</div>
      <div className="ld-nama">{nama}</div>
      <p>{isi}</p>
    </div>
  )
}

export function Landing({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  const { lang } = useT()
  const c = lang === 'en' ? EN : ID
  const maju = useScrollProgress()
  const buta = useReveal<HTMLDivElement>()
  const statistik = useReveal<HTMLDivElement>()

  return (
    <div className="ld">
      <div className="ld-grain" aria-hidden="true" />
      <div className="ld-maju" style={{ transform: `scaleX(${maju})` }} aria-hidden="true" />

      <section className="ld-hero">
        <div className="ld-hero-copy">
          <div className="ld-kicker ld-kicker-top">{c.kicker}</div>
          <h1 className="ld-h1"><Baris teks={`${c.judul1}\n${c.judul2}`} /></h1>
          <p className="ld-lead">{c.lead}</p>
          <div className="ld-cta">
            <button className="ld-btn utama" onClick={onOpenDashboard}>
              <span>{c.ctaDashboard}</span>
            </button>
            {UNDUH_AGENT && (
              <a className="ld-btn" href={UNDUH_AGENT} download>
                <span>{c.ctaApk}</span>
              </a>
            )}
            <a className="ld-btn" href={REPO} target="_blank" rel="noreferrer">
              <span>{c.ctaRepo}</span>
            </a>
          </div>
        </div>

        <div className="ld-hero-logo">
          <div className="ld-aura" aria-hidden="true" />
          <Lockup width={420} />
        </div>

        <div className="ld-gulir" aria-hidden="true">
          <span>{c.gulir}</span>
          <i />
        </div>
      </section>

      <div className="ld-pita" aria-hidden="true">
        <div className="ld-pita-jalan">
          {[0, 1].map((k) => (
            <div className="ld-pita-set" key={k}>
              {c.marquee.map((m) => (
                <span key={m}>{m}<i>/</i></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="ld-klaim">{c.batasKlaim}</p>

      <Bab n="01" kicker={c.butaKicker} judul={c.butaJudul}>
        <div className="ld-dua">
          <div>
            <p className="ld-lead">{c.butaLead}</p>
            <p className="ld-note">{c.butaKeterangan}</p>
          </div>
          <div ref={buta.ref} className={`ld-hp${buta.masuk ? ' is-in' : ''}`}>
            <div className="ld-hp-layar">
              <span className="ld-sapu" />
              <ul>
                {c.butaIndikator.map((i, k) => (
                  <li key={i} style={{ ['--d' as string]: `${260 + k * 170}ms` }}>
                    <span className="t">{i}</span>
                    <span className="d" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Bab>

      <Bab n="02" kicker={c.ancamanKicker} judul={c.ancamanJudul}>
        <div ref={statistik.ref} className={`ld-stat${statistik.masuk ? ' is-in' : ''}`}>
          {c.statistik.map((s, k) => (
            <div className="ld-stat-baris" key={s.angka} style={{ ['--d' as string]: `${k * 140}ms` }}>
              <div className="ld-stat-angka">{s.angka}</div>
              <p>{s.isi}</p>
            </div>
          ))}
        </div>
        <p className="ld-note">{c.ancamanCatatan}</p>
      </Bab>

      <Bab n="03" kicker={c.sinyalKicker} judul={c.sinyalJudul} lebar>
        <p className="ld-lead">{c.sinyalLead}</p>
        <div className="ld-sinyal">
          {c.sinyal.map((s, k) => (
            <article className="ld-kartu" key={s.judul} style={{ ['--d' as string]: `${k * 90}ms` }}>
              <span className="ld-kartu-n">{String(k + 1).padStart(2, '0')}</span>
              <h3>{s.judul}</h3>
              <p>{s.isi}</p>
              <span className="ld-kartu-garis" />
            </article>
          ))}
        </div>
      </Bab>

      <Bab n="04" kicker={c.kerjaKicker} judul={c.kerjaJudul} lebar>
        <div className="ld-alur">
          <div className="ld-alur-kiri">
            <p className="ld-lead">{c.kerjaLead}</p>
          </div>
          <ol className="ld-alur-kanan">
            {c.langkah.map((s, k) => (
              <li key={s.judul} style={{ ['--d' as string]: `${k * 110}ms` }}>
                <span className="ld-alur-n">{String(k + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{s.judul}</h3>
                  <p>{s.isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Bab>

      <Bab n="05" kicker={c.gerbangKicker} judul={c.gerbangJudul} lebar>
        <div className="ld-gerbang">
          <Lajur skor={18} nama={c.lolosNama} vonis={c.lolos} isi={c.lolosIsi} lolos />
          <Lajur skor={87} nama={c.ditolakNama} vonis={c.ditolak} isi={c.ditolakIsi} lolos={false} />
        </div>
        <p className="ld-note">{c.gerbangCatatan}</p>
      </Bab>

      <Bab n="06" kicker={c.daulatKicker} judul={c.daulatJudul} lebar>
        <div className="ld-daulat">
          {c.daulat.map((s, k) => (
            <article key={s.judul} style={{ ['--d' as string]: `${k * 110}ms` }}>
              <h3>{s.judul}</h3>
              <p>{s.isi}</p>
            </article>
          ))}
        </div>
      </Bab>

      <Bab n="07" kicker={c.jujurKicker} judul={c.jujurJudul} lebar>
        <div className="ld-jujur">
          <div className="ld-is">
            <h3>{c.adalahJudul}</h3>
            <ul>{c.adalah.map((x, k) => <li key={x} style={{ ['--d' as string]: `${k * 80}ms` }}>{x}</li>)}</ul>
          </div>
          <div className="ld-isnt">
            <h3>{c.bukanJudul}</h3>
            <ul>{c.bukan.map((x, k) => <li key={x} style={{ ['--d' as string]: `${k * 80}ms` }}>{x}</li>)}</ul>
          </div>
        </div>
      </Bab>

      <Tutup copy={c} onOpenDashboard={onOpenDashboard} />
    </div>
  )
}

function Tutup({ copy, onOpenDashboard }: { copy: Copy; onOpenDashboard: () => void }) {
  const { ref, masuk } = useReveal<HTMLElement>()
  return (
    <section ref={ref} className={`ld-tutup${masuk ? ' is-in' : ''}`}>
      <h2 className="ld-h1 kecil"><Baris teks={copy.tutupJudul} /></h2>
      <p className="ld-lead">{copy.tutupLead}</p>
      <div className="ld-cta">
        <button className="ld-btn utama" onClick={onOpenDashboard}>
          <span>{copy.ctaDashboard}</span>
        </button>
      </div>
      <footer className="ld-foot">
        <span>{copy.footer}</span>
        <span className="ld-foot-kanan">OWL · ON DEVICE WATCH LAYER</span>
      </footer>
    </section>
  )
}
