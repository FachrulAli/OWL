import { useEffect, useMemo, useRef, useState } from 'react'
import { Ikon, Kosong, SkorLencana } from '../components/Ui'
import { AGENT_INFO, UNDUH_AGENT } from '../lib/agent'
import { useAdmin } from '../lib/admin'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Page } from '../lib/nav'
import type { Catalog, DeviceRow, TokenDaftar } from '../lib/types'

/**
 * Pendaftaran agent: tiga langkah yang benar-benar berurutan.
 *
 * Inilah satu-satunya tempat di dashboard yang memang sebuah urutan, jadi
 * penomoran di sini berarti sesuatu: agent harus terpasang sebelum tautannya
 * dibuka, dan tautannya harus ada sebelum perangkat dapat mendaftar. Langkah
 * ketiga tidak menyuruh petugas menebak: ia menunggu laporan pertama dari
 * perangkat itu dan memberi tahu begitu masuk.
 */

const TEKS = {
  id: {
    l1: 'Pasang agent di HP', l1b: 'Berkas APK untuk Android 10 ke atas.',
    unduh: 'Unduh APK agent', belumAda: 'Berkas APK belum disediakan di server ini.',
    izin: 'Di HP, izinkan pemasangan dari sumber ini saat diminta, lalu buka berkasnya.',
    l2: 'Terbitkan tautan pendaftaran', l2b: 'Satu tautan untuk satu perangkat. Berlaku sekali pakai dan kedaluwarsa dalam waktu singkat.',
    idLabel: 'ID perangkat', idHint: 'Pilih dari daftar atau ketik ID baru, mis. TACTICAL-12',
    terbit: 'Terbitkan tautan', menerbitkan: 'Menerbitkan…',
    butuhAdmin: 'Butuh kunci admin.', isiKunci: 'Isi kunci admin',
    salin: 'Salin tautan', tersalin: 'Tersalin',
    berlaku: (m: string) => `Berlaku sampai ${m}. Setelah dipakai, tautan ini tidak berlaku lagi.`,
    l3: 'Buka tautan di HP', l3b: 'Kirim tautannya lewat saluran aman ke HP itu, lalu buka. Agent akan meminta persetujuan pemilik sebelum mendaftar.',
    menunggu: (id: string) => `Menunggu laporan pertama dari ${id}…`,
    masuk: (id: string, w: string) => `${id} sudah melapor pada ${w}.`,
    lihat: 'Lihat perangkat',
    terdaftar: 'Perangkat terdaftar', terdaftarB: 'Tekan satu baris untuk memakai ID-nya pada langkah 2.',
    cari: 'Cari ID, satuan, atau model',
    kosongJ: 'Belum ada perangkat terdaftar', kosongI: 'Terbitkan tautan pertama di langkah 2, atau muat data contoh dari halaman Gerbang akses.',
    melapor: 'Melapor', senyap: 'Senyap', dicabut: 'Dicabut', belum: 'Belum melapor',
    detail: 'Detail',
    luringJ: 'Pendaftaran butuh OWL Core yang berjalan',
    luringI: 'Tautan pendaftaran diterbitkan oleh server dan tidak dapat disimulasikan dari rekaman. Jalankan OWL Core, lalu buka halaman ini lagi.',
    tersisa: (n: number) => `${n} perangkat`,
    gagalJ: 'Jika pendaftaran tidak berhasil',
    g1: 'Tautan tidak terbuka di agent: pastikan agent sudah terpasang, lalu buka tautan itu dari HP yang sama, bukan dari komputer.',
    g2: 'Server menolak (401): tautan sudah dipakai atau kedaluwarsa. Terbitkan tautan baru. Satu tautan hanya berlaku untuk satu perangkat.',
    g3: 'Agent tidak menjangkau server: periksa bahwa HP berada di jaringan yang sama dengan OWL Core dan alamatnya di tautan benar.',
    g4: 'Perangkat terdaftar tetapi skornya belum muncul: tunggu beberapa saat, atau buka agent dan tekan Mulai pemantauan.',
  },
  en: {
    l1: 'Install the agent on the phone', l1b: 'APK for Android 10 and later.',
    unduh: 'Download the agent APK', belumAda: 'The APK is not provided on this server yet.',
    izin: 'On the phone, allow installs from this source when asked, then open the file.',
    l2: 'Issue an enrolment link', l2b: 'One link per device. Single-use and expires shortly.',
    idLabel: 'Device ID', idHint: 'Pick from the list or type a new ID, e.g. TACTICAL-12',
    terbit: 'Issue link', menerbitkan: 'Issuing…',
    butuhAdmin: 'Admin key required.', isiKunci: 'Enter admin key',
    salin: 'Copy link', tersalin: 'Copied',
    berlaku: (m: string) => `Valid until ${m}. It stops working once used.`,
    l3: 'Open the link on the phone', l3b: 'Send the link to that phone over a secure channel and open it. The agent asks the owner to confirm before enrolling.',
    menunggu: (id: string) => `Waiting for the first report from ${id}…`,
    masuk: (id: string, w: string) => `${id} reported at ${w}.`,
    lihat: 'View device',
    terdaftar: 'Enrolled devices', terdaftarB: 'Press a row to use its ID in step 2.',
    cari: 'Search ID, unit, or model',
    kosongJ: 'No devices enrolled yet', kosongI: 'Issue the first link in step 2, or load sample data from the Access gate page.',
    melapor: 'Reporting', senyap: 'Silent', dicabut: 'Revoked', belum: 'Not reported',
    detail: 'Details',
    luringJ: 'Enrolment needs a running OWL Core',
    luringI: 'Enrolment links are issued by the server and cannot be simulated from a recording. Start OWL Core, then open this page again.',
    tersisa: (n: number) => `${n} devices`,
    gagalJ: 'If enrolment does not work',
    g1: 'The link does not open in the agent: make sure the agent is installed, then open the link from the same phone, not from a computer.',
    g2: 'The server refuses (401): the link was used or has expired. Issue a new link. One link works for one device only.',
    g3: 'The agent cannot reach the server: check that the phone is on the same network as OWL Core and that the address in the link is right.',
    g4: 'The device enrolled but no score yet: wait a moment, or open the agent and press Start monitoring.',
  },
} as const

export function Pendaftaran({
  devices, catalog, offline, awal, onRefresh, onPindah,
}: {
  awal: string
  devices: DeviceRow[]
  catalog: Catalog | null
  offline: boolean
  onRefresh: () => void
  onPindah: (p: Page, arg?: string) => void
}) {
  const { lang, locale } = useT()
  const L = TEKS[lang]
  const { admin, minta } = useAdmin()
  const [id, setId] = useState(awal)
  const [token, setToken] = useState<TokenDaftar | null>(null)
  const [terbitPada, setTerbitPada] = useState<number | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [salah, setSalah] = useState('')
  const [tersalin, setTersalin] = useState(false)
  const [cari, setCari] = useState('')
  const kotak = useRef<HTMLInputElement>(null)
  useEffect(() => { if (awal) setId(awal) }, [awal])
  const adaAdmin = admin.trim() !== ''
  const batas = catalog?.parameters?.max_report_age_minutes ?? 60

  // Langkah 3 menunggu: segarkan daftar tiap beberapa detik selama tautannya
  // belum dipakai, supaya petugas tidak perlu menekan muat ulang.
  const dipakai = useMemo(() => {
    if (!token || terbitPada === null) return null
    const d = devices.find((x) => x.device_id === token.device_id)
    return d?.assessed_at && Date.parse(d.assessed_at) > terbitPada ? d : null
  }, [devices, token, terbitPada])

  useEffect(() => {
    if (!token || dipakai) return
    const t = setInterval(onRefresh, 5000)
    return () => clearInterval(t)
  }, [token, dipakai, onRefresh])

  async function terbitkan() {
    setSibuk(true); setSalah(''); setTersalin(false)
    try {
      const r = await api.enrollToken(id.trim(), admin)
      setToken(r)
      setTerbitPada(Date.now())
    } catch (e) {
      setSalah(String(e instanceof Error ? e.message : e))
    } finally {
      setSibuk(false)
    }
  }

  async function salin() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token.provision_url)
    } catch {
      kotak.current?.select()
      document.execCommand('copy')
    }
    setTersalin(true)
    setTimeout(() => setTersalin(false), 2000)
  }

  const status = (d: DeviceRow): { teks: string; nada: string } => {
    if (d.revoked) return { teks: L.dicabut, nada: 'merah' }
    if (!d.assessed_at) return { teks: L.belum, nada: '' }
    const menit = (Date.now() - Date.parse(d.assessed_at)) / 60000
    return menit > batas ? { teks: L.senyap, nada: 'jingga' } : { teks: L.melapor, nada: 'hijau' }
  }

  const q = cari.trim().toLowerCase()
  const daftar = devices.filter((d) =>
    !q || [d.device_id, d.label, d.unit, d.model].some((v) => (v ?? '').toLowerCase().includes(q)))

  if (offline) {
    return (
      <div className="card"><Kosong judul={L.luringJ} isi={L.luringI} /></div>
    )
  }

  const idSiap = id.trim() !== ''

  return (
    <div className="dua-kolom">
      <div className="kolom">
      <ol className="langkah">
        {/* ——— 1 ——— */}
        <li className={UNDUH_AGENT ? '' : 'redup'}>
          <div className="lk-no" aria-hidden="true">1</div>
          <div className="lk-isi">
            <h2>{L.l1}</h2>
            <p>{L.l1b}</p>
            {UNDUH_AGENT ? (
              <a className="btn lk-unduh" href={UNDUH_AGENT} download>
                <Ikon nama="unduh" size={18} />
                <span>{L.unduh}</span>
                {AGENT_INFO && <i>{AGENT_INFO}</i>}
              </a>
            ) : <p className="lk-catatan">{L.belumAda}</p>}
            <p className="lk-catatan">{L.izin}</p>
          </div>
        </li>

        {/* ——— 2 ——— */}
        <li>
          <div className="lk-no" aria-hidden="true">2</div>
          <div className="lk-isi">
            <h2>{L.l2}</h2>
            <p>{L.l2b}</p>
            <label className="fl-label" htmlFor="pd-id">{L.idLabel}</label>
            <div className="lk-baris">
              <input
                id="pd-id" list="pd-daftar" value={id} placeholder={L.idHint}
                onChange={(e) => { setId(e.target.value); setToken(null) }}
              />
              <datalist id="pd-daftar">
                {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.label}</option>)}
              </datalist>
              <button className="btn" disabled={sibuk || !adaAdmin || !idSiap} onClick={() => void terbitkan()}>
                {sibuk ? L.menerbitkan : L.terbit}
              </button>
            </div>
            {!adaAdmin && (
              <p className="lk-catatan">
                {L.butuhAdmin}{' '}
                <button className="tautan" onClick={minta}>{L.isiKunci}</button>
              </p>
            )}
            {salah && <p className="pesan salah" role="alert">{salah}</p>}
            {token && (
              <div className="lk-tautan">
                <div className="lk-baris">
                  <input ref={kotak} readOnly value={token.provision_url} onFocus={(e) => e.target.select()} aria-label={L.l2} />
                  <button className="btn ghost" onClick={() => void salin()}>
                    <Ikon nama={tersalin ? 'centang' : 'salin'} size={16} />
                    <span>{tersalin ? L.tersalin : L.salin}</span>
                  </button>
                </div>
                <p className="lk-catatan">{L.berlaku(new Date(token.expires_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }))}</p>
              </div>
            )}
          </div>
        </li>

        {/* ——— 3 ——— */}
        <li className={token ? '' : 'redup'}>
          <div className={`lk-no${dipakai ? ' selesai' : ''}`} aria-hidden="true">
            {dipakai ? <Ikon nama="centang" size={16} /> : '3'}
          </div>
          <div className="lk-isi">
            <h2>{L.l3}</h2>
            <p>{L.l3b}</p>
            {token && (
              dipakai ? (
                <div className="lk-hasil ok" role="status">
                  <span>{L.masuk(token.device_id, new Date(dipakai.assessed_at!).toLocaleTimeString(locale))}</span>
                  <button className="btn ghost" onClick={() => onPindah('perangkat', token.device_id)}>{L.lihat}</button>
                </div>
              ) : (
                <div className="lk-hasil tunggu" role="status">
                  <span className="denyut" aria-hidden="true" />
                  <span>{L.menunggu(token.device_id)}</span>
                </div>
              )
            )}
          </div>
        </li>
      </ol>

      <section className="card">
        <h2>{L.gagalJ}</h2>
        <ul className="panduan">
          <li>{L.g1}</li>
          <li>{L.g2}</li>
          <li>{L.g3}</li>
          <li>{L.g4}</li>
        </ul>
      </section>
      </div>

      <section className="card sisi-daftar">
        <div className="sd-kepala">
          <div>
            <h2>{L.terdaftar}</h2>
            <p>{L.terdaftarB}</p>
          </div>
          <span className="sd-jumlah">{L.tersisa(devices.length)}</span>
        </div>
        <div className="cari-kotak">
          <Ikon nama="cari" size={16} />
          <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder={L.cari} aria-label={L.cari} />
        </div>
        {devices.length === 0 ? (
          <Kosong judul={L.kosongJ} isi={L.kosongI} />
        ) : (
          <ul className="sd-daftar">
            {daftar.map((d) => {
              const s = status(d)
              return (
                <li key={d.device_id}>
                  <button className="sd-baris" aria-pressed={id === d.device_id}
                          onClick={() => { setId(d.device_id); setToken(null) }}>
                    <SkorLencana skor={d.score} />
                    <span className="sd-nama">
                      <b>{d.device_id}</b>
                      <small>{d.unit || d.model || '—'}</small>
                    </span>
                    <span className={`lencana ${s.nada}`}>{s.teks}</span>
                  </button>
                  <button className="tautan sd-detail" onClick={() => onPindah('perangkat', d.device_id)}>{L.detail}</button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
