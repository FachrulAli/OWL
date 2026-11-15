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
  const { t, word, lang } = useT()
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

  const aktif = titik.find((p) => p.s.id === fokus) ?? null
  const TK = lang === 'id'
    ? { semua: '‹ Semua satuan', perangkat: 'perangkat', awas: 'perlu tindakan', rata: 'skor rata-rata', lihat: (n: number) => `Lihat ${n} perangkat`, kosong: 'Belum ada perangkat terdaftar di satuan ini.', ringkas: 'Wilayah komando, bukan posisi perangkat.', baru: 'Kodam baru 2025', pusat: 'Markas besar', kodam: 'Kodam' }
    : { semua: '‹ All commands', perangkat: 'devices', awas: 'need action', rata: 'average score', lihat: (n: number) => `View ${n} devices`, kosong: 'No devices enrolled in this command yet.', ringkas: 'Command territory, not device positions.', baru: 'New in 2025', pusat: 'Headquarters', kodam: 'Area command' }

  const keDaftar = () =>
    document.querySelector('.kmd-sisi')?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  const ringkas = aktif ? (
    <>
      <div className="kmd-judul">
        <button className="kmd-balik" onClick={() => setFokus(null)}>{TK.semua}</button>
        <h2 className="kmd-nama">{aktif.s.nama}</h2>
        <p className="muted">
          {aktif.s.pusat ? TK.pusat : TK.kodam}{aktif.s.baru ? ` · ${TK.baru}` : ''} · {aktif.s.markas} · {aktif.s.wilayah}
        </p>
      </div>

      {aktif.milik.length > 0 ? (
        <>
          <div className="kmd-stat">
            <div><span className="n">{aktif.milik.length}</span><span className="l">{TK.perangkat}</span></div>
            <div className={aktif.awas > 0 ? 'nyala' : undefined}>
              <span className="n">{aktif.awas}</span><span className="l">{TK.awas}</span>
            </div>
          </div>
          <div className="kmd-postur">
            <Ring score={aktif.skor === null ? null : Math.round(aktif.skor)} size={52} />
            <div>
              <span className="l">{TK.rata}</span>
              <span
                className="kata"
                style={{ color: aktif.skor === null ? 'var(--slate)' : scoreColor(aktif.skor) }}
              >
                {aktif.skor === null ? t('dev.notAssessed') : word(tingkatDari(Math.round(aktif.skor), catalog))}
              </span>
            </div>
          </div>
          <button className="btn ghost kmd-lihat" onClick={keDaftar}>{TK.lihat(aktif.milik.length)} ↓</button>
        </>
      ) : (
        <p className="kmd-kosong">{TK.kosong}</p>
      )}
    </>
  ) : (
    <>
      <div className="kmd-judul">
        <h2 className="kmd-nama" title={t('map.note')}>{t('map.kicker')}</h2>
        <p className="muted">{TK.ringkas}</p>
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
            <span className="l">{t('ov.posture')} · 0–100</span>
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
