import { useEffect, useMemo, useRef, useState } from 'react'
import { GELARAN, JUMLAH_KODAM } from '../data/gelaran'
import type { Satuan } from '../data/gelaran'
import { INDONESIA_PATH, projX, projY } from '../data/indonesiaGeo'
import { useT } from '../lib/i18n'
import type { DeviceRow } from '../lib/types'

/**
 * Peta gelaran satuan.
 *
 * Garis pantainya Natural Earth 50m (domain publik) yang sudah diproyeksikan
 * ke viewBox 1000x440, jadi pin mendarat di pulau yang benar, bukan di atas
 * gumpalan hiasan. Satu klik pada pin mendekatkan peta ke satuan itu dan
 * membuka satu jendela keterangan; klik di luar pin mengembalikannya.
 *
 * Yang ditunjukkan peta ini adalah CAKUPAN KOMANDO, bukan posisi perangkat.
 * OWL tidak pernah membaca lokasi perangkat, jadi jumlah perangkat pada tiap
 * pin dihitung dari kolom `unit` yang diisi saat registrasi, bukan dari
 * telemetri. Keterangan itu ditulis di layar supaya tidak ada yang salah
 * membaca peta ini sebagai pelacakan.
 */

const VB_W = 1000
const VB_H = 440
const ZOOM = 2.6

/** Perangkat dihitung masuk satu satuan bila kolom `unit`-nya menyebut satuan itu. */
function cocok(unit: string, s: Satuan): boolean {
  const u = unit.toLowerCase()
  if (!u) return false
  return u.includes(s.nama.toLowerCase())
    || u.includes(`kodam ${s.singkat.toLowerCase()}`)
}

export function PetaGelaran({ devices }: { devices: DeviceRow[] }) {
  const { t } = useT()
  const [fokus, setFokus] = useState<string | null>(null)
  const bungkus = useRef<HTMLDivElement>(null)

  const titik = useMemo(
    () => GELARAN.map((s) => ({
      s,
      x: projX(s.lon),
      y: projY(s.lat),
      n: devices.filter((d) => cocok(d.unit ?? '', s)).length,
    })),
    [devices],
  )

  const aktif = titik.find((p) => p.s.id === fokus) ?? null
  const terpeta = titik.reduce((a, p) => a + p.n, 0)

  // Escape menutup jendela keterangan, seperti layar kunci.
  useEffect(() => {
    if (!fokus) return
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setFokus(null) }
    addEventListener('keydown', tekan)
    return () => removeEventListener('keydown', tekan)
  }, [fokus])

  const k = aktif ? ZOOM : 1
  const tx = aktif ? VB_W / 2 - k * aktif.x : 0
  const ty = aktif ? VB_H / 2 - k * aktif.y : 0

  return (
    <div className="card peta-kartu">
      <div className="peta-kepala">
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>{t('map.kicker')}</div>
          <p className="muted" style={{ maxWidth: '62ch' }}>{t('map.note')}</p>
        </div>
        <div className="peta-angka">
          <div>
            <span className="n">{JUMLAH_KODAM}</span>
            <span className="l">{t('map.kodam')}</span>
          </div>
          <div>
            <span className="n">{terpeta}</span>
            <span className="l">{t('map.mapped')}</span>
          </div>
        </div>
      </div>

      <div className="peta-bungkus" ref={bungkus}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="peta"
          role="img"
          aria-label={t('map.alt')}
          onClick={() => setFokus(null)}
        >
          <defs>
            <radialGradient id="peta-sinar" cx="50%" cy="42%" r="70%">
              <stop offset="0%" stopColor="rgba(201,162,39,.10)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <pattern id="peta-kisi" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="rgba(201,162,39,.08)" strokeWidth=".6" />
            </pattern>
          </defs>

          <rect width={VB_W} height={VB_H} fill="url(#peta-kisi)" />
          <rect width={VB_W} height={VB_H} fill="url(#peta-sinar)" />

          <g className="peta-isi" style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
            <path d={INDONESIA_PATH} className="peta-darat" />

            {titik.map(({ s, x, y, n }) => {
              const dipilih = s.id === fokus
              return (
                <g
                  key={s.id}
                  className={`peta-pin${s.pusat ? ' pusat' : ''}${s.baru ? ' baru' : ''}`
                    + `${dipilih ? ' dipilih' : ''}${n > 0 ? ' isi' : ''}`}
                  transform={`translate(${x} ${y})`}
                  onClick={(e) => { e.stopPropagation(); setFokus(dipilih ? null : s.id) }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.nama}, ${s.markas}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setFokus(dipilih ? null : s.id)
                    }
                  }}
                >
                  {/* Jari-jari dan ukuran huruf dibagi faktor zoom, sehingga pin
                      dan labelnya tetap sebesar semula saat peta didekatkan.
                      Yang membesar hanya garis pantainya, dan itu memang yang
                      ingin dilihat lebih dekat; pin yang ikut membesar hanya
                      menjadi gumpalan. */}
                  <circle className="denyut" r={(s.pusat ? 13 : 10) / k} />
                  <circle className="sasar" r={14 / k} />
                  <circle className="inti" r={(s.pusat ? 5 : 3.4) / k} />
                  <text
                    className="nama"
                    x={(s.dx ?? 0) / k}
                    y={(s.dy ?? -11) / k}
                    style={{ fontSize: `${7 / k}px` }}
                  >
                    {s.pusat ? 'MABESAD' : s.singkat}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {aktif && (
          <div className="peta-pop" role="dialog" aria-label={aktif.s.nama}>
            <button
              className="peta-pop-tutup"
              onClick={() => setFokus(null)}
              aria-label={t('map.close')}
            >
              ×
            </button>
            <div className="kicker" style={{ marginBottom: 6 }}>
              {aktif.s.pusat ? t('map.center') : t('map.command')}
              {aktif.s.baru && <span className="peta-tag">{t('map.new')}</span>}
            </div>
            <h4>{aktif.s.nama}</h4>
            <dl>
              <div><dt>{t('map.hq')}</dt><dd>{aktif.s.markas}</dd></div>
              <div><dt>{t('map.area')}</dt><dd>{aktif.s.wilayah}</dd></div>
              <div>
                <dt>{t('map.devices')}</dt>
                <dd className={aktif.n > 0 ? 'isi' : ''}>
                  {aktif.n > 0 ? t('map.deviceN', { n: aktif.n }) : t('map.deviceNone')}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="peta-legenda">
          <span><i className="l-pusat" />{t('map.center')}</span>
          <span><i className="l-kodam" />{t('map.command')}</span>
          <span><i className="l-baru" />{t('map.new2025')}</span>
        </div>
      </div>

      <p className="peta-kaki">{t('map.foot')}</p>
    </div>
  )
}
