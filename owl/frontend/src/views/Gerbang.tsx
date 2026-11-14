import { useState } from 'react'
import { Contributors } from '../components/Contributors'
import { Ring } from '../components/Ring'
import { api } from '../lib/api'
import { DECISION_EN, useT } from '../lib/i18n'
import type { Decision, DeviceRow, Sensitivity } from '../lib/types'

/**
 * Layar gerbang. Inilah momen demo (proposal §6): dua perangkat datang,
 * OWL menilai, lalu satu lolos dan satu ditolak di depan juri.
 *
 * Keputusan di sini tidak pernah dihitung di browser. Tombolnya memanggil
 * POST /api/gate dan menampilkan apa yang dijawab Policy Decision Point.
 */
export function Gerbang({ devices, onRefresh }: { devices: DeviceRow[]; onRefresh: () => void }) {
  const { t, locale, decision, reason } = useT()
  const [resource, setResource] = useState<Sensitivity>('classified')
  const [results, setResults] = useState<Record<string, Decision>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function runGate(ids: string[]) {
    setBusy(true); setErr('')
    try {
      const out: Record<string, Decision> = {}
      for (const id of ids) out[id] = await api.gate(id, resource)
      setResults((p) => ({ ...p, ...out }))
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally {
      setBusy(false)
    }
  }

  async function seed() {
    setBusy(true); setErr(''); setResults({})
    try { await api.seed(); onRefresh() }
    catch (e) { setErr(String(e instanceof Error ? e.message : e)) }
    finally { setBusy(false) }
  }

  if (devices.length === 0) {
    return (
      <div className="card">
        <div className="kicker">{t('gate.kicker')}</div>
        <h3>{t('gate.emptyTitle')}</h3>
        <p className="muted" style={{ marginBottom: 16 }}>{t('gate.emptyBody')}</p>
        <button className="btn" onClick={seed} disabled={busy}>
          {busy ? t('gate.seeding') : t('gate.seed')}
        </button>
        {err && <p className="muted" style={{ color: 'var(--red)', marginTop: 12 }}>{err}</p>}
      </div>
    )
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="kicker">{t('gate.kicker')}</div>
            <p className="muted">{t('gate.threshold')}</p>
            <p className="muted" style={{ marginTop: 6 }}>
              {t('gate.note1')} <strong>{t('gate.noteBold')}</strong>{t('gate.note2')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={resource === 'classified' ? 'btn' : 'btn ghost'}
                    onClick={() => setResource('classified')}>{t('gate.classified')}</button>
            <button className={resource === 'standard' ? 'btn' : 'btn ghost'}
                    onClick={() => setResource('standard')}>{t('gate.standard')}</button>
            <button className="btn amber" disabled={busy}
                    onClick={() => runGate(devices.map((d) => d.device_id))}>
              {busy ? t('gate.running') : t('gate.run')}
            </button>
          </div>
        </div>
        {err && <p className="muted" style={{ color: 'var(--red)', marginTop: 12 }}>{err}</p>}
      </div>

      <div className="grid cols-2">
        {devices.map((d) => {
          const res = results[d.device_id]
          const lane = res ? (res.decision === 'allow' || res.decision === 'step_up' ? 'allow' : 'deny') : ''
          return (
            <div key={d.device_id} className={`gate-lane ${lane}`}>
              <div className="devhead">
                <Ring score={d.score} />
                <div className="devmeta" style={{ flex: 1 }}>
                  <div className="name">{d.label || d.device_id}</div>
                  <div className="sub">{d.device_id} · {d.unit || '—'}</div>
                  <div className="sub">{d.model} · {d.os_version}</div>
                  <div className="sub">
                    {d.assessed_at
                      ? t('gate.checked', { time: new Date(d.assessed_at).toLocaleString(locale) })
                      : t('gate.neverChecked')}
                  </div>
                  {d.attestation_ok === false && (
                    <div className="flag" style={{ marginTop: 6 }}>{t('gate.attestationBad')}</div>
                  )}
                  {d.skipped_rules?.length > 0 && (
                    <div className="flag" style={{ marginTop: 4 }}>
                      {t('gate.skipped', { n: d.skipped_rules.length })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className={`verdict ${res ? lane : 'pending'}`}>
                  {res ? decision(res.decision) : t('gate.pending')}
                </div>
                {res && (
                  <div className="sub" style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 2 }}>
                    {t('gate.recommendation')}: {DECISION_EN[res.decision]}
                  </div>
                )}
                <p className="muted" style={{ marginTop: 6 }}>
                  {res ? reason(res.reason) : t('gate.hint')}
                </p>
                {res?.quarantine && (
                  <p className="flag" style={{ marginTop: 8 }}>{t('gate.quarantine')}</p>
                )}
              </div>

              <Contributors findings={d.findings} max={4} />
            </div>
          )
        })}
      </div>
    </>
  )
}
