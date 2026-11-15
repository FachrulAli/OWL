import { useMemo, useState } from 'react'
import { api, scoreColor } from '../lib/api'
import { DECISION_EN, useT } from '../lib/i18n'
import type { Catalog, Decision, DeviceRow, Metrics, Sensitivity } from '../lib/types'

/**
 * Gerbang: keputusan akses, dan angka-angka yang menerangkannya.
 *
 * Satu halaman untuk satu pertanyaan: boleh masuk atau tidak, dan atas dasar
 * apa. Di atas, kendali gerbangnya sendiri beserta jawaban yang dikeluarkan
 * Policy Decision Point. Di bawahnya, keadaan yang membuat jawaban itu masuk
 * akal: postur satuan, sebaran tingkat risiko, asal poin risiko, bauran
 * keputusan yang sedang berlaku, telemetri yang ditolak, dan apa yang keluar
 * ke SOC.
 *
 * Peta gelaran pindah ke tab Ikhtisar. Peta menjawab "di mana ini dipakai",
 * dan itu pertanyaan situasi, bukan pertanyaan keputusan.
 *
 * Keputusan di sini tidak pernah dihitung di browser, dan seluruh angka di
 * bawahnya DITURUNKAN dari penilaian yang sudah dikeluarkan mesin aturan,
 * bukan dihitung ulang dengan rumus lain. Tidak ada ambang baru yang
 * diciptakan di lapisan tampilan.
 */

const TINGKAT = ['rendah', 'sedang', 'tinggi', 'kritis'] as const
type Tingkat = (typeof TINGKAT)[number]

const WARNA: Record<Tingkat, string> = {
  rendah: '#C9A227',
  sedang: '#E7C878',
  tinggi: '#E8A33D',
  kritis: '#D9534F',
}

const KEPUTUSAN = ['allow', 'step_up', 'limited', 'deny'] as const

export function Gerbang({
  devices, catalog, metrics, onRefresh,
}: {
  devices: DeviceRow[]
  catalog: Catalog | null
  /** Dari OWL Core. Null pada tautan publik: tidak ada rekamannya. */
  metrics: Metrics | null
  onRefresh: () => void
}) {
  const { t, category, word, decision, reason } = useT()
  const [resource, setResource] = useState<Sensitivity>('classified')
  const [results, setResults] = useState<Record<string, Decision>>({})
  const [sibuk, setSibuk] = useState(false)
  const [salah, setSalah] = useState('')

  async function jalankan() {
    setSibuk(true); setSalah('')
    try {
      const out: Record<string, Decision> = {}
      for (const d of devices) out[d.device_id] = await api.gate(d.device_id, resource)
      setResults((p) => ({ ...p, ...out }))
    } catch (e) {
      setSalah(String(e instanceof Error ? e.message : e))
    } finally {
      setSibuk(false)
    }
  }

  async function seed() {
    setSibuk(true); setSalah(''); setResults({})
    try { await api.seed(); onRefresh() }
    catch (e) { setSalah(String(e instanceof Error ? e.message : e)) }
    finally { setSibuk(false) }
  }

  const r = useMemo(() => {
    const dinilai = devices.filter((d) => d.score !== null)
    const total = devices.length
    const rata = dinilai.length
      ? dinilai.reduce((a, d) => a + (d.score ?? 0), 0) / dinilai.length
      : null

    const sebaran = {} as Record<Tingkat, number>
    for (const k of TINGKAT) sebaran[k] = 0
    for (const d of dinilai) {
      const lv = (d.level ?? 'rendah') as Tingkat
      if (lv in sebaran) sebaran[lv] += 1
    }

    const perKategori = new Map<string, number>()
    for (const d of dinilai) {
      for (const f of d.findings) {
        perKategori.set(f.category, (perKategori.get(f.category) ?? 0) + f.points)
      }
    }
    const kategori = [...perKategori.entries()].sort((a, b) => b[1] - a[1])
    const puncakKategori = kategori.length ? kategori[0][1] : 0

    const temuan = dinilai.reduce((a, d) => a + d.findings.length, 0)
    const kritisTemuan = dinilai.reduce(
      (a, d) => a + d.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length,
      0,
    )
    const dilewati = dinilai.reduce((a, d) => a + (d.skipped_rules?.length ?? 0), 0)
    const attestasiGagal = devices.filter((d) => d.attestation_ok === false).length

    // Perhatian: perangkat yang paling pantas dilihat lebih dahulu, diurutkan
    // oleh skor yang sama dengan yang dipakai gerbang.
    const perhatian = [...dinilai]
      .filter((d) => (d.score ?? 0) >= (catalog?.thresholds.medium ?? 30))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5)

    return {
      total, dinilai: dinilai.length, rata, sebaran, kategori, puncakKategori,
      temuan, kritisTemuan, dilewati, attestasiGagal, perhatian,
      belum: total - dinilai.length,
    }
  }, [devices, catalog])

  if (devices.length === 0) {
    return (
      <div className="card">
        <div className="kicker">{t('gate.kicker')}</div>
        <h3>{t('gate.emptyTitle')}</h3>
        <p className="muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>{t('gate.emptyBody')}</p>
        <button className="btn" onClick={seed} disabled={sibuk}>
          {sibuk ? t('gate.seeding') : t('gate.seed')}
        </button>
        {salah && <p className="muted" style={{ color: 'var(--red)', marginTop: 12 }}>{salah}</p>}
      </div>
    )
  }

  const hasil = devices.filter((d) => results[d.device_id])

  return (
    <div className="ikhtisar">
      {/* ——— kendali gerbang, lalu jawaban yang dikeluarkan PDP ——— */}
      <div className="card gerbang-kendali">
        <div className="gerbang-atur">
          <div>
            <div className="kicker">{t('gate.kicker')}</div>
            <p className="muted" style={{ maxWidth: '64ch' }}>{t('gate.threshold')}</p>
          </div>
          <div className="gerbang-tombol">
            <button className={resource === 'classified' ? 'btn' : 'btn ghost'}
                    onClick={() => setResource('classified')}>{t('gate.classified')}</button>
            <button className={resource === 'standard' ? 'btn' : 'btn ghost'}
                    onClick={() => setResource('standard')}>{t('gate.standard')}</button>
            <button className="btn amber" disabled={sibuk} onClick={() => void jalankan()}>
              {sibuk ? t('gate.running') : t('gate.run')}
            </button>
          </div>
        </div>

        {salah && <p className="muted" style={{ color: 'var(--red)', marginTop: 12 }}>{salah}</p>}

        {hasil.length > 0 && (
          <div className="gerbang-hasil">
            {hasil.map((d) => {
              const res = results[d.device_id]
              const lolos = res.decision === 'allow' || res.decision === 'step_up'
              return (
                <div key={d.device_id} className={`gerbang-jawab ${lolos ? 'ok' : 'no'}`}>
                  <div className="atas">
                    <span className="skor" style={{ color: scoreColor(res.score) }}>
                      {res.score.toFixed(0)}
                    </span>
                    <div className="siapa">
                      <div className="nama">{d.label || d.device_id}</div>
                      <div className="sub">{d.device_id} · {d.unit || '—'}</div>
                    </div>
                    <span className={`vonis ${lolos ? 'ok' : 'no'}`}>{decision(res.decision)}</span>
                  </div>
                  <p className="alasan">{reason(res.reason)}</p>
                  <p className="rek">{t('gate.recommendation')}: {DECISION_EN[res.decision]}</p>
                  {res.quarantine && <p className="flag">{t('gate.quarantine')}</p>}
                </div>
              )
            })}
          </div>
        )}

        <p className="muted gerbang-batas">
          {t('gate.note1')} <strong>{t('gate.noteBold')}</strong>{t('gate.note2')}
        </p>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        {/* ——— sebaran tingkat risiko ——— */}
        <div className="card">
          <div className="kicker">{t('ov.spread')}</div>
          <div className="ov-pita">
            {TINGKAT.map((k) => r.sebaran[k] > 0 && (
              <span
                key={k}
                style={{ flex: r.sebaran[k], background: WARNA[k] }}
                title={`${word(k)}: ${r.sebaran[k]}`}
              />
            ))}
          </div>
          <div className="ov-sebaran">
            {TINGKAT.map((k) => (
              <div key={k} className={r.sebaran[k] === 0 ? 'kosong' : ''}>
                <span className="t" style={{ background: WARNA[k] }} />
                <span className="n">{r.sebaran[k]}</span>
                <span className="l">{word(k)}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 14 }}>{t('ov.spreadNote')}</p>
        </div>

        {/* ——— dari mana poin risikonya datang ——— */}
        <div className="card">
          <div className="kicker">{t('ov.byCategory')}</div>
          {r.kategori.length === 0
            ? <p className="empty" style={{ padding: '20px 0' }}>{t('ov.noFindings')}</p>
            : (
              <div className="ov-kat">
                {r.kategori.map(([c, poin]) => (
                  <div key={c} className="ov-kat-baris">
                    <span className="l">{category(c)}</span>
                    <span className="bar">
                      <i style={{ width: `${(poin / r.puncakKategori) * 100}%` }} />
                    </span>
                    <span className="p">+{poin.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          <p className="muted" style={{ marginTop: 14 }}>{t('ov.byCategoryNote')}</p>
        </div>
      </div>

      {metrics && (
        <div className="grid cols-2" style={{ marginTop: 16 }}>
          {/* ——— bauran keputusan gerbang, dihitung backend ——— */}
          <div className="card">
            <div className="kicker">{t('ov.mix')}</div>
            <div className="ov-mix">
              {KEPUTUSAN.map((k) => (
                <div key={k} className={metrics.decisions[k] ? '' : 'kosong'}>
                  <span className="n" style={{ color: warnaKeputusan(k) }}>
                    {metrics.decisions[k] ?? 0}
                  </span>
                  <span className="l">{decision(k)}</span>
                </div>
              ))}
            </div>
            {basi(metrics, catalog) > 0 && (
              <p className="flag" style={{ marginTop: 12 }}>
                {t('ov.stale')}: {basi(metrics, catalog)} — {t('ov.staleNote')}
              </p>
            )}
            {metrics.revocation_unchecked_devices.length > 0 && (
              <p className="flag" style={{ marginTop: 8 }}>
                {t('ov.revUnchecked', { n: metrics.revocation_unchecked_devices.length })}
              </p>
            )}
            <p className="muted" style={{ marginTop: 12 }}>{t('ov.mixNote')}</p>
          </div>

          {/* ——— telemetri yang ditolak sebelum dinilai ——— */}
          <div className="card">
            <div className="kicker">{t('ov.rejects')}</div>
            {Object.keys(metrics.rejects_by_reason).length === 0
              ? <p className="empty" style={{ padding: '20px 0' }}>{t('ov.rejectsNone')}</p>
              : (
                <ul className="ov-tolak">
                  {Object.entries(metrics.rejects_by_reason)
                    .sort((a, b) => b[1] - a[1])
                    .map(([alasan, n]) => (
                      <li key={alasan}>
                        <span className="n">{n}</span>
                        <span className="l">{alasan}</span>
                      </li>
                    ))}
                </ul>
              )}
          </div>
        </div>
      )}

    </div>
  )
}

/** Warna keputusan: hanya dua yang terakhir yang pantas berteriak. */
function warnaKeputusan(k: string): string {
  if (k === 'deny') return 'var(--red)'
  if (k === 'limited') return 'var(--amber)'
  if (k === 'step_up') return 'var(--gold-soft)'
  return 'var(--gold)'
}

/**
 * Perangkat yang laporan terakhirnya melewati ambang umur.
 *
 * Dihitung dari `report_age_seconds` yang dikirim backend dan ambang
 * `max_report_age_minutes` di katalog, bukan dari ambang baru di layar ini.
 * Ambang 0 berarti pemeriksaan umur dimatikan, dan jumlahnya pun nol.
 */
function basi(m: Metrics, catalog: Catalog | null): number {
  const menit = catalog?.parameters?.max_report_age_minutes ?? 0
  if (!menit) return 0
  return Object.values(m.report_age_seconds).filter((d) => d > menit * 60).length
}
