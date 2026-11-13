import { useState } from 'react'
import { Contributors } from '../components/Contributors'
import { Ring } from '../components/Ring'
import { api, DECISION_LABEL } from '../lib/api'
import type { Decision, DeviceRow, Sensitivity } from '../lib/types'

/**
 * Layar gerbang. Inilah momen demo (proposal §6): dua perangkat datang,
 * OWL menilai, lalu satu lolos dan satu ditolak di depan juri.
 *
 * Keputusan di sini tidak pernah dihitung di browser. Tombolnya memanggil
 * POST /api/gate dan menampilkan apa yang dijawab Policy Decision Point.
 */
export function Gerbang({ devices, onRefresh }: { devices: DeviceRow[]; onRefresh: () => void }) {
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
        <div className="kicker">Gerbang Risiko Perangkat</div>
        <h3>Belum ada perangkat terdaftar</h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          Muat dua perangkat contoh, satu bersih dan satu berisiko, lalu jalankan gerbangnya.
          Keduanya dinilai lewat mesin aturan yang sama dengan telemetri agent sungguhan.
        </p>
        <button className="btn" onClick={seed} disabled={busy}>
          {busy ? 'Memuat…' : 'Muat dua perangkat contoh'}
        </button>
        {err && <p className="muted" style={{ color: '#F87171', marginTop: 12 }}>{err}</p>}
      </div>
    )
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="kicker">Gerbang Risiko Perangkat</div>
            <p className="muted">
              Pilih sumber daya yang hendak diakses, lalu jalankan gerbang. Ambang deny
              berbeda menurut kepekaan sumber daya: 70 untuk sistem terklasifikasi, 90
              untuk jaringan biasa.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={resource === 'classified' ? 'btn' : 'btn ghost'}
                    onClick={() => setResource('classified')}>Sistem terklasifikasi</button>
            <button className={resource === 'standard' ? 'btn' : 'btn ghost'}
                    onClick={() => setResource('standard')}>Jaringan biasa</button>
            <button className="btn amber" disabled={busy}
                    onClick={() => runGate(devices.map((d) => d.device_id))}>
              {busy ? 'Menilai…' : 'Jalankan gerbang'}
            </button>
          </div>
        </div>
        {err && <p className="muted" style={{ color: '#F87171', marginTop: 12 }}>{err}</p>}
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
                  {d.attestation_ok === false && (
                    <div className="flag" style={{ marginTop: 6 }}>attestation agent tidak sah</div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className={`verdict ${res ? lane : 'pending'}`}>
                  {res ? DECISION_LABEL[res.decision] : 'BELUM DINILAI'}
                </div>
                <p className="muted" style={{ marginTop: 6 }}>
                  {res ? res.reason : 'Tekan "Jalankan gerbang" untuk meminta keputusan dari Policy Decision Point.'}
                </p>
                {res?.quarantine && (
                  <p className="flag" style={{ marginTop: 8 }}>
                    perangkat dikarantina, eskalasi dikirim ke komando dan CSIRT
                  </p>
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
