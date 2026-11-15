import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Latar } from './components/Latar'
import { Logo } from './components/Logo'
import { Login } from './components/Login'
import { Notifikasi } from './components/Notifikasi'
import type { Kabar } from './components/Notifikasi'
import { PanelAturan } from './components/PanelAturan'
import { StatusKoneksi, Versi } from './components/Status'
import { api, clearKey, hasKey, isOffline, onOfflineChange, onUnauthorized, snapshotGeneratedAt, wsQuery } from './lib/api'
import { LangToggle, useT } from './lib/i18n'
import type { Key } from './lib/i18n'
import type { Catalog, DeviceRow, Metrics, SocEvent } from './lib/types'
import { Gelaran } from './views/Gelaran'
import { Landing } from './views/Landing'
import { Gerbang } from './views/Gerbang'
import { Perangkat } from './views/Perangkat'
import { Operasi } from './views/Operasi'
import { Soc } from './views/Soc'

type Tab = 'ikhtisar' | 'gerbang' | 'perangkat' | 'soc' | 'operasi'

/**
 * Dua halaman, satu berkas.
 *
 * Yang dibuka pertama kali adalah halaman depan, bukan dashboard. Jalur
 * `/dashboard` yang dibuka langsung tetap sampai ke dashboard, sebab
 * `vercel.json` dan nginx mengarahkan setiap jalur ke index.html.
 */
function jalurSekarang(): string {
  const p = location.pathname.replace(/\/+$/, '')
  return p === '' ? '/' : p
}

function diamSaja(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Layar pembuka hanya pada kunjungan pertama satu sesi.
 *
 * Tiga detik terasa sinematik sekali, dan menyebalkan pada kali kesepuluh.
 * Demo menuntut halaman dimuat ulang berkali-kali, jadi sesudah kunjungan
 * pertama layar ini dilewati, dan pembaca yang mematikan animasi tidak
 * pernah melihatnya sama sekali.
 */
const SESI_MUAT = 'owl.boot'

function perluLayarPembuka(): boolean {
  if (diamSaja()) return false
  try { return sessionStorage.getItem(SESI_MUAT) === null } catch { return false }
}

/**
 * Aturan & bobot tidak lagi berupa tab.
 *
 * Sifatnya rujukan: dibuka untuk membuktikan satu angka, lalu ditutup.
 * Sekarang ia tinggal di panel sisi kiri yang dapat dibuka di sebelah
 * pekerjaan, dan slot navigasinya dipakai Ikhtisar, yang justru dibuka
 * lebih dahulu daripada layar mana pun.
 */
const TABS: { id: Tab; label: Key }[] = [
  { id: 'ikhtisar', label: 'tab.ikhtisar' },
  { id: 'gerbang', label: 'tab.gerbang' },
  { id: 'perangkat', label: 'tab.perangkat' },
  { id: 'soc', label: 'tab.soc' },
  { id: 'operasi', label: 'tab.operasi' },
]

export default function App() {
  const { t, locale } = useT()
  const [route, setRoute] = useState(jalurSekarang)
  const [tab, setTab] = useState<Tab>('ikhtisar')
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [events, setEvents] = useState<SocEvent[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [panel, setPanel] = useState(false)
  const [health, setHealth] = useState<{ version: string; air_gapped: boolean } | null>(null)
  const [err, setErr] = useState('')
  const [offline, setOffline] = useState(isOffline())
  const [locked, setLocked] = useState(!hasKey())
  const [muat, setMuat] = useState(perluLayarPembuka)
  const [pindahKe, setPindahKe] = useState<string | null>(null)
  const [bukaDash, setBukaDash] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDevices(await api.devices())
      api.socEvents(12).then(setEvents).catch(() => undefined)
      api.metrics().then(setMetrics).catch(() => setMetrics(null))
      setErr('')
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    }
  }, [])

  useEffect(() => {
    const kembali = () => setRoute(jalurSekarang())
    addEventListener('popstate', kembali)
    return () => removeEventListener('popstate', kembali)
  }, [])

  // Perpindahan halaman: layar diredupkan lebih dahulu, jalurnya diganti di
  // balik redup itu, lalu halaman baru muncul dari gelap. Tanpa jeda ini,
  // peralihannya terasa seperti layar yang patah, bukan berpindah.
  const pindah = useCallback((p: string) => {
    if (diamSaja()) {
      history.pushState({}, '', p)
      setRoute(p)
      scrollTo({ top: 0 })
      return
    }
    setPindahKe(p)
    setTimeout(() => {
      history.pushState({}, '', p)
      setRoute(p)
      scrollTo({ top: 0 })
      setTimeout(() => setPindahKe(null), 40)
    }, 380)
  }, [])

  /**
   * Membuka kunci dashboard.
   *
   * Kata sandi yang benar tidak langsung menyingkap layar, sebab lompatan
   * seketika dari kartu kata sandi ke tabel penuh angka terbaca seperti
   * layar yang berganti sendiri. Satu layar pendek menutup peralihannya,
   * lalu buram di belakangnya luruh.
   */
  const bukaKunci = useCallback(() => {
    if (diamSaja()) { setLocked(false); return }
    setBukaDash(true)
    setTimeout(() => { setLocked(false); setBukaDash(false) }, 1750)
  }, [])

  /**
   * Keluar, dan menutup layar kunci.
   *
   * Keduanya berakhir di halaman depan, bukan di kotak kata sandi.
   * Pengguna yang menekan Keluar sedang pergi, jadi menyodorkan kotak
   * kata sandi di detik yang sama adalah menahan orang yang pamit.
   * Penguncian dinyalakan setelah tiraihnya menutup, supaya kartunya
   * tidak sempat berkedip di layar.
   */
  const keluar = useCallback(() => {
    clearKey()
    pindah('/')
    setTimeout(() => setLocked(true), diamSaja() ? 0 : 400)
  }, [pindah])

  useEffect(() => {
    if (!muat) return
    try { sessionStorage.setItem(SESI_MUAT, '1') } catch { /* jendela privat */ }
    const t = setTimeout(() => setMuat(false), 3100)
    return () => clearTimeout(t)
  }, [muat])

  useEffect(() => onOfflineChange(setOffline), [])

  // Keadaan sambungan ditanyakan sekali di awal, pada halaman mana pun.
  // Tanpa ini, lampu di halaman depan menyala hijau hanya karena belum
  // ada yang pernah bertanya, dan lampu yang menebak lebih buruk daripada
  // lampu yang tidak ada.
  useEffect(() => { api.health().then(setHealth).catch(() => undefined) }, [])

  // Kunci dicabut di tengah sesi: layar dikunci lagi, bukan dibiarkan
  // memperlihatkan data terakhir yang sudah tidak berhak dilihat.
  useEffect(() => onUnauthorized(() => setLocked(true)), [])

  useEffect(() => {
    if (locked || muat || route !== '/dashboard') return
    void refresh()
    api.catalog().then(setCatalog).catch(() => undefined)
    api.health().then(setHealth).catch(() => undefined)
  }, [refresh, locked, muat, route])

  // Siaran dari backend: setiap penilaian dan keputusan gerbang mendorong
  // muat ulang, sehingga dashboard tidak perlu menebak kapan harus bertanya.
  useEffect(() => {
    if (locked || route !== '/dashboard') return
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws' + wsQuery()
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(url)
      wsRef.current = ws
      ws.onmessage = () => { void refresh() }
      ws.onerror = () => undefined
    } catch {
      // Dashboard tetap berguna tanpa WebSocket; tombol muat ulang mengambil
      // alih. Kegagalan di sini bukan alasan untuk mengosongkan layar.
      ws = null
    }
    return () => { ws?.close(); wsRef.current = null }
  }, [refresh, locked, route])

  /**
   * Isi lonceng pemberitahuan.
   *
   * Keadaan yang sama yang dulu memasang spanduk selebar halaman di atas
   * setiap tab. Lampu dan tulisan "mode luring" tetap menyala di bilah atas,
   * jadi yang pindah ke sini adalah uraian panjangnya, bukan pengakuannya.
   */
  const kabar = useMemo<Kabar[]>(() => {
    const out: Kabar[] = []
    if (offline) {
      out.push({
        id: 'luring',
        nada: 'warn',
        judul: t('offline.title'),
        isi: `${t('offline.body', { time: new Date(snapshotGeneratedAt).toLocaleString(locale) })}`
          + ` make backend ${t('offline.body2')} owl/ ${t('offline.body3')}`,
      })
    }
    if (err && !offline) {
      out.push({ id: 'gagal', nada: 'err', judul: t('err.title'), isi: err })
    }
    return out
  }, [offline, err, t, locale])

  const tirai = (
    <>
      <Latar redup={route === '/dashboard'} />
      {muat && (
        <div className="boot">
          <div className="boot-isi">
            <Logo size={78} />
            <div className="boot-word">OWL</div>
            <div className="boot-sub">ON DEVICE WATCH LAYER</div>
            <div className="boot-bar"><i /></div>
            <div className="boot-line">{t('loader.line')}</div>
          </div>
        </div>
      )}
      {bukaDash && (
        <div className="boot cepat">
          <div className="boot-isi">
            <Logo size={58} />
            <div className="boot-bar"><i /></div>
            <div className="boot-line">{t('loader.unlock')}</div>
          </div>
        </div>
      )}
      <div className={`xfade${pindahKe ? ' is-on' : ''}`} aria-hidden="true" />
    </>
  )

  if (route !== '/dashboard') {
    return (
      <>
        {tirai}
        <header className="land-top">
          <button className="btn ghost" onClick={() => pindah('/dashboard')}>
            {t('land.toDashboard')}
          </button>
          <div className="sudut">
            <div className="sudut-baris">
              <Notifikasi kabar={kabar} />
              <LangToggle />
            </div>
            <StatusKoneksi offline={offline} />
          </div>
        </header>
        <div key="landing" className="halaman">
          <Landing onOpenDashboard={() => pindah('/dashboard')} />
        </div>
      </>
    )
  }

  return (
    <>
    {tirai}
    {locked && !muat && !bukaDash && <Login onOpen={bukaKunci} onClose={keluar} />}
    <div className={`halaman shell${locked ? ' locked' : ''}`} aria-hidden={locked}>
      <header className="topbar">
        <button className="brand" onClick={() => pindah('/')} title={t('land.home')}>
          <Logo />
          <div>
            <div className="word">OWL</div>
            <div className="sub">ON DEVICE WATCH LAYER</div>
          </div>
        </button>
        <nav className="tabs">
          {TABS.map((tb) => (
            <button key={tb.id} aria-current={tab === tb.id} onClick={() => setTab(tb.id)}>
              {t(tb.label)}
            </button>
          ))}
        </nav>

        <div className="sudut">
          <div className="sudut-baris">
            <button className="btn ghost" onClick={() => void refresh()}>{t('top.refresh')}</button>
            <button className="btn ghost" onClick={keluar}>{t('top.logout')}</button>
            <Notifikasi kabar={kabar} />
            <LangToggle />
          </div>
          <StatusKoneksi offline={offline} />
        </div>
      </header>

      <div className="tabisi" key={tab}>
        {tab === 'ikhtisar' && <Gelaran devices={devices} />}
        {tab === 'gerbang' && (
          <Gerbang
            devices={devices}
            catalog={catalog}
            events={events}
            metrics={metrics}
            onLihatPerangkat={() => setTab('perangkat')}
            onRefresh={() => void refresh()}
          />
        )}
        {tab === 'perangkat' && <Perangkat devices={devices} />}
        {tab === 'soc' && <Soc devices={devices} />}
        {tab === 'operasi' && (
          <Operasi devices={devices} offline={offline} onRefresh={() => void refresh()} />
        )}
      </div>
    </div>
    {!locked && !muat && (
      <>
        <PanelAturan catalog={catalog} buka={panel} onToggle={setPanel} />
        <Versi
          version={health?.version ?? null}
          airGapped={health?.air_gapped ?? true}
          offline={offline}
        />
      </>
    )}
    </>
  )
}
