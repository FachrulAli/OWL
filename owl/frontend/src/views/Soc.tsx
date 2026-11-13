import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { DeviceRow, SocEvent } from '../lib/types'

/**
 * Jalur keluar ke SOC. Payload yang ditampilkan di sini adalah payload yang
 * benar-benar dikirim, diambil kembali dari tabel soc_events, bukan contoh
 * yang ditulis untuk slide.
 */
export function Soc({ devices }: { devices: DeviceRow[] }) {
  const { t, locale } = useT()
  const [events, setEvents] = useState<SocEvent[]>([])
  const [sel, setSel] = useState<SocEvent | null>(null)
  const [err, setErr] = useState('')

  async function load() {
    try { setEvents(await api.socEvents(12)); setErr('') }
    catch (e) { setErr(String(e instanceof Error ? e.message : e)) }
  }

  useEffect(() => { void load() }, [devices])

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,.9fr) minmax(0,1.1fr)' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 4px' }}>
          <div className="kicker">{t('soc.kicker')}</div>
          <p className="muted" style={{ marginBottom: 10 }}>{t('soc.note')}</p>
        </div>
        {err && <p className="muted" style={{ color: '#F87171', padding: '0 20px 12px' }}>{err}</p>}
        <table>
          <thead>
            <tr>
              <th>{t('soc.col.time')}</th><th>{t('soc.col.device')}</th>
              <th>{t('soc.col.kind')}</th><th>{t('soc.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="clickable" onClick={() => setSel(e)}>
                <td className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                  {new Date(e.sent_at).toLocaleTimeString(locale)}
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{e.device_id}</td>
                <td><span className={`sev ${e.kind === 'stix' ? 'medium' : 'low'}`}>{e.kind}</span></td>
                <td className="muted">{e.delivered ? t('soc.delivered') : t('soc.stored')}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={4}><p className="empty">{t('soc.empty')}</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="kicker">{t('soc.payload')}</div>
        {sel ? (
          <>
            <p className="muted" style={{ marginBottom: 10 }}>
              {sel.kind.toUpperCase()} · {sel.device_id} ·{' '}
              {new Date(sel.sent_at).toLocaleString(locale)}
            </p>
            <pre>{sel.kind === 'stix' ? prettyJson(sel.payload) : sel.payload}</pre>
          </>
        ) : (
          <p className="empty">{t('soc.pickEvent')}</p>
        )}
      </div>
    </div>
  )
}

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) }
  catch { return raw }
}
