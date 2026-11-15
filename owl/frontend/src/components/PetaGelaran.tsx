import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { GELARAN, JUMLAH_KODAM } from '../data/gelaran'
import type { Satuan } from '../data/gelaran'
import { INDONESIA_PATH, projX, projY } from '../data/indonesiaGeo'
import { scoreColor } from '../lib/api'
import { useT } from '../lib/i18n'
import type { DeviceRow } from '../lib/types'

/**
 * Peta gelaran satuan, beserta panel keterangannya.
 *
 * Garis pantainya Natural Earth 50m (domain publik) yang sudah diproyeksikan
 * ke viewBox 1000x440, jadi pin mendarat di pulau yang benar, bukan di atas
 * gumpalan hiasan. Satu klik pada pin mendekatkan peta ke satuan itu dan
 * mengisi panel di sebelah kanannya; klik di luar pin mengembalikannya.
 *
 * Yang ditunjukkan peta ini adalah CAKUPAN KOMANDO, bukan posisi perangkat.
 * OWL tidak pernah membaca lokasi perangkat, jadi daftar perangkat pada tiap
 * satuan disusun dari kolom `unit` yang diisi saat registrasi, bukan dari
 * telemetri. Keterangan itu ditulis di layar supaya tidak ada yang salah
 * membaca peta ini sebagai pelacakan.
 */

const VB_W = 1000
const VB_H = 440
const ZOOM = 2.6

/** Ukuran pin dan label dalam piksel layar, bukan satuan viewBox. */
const PX_INTI = 3.6
const PX_INTI_PUSAT = 5
const PX_DENYUT = 10
const PX_SASAR = 15
const PX_HURUF = 8.5
const PX_LABEL_Y = -12

export interface Titik {
  s: Satuan
  x: number
  y: number
  milik: DeviceRow[]
}

/** Perangkat dihitung masuk satu satuan bila kolom `unit`-nya menyebut satuan itu. */
function cocok(unit: string, s: Satuan): boolean {
  const u = (unit ?? '').toLowerCase()
  if (!u) return false
  return u.includes(s.nama.toLowerCase())
    || u.includes(`kodam ${s.singkat.toLowerCase()}`)
}

/** Titik peta beserta perangkat yang terdaftar pada tiap satuan. */
export function useGelaran(devices: DeviceRow[]): Titik[] {
  return useMemo(
    () => GELARAN.map((s) => ({
      s,
      x: projX(s.lon),
      y: projY(s.lat),
      milik: devices.filter((d) => cocok(d.unit, s)),
    })),
    [devices],
  )
}

export function PetaGelaran({
  titik, fokus, onFokus,
}: {
  titik: Titik[]
  fokus: string | null
  onFokus: (id: string | null) => void
}) {
  const { t } = useT()
  const bungkus = useRef<HTMLDivElement>(null)
  const [lebar, setLebar] = useState(VB_W)

  /**
   * Berapa satuan viewBox untuk satu piksel layar.
   *
   * Tanpa ini, pin dan labelnya ikut mengecil ketika peta dipasang di kolom
   * yang sempit: pada lebar render 690 piksel, huruf setinggi 7 satuan
   * viewBox mendarat sebagai 4,8 piksel di layar dan tidak terbaca sama
   * sekali. Jadi ukurannya dihitung balik dari lebar yang benar-benar
   * dirender, bukan dipatok pada satuan viewBox.
   */
  useLayoutEffect(() => {
    const el = bungkus.current
    if (!el) return
    const ukur = () => setLebar(el.getBoundingClientRect().width || VB_W)
    ukur()
    if (typeof ResizeObserver !== 'function') {
      addEventListener('resize', ukur)
      return () => removeEventListener('resize', ukur)
    }
    const ro = new ResizeObserver(ukur)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Escape melepas fokus, seperti layar kunci dan panel aturan.
  useEffect(() => {
    if (!fokus) return
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') onFokus(null) }
    addEventListener('keydown', tekan)
    return () => removeEventListener('keydown', tekan)
  }, [fokus, onFokus])

  const aktif = titik.find((p) => p.s.id === fokus) ?? null
  const k = aktif ? ZOOM : 1
  const tx = aktif ? VB_W / 2 - k * aktif.x : 0
  const ty = aktif ? VB_H / 2 - k * aktif.y : 0

  /** Piksel layar menjadi satuan viewBox, sudah dibagi faktor zoom. */
  const px = (n: number) => (n * (VB_W / lebar)) / k

  return (
    <div className="card peta-kartu">
      <div className="peta-bungkus" ref={bungkus}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="peta"
          role="img"
          aria-label={t('map.alt')}
          onClick={() => onFokus(null)}
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

            {titik.map(({ s, x, y, milik }) => {
              const dipilih = s.id === fokus
              const pilih = () => onFokus(dipilih ? null : s.id)
              return (
                <g
                  key={s.id}
                  className={`peta-pin${s.pusat ? ' pusat' : ''}${s.baru ? ' baru' : ''}`
                    + `${dipilih ? ' dipilih' : ''}${milik.length > 0 ? ' isi' : ''}`}
                  transform={`translate(${x} ${y})`}
                  onClick={(e) => { e.stopPropagation(); pilih() }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.nama}, ${s.markas}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pilih() }
                  }}
                >
                  <circle className="denyut" r={px(PX_DENYUT)} />
                  <circle className="sasar" r={px(PX_SASAR)} />
                  <circle className="inti" r={px(s.pusat ? PX_INTI_PUSAT : PX_INTI)} />
                  <text
                    className="nama"
                    x={px(s.dx ?? 0)}
                    y={px(s.dy ?? PX_LABEL_Y)}
                    style={{ fontSize: `${px(PX_HURUF)}px` }}
                  >
                    {s.pusat ? 'MABESAD' : s.singkat}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        <div className="peta-legenda">
          <span><i className="l-pusat" />{t('map.center')}</span>
          <span><i className="l-kodam" />{t('map.command')}</span>
          <span><i className="l-baru" />{t('map.new2025')}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Panel keterangan di sebelah kanan peta.
 *
 * Selama belum ada pin yang ditekan, panel ini tidak dibiarkan kosong: ia
 * memakai ruangnya untuk menyatakan apa yang sebenarnya ditunjukkan peta di
 * sebelahnya, sebab membaca peta komando sebagai peta pelacakan adalah salah
 * paham yang paling mahal di layar ini.
 */
export function KeteranganSatuan({
  titik, fokus, onFokus,
}: {
  titik: Titik[]
  fokus: string | null
  onFokus: (id: string | null) => void
}) {
  const { t, word } = useT()
  const aktif = titik.find((p) => p.s.id === fokus) ?? null
  const terpeta = titik.reduce((a, p) => a + p.milik.length, 0)

  if (!aktif) {
    return (
      <div className="card peta-sisi kosong">
        <div className="kicker">{t('map.kicker')}</div>
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
        <p className="muted">{t('map.note')}</p>
        <p className="peta-ajak">{t('map.pick')}</p>
        <p className="peta-kaki">{t('map.foot')}</p>
      </div>
    )
  }

  const { s, milik } = aktif

  return (
    <div className="card peta-sisi">
      <div className="peta-sisi-kepala">
        <div className="kicker" style={{ marginBottom: 0 }}>
          {s.pusat ? t('map.center') : t('map.command')}
          {s.baru && <span className="peta-tag">{t('map.new')}</span>}
        </div>
        <button className="peta-sisi-tutup" onClick={() => onFokus(null)} aria-label={t('map.close')}>
          ×
        </button>
      </div>

      <h4>{s.nama}</h4>
      <dl>
        <div><dt>{t('map.hq')}</dt><dd>{s.markas}</dd></div>
        <div><dt>{t('map.area')}</dt><dd>{s.wilayah}</dd></div>
      </dl>

      <div className="peta-sisi-garis" />

      <div className="kicker" style={{ marginBottom: 10 }}>
        {t('map.deviceList', { n: milik.length })}
      </div>

      {milik.length === 0 ? (
        <p className="muted peta-sisi-kosong">{t('map.deviceNoneLong')}</p>
      ) : (
        <ul className="peta-sisi-daftar">
          {milik.map((d) => (
            <li key={d.device_id}>
              <span
                className="skor"
                style={{ color: d.score === null ? 'var(--slate)' : scoreColor(d.score) }}
              >
                {d.score === null ? '—' : d.score.toFixed(0)}
              </span>
              <span className="isi">
                <span className="nama">{d.label || d.device_id}</span>
                <span className="sub">{d.device_id} · {d.owner_role || '—'}</span>
              </span>
              <span className="tingkat">{d.level ? word(d.level) : t('dev.notAssessed')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
