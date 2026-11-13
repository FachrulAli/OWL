import { useCallback, useEffect, useRef, useState } from 'react'
import { Logo } from './components/Logo'
import { api, isOffline, onOfflineChange, snapshotGeneratedAt } from './lib/api'
import type { Catalog, DeviceRow } from './lib/types'
import { Aturan } from './views/Aturan'
import { Gerbang } from './views/Gerbang'
import { Perangkat } from './views/Perangkat'
import { Soc } from './views/Soc'

type Tab = 'gerbang' | 'perangkat' | 'aturan' | 'soc'

const TABS: { id: Tab; label: string }[] = [
  { id: 'gerbang', label: 'Gerbang' },
  { id: 'perangkat', label: 'Perangkat' },
  { id: 'aturan', label: 'Aturan & bobot' },
  { id: 'soc', label: 'SOC / CSIRT' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('gerbang')
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [health, setHealth] = useState<{ version: string; air_gapped: boolean } | null>(null)
  const [err, setErr] = useState('')
  const [offline, setOffline] = useState(isOffline())
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

  useEffect(() => {
    void refresh()
    api.catalog().then(setCatalog).catch(() => undefined)
    api.health().then(setHealth).catch(() => undefined)
  }, [refresh])

  // Siaran dari backend: setiap penilaian dan keputusan gerbang mendorong
  // muat ulang, sehingga dashboard tidak perlu menebak kapan harus bertanya.
  useEffect(() => {
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
  }, [refresh])

  return (
    <div className="shell">
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
          ? <span className="pill warn">mode luring · rekaman</span>
          : health?.air_gapped && <span className="pill ok">on-prem · air-gapped</span>}
        {health && <span className="pill">v{health.version}</span>}
        <button className="btn ghost" onClick={() => void refresh()}>Muat ulang</button>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {offline && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(245,158,11,.45)' }}>
          <h3>Mode luring</h3>
          <p className="muted">
            OWL Core tidak terjangkau, jadi yang ditampilkan adalah rekaman hasil
            penilaian mesin yang sungguhan, dibuat {new Date(snapshotGeneratedAt).toLocaleString('id-ID')}.
            Angkanya tidak dihitung di browser. Untuk menilai telemetri baru dan
            mengeluarkan event ke SOC, jalankan <code>make backend</code> dari folder{' '}
            <code>owl/</code>, lalu muat ulang.
          </p>
        </div>
      )}
      {err && !offline && (
        <div className="card err" style={{ marginBottom: 16 }}>
          <h3>Gagal memuat data</h3>
          <p className="muted">{err}</p>
        </div>
      )}

      {tab === 'gerbang' && <Gerbang devices={devices} onRefresh={refresh} />}
      {tab === 'perangkat' && <Perangkat devices={devices} />}
      {tab === 'aturan' && <Aturan catalog={catalog} />}
      {tab === 'soc' && <Soc devices={devices} />}
    </div>
  )
}
