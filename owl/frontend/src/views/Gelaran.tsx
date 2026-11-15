import { useMemo, useState } from 'react'
import { PetaKomando, useGelaran } from '../components/PetaGelaran'
import { Ring } from '../components/Ring'
import { scoreColor } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Catalog, DeviceRow } from '../lib/types'

/**
 * Ikhtisar gelaran.
 *
 * Layar yang dibuka pertama kali menjawab pertanyaan situasi: di mana ini
 * dipakai, seberapa sehat keseluruhannya, dan ke mana perhatian diarahkan
 * lebih dahulu. Urutannya sengaja begitu — peta dahulu, baru angka, baru
 * daftar — sebab itulah urutan orang membaca keadaan: tempat, lalu
 * ukuran, lalu tindakan.
 *
 * Yang TIDAK ada di sini adalah apa pun yang menghasilkan keputusan akses.
 * Tombol gerbang, bauran keputusan, dan asal poin risiko tinggal di tab
 * Gerbang, sebab ketiganya menjawab pertanyaan yang berbeda dan dibaca
 * pada saat yang berbeda.
 *
 * Seluruh angka DITURUNKAN dari penilaian yang sudah dikeluarkan mesin
 * aturan. Tidak ada ambang baru yang diciptakan di lapisan tampilan.
 */
export function Gelaran({
  devices, catalog, onLihatPerangkat,
}: {
  devices: DeviceRow[]
  catalog: Catalog | null
  onLihatPerangkat: () => void
}) {
  const { t, word } = useT()
  const titik = useGelaran(devices)
  const [fokus, setFokus] = useState<string | null>(null)

  const r = useMemo(() => {
    const dinilai = devices.filter((d) => d.score !== null)
    const rata = dinilai.length
      ? dinilai.reduce((a, d) => a + (d.score ?? 0), 0) / dinilai.length
      : null
    const awas = dinilai.filter((d) => d.level === 'tinggi' || d.level === 'kritis').length
    const dilewati = dinilai.reduce((a, d) => a + (d.skipped_rules?.length ?? 0), 0)
    const attestasiGagal = devices.filter((d) => d.attestation_ok === false).length

    // Yang paling pantas dilihat lebih dahulu, diurutkan oleh skor yang sama
    // dengan yang dipakai gerbang.
    const perhatian = [...dinilai]
      .filter((d) => (d.score ?? 0) >= (catalog?.thresholds.medium ?? 30))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 6)

    return {
      total: devices.length,
      dinilai: dinilai.length,
      belum: devices.length - dinilai.length,
      rata, awas, dilewati, attestasiGagal, perhatian,
    }
  }, [devices, catalog])

  /** Satuan tempat satu perangkat terdaftar, untuk mengarahkan peta. */
  function satuanDari(id: string): string | null {
    return titik.find((p) => p.milik.some((d) => d.device_id === id))?.s.id ?? null
  }

  const rataBulat = r.rata === null ? null : Math.round(r.rata)

  return (
    <div className="gelaran">
      <PetaKomando titik={titik} fokus={fokus} onFokus={setFokus} />

      {devices.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="empty">{t('ov.empty')}</p>
        </div>
      ) : (
        <>
          <div className="gl-kpi">
            <div className="card ov-postur">
              <div className="kicker">{t('ov.posture')}</div>
              <div className="ov-postur-isi">
                <Ring score={rataBulat} size={96} />
                <div>
                  <div
                    className="ov-postur-kata"
                    style={{ color: rataBulat === null ? 'var(--slate)' : scoreColor(rataBulat) }}
                  >
                    {rataBulat === null ? t('dev.notAssessed') : word(tingkatDari(rataBulat, catalog))}
                  </div>
                  <p className="muted">{t('ov.postureNote', { n: r.dinilai })}</p>
                </div>
              </div>
            </div>

            <Angka
              label={t('ov.devices')}
              nilai={r.total}
              catatan={t('ov.devicesNote', { n: r.belum })}
            />
            <Angka
              label={t('ov.atRisk')}
              nilai={r.awas}
              catatan={t('ov.atRiskNote')}
              nyala={r.awas > 0}
            />
            <Angka
              label={t('ov.blind')}
              nilai={r.dilewati}
              catatan={t('ov.blindNote')}
              nyala={r.dilewati > 0}
            />
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="ov-kepala">
              <div className="kicker" style={{ marginBottom: 0 }}>{t('ov.attention')}</div>
              <button className="btn ghost kecil" onClick={onLihatPerangkat}>
                {t('ov.openDevices')}
              </button>
            </div>
            {r.perhatian.length === 0 ? (
              <p className="empty" style={{ padding: '26px 0' }}>{t('ov.allCalm')}</p>
            ) : (
              <ul className="ov-alert">
                {r.perhatian.map((d) => {
                  const puncak = [...d.findings].sort((a, b) => b.points - a.points)[0]
                  const satuan = satuanDari(d.device_id)
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
                      {satuan && (
                        <button
                          className="ov-kepeta"
                          onClick={() => setFokus(satuan)}
                          title={t('ov.onMap')}
                        >
                          {t('ov.onMap')}
                        </button>
                      )}
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
        </>
      )}
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
function tingkatDari(skor: number, catalog: Catalog | null): string {
  const th = catalog?.thresholds ?? { medium: 30, high: 70, critical: 90 }
  if (skor >= th.critical) return 'kritis'
  if (skor >= th.high) return 'tinggi'
  if (skor >= th.medium) return 'sedang'
  return 'rendah'
}
