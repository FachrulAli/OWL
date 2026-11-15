import { useMemo } from 'react'
import { Ring } from '../components/Ring'
import { scoreColor } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Catalog, DeviceRow, Metrics, SocEvent } from '../lib/types'

/**
 * Ikhtisar satuan.
 *
 * Halaman gerbang menjawab "perangkat ini boleh masuk atau tidak". Halaman
 * ini menjawab pertanyaan yang berbeda dan lebih dulu ditanyakan komandan:
 * seberapa sehat gelaran perangkat secara keseluruhan, dan ke mana perhatian
 * harus diarahkan lebih dahulu.
 *
 * Seluruh angka di sini DITURUNKAN dari penilaian yang sudah dikeluarkan
 * mesin aturan, bukan dihitung ulang dengan rumus lain. Rata-rata tetap
 * rata-rata dari skor yang sama yang dipakai gerbang, dan tidak ada ambang
 * baru yang diciptakan di lapisan tampilan.
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

export function Ikhtisar({
  devices, catalog, events, metrics, onLihatPerangkat,
}: {
  devices: DeviceRow[]
  catalog: Catalog | null
  events: SocEvent[]
  /** Dari OWL Core. Null pada tautan publik: tidak ada rekamannya. */
  metrics: Metrics | null
  onLihatPerangkat: () => void
}) {
  const { t, locale, category, word, decision } = useT()

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
    return <div className="card"><p className="empty">{t('ov.empty')}</p></div>
  }

  const rataBulat = r.rata === null ? null : Math.round(r.rata)

  return (
    <div className="ikhtisar">
      {/* ——— baris angka utama ——— */}
      <div className="ov-kpi">
        <div className="ov-postur card">
          <div className="kicker">{t('ov.posture')}</div>
          <div className="ov-postur-isi">
            <Ring score={rataBulat} size={104} />
            <div>
              <div className="ov-postur-kata" style={{ color: rataBulat === null ? 'var(--slate)' : scoreColor(rataBulat) }}>
                {rataBulat === null ? t('dev.notAssessed') : word(tingkatDari(rataBulat, catalog))}
              </div>
              <p className="muted">{t('ov.postureNote', { n: r.dinilai })}</p>
            </div>
          </div>
        </div>

        <Angka label={t('ov.devices')} nilai={r.total} catatan={t('ov.devicesNote', { n: r.belum })} />
        <Angka
          label={t('ov.atRisk')}
          nilai={r.sebaran.tinggi + r.sebaran.kritis}
          catatan={t('ov.atRiskNote')}
          nyala={r.sebaran.tinggi + r.sebaran.kritis > 0}
        />
        <Angka
          label={t('ov.findings')}
          nilai={r.temuan}
          catatan={t('ov.findingsNote', { n: r.kritisTemuan })}
        />
        <Angka
          label={t('ov.blind')}
          nilai={r.dilewati}
          catatan={t('ov.blindNote')}
          nyala={r.dilewati > 0}
        />
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

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        {/* ——— yang pantas dilihat lebih dahulu ——— */}
        <div className="card">
          <div className="ov-kepala">
            <div className="kicker" style={{ marginBottom: 0 }}>{t('ov.attention')}</div>
            <button className="btn ghost kecil" onClick={onLihatPerangkat}>{t('ov.openDevices')}</button>
          </div>
          {r.perhatian.length === 0
            ? <p className="empty" style={{ padding: '26px 0' }}>{t('ov.allCalm')}</p>
            : (
              <ul className="ov-alert">
                {r.perhatian.map((d) => {
                  const puncak = [...d.findings].sort((a, b) => b.points - a.points)[0]
                  return (
                    <li key={d.device_id}>
                      <span className="skor" style={{ color: scoreColor(d.score ?? 0) }}>
                        {(d.score ?? 0).toFixed(0)}
                      </span>
                      <span className="isi">
                        <span className="nama">{d.label || d.device_id}</span>
                        <span className="sub">
                          {d.unit || '—'} · {puncak ? puncak.rule_id : t('ov.noRule')}
                        </span>
                      </span>
                      <span className={`sev ${puncak?.severity ?? 'low'}`}>
                        {puncak?.severity ?? '—'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          {r.attestasiGagal > 0 && (
            <p className="flag" style={{ marginTop: 12 }}>
              {t('ov.attestation', { n: r.attestasiGagal })}
            </p>
          )}
        </div>

        {/* ——— jalur keluar ke SOC ——— */}
        <div className="card">
          <div className="kicker">{t('ov.socFlow')}</div>
          {events.length === 0
            ? <p className="empty" style={{ padding: '26px 0' }}>{t('soc.empty')}</p>
            : (
              <ul className="ov-soc">
                {events.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <span className="jam">{new Date(e.sent_at).toLocaleTimeString(locale)}</span>
                    <span className="id">{e.device_id}</span>
                    <span className={`sev ${e.kind === 'stix' ? 'medium' : 'low'}`}>{e.kind}</span>
                    <span className="st">{e.delivered ? t('soc.delivered') : t('soc.stored')}</span>
                  </li>
                ))}
              </ul>
            )}
          <p className="muted" style={{ marginTop: 14 }}>{t('ov.socNote')}</p>
        </div>
      </div>
    </div>
  )
}

/** Satu kotak angka. Angka besar dulu, keterangannya menyusul. */
function Angka({
  label, nilai, catatan, nyala,
}: {
  label: string
  nilai: number
  catatan: string
  nyala?: boolean
}) {
  return (
    <div className={`card ov-angka${nyala ? ' nyala' : ''}`}>
      <div className="kicker">{label}</div>
      <div className="n">{nilai}</div>
      <p className="muted">{catatan}</p>
    </div>
  )
}

/** Tingkat risiko dari skor, memakai ambang katalog, bukan ambang baru. */
function tingkatDari(skor: number, catalog: Catalog | null): Tingkat {
  const th = catalog?.thresholds ?? { medium: 30, high: 70, critical: 90 }
  if (skor >= th.critical) return 'kritis'
  if (skor >= th.high) return 'tinggi'
  if (skor >= th.medium) return 'sedang'
  return 'rendah'
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
