import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react'
import { GELARAN, JUMLAH_KODAM } from '../data/gelaran'
import type { Satuan } from '../data/gelaran'
import { INDONESIA_PATH, projX, projY } from '../data/indonesiaGeo'
import { PROVINSI } from '../data/provinsi'
import { KODAM_PROVINSI } from '../data/wilayahKodam'
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

/** Gerak dimatikan pada mesin yang memintanya; SMIL tidak mematuhinya sendiri. */
function diamSaja(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Juring sapuan radar, dibuat di koordinat lokal pin.
 *
 * Diputar dengan `animateTransform` SMIL, bukan transform CSS: pusat putar
 * SMIL dapat disebut langsung sebagai `0 0`, yaitu titik pin itu sendiri,
 * sedangkan `transform-origin` CSS pada SVG bersandar pada kotak isi juring
 * yang pusatnya BUKAN pusat pin.
 */
function juring(r: number, derajat: number): string {
  const a = (-derajat / 2) * (Math.PI / 180)
  const b = (derajat / 2) * (Math.PI / 180)
  return `M0 0 L${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`
    + ` A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1`
    + ` ${(r * Math.cos(b)).toFixed(2)} ${(r * Math.sin(b)).toFixed(2)} Z`
}

interface Pandang { k: number; tx: number; ty: number }

const AWAL: Pandang = { k: 1, tx: 0, ty: 0 }

export interface Titik {
  s: Satuan
  x: number
  y: number
  milik: DeviceRow[]
  /** Perangkat yang satuannya tidak cocok dengan Kodam mana pun. */
  lepas: number
  /** Rata-rata skor perangkat satuan ini; null bila belum ada yang dinilai. */
  skor: number | null
  /** Perangkat pada tingkat tinggi atau kritis. */
  awas: number
}

/**
 * Perangkat dihitung masuk satu satuan bila kolom `unit`-nya menyebut satuan itu.
 *
 * Singkatannya dicocokkan dengan BATAS KATA, bukan sebagai potongan teks.
 * Angka Romawi saling menjadi awalan satu sama lain: "Kodam III/Siliwangi"
 * memuat potongan "kodam i", sehingga pencocokan potongan menaruh perangkat
 * Siliwangi di bawah Kodam I/Bukit Barisan, lengkap dengan wilayahnya di
 * peta ikut berwarna. Ditemukan 2026-11-15 saat lapisan indikator pertama
 * kali diuji dengan perangkat yang satuannya sungguhan.
 */
function cocok(unit: string, s: Satuan): boolean {
  const u = (unit ?? '').toLowerCase().trim()
  if (!u) return false
  if (s.pusat) return /\bmabes/.test(u)
  if (u.includes(s.nama.toLowerCase())) return true
  return new RegExp(`\\bkodam\\s+${s.singkat.toLowerCase()}\\b`).test(u)
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
      s, x: projX(s.lon), y: projY(s.lat), milik: [], lepas: 0, skor: null, awas: 0,
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
    // Rata-rata dan cacah yang perlu ditindak, dihitung dari skor yang sudah
    // dikeluarkan mesin aturan. Tidak ada ambang baru: "awas" berarti tingkat
    // yang sama dengan yang dipakai gerbang.
    for (const p of titik) {
      const dinilai = p.milik.filter((d) => d.score !== null)
      p.skor = dinilai.length
        ? dinilai.reduce((a, d) => a + (d.score ?? 0), 0) / dinilai.length
        : null
      p.awas = p.milik.filter((d) => d.level === 'tinggi' || d.level === 'kritis').length
    }
    return titik
  }, [devices])
}

export function PetaKomando({
  titik, fokus, onFokus,
}: {
  titik: Titik[]
  fokus: string | null
  onFokus: (id: string | null) => void
}) {
  const { t } = useT()
  const bungkus = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [lebar, setLebar] = useState(VB_W)
  const [pandang, setPandang] = useState<Pandang>(AWAL)
  const [geser, setGeser] = useState(false)
  const [kiriBuka, setKiriBuka] = useState(true)
  const [kananBuka, setKananBuka] = useState(true)
  const [petunjuk, setPetunjuk] = useState(false)
  const tenang = diamSaja()

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

  /**
   * Pandangan mengikuti fokus, dan fokus datang dari luar.
   *
   * Dengan begitu daftar "perlu dilihat lebih dahulu" di bawah peta dapat
   * mengarahkan peta hanya dengan menyebut satuannya, tanpa komponen ini
   * perlu tahu daftar itu ada.
   */
  useEffect(() => {
    const p = titik.find((x) => x.s.id === fokus)
    if (!p) { setPandang(AWAL); return }
    setKananBuka(true)
    setPandang(batas({ k: ZOOM_PIN, tx: CX - ZOOM_PIN * p.x, ty: CY - ZOOM_PIN * p.y }))
  }, [fokus, titik, batas])

  const pilih = useCallback((p: Titik) => {
    onFokus(p.s.id === fokus ? null : p.s.id)
  }, [fokus, onFokus])

  // Escape melepas fokus, seperti layar kunci dan panel aturan.
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') onFokus(null) }
    addEventListener('keydown', tekan)
    return () => removeEventListener('keydown', tekan)
  }, [onFokus])

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

  /** Zoom berpusat pada satu titik: titik itu tidak boleh bergeser. */
  const zoomKe = useCallback((p: { x: number; y: number }, faktor: number) => {
    setPandang((v) => {
      const k2 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * faktor))
      return batas({
        k: k2,
        tx: p.x - (k2 / v.k) * (p.x - v.tx),
        ty: p.y - (k2 / v.k) * (p.y - v.ty),
      })
    })
  }, [batas])

  /**
   * Roda dan cubit, mengikuti perilaku peta tersemat Google Maps.
   *
   * Cubitan pada touchpad sampai ke browser sebagai peristiwa `wheel`
   * ber-`ctrlKey`; gulungan dua jari biasa datang sebagai `wheel` polos.
   * Dulu KEDUANYA dipakai untuk zoom, dan akibatnya menggulung halaman
   * dengan kursor kebetulan berada di atas peta justru menukikkan peta,
   * lalu halaman berhenti bergulir. Sekarang hanya cubitan dan Ctrl/Cmd
   * yang mengubah zoom; gulungan biasa dibiarkan menggulung halaman, dan
   * satu petunjuk kecil muncul untuk menyebutkan caranya.
   *
   * Dipasang sebagai pendengar asli, bukan `onWheel`, sebab React memasang
   * `wheel` secara pasif dan pendengar pasif tidak boleh membatalkan
   * gulungan bawaan.
   */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    let hilang: ReturnType<typeof setTimeout> | undefined

    const roda = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        setPetunjuk(true)
        clearTimeout(hilang)
        hilang = setTimeout(() => setPetunjuk(false), 1600)
        return
      }
      e.preventDefault()
      setPetunjuk(false)
      const p = diViewBox(e)
      if (!p) return
      // Satuan delta berbeda-beda antara piksel, baris, dan halaman, dan
      // satu kibasan roda tetikus bernilai jauh lebih besar daripada satu
      // langkah cubitan. Dibatasi supaya keduanya terasa sama.
      let d = e.deltaY
      if (e.deltaMode === 1) d *= 16
      else if (e.deltaMode === 2) d *= 400
      d = Math.max(-40, Math.min(40, d))
      zoomKe(p, Math.exp(-d * 0.011))
    }

    svg.addEventListener('wheel', roda, { passive: false })
    return () => { svg.removeEventListener('wheel', roda); clearTimeout(hilang) }
  }, [zoomKe])

  /** Ketuk ganda memperbesar di tempat yang diketuk, seperti peta mana pun. */
  function ketukGanda(e: React.MouseEvent<SVGSVGElement>) {
    const p = diViewBox(e)
    if (p) zoomKe(p, e.shiftKey ? 1 / 1.8 : 1.8)
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
    if (a && a.jauh < 5) onFokus(null)
  }

  const zoomTengah = (faktor: number) => zoomKe({ x: CX, y: CY }, faktor)

  /** Provinsi mana dipegang satuan mana, hanya untuk yang sudah ada datanya. */
  const berwilayah = useMemo(() => {
    const m = new Map<string, Titik>()
    for (const p of titik) {
      if (p.s.pusat || p.milik.length === 0) continue
      for (const [prov, id] of Object.entries(KODAM_PROVINSI)) {
        if (id === p.s.id) m.set(prov, p)
      }
    }
    return m
  }, [titik])

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
          onDoubleClick={ketukGanda}
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

            {/* Daratan: bidang provinsi dahulu, garis pantai di atasnya.
                Wilayah yang Kodam-nya sudah punya perangkat terdaftar diberi
                warna menurut posturnya; sisanya dibiarkan netral. Wilayah
                gelap di peta ini berarti BELUM ADA DATA, bukan aman, dan
                legendanya mengatakan itu. Peta yang memberi warna "tenang"
                pada wilayah yang tidak pernah dilihat adalah peta yang
                berbohong dengan cara paling meyakinkan. */}
            <g className="peta-prov">
              {PROVINSI.map((pr) => {
                const p = berwilayah.get(pr.nama)
                return (
                  <path
                    key={pr.nama}
                    d={pr.d}
                    className={p ? 'ada' : undefined}
                    style={p ? { fill: warnaWilayah(p) } : undefined}
                    onPointerDown={p ? (e) => e.stopPropagation() : undefined}
                    onClick={p ? (e) => { e.stopPropagation(); pilih(p) } : undefined}
                  >
                    <title>
                      {p ? `${pr.nama} · ${p.s.nama} · ${p.milik.length}` : pr.nama}
                    </title>
                  </path>
                )
              })}
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
                  {dipilih && !tenang && (
                    <g className="radar">
                      <circle className="jangkau" r={px(34)} />
                      <g>
                        <path className="sapu" d={juring(px(34), 62)} />
                        <animateTransform
                          attributeName="transform" type="rotate"
                          from="0 0 0" to="360 0 0" dur="2.8s" repeatCount="indefinite"
                        />
                      </g>
                      <circle className="riak" r={px(5)}>
                        <animate attributeName="r" values={`${px(5)};${px(34)}`}
                                 dur="2.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.75;0"
                                 dur="2.8s" repeatCount="indefinite" />
                      </circle>
                      <circle className="riak" r={px(5)}>
                        <animate attributeName="r" values={`${px(5)};${px(34)}`}
                                 dur="2.8s" begin="1.4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.75;0"
                                 dur="2.8s" begin="1.4s" repeatCount="indefinite" />
                      </circle>
                    </g>
                  )}
                  {dipilih && tenang && <circle className="jangkau" r={px(34)} />}
                  <circle className="denyut" r={px(PX_DENYUT)} />
                  <circle className="sasar" r={px(PX_SASAR)} />
                  <circle
                    className="inti"
                    r={px(jariPin(p))}
                    style={p.skor !== null ? { fill: scoreColor(p.skor) } : undefined}
                  />
                  {milik.length > 0 && (
                    <g className="cacah">
                      <circle cx={px(8)} cy={px(-8)} r={px(5.6)} />
                      <text cx={px(8)} x={px(8)} y={px(-6)} style={{ fontSize: `${px(7)}px` }}>
                        {milik.length}
                      </text>
                    </g>
                  )}
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
                      y={px((s.dy ?? PX_LABEL_Y) > 0 ? 25 : 13)}
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
            onClick={() => { setPandang(AWAL); onFokus(null) }}
            aria-label={t('map.reset')}
            title={t('map.reset')}
            disabled={k === 1 && tx === 0 && ty === 0}
          >
            ⟲
          </button>
          <span className="kmd-kali">{k.toFixed(1)}×</span>
        </div>

        {petunjuk && (
          <div className="peta-petunjuk" role="status">{t('map.zoomHint')}</div>
        )}

        <div className="peta-legenda">
          <span><i className="l-pusat" />{t('map.center')}</span>
          <span><i className="l-kodam" />{t('map.command')}</span>
          <span><i className="l-baru" />{t('map.new2025')}</span>
          <span><i className="l-isi" />{t('map.lit')}</span>
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
            onTutup={() => onFokus(null)}
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
      <p className="muted" style={{ marginTop: 10 }}>{t('map.litNote')}</p>
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

/**
 * Warna bidang wilayah, mengikuti postur perangkat di dalamnya.
 *
 * Memakai `scoreColor` yang sama dengan cincin skor dan tabel perangkat,
 * jadi satu warna berarti satu hal di seluruh dashboard. Alfanya rendah
 * karena ini bidang selebar provinsi, bukan titik: pada kepekatan penuh,
 * satu provinsi berisiko akan menenggelamkan seluruh peta.
 */
function warnaWilayah(p: Titik): string {
  if (p.skor === null) return 'rgba(201, 162, 39, .17)'
  const w = scoreColor(p.skor)
  return `color-mix(in srgb, ${w} 26%, transparent)`
}

/** Pin membesar mengikuti jumlah perangkat, tetapi tidak tanpa batas. */
function jariPin(p: Titik): number {
  if (p.s.pusat) return PX_INTI_PUSAT + Math.min(p.milik.length, 12) * 0.22
  if (p.milik.length === 0) return PX_INTI
  return PX_INTI + 1.4 + Math.min(p.milik.length, 12) * 0.22
}
