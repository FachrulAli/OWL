import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Dua bahasa untuk satu sumber kebenaran.
 *
 * Teks antarmuka disimpan di berkas ini dalam dua bahasa. Teks yang datang
 * dari OWL Core, yaitu judul aturan, alasan keputusan, dan bukti temuan,
 * tetap dihasilkan backend dalam bahasa Indonesia; di sini hanya
 * diterjemahkan untuk ditampilkan. Jika satu teks backend belum punya
 * padanan, yang ditampilkan adalah teks aslinya, bukan ruang kosong.
 */
export type Lang = 'id' | 'en'

const KEY = 'owl.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'id' || saved === 'en') return saved
  } catch {
    // Penyimpanan browser dapat ditolak, misalnya pada jendela privat.
    // Bahasa bawaan tetap jalan tanpa itu.
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'id'
}

const S = {
  'tab.gerbang': { id: 'Gerbang', en: 'Gate' },
  'tab.perangkat': { id: 'Perangkat', en: 'Devices' },
  'tab.aturan': { id: 'Aturan & bobot', en: 'Rules & weights' },
  'tab.soc': { id: 'SOC / CSIRT', en: 'SOC / CSIRT' },

  'land.toDashboard': { id: 'Dashboard', en: 'Dashboard' },
  'land.home': { id: 'Kembali ke halaman depan', en: 'Back to the landing page' },

  'top.refresh': { id: 'Muat ulang', en: 'Reload' },
  'top.offline': { id: 'mode luring · rekaman', en: 'offline mode · recorded' },
  'top.airgapped': { id: 'on-prem · air-gapped', en: 'on-prem · air-gapped' },
  'top.langLabel': { id: 'Bahasa tampilan', en: 'Display language' },

  'offline.title': { id: 'Mode luring', en: 'Offline mode' },
  'offline.body': {
    id: 'OWL Core tidak terjangkau dari sini, jadi yang Anda lihat adalah rekaman '
      + 'penilaian dari mesin aturan yang sama, dibuat {time}, dan angkanya sendiri '
      + 'tidak dihitung di browser. Untuk menilai telemetri baru dan mengeluarkan event '
      + 'ke SOC, jalankan',
    en: 'OWL Core cannot be reached from here, so what you see is a recorded '
      + 'assessment produced by the same rule engine on {time}. None of these numbers '
      + 'are computed in the browser. To assess fresh telemetry and emit SOC events, run',
  },
  'offline.body2': {
    id: 'dari folder',
    en: 'from the',
  },
  'offline.body3': {
    id: 'lalu muat ulang halaman ini.',
    en: 'folder, then reload this page.',
  },

  'login.title': { id: 'Dashboard terkunci', en: 'Dashboard locked' },
  'login.body': {
    id: 'Masukkan kata sandi satuan untuk membuka penilaian perangkat.',
    en: 'Enter the unit password to open the device assessments.',
  },
  'login.password': { id: 'Kata sandi', en: 'Password' },
  'login.open': { id: 'Buka', en: 'Unlock' },
  'login.checking': { id: 'Memeriksa…', en: 'Checking…' },
  'login.wrong': { id: 'Kata sandi salah.', en: 'Wrong password.' },
  'login.guest': { id: 'Masuk sebagai tamu', en: 'Continue as guest' },
  'login.guestNote': {
    id: 'Mode tamu memperoleh akses yang sama dengan admin. Pemisahan peran '
      + 'belum dipasang, jadi layar ini menahan tampilan, bukan membatasi hak.',
    en: 'Guest mode gets the same access as admin. Role separation is not in '
      + 'place yet, so this screen holds back the view rather than limiting rights.',
  },
  'login.guestUnavailable': {
    id: 'Mode tamu tidak tersedia pada penggelaran ini, sebab kunci bacanya '
      + 'sudah diganti. Masukkan kata sandi satuan.',
    en: 'Guest mode is not available on this deployment, because the read key has '
      + 'been changed. Enter the unit password.',
  },
  'login.offlineNote': {
    id: 'OWL Core tidak terjangkau dari sini, jadi kata sandi tidak dapat '
      + 'diperiksa di server dan layar ini hanya menahan tampilan rekaman.',
    en: 'OWL Core cannot be reached from here, so the password cannot be checked '
      + 'on the server and this screen only holds back the recorded view.',
  },

  'err.title': { id: 'Gagal memuat data', en: 'Could not load data' },

  'gate.kicker': { id: 'Gerbang Risiko Perangkat', en: 'Device Risk Gate' },
  'gate.emptyTitle': { id: 'Belum ada perangkat terdaftar', en: 'No devices enrolled yet' },
  'gate.emptyBody': {
    id: 'Muat dua perangkat contoh, satu bersih dan satu berisiko, lalu jalankan '
      + 'gerbangnya. Keduanya dinilai oleh mesin aturan yang sama dengan yang menilai '
      + 'telemetri dari agent sungguhan.',
    en: 'Load two sample devices, one clean and one at risk, then run the gate. Both '
      + 'are assessed by the same rule engine that assesses telemetry from a real agent.',
  },
  'gate.seed': { id: 'Muat dua perangkat contoh', en: 'Load two sample devices' },
  'gate.seeding': { id: 'Memuat…', en: 'Loading…' },
  'gate.threshold': {
    id: 'Pilih sumber daya yang hendak diakses, lalu jalankan gerbang. Ambang deny '
      + 'mengikuti kepekaan sumber daya: 70 untuk sistem terklasifikasi, 90 untuk '
      + 'jaringan biasa.',
    en: 'Pick the resource being accessed, then run the gate. The deny threshold '
      + 'follows how sensitive that resource is: 70 for classified systems, 90 for the '
      + 'standard network.',
  },
  'gate.note1': { id: 'Keluarannya adalah', en: 'The output is an' },
  'gate.noteBold': {
    id: 'rekomendasi keputusan akses',
    en: 'access decision recommendation',
  },
  'gate.note2': {
    id: '. Pemblokiran yang sebenarnya menuntut integrasi dengan gateway, IAM, atau MDM '
      + 'satuan, dan itu belum terpasang pada purwarupa ini.',
    en: '. Actual blocking requires integration with the unit gateway, IAM, or MDM, and '
      + 'that is not wired into this prototype yet.',
  },
  'gate.classified': { id: 'Sistem terklasifikasi', en: 'Classified system' },
  'gate.standard': { id: 'Jaringan biasa', en: 'Standard network' },
  'gate.run': { id: 'Jalankan gerbang', en: 'Run the gate' },
  'gate.running': { id: 'Menilai…', en: 'Assessing…' },
  'gate.pending': { id: 'BELUM DINILAI', en: 'NOT ASSESSED' },
  'gate.hint': {
    id: 'Tekan "Jalankan gerbang" untuk meminta keputusan dari Policy Decision Point.',
    en: 'Press "Run the gate" to request a decision from the Policy Decision Point.',
  },
  'gate.recommendation': { id: 'rekomendasi', en: 'recommendation' },
  'gate.quarantine': {
    id: 'perangkat dikarantina, eskalasi dikirim ke komando dan CSIRT',
    en: 'device quarantined, escalation sent to command and CSIRT',
  },
  'gate.attestationBad': { id: 'attestation agent tidak sah', en: 'agent attestation invalid' },
  'gate.skipped': {
    id: '{n} indikator tidak dapat diperiksa',
    en: '{n} indicators could not be checked',
  },
  'gate.checked': { id: 'diperiksa {time}', en: 'checked {time}' },
  'gate.neverChecked': { id: 'belum pernah diperiksa', en: 'never checked' },

  'dev.empty': { id: 'Belum ada perangkat terdaftar.', en: 'No devices enrolled yet.' },
  'dev.col.device': { id: 'Perangkat', en: 'Device' },
  'dev.col.unit': { id: 'Satuan', en: 'Unit' },
  'dev.col.role': { id: 'Peran', en: 'Role' },
  'dev.col.score': { id: 'Skor', en: 'Score' },
  'dev.col.level': { id: 'Tingkat', en: 'Level' },
  'dev.col.findings': { id: 'Temuan', en: 'Findings' },
  'dev.notAssessed': { id: 'belum dinilai', en: 'not assessed' },
  'dev.assessedAt': { id: 'dinilai {time}', en: 'assessed {time}' },
  'dev.indicatorStatus': {
    id: 'Status indikator pada pemeriksaan terakhir',
    en: 'Indicator status at the last check',
  },
  'dev.scoreBreakdown': { id: 'Rincian skor', en: 'Score breakdown' },
  'dev.mitre': { id: 'Pemetaan MITRE ATT&CK Mobile', en: 'MITRE ATT&CK Mobile mapping' },
  'dev.confidence': { id: 'keyakinan {v}', en: '{v} confidence' },

  'ind.noReport': {
    id: 'Agent tidak melaporkan status indikator, karena laporan ini datang dari versi '
      + 'agent sebelum status indikator ada. Seluruh indikatornya diperlakukan sebagai '
      + 'terbaca.',
    en: 'The agent reported no indicator status. This report comes from an agent build '
      + 'that predates indicator status, so every indicator is treated as readable.',
  },
  'ind.col.indicator': { id: 'Indikator', en: 'Indicator' },
  'ind.col.status': { id: 'Status', en: 'Status' },
  'ind.col.source': { id: 'Sumber', en: 'Source' },
  'ind.col.checkedAt': { id: 'Waktu periksa', en: 'Checked at' },
  'ind.skipped': {
    id: '{n} aturan tidak dijalankan karena indikatornya tidak terbaca: {list}. '
      + 'Aturan yang dilewati tidak dihitung lulus.',
    en: '{n} rules were not run because their indicator could not be read: {list}. '
      + 'A skipped rule is never counted as passed.',
  },

  'contrib.none': {
    id: 'Tidak ada temuan pada laporan terakhir.',
    en: 'No findings in the latest report.',
  },
  'contrib.downgraded': {
    id: 'diturunkan karena berdiri sendiri',
    en: 'downgraded, uncorroborated',
  },
  'contrib.more': { id: 'dan {n} temuan lain', en: 'and {n} more findings' },

  'rules.loading': { id: 'Memuat katalog…', en: 'Loading the catalog…' },
  'rules.weights': { id: 'Bobot kategori', en: 'Category weights' },
  'rules.severity': { id: 'Severitas', en: 'Severity' },
  'rules.saturation': {
    id: 'Satu kategori mencapai bobot penuhnya pada jumlah severitas {n}.',
    en: 'A category reaches its full weight at a severity sum of {n}.',
  },
  'rules.thresholds': { id: 'Ambang keputusan', en: 'Decision thresholds' },
  'rules.th1': { id: '0 sampai {n}: lolos', en: '0 to {n}: pass' },
  'rules.th2': { id: '{a} sampai {b}: lolos dengan MFA', en: '{a} to {b}: pass with MFA' },
  'rules.th3': {
    id: '{a} sampai {b}: akses terbatas, dan ditolak untuk sistem terklasifikasi',
    en: '{a} to {b}: limited access, and denied for classified systems',
  },
  'rules.th4': {
    id: '{n} ke atas: ditolak dan dikarantina untuk semua sumber daya',
    en: '{n} and above: denied and quarantined for every resource',
  },
  'rules.weightOf': { id: 'bobot {n}', en: 'weight {n}' },
  'rules.col.id': { id: 'Id', en: 'Id' },
  'rules.col.rule': { id: 'Aturan', en: 'Rule' },
  'rules.col.severity': { id: 'Severitas', en: 'Severity' },
  'rules.col.mitre': { id: 'MITRE', en: 'MITRE' },
  'rules.col.confidence': { id: 'Keyakinan', en: 'Confidence' },
  'rules.corroborate': {
    id: 'turun satu tingkat jika menyala sendirian',
    en: 'drops one level when it fires alone',
  },

  'soc.kicker': { id: 'Event ke Kartika CSIRT', en: 'Events to Kartika CSIRT' },
  'soc.note': {
    id: 'STIX 2.1 lewat webhook bertanda tangan HMAC, dan CEF lewat Syslog. Status '
      + '"tersimpan lokal" adalah keadaan normal pada mode air-gapped, karena event '
      + 'tetap disimpan untuk diambil petugas.',
    en: 'STIX 2.1 over an HMAC-signed webhook, and CEF over Syslog. The status "stored '
      + 'locally" is normal in air-gapped mode, because the event is kept for an '
      + 'operator to collect.',
  },
  'soc.col.time': { id: 'Waktu', en: 'Time' },
  'soc.col.device': { id: 'Perangkat', en: 'Device' },
  'soc.col.kind': { id: 'Jenis', en: 'Kind' },
  'soc.col.status': { id: 'Status', en: 'Status' },
  'soc.delivered': { id: 'terkirim', en: 'delivered' },
  'soc.stored': { id: 'tersimpan lokal', en: 'stored locally' },
  'soc.empty': {
    id: 'Belum ada event. Jalankan gerbang lebih dahulu.',
    en: 'No events yet. Run the gate first.',
  },
  'soc.payload': { id: 'Payload', en: 'Payload' },
  'soc.pickEvent': {
    id: 'Pilih satu event untuk melihat payload yang dikirim.',
    en: 'Pick an event to see the payload that was sent.',
  },
} as const

export type Key = keyof typeof S

/** Nama kategori aturan. */
const CATEGORY = {
  runtime: { id: 'Perilaku runtime', en: 'Runtime behaviour' },
  app: { id: 'Integritas aplikasi', en: 'Application integrity' },
  config: { id: 'Konfigurasi', en: 'Configuration' },
  device: { id: 'Integritas perangkat', en: 'Device integrity' },
  identity: { id: 'Perilaku jaringan', en: 'Network behaviour' },
} as const

/** Nama keputusan. Padanan resminya ada di Requirements §3.3. */
const DECISION = {
  allow: { id: 'LOLOS', en: 'ALLOW' },
  step_up: { id: 'LOLOS + MFA', en: 'ALLOW + MFA' },
  limited: { id: 'TERBATAS', en: 'RESTRICTED' },
  deny: { id: 'DITOLAK', en: 'DENIED' },
} as const

/** Istilah Requirements §3.3, sengaja tetap bahasa Inggris pada kedua bahasa. */
export const DECISION_EN: Record<string, string> = {
  allow: 'Allow',
  step_up: 'Step-up',
  limited: 'Restrict',
  deny: 'Deny / Quarantine',
}

/** Nama indikator pada laporan agent, untuk tabel status (FR-02, FR-03). */
const INDICATOR = {
  permissions: { id: '1. Izin aplikasi', en: '1. Application permissions' },
  accessibility: {
    id: '2. Layanan aksesibilitas dan hamparan',
    en: '2. Accessibility services and overlays',
  },
  certificates: { id: '3a. Sertifikat CA pengguna', en: '3a. User-installed CA certificates' },
  vpn: { id: '3b. Profil VPN', en: '3b. VPN profiles' },
  install_source: { id: '4. Sumber pemasangan aplikasi', en: '4. App install source' },
  integrity: { id: '5. Integritas perangkat dan patch', en: '5. Device integrity and patch level' },
  network_volume: {
    id: '6a. Volume unggahan dan waktu layar menyala',
    en: '6a. Egress volume and screen-on time',
  },
  network_destinations: { id: '6b. Tujuan jaringan', en: '6b. Network destinations' },
  attestation: { id: 'Attestation agent', en: 'Agent attestation' },
} as const

/**
 * Status keterbacaan indikator.
 *
 * `Unavailable` dan `Not Supported` sengaja tetap berbahasa Inggris pada
 * kedua bahasa, karena Requirements FR-03 menyebut kedua kata itu sebagai
 * status yang harus muncul di layar.
 */
const AVAILABILITY = {
  ok: { id: 'Terbaca', en: 'Readable' },
  partial: { id: 'Sebagian', en: 'Partial' },
  unavailable: { id: 'Unavailable', en: 'Unavailable' },
  not_supported: { id: 'Not Supported', en: 'Not Supported' },
} as const

/** Tingkat risiko dan tingkat keyakinan, dikirim backend dalam bahasa Indonesia. */
const WORD: Record<string, string> = {
  rendah: 'low',
  sedang: 'medium',
  tinggi: 'high',
  kritis: 'critical',
  agent: 'agent',
  resolver: 'resolver',
}

/** Judul dan uraian aturan, berpasangan dengan `rules/rules.yaml`. */
const RULE_EN: Record<string, { title: string; detail: string }> = {
  'OWL-R01': {
    title: 'Accessibility service outside the allowlist',
    detail: 'An app holds BIND_ACCESSIBILITY_SERVICE without being on the unit '
      + 'allowlist. That permission reads the entire screen and can press buttons on '
      + 'the user’s behalf, and it is the primary route for credential theft.',
  },
  'OWL-R02': {
    title: 'Overlay window on top of other apps',
    detail: 'An app holds SYSTEM_ALERT_WINDOW. Several apps use it legitimately, so on '
      + 'its own it is not enough; together with OWL-R01 the pattern is a '
      + 'credential-stealing overlay.',
  },
  'OWL-A01': {
    title: 'App installed from outside the official store',
    detail: 'The installing source is not on the list of permitted installers. '
      + 'Sideloading is the main entry vector for commercial spyware.',
  },
  'OWL-A02': {
    title: 'Excessive microphone, camera, or location permissions',
    detail: 'An app holds a combination of recording permissions that does not match '
      + 'its function. Measured as a combination rather than a single permission, '
      + 'because one microphone permission on a messaging app is perfectly normal.',
  },
  'OWL-C01': {
    title: 'CA certificate installed by the user',
    detail: 'There is a CA in the user trust store. On an official device there is no '
      + 'legitimate reason for that, and such a CA is a precondition for TLS interception.',
  },
  'OWL-C02': {
    title: 'VPN profile outside the allowlist',
    detail: 'An active VPN that does not belong to the unit redirects all device '
      + 'traffic to an unknown party.',
  },
  'OWL-D01': {
    title: 'Device integrity failed',
    detail: 'Play Integrity rejects the device, or root artefacts (su, Magisk) were '
      + 'found, or the bootloader is unlocked. Root voids nearly every security '
      + 'assumption the other checks rely on.',
  },
  'OWL-D02': {
    title: 'Security patch behind',
    detail: 'The security patch level is older than the unit threshold. It rises to '
      + 'high once it passes the second threshold.',
  },
  'OWL-N01': {
    title: 'Large upload while the device was idle',
    detail: 'Egress volume over 24 hours passes the threshold while the screen stayed '
      + 'off. Metadata only; traffic content is never read.',
  },
  'OWL-N02': {
    title: 'Unusual network destination or regular beacon pattern',
    detail: 'Destinations outside those a unit device usually contacts, or egress '
      + 'intervals too regular for human traffic.',
  },
  'OWL-N03': {
    title: 'New network destination outside the device’s habit',
    detail: 'The device contacted a destination never seen in its own history. On its '
      + 'own this proves nothing, because ordinary use produces new destinations too. '
      + 'Recorded as a weak signal so an analyst sees it when other signals fire as well.',
  },
  'OWL-X01': {
    title: 'Agent attestation invalid',
    detail: 'The report comes from an agent that cannot prove it is a genuine build in '
      + 'a hardware-backed Keystore. A “clean device” report from an '
      + 'unverified agent means nothing. It drops to medium when the key is proven but '
      + 'the Play Integrity verdict cannot be obtained, and disappears entirely in '
      + 'air-gapped mode, where that verdict is impossible to fetch and Key Attestation '
      + 'is its legitimate replacement.',
  },
}

/** Alasan keputusan dari Policy Decision Point, dicocokkan pada awalannya. */
const REASON_EN: [string, string][] = [
  ['Attestation agent tidak sah',
    'Agent attestation is invalid. This device’s report is not trusted.'],
  ['Allow.', 'Allow. Score is below the threshold; full access is recommended.'],
  ['Step-up.',
    'Step-up. Score is moderate; access is recommended after additional verification (MFA).'],
  ['Restrict.',
    'Restrict. Score is high; access to sensitive resources is recommended to be limited.'],
  ['Deny / Quarantine.',
    'Deny / Quarantine. Score passes the threshold for this resource; access is '
    + 'recommended to be denied and the device quarantined.'],
]

/** Bukti temuan, dirakit backend dari pola tetap. */
const EVIDENCE_EN: [RegExp, string][] = [
  [/^layanan aksesibilitas aktif: /, 'accessibility service active: '],
  [/^SYSTEM_ALERT_WINDOW: /, 'SYSTEM_ALERT_WINDOW: '],
  [/^CA pengguna: /, 'user-installed CA: '],
  [/^profil VPN aktif: /, 'active VPN profile: '],
  [/^tujuan tidak lazim: /, 'unusual destinations: '],
  [/^tujuan baru: /, 'new destination: '],
  [/^artefak root: /, 'root artefacts: '],
  [/^tingkat patch tidak terbaca: /, 'patch level unreadable: '],
  [/^verdict Play Integrity tidak diperoleh: /, 'Play Integrity verdict unavailable: '],
  [/^verdict Play Integrity: /, 'Play Integrity verdict: '],
  [/^bootloader terbuka$/, 'bootloader unlocked'],
  [/^Play Integrity: FAILED$/, 'Play Integrity: FAILED'],
]

function translateEvidence(raw: string): string {
  for (const [re, en] of EVIDENCE_EN) {
    if (re.test(raw)) return raw.replace(re, en)
  }
  let m = raw.match(/^(.+) dipasang oleh (.+)$/)
  if (m) return `${m[1]} installed by ${m[2] === 'sumber tidak diketahui' ? 'an unknown source' : m[2]}`
  m = raw.match(/^patch (.+), tertinggal (\d+) hari$/)
  if (m) return `patch ${m[1]}, ${m[2]} days behind`
  m = raw.match(/^unggahan (.+) MB dalam 24 jam$/)
  if (m) return `${m[1]} MB uploaded in 24 hours`
  m = raw.match(/^layar menyala (.+) persen dari waktu itu$/)
  if (m) return `screen on for ${m[1]} percent of that window`
  m = raw.match(/^interval keluar terlalu teratur \(jitter (.+) persen\)$/)
  if (m) return `egress interval too regular (jitter ${m[1]} percent)`
  m = raw.match(/^kunci agent tidak terikat perangkat keras/)
  if (m) return 'agent key is not hardware-backed'
  return raw
}

/** Alasan status indikator, dikirim agent dalam bahasa Indonesia. */
const REASON_INDICATOR_EN: [string, string][] = [
  ['status bootloader tidak diberikan API publik; dinilai lewat verdict integritas',
    'bootloader status is not exposed by any public API; judged through the integrity verdict'],
]

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
}

const LangCtx = createContext<Ctx>({ lang: 'id', setLang: () => undefined })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* lihat initialLang */ }
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export interface Translator {
  lang: Lang
  setLang: (l: Lang) => void
  /** Teks antarmuka. Nilai `{nama}` diganti dari `vars`. */
  t: (key: Key, vars?: Record<string, string | number>) => string
  /** Tanggal dan waktu mengikuti bahasa yang sedang dipakai. */
  locale: string
  category: (c: string) => string
  decision: (d: string) => string
  indicator: (k: string) => string
  availability: (s: string) => string
  /** Tingkat risiko, keyakinan, dan sumber indikator. */
  word: (w: string) => string
  ruleTitle: (id: string, fallback: string) => string
  ruleDetail: (id: string, fallback: string) => string
  reason: (raw: string) => string
  evidence: (raw: string) => string
  indicatorReason: (raw: string) => string
}

export function useT(): Translator {
  const { lang, setLang } = useContext(LangCtx)

  return useMemo<Translator>(() => {
    const pick = (pair: { id: string; en: string } | undefined, fallback: string) =>
      pair ? pair[lang] : fallback

    return {
      lang,
      setLang,
      locale: lang === 'id' ? 'id-ID' : 'en-GB',
      t: (key, vars) => {
        let out: string = S[key][lang]
        if (vars) {
          for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
        }
        return out
      },
      category: (c) => pick(CATEGORY[c as keyof typeof CATEGORY], c),
      decision: (d) => pick(DECISION[d as keyof typeof DECISION], d),
      indicator: (k) => pick(INDICATOR[k as keyof typeof INDICATOR], k),
      availability: (s) => pick(AVAILABILITY[s as keyof typeof AVAILABILITY], s),
      word: (w) => (lang === 'id' ? w : WORD[w] ?? w),
      ruleTitle: (id, fallback) => (lang === 'id' ? fallback : RULE_EN[id]?.title ?? fallback),
      ruleDetail: (id, fallback) => (lang === 'id' ? fallback : RULE_EN[id]?.detail ?? fallback),
      reason: (raw) => {
        if (lang === 'id') return raw
        for (const [prefix, en] of REASON_EN) if (raw.startsWith(prefix)) return en
        return raw
      },
      evidence: (raw) => (lang === 'id' ? raw : translateEvidence(raw)),
      indicatorReason: (raw) => {
        if (lang === 'id') return raw
        for (const [src, en] of REASON_INDICATOR_EN) if (raw === src) return en
        return raw
      },
    }
  }, [lang, setLang])
}

/** Tombol bahasa di pojok bilah atas. */
export function LangToggle() {
  const { lang, setLang, t } = useT()
  return (
    <div className="langswitch" role="group" aria-label={t('top.langLabel')}>
      {(['id', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
