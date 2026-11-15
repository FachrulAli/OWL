import { useMemo, useState } from 'react'
import { Contributors } from '../components/Contributors'
import { Indicators } from '../components/Indicators'
import { Ring } from '../components/Ring'
import { scoreColor } from '../lib/api'
import { useT } from '../lib/i18n'
import type { DeviceRow } from '../lib/types'

/**
 * Daftar perangkat, dengan pencarian dan penyaringan.
 *
 * Dua perangkat contoh muat di satu layar tanpa alat bantu apa pun, tetapi
 * satuan yang sungguhan mendaftarkan ratusan. Pencarian dan penyaringan
 * ditaruh di sini supaya layar ini tetap dapat dipakai pada jumlah itu,
 * bukan hanya pada jumlah demo.
 *
 * Seluruh penyaringan terjadi pada daftar yang SUDAH dinilai backend. Tidak
 * ada skor yang dihitung di sini, dan tidak ada ambang baru: "tinggi" berarti
 * tingkat yang sama dengan yang dikeluarkan mesin aturan.
 */

const TINGKAT = ['rendah', 'sedang', 'tinggi', 'kritis'] as const
type Saring = 'semua' | (typeof TINGKAT)[number] | 'belum'
type Urut = 'skor' | 'nama' | 'temuan'

export function Perangkat({ devices }: { devices: DeviceRow[] }) {
  const { t, locale, category, word } = useT()
  const [open, setOpen] = useState<string | null>(null)
  const [cari, setCari] = useState('')
  const [saring, setSaring] = useState<Saring>('semua')
  const [urut, setUrut] = useState<Urut>('skor')

  const hitung = useMemo(() => {
    const h = { semua: devices.length, belum: 0 } as Record<Saring, number>
    for (const k of TINGKAT) h[k] = 0
    for (const d of devices) {
      if (d.score === null) h.belum += 1
      else if (d.level && d.level in h) h[d.level as Saring] += 1
    }
    return h
  }, [devices])

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    const out = devices.filter((d) => {
      if (saring === 'belum' && d.score !== null) return false
      if (saring !== 'semua' && saring !== 'belum' && d.level !== saring) return false
      if (!q) return true
      return [d.label, d.device_id, d.unit, d.owner_role, d.model, d.os_version]
        .some((v) => (v ?? '').toLowerCase().includes(q))
        || d.findings.some((f) => f.rule_id.toLowerCase().includes(q))
    })

    out.sort((a, b) => {
      if (urut === 'nama') return (a.label || a.device_id).localeCompare(b.label || b.device_id)
      if (urut === 'temuan') return b.findings.length - a.findings.length
      return (b.score ?? -1) - (a.score ?? -1)
    })
    return out
  }, [devices, cari, saring, urut])

  const sel = tampil.find((d) => d.device_id === open) ?? null

  if (devices.length === 0) {
    return <div className="card"><p className="empty">{t('dev.empty')}</p></div>
  }

  const disaring = cari.trim() !== '' || saring !== 'semua'

  return (
    <>
      <div className="card saring" style={{ marginBottom: 16 }}>
        <div className="saring-cari">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13.4 13.4 L17.5 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={t('dev.searchHint')}
            aria-label={t('dev.search')}
          />
          {cari && (
            <button className="saring-hapus" onClick={() => setCari('')} aria-label={t('dev.clear')}>×</button>
          )}
        </div>

        <div className="saring-cip" role="group" aria-label={t('dev.filterLevel')}>
          {(['semua', ...TINGKAT, 'belum'] as Saring[]).map((k) => (
            <button
              key={k}
              aria-pressed={saring === k}
              disabled={k !== 'semua' && hitung[k] === 0}
              onClick={() => setSaring(k)}
            >
              {k === 'semua' ? t('dev.all') : k === 'belum' ? t('dev.notAssessed') : word(k)}
              <i>{hitung[k]}</i>
            </button>
          ))}
        </div>

        <label className="saring-urut">
          <span>{t('dev.sort')}</span>
          <select value={urut} onChange={(e) => setUrut(e.target.value as Urut)}>
            <option value="skor">{t('dev.sortScore')}</option>
            <option value="temuan">{t('dev.sortFindings')}</option>
            <option value="nama">{t('dev.sortName')}</option>
          </select>
        </label>
      </div>

      {disaring && (
        <p className="saring-hasil">
          {t('dev.showing', { n: tampil.length, total: devices.length })}
          <button onClick={() => { setCari(''); setSaring('semua') }}>{t('dev.reset')}</button>
        </p>
      )}

      {tampil.length === 0 ? (
        <div className="card"><p className="empty">{t('dev.noMatch')}</p></div>
      ) : (
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
                {tampil.map((d) => (
                  <tr key={d.device_id}
                      className={`clickable${open === d.device_id ? ' terpilih' : ''}`}
                      onClick={() => setOpen(open === d.device_id ? null : d.device_id)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {sorot(d.label || d.device_id, cari)}
                        {d.revoked ? <span className="ops-lencana merah">{t('dev.revoked')}</span> : null}
                      </div>
                      <div className="ev">{sorot(d.device_id, cari)} · {d.model}</div>
                    </td>
                    <td className="muted">{sorot(d.unit || '—', cari)}</td>
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
      )}
    </>
  )
}

/**
 * Menandai bagian teks yang cocok dengan pencarian.
 *
 * Tanpa penanda ini, hasil pencarian pada kolom yang tidak terlihat, misalnya
 * model atau versi OS, tampak seperti baris yang nyasar.
 */
function sorot(teks: string, q: string) {
  const cari = q.trim()
  if (!cari) return teks
  const i = teks.toLowerCase().indexOf(cari.toLowerCase())
  if (i < 0) return teks
  return (
    <>
      {teks.slice(0, i)}
      <mark>{teks.slice(i, i + cari.length)}</mark>
      {teks.slice(i + cari.length)}
    </>
  )
}
