import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type Case = { device_id: string; status: string; note: string; actor: string; expires_at: string | null }
type Revocation = { status: string; entries: number; age_days?: number }
type Metrics = { devices: number; decisions: Record<string, number>; rejects_by_reason: Record<string, number> }

export function Operations() {
  const [admin, setAdmin] = useState('')
  const [device, setDevice] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('diperiksa')
  const [ttl, setTtl] = useState(30)
  const [cases, setCases] = useState<Case[]>([])
  const [revocation, setRevocation] = useState<Revocation | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [link, setLink] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [c, r, m] = await Promise.all([
      api.operations<Case[]>('/api/cases'),
      api.operations<Revocation>('/api/attestation/revocations'),
      api.operations<Metrics>('/api/metrics'),
    ])
    setCases(c); setRevocation(r); setMetrics(m)
  }
  useEffect(() => { void load().catch(e => setMessage(String(e))) }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('')
    try { await action(); await load(); setMessage('Perubahan tersimpan.') }
    catch (e) { setMessage(String(e)) }
    finally { setBusy(false) }
  }
  async function importFile(file: File | undefined, path: string, method = 'POST') {
    if (!file) return
    await run(async () => { await api.operations(path, method, JSON.parse(await file.text()), admin) })
  }
  const input = { width: '100%', padding: 8, marginBottom: 10 } as const
  return <section className="card" style={{ marginTop: 20 }}>
    <h3>Operasi perangkat</h3>
    <p>Daftar pencabutan attestation: {revocation?.status ?? 'belum terbaca'}
      {revocation && ` · ${revocation.entries} entri · umur ${revocation.age_days ?? '—'} hari`}</p>
    {metrics && <p className="muted">{metrics.devices} perangkat · {Object.entries(metrics.decisions).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
    <label>Kunci admin (hanya untuk sesi halaman ini)
      <input style={input} type="password" autoComplete="off" value={admin} onChange={e => setAdmin(e.target.value)} />
    </label>
    <label>ID perangkat<input style={input} value={device} onChange={e => { setDevice(e.target.value); setLink('') }} /></label>
    <label>Alasan / catatan<input style={input} value={note} onChange={e => setNote(e.target.value)} /></label>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <button disabled={busy || !admin || !device} onClick={() => void run(async () => {
        const r = await api.operations<{ provision_url: string }>('/api/enroll/tokens', 'POST', { device_id: device }, admin)
        setLink(r.provision_url)
      })}>Terbitkan token enrollment</button>
      <button disabled={busy || !admin || !device || note.length < 3} onClick={() => void run(async () => {
        await api.operations(`/api/devices/${encodeURIComponent(device)}/revoke`, 'PUT', { reason: note }, admin)
      })}>Cabut perangkat</button>
      <button disabled={busy || !admin || !device} onClick={() => void run(async () => {
        await api.operations(`/api/devices/${encodeURIComponent(device)}/revoke`, 'DELETE', undefined, admin)
      })}>Buka pencabutan</button>
    </div>
    {link && <p>Tautan sekali pakai: <a href={link}>Buka di OWL Agent</a><br /><code style={{ overflowWrap: 'anywhere' }}>{link}</code></p>}
    <label>Status penanganan <select value={status} onChange={e => setStatus(e.target.value)}>
      {['baru', 'diperiksa', 'diselesaikan', 'dikecualikan'].map(s => <option key={s}>{s}</option>)}
    </select></label>{' '}
    <label>Masa pengecualian (menit) <input type="number" min={1} max={1440} value={ttl} onChange={e => setTtl(Number(e.target.value))} /></label>{' '}
    <button disabled={busy || !admin || !device || note.length < 3} onClick={() => void run(async () => {
      await api.operations(`/api/cases/${encodeURIComponent(device)}`, 'PUT', { status, note, ttl_minutes: ttl }, admin)
    })}>Simpan penanganan</button>
    <table><thead><tr><th>Perangkat</th><th>Status</th><th>Pelaku</th><th>Catatan / kedaluwarsa</th></tr></thead>
      <tbody>{cases.map(c => <tr key={c.device_id} onClick={() => setDevice(c.device_id)}>
        <td>{c.device_id}</td><td>{c.status}</td><td>{c.actor}</td><td>{c.note}{c.expires_at && ` · ${c.expires_at}`}</td>
      </tr>)}</tbody></table>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14 }}>
      <label>Impor pencabutan Google (JSON)<input disabled={busy || !admin} type="file" accept=".json" onChange={e => void importFile(e.target.files?.[0], '/api/attestation/revocations')} /></label>
      <label>Ganti daftar larangan STIX<input disabled={busy || !admin} type="file" accept=".json" onChange={e => void importFile(e.target.files?.[0], '/api/blocklist/import')} /></label>
      <label>Ganti pengecualian pabrik (JSON)<input disabled={busy || !admin} type="file" accept=".json" onChange={e => void importFile(e.target.files?.[0], '/api/factory-allowlist', 'PUT')} /></label>
      <button disabled={busy} onClick={() => void run(load)}>Muat ulang status</button>
    </div>
    <p role="status" style={{ overflowWrap: 'anywhere' }}>{message}</p>
  </section>
}
