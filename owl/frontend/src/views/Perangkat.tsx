import { useState } from 'react'
import { Contributors } from '../components/Contributors'
import { Indicators } from '../components/Indicators'
import { Ring } from '../components/Ring'
import { CATEGORY_LABEL, scoreColor } from '../lib/api'
import type { DeviceRow } from '../lib/types'

export function Perangkat({ devices }: { devices: DeviceRow[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const sel = devices.find((d) => d.device_id === open) ?? null

  if (devices.length === 0) {
    return <div className="card"><p className="empty">Belum ada perangkat terdaftar.</p></div>
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: sel ? 'minmax(0,1.1fr) minmax(0,1fr)' : '1fr' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Perangkat</th><th>Satuan</th><th>Peran</th>
              <th style={{ textAlign: 'right' }}>Skor</th><th>Tingkat</th><th>Temuan</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.device_id} className="clickable"
                  onClick={() => setOpen(open === d.device_id ? null : d.device_id)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.label || d.device_id}</div>
                  <div className="ev">{d.device_id} · {d.model}</div>
                </td>
                <td className="muted">{d.unit || '—'}</td>
                <td className="muted">{d.owner_role || '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600,
                             color: d.score === null ? 'var(--slate)' : scoreColor(d.score) }}>
                  {d.score === null ? '—' : d.score.toFixed(0)}
                </td>
                <td className="muted">{d.level ?? 'belum dinilai'}</td>
                <td className="muted">{d.findings.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="card">
          <div className="devhead" style={{ marginBottom: 16 }}>
            <Ring score={sel.score} size={88} />
            <div className="devmeta">
              <div className="name">{sel.label || sel.device_id}</div>
              <div className="sub">{sel.device_id}</div>
              <div className="sub">
                dinilai {sel.assessed_at ? new Date(sel.assessed_at).toLocaleString('id-ID') : '—'}
              </div>
            </div>
          </div>

          <div className="kicker">Status indikator pada pemeriksaan terakhir</div>
          <Indicators availability={sel.availability} skipped={sel.skipped_rules} />

          <div className="kicker" style={{ marginTop: 20 }}>Rincian skor</div>
          <Contributors findings={sel.findings} />

          <div className="kicker" style={{ marginTop: 20 }}>Pemetaan MITRE ATT&amp;CK Mobile</div>
          <table>
            <tbody>
              {sel.findings.filter((f) => f.mitre).map((f) => (
                <tr key={f.rule_id}>
                  <td style={{ width: 74 }}><span className="rid" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{f.rule_id}</span></td>
                  <td className="muted">{CATEGORY_LABEL[f.category]}</td>
                  <td className="muted">{f.mitre}</td>
                  <td className="muted">keyakinan {f.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
