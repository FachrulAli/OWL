import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Latar } from './components/Latar'
import { Logo } from './components/Logo'
import { Login } from './components/Login'
import { StatusKoneksi } from './components/Status'
import { Notifikasi } from './components/Notifikasi'
import type { Kabar } from './components/Notifikasi'
import { BilahAtas, Sidebar } from './components/Sidebar'
import { KepalaHalaman } from './components/Ui'
import { AdminContext } from './lib/admin'
import { api, clearKey, hasKey, isOffline, onOfflineChange, onUnauthorized, snapshotGeneratedAt, wsQuery } from './lib/api'
import { LangToggle, useT } from './lib/i18n'
import { LABEL, TUJUAN, useNav } from './lib/nav'
import type { Catalog, DeviceRow, Kasus, Metrics } from './lib/types'
import { Aturan } from './views/Aturan'
import { Gelaran } from './views/Gelaran'
import { Gerbang } from './views/Gerbang'
import { Landing } from './views/Landing'
import { Pendaftaran } from './views/Pendaftaran'
import { Penanganan } from './views/Penanganan'
import { Perangkat } from './views/Perangkat'
import { Sistem } from './views/Sistem'

/**
 * Dua halaman, satu berkas.
 *
 * Yang dibuka pertama kali adalah halaman depan, bukan dashboard. Jalur
 * `/dashboard` yang dibuka langsung tetap sampai ke dashboard, sebab
 * `vercel.json` dan nginx mengarahkan setiap jalur ke index.html.
 */
function jalurSekarang(): string {
  const p = location.pathname.replace(/\/+$/, '')
  return p === '' ? '/' : p
}

function diamSaja(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Layar pembuka hanya pada kunjungan pertama satu sesi.
 *
 * Tiga detik terasa sinematik sekali, dan menyebalkan pada kali kesepuluh.
 * Demo menuntut halaman dimuat ulang berkali-kali, jadi sesudah kunjungan
 * pertama layar ini dilewati, dan pembaca yang mematikan animasi tidak
 * pernah melihatnya sama sekali.
 */
const SESI_MUAT = 'owl.boot'

function perluLayarPembuka(): boolean {
  if (diamSaja()) return false
  try { return sessionStorage.getItem(SESI_MUAT) === null } catch { return false }
}

export default function App() {
  const { t, lang, locale } = useT()
  const [route, setRoute] = useState(jalurSekarang)
  const nav = useNav()
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [kasus, setKasus] = useState<Kasus[]>([])
  const [diperbarui, setDiperbarui] = useState<Date | null>(null)
  const [menuBuka, setMenuBuka] = useState(false)
  const [kecil, setKecil] = useState(() => {
    try { return localStorage.getItem('owl.sb') === 'kecil' } catch { return false }
  })
  const ubahKecil = useCallback(() => {
    setKecil((k) => {
      try { localStorage.setItem('owl.sb', k ? 'lebar' : 'kecil') } catch { /* jendela privat */ }
      return !k
    })
  }, [])
  const [admin, setAdmin] = useState('')
  const [, setHealth] = useState<{ version: string; air_gapped: boolean } | null>(null)
  const [err, setErr] = useState('')
  const [offline, setOffline] = useState(isOffline())
  const [locked, setLocked] = useState(!hasKey())
  const [muat, setMuat] = useState(perluLayarPembuka)
  const [pindahKe, setPindahKe] = useState<string | null>(null)
  const [bukaDash, setBukaDash] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const muatKasus = useCallback(async () => {
    if (isOffline()) { setKasus([]); return }
    try { setKasus(await api.cases()) } catch { setKasus([]) }
  }, [])

  const refresh = useCallback(async () => {
    try {
      setDevices(await api.devices())
      api.metrics().then(setMetrics).catch(() => setMetrics(null))
      void muatKasus()
      setDiperbarui(new Date())
      setErr('')
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    }
  }, [muatKasus])

  useEffect(() => {
    const kembali = () => setRoute(jalurSekarang())
    addEventListener('popstate', kembali)
    return () => removeEventListener('popstate', kembali)
  }, [])

  // Perpindahan halaman: layar diredupkan lebih dahulu, jalurnya diganti di
  // balik redup itu, lalu halaman baru muncul dari gelap. Tanpa jeda ini,
  // peralihannya terasa seperti layar yang patah, bukan berpindah.
  const pindah = useCallback((p: string) => {
    if (diamSaja()) {
      history.pushState({}, '', p)
      setRoute(p)
      scrollTo({ top: 0 })
      return
    }
    setPindahKe(p)
    setTimeout(() => {
      history.pushState({}, '', p)
      setRoute(p)
      scrollTo({ top: 0 })
      setTimeout(() => setPindahKe(null), 40)
    }, 380)
  }, [])

  /**
   * Membuka kunci dashboard.
   *
   * Kata sandi yang benar tidak langsung menyingkap layar, sebab lompatan
   * seketika dari kartu kata sandi ke tabel penuh angka terbaca seperti
   * layar yang berganti sendiri. Satu layar pendek menutup peralihannya,
   * lalu buram di belakangnya luruh.
   */
  const bukaKunci = useCallback(() => {
    if (diamSaja()) { setLocked(false); return }
    setBukaDash(true)
    setTimeout(() => { setLocked(false); setBukaDash(false) }, 1750)
  }, [])

  /**
   * Keluar, dan menutup layar kunci.
   *
   * Keduanya berakhir di halaman depan, bukan di kotak kata sandi.
   * Pengguna yang menekan Keluar sedang pergi, jadi menyodorkan kotak
   * kata sandi di detik yang sama adalah menahan orang yang pamit.
   * Penguncian dinyalakan setelah tiraihnya menutup, supaya kartunya
   * tidak sempat berkedip di layar.
   */
  const keluar = useCallback(() => {
    clearKey()
    pindah('/')
    setTimeout(() => setLocked(true), diamSaja() ? 0 : 400)
  }, [pindah])

  useEffect(() => {
    if (!muat) return
    try { sessionStorage.setItem(SESI_MUAT, '1') } catch { /* jendela privat */ }
    const t = setTimeout(() => setMuat(false), 3100)
    return () => clearTimeout(t)
  }, [muat])

  useEffect(() => onOfflineChange(setOffline), [])

  // Keadaan sambungan ditanyakan sekali di awal, pada halaman mana pun.
  // Tanpa ini, lampu di halaman depan menyala hijau hanya karena belum
  // ada yang pernah bertanya, dan lampu yang menebak lebih buruk daripada
  // lampu yang tidak ada.
  useEffect(() => { api.health().then(setHealth).catch(() => undefined) }, [])

  // Kunci dicabut di tengah sesi: layar dikunci lagi, bukan dibiarkan
  // memperlihatkan data terakhir yang sudah tidak berhak dilihat.
  useEffect(() => onUnauthorized(() => setLocked(true)), [])

  useEffect(() => {
    if (locked || muat || route !== '/dashboard') return
    void refresh()
    api.catalog().then(setCatalog).catch(() => undefined)
    api.health().then(setHealth).catch(() => undefined)
  }, [refresh, locked, muat, route])

  // Siaran dari backend: setiap penilaian dan keputusan gerbang mendorong
  // muat ulang, sehingga dashboard tidak perlu menebak kapan harus bertanya.
  useEffect(() => {
    if (locked || route !== '/dashboard') return
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws' + wsQuery()
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(url)
      wsRef.current = ws
      ws.onmessage = () => { void refresh() }
      ws.onerror = () => undefined
    } catch {
      // Dashboard tetap berguna tanpa WebSocket; tombol muat ulang mengambil
      // alih. Kegagalan di sini bukan alasan untuk mengosongkan layar.
      ws = null
    }
    return () => { ws?.close(); wsRef.current = null }
  }, [refresh, locked, route])

  /**
   * Isi lonceng pemberitahuan.
   *
   * Keadaan yang sama yang dulu memasang spanduk selebar halaman di atas
   * setiap tab. Lampu dan tulisan "mode luring" tetap menyala di bilah atas,
   * jadi yang pindah ke sini adalah uraian panjangnya, bukan pengakuannya.
   */
  const kabar = useMemo<Kabar[]>(() => {
    const out: Kabar[] = []
    if (offline) {
      out.push({
        id: 'luring',
        nada: 'warn',
        judul: t('offline.title'),
        isi: `${t('offline.body', { time: new Date(snapshotGeneratedAt).toLocaleString(locale) })}`
          + ` make backend ${t('offline.body2')} owl/ ${t('offline.body3')}`,
      })
    }
    if (err && !offline) {
      out.push({ id: 'gagal', nada: 'err', judul: t('err.title'), isi: err })
    }
    return out
  }, [offline, err, t, locale])

  const tirai = (
    <>
      <Latar redup={route === '/dashboard'} />
      {muat && (
        <div className="boot">
          <div className="boot-isi">
            <Logo size={78} />
            <div className="boot-word">OWL</div>
            <div className="boot-sub">ON DEVICE WATCH LAYER</div>
            <div className="boot-bar"><i /></div>
            <div className="boot-line">{t('loader.line')}</div>
          </div>
        </div>
      )}
      {bukaDash && (
        <div className="boot cepat">
          <div className="boot-isi">
            <Logo size={58} />
            <div className="boot-bar"><i /></div>
            <div className="boot-line">{t('loader.unlock')}</div>
          </div>
        </div>
      )}
      <div className={`xfade${pindahKe ? ' is-on' : ''}`} aria-hidden="true" />
    </>
  )

  if (route !== '/dashboard') {
    return (
      <>
        {tirai}
        {/* Tanpa tombol Dashboard di sudut. Halaman depan sudah menawarkannya
            dua kali pada tempat yang memang dibaca orang: di hero, dan di
            penutup setelah seluruh klaimnya dinyatakan. Tombol ketiga yang
            melayang di pojok hanya bersaing dengan keduanya. */}
        <header className="land-top">
          <div className="sudut">
            <div className="sudut-baris">
              <Notifikasi kabar={kabar} />
              <LangToggle />
            </div>
            <StatusKoneksi offline={offline} />
          </div>
        </header>
        <div key="landing" className="halaman">
          <Landing onOpenDashboard={() => pindah('/dashboard')} />
        </div>
      </>
    )
  }

  return (
    <>
    {tirai}
    {locked && !muat && !bukaDash && <Login onOpen={bukaKunci} onClose={keluar} />}
    <AdminContext.Provider value={{ admin, setAdmin, minta: () => dispatchEvent(new Event('owl:admin')) }}>
    <div className={`app${locked ? ' locked' : ''}${kecil ? ' kecil' : ''}`} aria-hidden={locked}>
      <Sidebar
        kecil={kecil}
        onKecil={ubahKecil}
        page={nav.page}
        onPindah={(p) => nav.go(p)}
        hitung={{
          perangkat: devices.length,
          awas: devices.filter((d) => d.level === 'tinggi' || d.level === 'kritis').length,
          kasusBuka: kasus.filter((k) => k.status === 'baru' || k.status === 'diperiksa').length,
        }}
        buka={menuBuka}
        onTutup={() => setMenuBuka(false)}
        onBeranda={() => pindah('/')}
        onKeluar={keluar}
      />
      <div className="app-isi">
        <BilahAtas
          offline={offline}
          diperbarui={diperbarui}
          onSegar={() => void refresh()}
          onMenu={() => setMenuBuka(true)}
          kabar={kabar}
          judul={LABEL[nav.page][lang]}
        />
        <main className="app-main" id="utama" key={nav.page}>
          {nav.page !== 'ikhtisar' && (
            <KepalaHalaman judul={LABEL[nav.page][lang]} tujuan={TUJUAN[nav.page][lang]} />
          )}
          {nav.page === 'ikhtisar' && <Gelaran devices={devices} catalog={catalog} />}
          {nav.page === 'perangkat' && (
            <Perangkat devices={devices} catalog={catalog} terpilih={nav.arg} onPindah={nav.go} />
          )}
          {nav.page === 'gerbang' && (
            <Gerbang devices={devices} catalog={catalog} metrics={metrics}
                     onRefresh={() => void refresh()} onPindah={nav.go} />
          )}
          {nav.page === 'penanganan' && (
            <Penanganan devices={devices} kasus={kasus} offline={offline} awal={nav.arg}
                        onRefresh={() => void refresh()} onKasus={muatKasus} onPindah={nav.go} />
          )}
          {nav.page === 'pendaftaran' && (
            <Pendaftaran devices={devices} catalog={catalog} offline={offline} awal={nav.arg}
                         onRefresh={() => void refresh()} onPindah={nav.go} />
          )}
          {nav.page === 'aturan' && <Aturan catalog={catalog} />}
          {nav.page === 'sistem' && (
            <Sistem offline={offline} metrics={metrics} onRefresh={() => void refresh()} />
          )}
        </main>
      </div>
    </div>
    </AdminContext.Provider>
    </>
  )
}
