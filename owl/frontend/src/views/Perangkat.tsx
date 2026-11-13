import { useState } from 'react'
import { Contributors } from '../components/Contributors'
import { Indicators } from '../components/Indicators'
import { Ring } from '../components/Ring'
import { scoreColor } from '../lib/api'
import { useT } from '../lib/i18n'
import type { DeviceRow } from '../lib/types'

export function Perangkat({ devices }: { devices: DeviceRow[] }) {
  const { t, locale, category, word } = useT()
  const [open, setOpen] = useState<string | null>(null)
  const sel = devices.find((d) => d.device_id === open) ?? null

  if (devices.length === 0) {
    return <div className="card"><p className="empty">{t('dev.empty')}</p></div>
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: sel ? 'minmax(0,1.1fr) minmax(0,1fr)' : '1fr' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>{t('dev.col.device')}</th><th>{t('dev.col.unit')}</th><th>{t('dev.col.role')}</th>
              <th style={{ textAlign: 'right' }}>{t('dev.col.score')}</th>
              <th>{t('dev.col.level')}</th><th>{t('dev.col.findings')}</th>
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
                <td className="muted">{d.level ? word(d.level) : t('dev.notAssessed')}</td>
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
                {sel.assessed_at
                  ? t('dev.assessedAt', { time: new Date(sel.assessed_at).toLocaleString(locale) })
                  : t('gate.neverChecked')}
              </div>
            </div>
          </div>

          <div className="kicker">{t('dev.indicatorStatus')}</div>
          <Indicators availability={sel.availability} skipped={sel.skipped_rules} />

          <div className="kicker" style={{ marginTop: 20 }}>{t('dev.scoreBreakdown')}</div>
          <Contributors findings={sel.findings} />

          <div className="kicker" style={{ marginTop: 20 }}>{t('dev.mitre')}</div>
          <table>
            <tbody>
              {sel.findings.filter((f) => f.mitre).map((f) => (
                <tr key={f.rule_id}>
                  <td style={{ width: 74 }}><span className="rid" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{f.rule_id}</span></td>
                  <td className="muted">{category(f.category)}</td>
                  <td className="muted">{f.mitre}</td>
                  <td className="muted">{t('dev.confidence', { v: word(f.confidence) })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
