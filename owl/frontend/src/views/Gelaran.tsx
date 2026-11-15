import { useMemo, useState } from 'react'
import { PetaKomando, useGelaran } from '../components/PetaGelaran'
import { Ring } from '../components/Ring'
import { JUMLAH_KODAM } from '../data/gelaran'
import { scoreColor } from '../lib/api'
import { useT } from '../lib/i18n'
import { Wawasan } from './Wawasan'
import type { Catalog, DeviceRow } from '../lib/types'

/**
 * Ikhtisar gelaran: satu bidang, peta selebar halaman.
 *
 * Seluruh angka situasi tinggal di panel kiri yang mengambang di atas peta,
 * bukan sebagai deretan kartu di bawahnya. Alasannya ruang: kartu di bawah
 * peta menuntut pembaca menggulung untuk melihat angka yang justru dipakai
 * bersama peta, dan menggulung memutus keduanya. Mengambang, keduanya
 * terbaca sekaligus.
 *
 * Panelnya sengaja tidak memuat prosa. Yang perlu dijelaskan tentang arti
 * peta ini tinggal sebagai keterangan pada judulnya dan pada legenda di
 * kaki peta; panel yang penuh paragraf berhenti menjadi panel angka.
 *
 * Seluruh angka DITURUNKAN dari penilaian yang sudah dikeluarkan mesin
 * aturan. Tidak ada ambang baru yang diciptakan di lapisan tampilan.
 */
export function Gelaran({ devices, catalog }: { devices: DeviceRow[]; catalog: Catalog | null }) {
  const { t, word } = useT()
  const titik = useGelaran(devices)
  const [fokus, setFokus] = useState<string | null>(null)

  const r = useMemo(() => {
    const dinilai = devices.filter((d) => d.score !== null)
    const rata = dinilai.length
      ? dinilai.reduce((a, d) => a + (d.score ?? 0), 0) / dinilai.length
      : null
    return {
      total: devices.length,
      dinilai: dinilai.length,
      belum: devices.length - dinilai.length,
      rata,
      awas: dinilai.filter((d) => d.level === 'tinggi' || d.level === 'kritis').length,
      dilewati: dinilai.reduce((a, d) => a + (d.skipped_rules?.length ?? 0), 0),
      attestasiGagal: devices.filter((d) => d.attestation_ok === false).length,
      terpeta: titik.reduce((a, p) => a + p.milik.length, 0),
    }
  }, [devices, titik])

  const rataBulat = r.rata === null ? null : Math.round(r.rata)

  const ringkas = (
    <>
      <div className="kmd-judul">
        <div className="kicker" title={t('map.note')}>{t('map.kicker')}</div>
        <p className="muted">{t('map.note')}</p>
      </div>

      <div className="kmd-stat">
        <div><span className="n">{JUMLAH_KODAM}</span><span className="l">{t('map.kodam')}</span></div>
        <div><span className="n">{r.terpeta}</span><span className="l">{t('map.mapped')}</span></div>
        {r.total > 0 && (
          <div className={r.awas > 0 ? 'nyala' : undefined}>
            <span className="n">{r.awas}</span><span className="l">{t('ov.atRisk')}</span>
          </div>
        )}
      </div>

      {r.total > 0 && (
        <div className="kmd-postur" title={t('ov.postureNote', { n: r.dinilai })}>
          <Ring score={rataBulat} size={52} />
          <div>
            <span className="l">{t('ov.posture')}</span>
            <span
              className="kata"
              style={{ color: rataBulat === null ? 'var(--slate)' : scoreColor(rataBulat) }}
            >
              {rataBulat === null ? t('dev.notAssessed') : word(tingkatDari(rataBulat, catalog))}
            </span>
          </div>
        </div>
      )}

      {r.attestasiGagal > 0 && (
        <p className="kmd-awas">{t('ov.attestation', { n: r.attestasiGagal })}</p>
      )}
    </>
  )

  return (
    <>
      <PetaKomando titik={titik} fokus={fokus} onFokus={setFokus} ringkas={ringkas} />
      <Wawasan devices={devices} catalog={catalog} />
    </>
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
