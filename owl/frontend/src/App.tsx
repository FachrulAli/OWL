import { useCallback, useEffect, useRef, useState } from 'react'
import { Logo } from './components/Logo'
import { Login } from './components/Login'
import { api, clearKey, hasKey, isOffline, onOfflineChange, onUnauthorized, snapshotGeneratedAt } from './lib/api'
import { LangToggle, useT } from './lib/i18n'
import type { Key } from './lib/i18n'
import type { Catalog, DeviceRow } from './lib/types'
import { Aturan } from './views/Aturan'
import { Landing } from './views/Landing'
import { Gerbang } from './views/Gerbang'
import { Perangkat } from './views/Perangkat'
import { Soc } from './views/Soc'

type Tab = 'gerbang' | 'perangkat' | 'aturan' | 'soc'

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

const TABS: { id: Tab; label: Key }[] = [
  { id: 'gerbang', label: 'tab.gerbang' },
  { id: 'perangkat', label: 'tab.perangkat' },
  { id: 'aturan', label: 'tab.aturan' },
  { id: 'soc', label: 'tab.soc' },
]

export default function App() {
  const { t, locale } = useT()
  const [route, setRoute] = useState(jalurSekarang)
  const [tab, setTab] = useState<Tab>('gerbang')
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [health, setHealth] = useState<{ version: string; air_gapped: boolean } | null>(null)
  const [err, setErr] = useState('')
  const [offline, setOffline] = useState(isOffline())
  const [locked, setLocked] = useState(!hasKey())
  const [muat, setMuat] = useState(perluLayarPembuka)
  const [pindahKe, setPindahKe] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDevices(await api.devices())
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

  useEffect(() => {
    if (!muat) return
    try { sessionStorage.setItem(SESI_MUAT, '1') } catch { /* jendela privat */ }
    const t = setTimeout(() => setMuat(false), 3100)
    return () => clearTimeout(t)
  }, [muat])

  useEffect(() => onOfflineChange(setOffline), [])

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
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'
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

  const tirai = (
    <>
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
          <LangToggle />
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
    {locked && !muat && <Login onOpen={() => setLocked(false)} />}
    <div className={`halaman shell${locked ? ' locked' : ''}`} aria-hidden={locked}>
      <header className="topbar">
        <button className="brand" onClick={() => pindah('/')} title={t('land.home')}>
          <Logo />
          <div>
            <div className="word">OWL</div>
            <div className="sub">ON DEVICE WATCH LAYER</div>
          </div>
        </button>
        <div className="spacer" />
        {offline
          ? <span className="pill warn">{t('top.offline')}</span>
          : health?.air_gapped && <span className="pill ok">{t('top.airgapped')}</span>}
        {health && <span className="pill">v{health.version}</span>}
        <button className="btn ghost" onClick={() => void refresh()}>{t('top.refresh')}</button>
        <button className="btn ghost" onClick={() => { clearKey(); setLocked(true) }}>
          {t('top.logout')}
        </button>
        <LangToggle />
      </header>

      <nav className="tabs">
        {TABS.map((tb) => (
          <button key={tb.id} aria-current={tab === tb.id} onClick={() => setTab(tb.id)}>
            {t(tb.label)}
          </button>
        ))}
      </nav>

      {offline && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(245,158,11,.45)' }}>
          <h3>{t('offline.title')}</h3>
          <p className="muted">
            {t('offline.body', { time: new Date(snapshotGeneratedAt).toLocaleString(locale) })}{' '}
            <code>make backend</code> {t('offline.body2')} <code>owl/</code>{' '}
            {t('offline.body3')}
          </p>
        </div>
      )}
      {err && !offline && (
        <div className="card err" style={{ marginBottom: 16 }}>
          <h3>{t('err.title')}</h3>
          <p className="muted">{err}</p>
        </div>
      )}

      <div className="tabisi" key={tab}>
        {tab === 'gerbang' && <Gerbang devices={devices} onRefresh={refresh} />}
        {tab === 'perangkat' && <Perangkat devices={devices} />}
        {tab === 'aturan' && <Aturan catalog={catalog} />}
        {tab === 'soc' && <Soc devices={devices} />}
      </div>
    </div>
    </>
  )
}
