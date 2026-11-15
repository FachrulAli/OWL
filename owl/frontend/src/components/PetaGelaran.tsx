import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react'
import { GELARAN, JUMLAH_KODAM } from '../data/gelaran'
import type { Satuan } from '../data/gelaran'
import { INDONESIA_PATH, projX, projY } from '../data/indonesiaGeo'
import { PROVINSI } from '../data/provinsi'
import { scoreColor } from '../lib/api'
import { useT } from '../lib/i18n'
import type { DeviceRow } from '../lib/types'

/**
 * Peta gelaran satuan, dipakai sebagai bidang kerja halaman gerbang.
 *
 * Garis pantainya Natural Earth 50m (domain publik) yang sudah diproyeksikan
 * ke viewBox 1000x440, jadi pin mendarat di pulau yang benar, bukan di atas
 * gumpalan hiasan.
 *
 * Petanya selebar halaman, dan kedua panel mengambang di atasnya dengan latar
 * tembus pandang, seperti ruang kendali. Alasannya bukan gaya: panel yang
 * berdiri sebagai kolom sendiri memotong lebar peta justru pada sumbu yang
 * paling dibutuhkan kepulauan ini, yaitu sumbu timur-barat sepanjang 46
 * derajat bujur. Mengambang, keduanya hanya menutup laut.
 *
 * Yang ditunjukkan peta ini adalah CAKUPAN KOMANDO, bukan posisi perangkat.
 * OWL tidak pernah membaca lokasi perangkat, jadi daftar perangkat pada tiap
 * satuan disusun dari kolom `unit` yang diisi saat registrasi, bukan dari
 * telemetri.
 */

/*
 * Bidang pandang peta.
 *
 * Garis pantainya diproyeksikan ke kotak 1000x440, tetapi yang digambar
 * adalah kotak yang LEBIH LEBAR dari itu, dipusatkan pada titik tengah yang
 * sama. Tambahan itu laut kosong, dan laut kosong itu ada gunanya: kedua
 * panel mengambang di tepi kiri dan kanan, sedangkan kepulauan ini
 * membentang 46 derajat bujur dari Sabang ke Merauke. Tanpa ruang tambahan,
 * Aceh dan Merauke selalu persis berada di bawah panel. Dengan ruang itu,
 * ujung-ujungnya tetap terlihat, dan sisanya diurus tombol lipat serta
 * geseran tangan pembaca.
 */
const PETA_W = 1000
const PETA_H = 440
const CX = PETA_W / 2
const CY = PETA_H / 2
const PAD_X = 70
const PAD_Y = 30
const VB_W = PETA_W + PAD_X * 2
const VB_H = PETA_H + PAD_Y * 2
const X0 = CX - VB_W / 2
const Y0 = CY - VB_H / 2
const ZOOM_PIN = 3
const ZOOM_MIN = 1
const ZOOM_MAX = 9

/** Ukuran pin dan label dalam piksel layar, bukan satuan viewBox. */
const PX_INTI = 3.6
const PX_INTI_PUSAT = 5
const PX_DENYUT = 10
const PX_SASAR = 15
const PX_HURUF = 8.5
const PX_LABEL_Y = -12

/**
 * Garis lintang dan bujur setiap lima derajat.
 *
 * Kisi persegi sembarang membuat peta terlihat seperti latar belakang; garis
 * yang benar-benar lintang dan bujur membuatnya terbaca sebagai peta dan
 * memberi rasa jarak tanpa satu label pun. Rentangnya melebihi daratan
 * supaya ikut mengisi laut di tepi bidang pandang.
 */
const BUJUR: number[] = []
for (let lon = 90; lon <= 145; lon += 5) BUJUR.push(lon)
const LINTANG: number[] = []
for (let lat = 10; lat >= -15; lat -= 5) LINTANG.push(lat)

/** Nama kota markas baru muncul saat peta cukup dekat untuk memuatnya. */
const ZOOM_KOTA = 2

interface Pandang { k: number; tx: number; ty: number }

const AWAL: Pandang = { k: 1, tx: 0, ty: 0 }

export interface Titik {
  s: Satuan
  x: number
  y: number
  milik: DeviceRow[]
  /** Perangkat yang satuannya tidak cocok dengan Kodam mana pun. */
  lepas: number
}

/** Perangkat dihitung masuk satu satuan bila kolom `unit`-nya menyebut satuan itu. */
function cocok(unit: string, s: Satuan): boolean {
  const u = (unit ?? '').toLowerCase()
  if (!u) return false
  if (s.pusat) return u.includes('mabes')
  return u.includes(s.nama.toLowerCase()) || u.includes(`kodam ${s.singkat.toLowerCase()}`)
}

/**
 * Titik peta beserta perangkat pada tiap satuan.
 *
 * Perangkat yang kolom satuannya tidak menyebut Kodam mana pun tidak
 * dihilangkan dari peta, melainkan dikumpulkan di Mabes TNI AD dan dihitung
 * sebagai `lepas`. Perangkat terdaftar yang tidak muncul di mana-mana lebih
 * buruk daripada perangkat yang ditaruh di markas besar sambil mengatakan
 * bahwa satuannya memang belum dipetakan, dan panel keterangannya memang
 * mengatakan itu.
 */
export function useGelaran(devices: DeviceRow[]): Titik[] {
  return useMemo(() => {
    const titik: Titik[] = GELARAN.map((s) => ({
      s, x: projX(s.lon), y: projY(s.lat), milik: [], lepas: 0,
    }))
    const pusat = titik.find((p) => p.s.pusat)
    const sisa: DeviceRow[] = []

    for (const d of devices) {
      const t = titik.find((p) => cocok(d.unit, p.s))
      if (t) t.milik.push(d)
      else sisa.push(d)
    }
    if (pusat) {
      pusat.milik = [...pusat.milik, ...sisa]
      pusat.lepas = sisa.length
    }
    return titik
  }, [devices])
}

export function PetaKomando({ titik }: { titik: Titik[] }) {
  const { t } = useT()
  const bungkus = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [lebar, setLebar] = useState(VB_W)
  const [fokus, setFokus] = useState<string | null>(null)
  const [pandang, setPandang] = useState<Pandang>(AWAL)
  const [geser, setGeser] = useState(false)
  const [kiriBuka, setKiriBuka] = useState(true)
  const [kananBuka, setKananBuka] = useState(true)

  /**
   * Berapa satuan viewBox untuk satu piksel layar.
   *
   * Tanpa ini, pin dan labelnya ikut mengecil atau membesar mengikuti lebar
   * render, dan ukuran yang pas pada peta selebar halaman menjadi tidak
   * terbaca pada layar sempit.
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

  /**
   * Peta tidak boleh dapat digeser sampai kehilangan daratannya.
   *
   * Batasnya diturunkan dari syarat bahwa bidang yang terlihat harus tetap
   * berada di dalam bidang pandang: dengan geseran t dan zoom k, tepi yang
   * terlihat adalah (X0 - t)/k sampai (X0 + VB_W - t)/k.
   */
  const batas = useCallback((p: Pandang): Pandang => {
    const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, p.k))
    return {
      k,
      tx: Math.min(X0 * (1 - k), Math.max((X0 + VB_W) * (1 - k), p.tx)),
      ty: Math.min(Y0 * (1 - k), Math.max((Y0 + VB_H) * (1 - k), p.ty)),
    }
  }, [])

  const keSatuan = useCallback((p: Titik) => {
    const k = ZOOM_PIN
    setPandang(batas({ k, tx: CX - k * p.x, ty: CY - k * p.y }))
  }, [batas])

  const pilih = useCallback((p: Titik) => {
    if (p.s.id === fokus) { setFokus(null); setPandang(AWAL); return }
    setFokus(p.s.id)
    setKananBuka(true)
    keSatuan(p)
  }, [fokus, keSatuan])

  // Escape melepas fokus dan mengembalikan pandangan, seperti layar kunci.
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setFokus(null)
      setPandang(AWAL)
    }
    addEventListener('keydown', tekan)
    return () => removeEventListener('keydown', tekan)
  }, [])

  /** Titik kursor dalam satuan viewBox, lewat matriks SVG yang sebenarnya. */
  function diViewBox(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svg = svgRef.current
    const m = svg?.getScreenCTM?.()
    if (!svg || !m) return null
    const p = svg.createSVGPoint()
    p.x = e.clientX; p.y = e.clientY
    const q = p.matrixTransform(m.inverse())
    return { x: q.x, y: q.y }
  }

  /**
   * Zoom roda, berpusat pada kursor.
   *
   * Yang dipertahankan adalah titik dunia di bawah kursor: tanpa itu, peta
   * melompat menjauh dari yang sedang ditunjuk pembaca setiap kali rodanya
   * diputar, dan zoom terasa seperti melawan tangan.
   */
  function roda(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const p = diViewBox(e)
    if (!p) return
    setPandang((v) => {
      const k2 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * Math.exp(-e.deltaY * 0.0015)))
      return batas({
        k: k2,
        tx: p.x - (k2 / v.k) * (p.x - v.tx),
        ty: p.y - (k2 / v.k) * (p.y - v.ty),
      })
    })
  }

  const tarik = useRef<{ x: number; y: number; tx: number; ty: number; jauh: number } | null>(null)

  function turun(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    tarik.current = { x: e.clientX, y: e.clientY, tx: pandang.tx, ty: pandang.ty, jauh: 0 }
    setGeser(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function pindah(e: React.PointerEvent<SVGSVGElement>) {
    const a = tarik.current
    if (!a) return
    const dx = e.clientX - a.x
    const dy = e.clientY - a.y
    a.jauh = Math.max(a.jauh, Math.abs(dx) + Math.abs(dy))
    const skala = VB_W / (lebar || VB_W)
    setPandang((v) => batas({ k: v.k, tx: a.tx + dx * skala, ty: a.ty + dy * skala }))
  }

  function naik(e: React.PointerEvent<SVGSVGElement>) {
    const a = tarik.current
    tarik.current = null
    setGeser(false)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    // Geseran bukan klik. Tanpa pembedaan ini, menarik peta selalu menutup
    // panel keterangan yang baru saja dibuka pembacanya.
    if (a && a.jauh < 5) { setFokus(null); setPandang(AWAL) }
  }

  function zoomTengah(faktor: number) {
    setPandang((v) => {
      const k2 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * faktor))
      return batas({
        k: k2,
        tx: CX - (k2 / v.k) * (CX - v.tx),
        ty: CY - (k2 / v.k) * (CY - v.ty),
      })
    })
  }

  const { k, tx, ty } = pandang
  /** Piksel layar menjadi satuan viewBox, sudah dibagi faktor zoom. */
  const px = (n: number) => (n * (VB_W / lebar)) / k

  return (
    <div className="komando">
      <div className={`peta-bungkus${geser ? ' geser' : ''}`} ref={bungkus}>
        <svg
          ref={svgRef}
          viewBox={`${X0} ${Y0} ${VB_W} ${VB_H}`}
          className="peta"
          role="application"
          aria-label={t('map.alt')}
          onWheel={roda}
          onPointerDown={turun}
          onPointerMove={pindah}
          onPointerUp={naik}
          onPointerCancel={naik}
        >
          <defs>
            <radialGradient id="peta-sinar" cx="50%" cy="48%" r="72%">
              <stop offset="0%" stopColor="rgba(201,162,39,.12)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id="peta-tanah" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(201,162,39,.21)" />
              <stop offset="100%" stopColor="rgba(201,162,39,.09)" />
            </linearGradient>
          </defs>

          <rect x={X0} y={Y0} width={VB_W} height={VB_H} className="peta-laut" />
          <rect x={X0} y={Y0} width={VB_W} height={VB_H} fill="url(#peta-sinar)" />

          <g
            className={`peta-isi${geser ? ' geser' : ''}`}
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}
          >
            {/* garis lintang dan bujur sungguhan, bukan kisi sembarang */}
            <g className="peta-graticule">
              {BUJUR.map((lon) => (
                <line key={`b${lon}`} x1={projX(lon)} y1={Y0} x2={projX(lon)} y2={Y0 + VB_H} />
              ))}
              {LINTANG.map((lat) => (
                <line key={`l${lat}`} x1={X0} y1={projY(lat)} x2={X0 + VB_W} y2={projY(lat)} />
              ))}
            </g>

            {/* daratan: bidang provinsi dahulu, garis pantai di atasnya */}
            <g className="peta-prov">
              {PROVINSI.map((pr) => (
                <path key={pr.nama} d={pr.d}><title>{pr.nama}</title></path>
              ))}
            </g>
            <path d={INDONESIA_PATH} className="peta-pantai-sinar" />
            <path d={INDONESIA_PATH} className="peta-pantai" />

            {titik.map((p) => {
              const { s, x, y, milik } = p
              const dipilih = s.id === fokus
              return (
                <g
                  key={s.id}
                  className={`peta-pin${s.pusat ? ' pusat' : ''}${s.baru ? ' baru' : ''}`
                    + `${dipilih ? ' dipilih' : ''}${milik.length > 0 ? ' isi' : ''}`}
                  transform={`translate(${x} ${y})`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); pilih(p) }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.nama}, ${s.markas}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pilih(p) }
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
                  {k >= ZOOM_KOTA && (
                    <text
                      className="kota"
                      x={px(s.dx ?? 0)}
                      y={px(13)}
                      style={{ fontSize: `${px(7)}px` }}
                    >
                      {s.markas}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        <div className="kmd-zoom">
          <button onClick={() => zoomTengah(1.5)} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>+</button>
          <button onClick={() => zoomTengah(1 / 1.5)} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>−</button>
          <button
            className="ulang"
            onClick={() => { setPandang(AWAL); setFokus(null) }}
            aria-label={t('map.reset')}
            title={t('map.reset')}
            disabled={k === 1 && tx === 0 && ty === 0}
          >
            ⟲
          </button>
          <span className="kmd-kali">{k.toFixed(1)}×</span>
        </div>

        <div className="peta-legenda">
          <span><i className="l-pusat" />{t('map.center')}</span>
          <span><i className="l-kodam" />{t('map.command')}</span>
          <span><i className="l-baru" />{t('map.new2025')}</span>
          <span className="kmd-petunjuk">{t('map.dragHint')}</span>
        </div>
      </div>

      {/* ——— panel kiri: ringkasan gelaran ——— */}
      <div className={`kmd-panel kiri${kiriBuka ? '' : ' tutup'}`}>
        <button
          className="kmd-lipat"
          onClick={() => setKiriBuka((b) => !b)}
          aria-expanded={kiriBuka}
          title={kiriBuka ? t('map.hide') : t('map.show')}
        >
          {kiriBuka ? '‹' : '›'}
        </button>
        <div className="kmd-isi"><RingkasGelaran titik={titik} /></div>
      </div>

      {/* ——— panel kanan: keterangan satuan ——— */}
      <div className={`kmd-panel kanan${kananBuka ? '' : ' tutup'}`}>
        <button
          className="kmd-lipat"
          onClick={() => setKananBuka((b) => !b)}
          aria-expanded={kananBuka}
          title={kananBuka ? t('map.hide') : t('map.show')}
        >
          {kananBuka ? '›' : '‹'}
        </button>
        <div className="kmd-isi">
          <KeteranganSatuan
            titik={titik}
            fokus={fokus}
            onPilih={pilih}
            onTutup={() => { setFokus(null); setPandang(AWAL) }}
          />
        </div>
      </div>

    </div>
  )
}

/**
 * Keterangan satuan yang sedang ditunjuk, beserta perangkat di bawahnya.
 *
 * Selama belum ada pin yang ditekan, panel ini tidak dibiarkan kosong: ia
 * memakai ruangnya untuk menyatakan apa yang sebenarnya ditunjukkan peta di
 * belakangnya, sebab membaca peta komando sebagai peta pelacakan adalah
 * salah paham yang paling mahal di layar ini.
 */
/**
 * Ringkasan gelaran di panel kiri.
 *
 * Isinya tidak berubah mengikuti pin yang ditekan: ia menyatakan apa yang
 * sebenarnya ditunjukkan peta di belakangnya. Membaca peta komando sebagai
 * peta pelacakan adalah salah paham yang paling mahal di layar ini, dan
 * salah paham itu tidak boleh bergantung pada pembaca menekan sesuatu
 * lebih dahulu.
 */
function RingkasGelaran({ titik }: { titik: Titik[] }) {
  const { t } = useT()
  const terpeta = titik.reduce((a, p) => a + p.milik.length, 0)
  return (
    <>
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
      <p className="peta-kaki">{t('map.foot')}</p>
    </>
  )
}

function KeteranganSatuan({
  titik, fokus, onPilih, onTutup,
}: {
  titik: Titik[]
  fokus: string | null
  onPilih: (p: Titik) => void
  onTutup: () => void
}) {
  const { t, word } = useT()
  const aktif = titik.find((p) => p.s.id === fokus) ?? null

  if (!aktif) {
    const berisi = titik.filter((p) => p.milik.length > 0)
    return (
      <>
        <div className="kicker">{t('map.detail')}</div>
        <p className="peta-ajak">{t('map.pick')}</p>
        {berisi.length > 0 && (
          <>
            <div className="kicker" style={{ marginTop: 18, marginBottom: 8 }}>
              {t('map.withDevices')}
            </div>
            <ul className="peta-pintas">
              {berisi.map((p) => (
                <li key={p.s.id}>
                  <button onClick={() => onPilih(p)}>
                    <span className="nama">{p.s.nama}</span>
                    <span className="n">{p.milik.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    )
  }

  const { s, milik, lepas } = aktif

  return (
    <>
      <div className="peta-sisi-kepala">
        <div className="kicker" style={{ marginBottom: 0 }}>
          {s.pusat ? t('map.center') : t('map.command')}
          {s.baru && <span className="peta-tag">{t('map.new')}</span>}
        </div>
        <button className="peta-sisi-tutup" onClick={onTutup} aria-label={t('map.close')}>×</button>
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
              {d.revoked
                ? <span className="ops-lencana merah">{t('dev.revoked')}</span>
                : <span className="tingkat">{d.level ? word(d.level) : t('dev.notAssessed')}</span>}
            </li>
          ))}
        </ul>
      )}

      {lepas > 0 && <p className="peta-sisi-lepas">{t('map.unmapped', { n: lepas })}</p>}
    </>
  )
}
