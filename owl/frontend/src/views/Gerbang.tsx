import { useState } from 'react'
import { PetaKomando, useGelaran } from '../components/PetaGelaran'
import { api, scoreColor } from '../lib/api'
import { DECISION_EN, useT } from '../lib/i18n'
import type { Decision, DeviceRow, Sensitivity } from '../lib/types'

/**
 * Layar gerbang. Inilah momen demo (proposal §6): dua perangkat datang,
 * OWL menilai, lalu satu lolos dan satu ditolak di depan juri.
 *
 * Keputusan di sini tidak pernah dihitung di browser. Tombolnya memanggil
 * POST /api/gate dan menampilkan apa yang dijawab Policy Decision Point.
 *
 * Seluruh layar ini satu bidang: peta selebar halaman, dengan kendali
 * gerbang mengambang di kiri dan keterangan satuan di kanan. Kartu perangkat
 * yang dulu berdiri sendiri di bawah peta dihapus, dan perangkatnya kini
 * muncul di tempat ia memang berada, yaitu di bawah satuannya pada peta.
 * Rincian temuan tiap perangkat tetap utuh di tab Perangkat; yang hilang
 * dari sini hanya pengulangannya.
 */
export function Gerbang({ devices, onRefresh }: { devices: DeviceRow[]; onRefresh: () => void }) {
  const { t, decision, reason } = useT()
  const [resource, setResource] = useState<Sensitivity>('classified')
  const [results, setResults] = useState<Record<string, Decision>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const titik = useGelaran(devices)

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

  const kosong = devices.length === 0
  const hasil = devices.filter((d) => results[d.device_id])

  const kendali = kosong ? (
    <>
      <div className="kicker">{t('gate.kicker')}</div>
      <h4>{t('gate.emptyTitle')}</h4>
      <p className="muted" style={{ marginBottom: 14 }}>{t('gate.emptyBody')}</p>
      <button className="btn" onClick={seed} disabled={busy}>
        {busy ? t('gate.seeding') : t('gate.seed')}
      </button>
      {err && <p className="muted" style={{ color: 'var(--red)', marginTop: 12 }}>{err}</p>}
    </>
  ) : (
    <>
      <div className="kicker">{t('gate.kicker')}</div>
      <p className="muted">{t('gate.threshold')}</p>

      <div className="gate-pilih" role="group" aria-label={t('gate.kicker')}>
        <button className={resource === 'classified' ? 'btn' : 'btn ghost'}
                onClick={() => setResource('classified')}>{t('gate.classified')}</button>
        <button className={resource === 'standard' ? 'btn' : 'btn ghost'}
                onClick={() => setResource('standard')}>{t('gate.standard')}</button>
      </div>

      <button className="btn amber gate-jalan" disabled={busy}
              onClick={() => runGate(devices.map((d) => d.device_id))}>
        {busy ? t('gate.running') : t('gate.run')}
      </button>

      {err && <p className="muted" style={{ color: 'var(--red)', marginTop: 12 }}>{err}</p>}

      {hasil.length > 0 && (
        <>
          <div className="peta-sisi-garis" />
          <div className="kicker" style={{ marginBottom: 10 }}>{t('gate.results')}</div>
          <ul className="gate-hasil">
            {hasil.map((d) => {
              const res = results[d.device_id]
              const lolos = res.decision === 'allow' || res.decision === 'step_up'
              return (
                <li key={d.device_id} className={lolos ? 'ok' : 'no'}>
                  <div className="baris">
                    <span className="skor" style={{ color: scoreColor(res.score) }}>
                      {res.score.toFixed(0)}
                    </span>
                    <span className="nama">{d.label || d.device_id}</span>
                    <span className={`vonis ${lolos ? 'ok' : 'no'}`}>{decision(res.decision)}</span>
                  </div>
                  <p className="alasan">{reason(res.reason)}</p>
                  <p className="rek">{t('gate.recommendation')}: {DECISION_EN[res.decision]}</p>
                  {res.quarantine && <p className="flag">{t('gate.quarantine')}</p>}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <p className="muted gate-batas">
        {t('gate.note1')} <strong>{t('gate.noteBold')}</strong>{t('gate.note2')}
      </p>
    </>
  )

  return <PetaKomando titik={titik} results={results} kendali={kendali} />
}
