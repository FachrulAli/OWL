import { useCallback, useEffect, useRef, useState } from 'react'
import { Logo } from './components/Logo'
import { Login } from './components/Login'
import { api, hasKey, isOffline, onOfflineChange, onUnauthorized, snapshotGeneratedAt } from './lib/api'
import { LangToggle, useT } from './lib/i18n'
import type { Key } from './lib/i18n'
import type { Catalog, DeviceRow } from './lib/types'
import { Aturan } from './views/Aturan'
import { Gerbang } from './views/Gerbang'
import { Perangkat } from './views/Perangkat'
import { Soc } from './views/Soc'

type Tab = 'gerbang' | 'perangkat' | 'aturan' | 'soc'

const TABS: { id: Tab; label: Key }[] = [
  { id: 'gerbang', label: 'tab.gerbang' },
  { id: 'perangkat', label: 'tab.perangkat' },
  { id: 'aturan', label: 'tab.aturan' },
  { id: 'soc', label: 'tab.soc' },
]

export default function App() {
  const { t, locale } = useT()
  const [tab, setTab] = useState<Tab>('gerbang')
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [health, setHealth] = useState<{ version: string; air_gapped: boolean } | null>(null)
  const [err, setErr] = useState('')
  const [offline, setOffline] = useState(isOffline())
  const [locked, setLocked] = useState(!hasKey())
  const wsRef = useRef<WebSocket | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDevices(await api.devices())
      setErr('')
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    }
  }, [])

  useEffect(() => onOfflineChange(setOffline), [])

  // Kunci dicabut di tengah sesi: layar dikunci lagi, bukan dibiarkan
  // memperlihatkan data terakhir yang sudah tidak berhak dilihat.
  useEffect(() => onUnauthorized(() => setLocked(true)), [])

  useEffect(() => {
    if (locked) return
    void refresh()
    api.catalog().then(setCatalog).catch(() => undefined)
    api.health().then(setHealth).catch(() => undefined)
  }, [refresh, locked])

  // Siaran dari backend: setiap penilaian dan keputusan gerbang mendorong
  // muat ulang, sehingga dashboard tidak perlu menebak kapan harus bertanya.
  useEffect(() => {
    if (locked) return
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
  }, [refresh, locked])

  return (
    <>
    {locked && <Login onOpen={() => setLocked(false)} />}
    <div className={locked ? 'shell locked' : 'shell'} aria-hidden={locked}>
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div>
            <div className="word">OWL</div>
            <div className="sub">ON DEVICE WATCH LAYER</div>
          </div>
        </div>
        <div className="spacer" />
        {offline
          ? <span className="pill warn">{t('top.offline')}</span>
          : health?.air_gapped && <span className="pill ok">{t('top.airgapped')}</span>}
        {health && <span className="pill">v{health.version}</span>}
        <button className="btn ghost" onClick={() => void refresh()}>{t('top.refresh')}</button>
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

      {tab === 'gerbang' && <Gerbang devices={devices} onRefresh={refresh} />}
      {tab === 'perangkat' && <Perangkat devices={devices} />}
      {tab === 'aturan' && <Aturan catalog={catalog} />}
      {tab === 'soc' && <Soc devices={devices} />}
    </div>
    </>
  )
}
