import { useEffect, useRef, useState } from 'react'
import { UNDUH_AGENT } from '../lib/agent'
import { useAdmin } from '../lib/admin'
import { LangToggle, useT } from '../lib/i18n'
import { GROUPS, LABEL } from '../lib/nav'
import type { Page } from '../lib/nav'
import { Logo } from './Logo'
import { Notifikasi } from './Notifikasi'
import type { Kabar } from './Notifikasi'
import { StatusKoneksi } from './Status'
import { Ikon } from './Ui'

/**
 * Bilah navigasi di sisi kiri.
 *
 * Dikelompokkan menurut pekerjaan petugas: memantau, menindak, mengelola.
 * Angka di samping menu adalah hal yang menuntut perhatian, bukan sekadar
 * jumlah: perangkat yang perlu ditindak di Ikhtisar, kasus yang masih
 * terbuka di Penanganan. Menu tanpa angka berarti tidak ada yang menunggu.
 */
export interface Hitung {
  perangkat: number
  awas: number
  kasusBuka: number
}

export function Sidebar({
  page, onPindah, hitung, buka, onTutup, onBeranda, onKeluar, kecil, onKecil,
}: {
  kecil: boolean
  onKecil: () => void
  page: Page
  onPindah: (p: Page) => void
  hitung: Hitung
  buka: boolean
  onTutup: () => void
  onBeranda: () => void
  onKeluar: () => void
}) {
  const { lang } = useT()

  const badge = (p: Page): { n: number; nada: string } | null => {
    if (p === 'ikhtisar' && hitung.awas > 0) return { n: hitung.awas, nada: 'awas' }
    if (p === 'perangkat') return { n: hitung.perangkat, nada: '' }
    if (p === 'penanganan' && hitung.kasusBuka > 0) return { n: hitung.kasusBuka, nada: 'awas' }
    return null
  }

  return (
    <>
      {buka && <div className="sb-tirai" onClick={onTutup} aria-hidden="true" />}
      <aside className={`sb${buka ? ' buka' : ''}${kecil ? ' kecil' : ''}`} aria-label={lang === 'id' ? 'Navigasi utama' : 'Main navigation'}>
        <button className="sb-merek" onClick={onBeranda} title={lang === 'id' ? 'Kembali ke halaman depan' : 'Back to the landing page'}>
          <Logo />
          <span>
            <b>OWL</b>
            <small>On Device Watch Layer</small>
          </span>
        </button>

        <nav className="sb-nav">
          {GROUPS.map((g) => (
            <div key={g.id} className="sb-grup">
              <div className="sb-judul">{g.id_[lang]}</div>
              {g.pages.map((p) => {
                const b = badge(p)
                return (
                  <button
                    key={p} className="sb-item" aria-current={page === p ? 'page' : undefined}
                    title={kecil ? LABEL[p][lang] : undefined}
                    aria-label={LABEL[p][lang]}
                    onClick={() => { onPindah(p); onTutup() }}
                  >
                    <Ikon nama={p} />
                    <span>{LABEL[p][lang]}</span>
                    {b && <i className={b.nada}>{b.n}</i>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sb-kaki">
          <button
            className="sb-keluar sb-ciut" onClick={onKecil} aria-pressed={kecil}
            title={kecil ? (lang === 'id' ? 'Perlebar menu' : 'Expand menu') : (lang === 'id' ? 'Ciutkan menu' : 'Collapse menu')}
          >
            <Ikon nama={kecil ? 'kanan' : 'kiri'} />
            <span>{lang === 'id' ? 'Ciutkan menu' : 'Collapse menu'}</span>
          </button>
          <button className="sb-keluar" onClick={onKeluar} title={kecil ? (lang === 'id' ? 'Keluar' : 'Log out') : undefined}>
            <Ikon nama="keluar" />
            <span>{lang === 'id' ? 'Keluar' : 'Log out'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

/**
 * Bilah atas: apa yang berlaku di semua halaman.
 *
 * Keadaan sambungan dan waktu pembaruan, kunci admin, pemberitahuan, bahasa,
 * dan unduhan agent. Tombol unduh sengaja di sini, bukan di dalam satu
 * halaman: petugas yang baru mulai selalu butuh agent lebih dulu.
 */
export function BilahAtas({
  offline, diperbarui, onSegar, onMenu, kabar, judul,
}: {
  offline: boolean
  diperbarui: Date | null
  onSegar: () => void
  onMenu: () => void
  kabar: Kabar[]
  judul: string
}) {
  const { lang, locale } = useT()
  const [putar, setPutar] = useState(false)

  return (
    <div className="ba">
      <button className="ba-menu" onClick={onMenu} aria-label={lang === 'id' ? 'Buka menu' : 'Open menu'}>
        <Ikon nama="menu" size={22} />
      </button>
      <div className="ba-judul">{judul}</div>

      <div className="ba-status">
        <StatusKoneksi offline={offline} />
        <button
          className="ba-segar" disabled={putar}
          onClick={() => { setPutar(true); onSegar(); setTimeout(() => setPutar(false), 700) }}
          title={lang === 'id' ? 'Muat ulang data' : 'Reload data'}
        >
          <Ikon nama="segar" size={16} />
          <span>
            {diperbarui
              ? (lang === 'id' ? 'Diperbarui ' : 'Updated ') + diperbarui.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
              : (lang === 'id' ? 'Muat ulang' : 'Reload')}
          </span>
        </button>
      </div>

      <div className="ba-kanan">
        <KunciAdmin />
        <Notifikasi kabar={kabar} />
        <LangToggle />
        {UNDUH_AGENT && (
          <a className="btn ba-apk" href={UNDUH_AGENT} download>
            <Ikon nama="unduh" size={16} />
            <span>{lang === 'id' ? 'Unduh APK' : 'Get the APK'}</span>
          </a>
        )}
      </div>
    </div>
  )
}

/** Kunci admin: diisi sekali, berlaku di semua halaman, hilang saat dimuat ulang. */
function KunciAdmin() {
  const { admin, setAdmin } = useAdmin()
  const { lang } = useT()
  const [buka, setBuka] = useState(false)
  const kotak = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const dari = () => setBuka(true)
    addEventListener('owl:admin', dari)
    return () => removeEventListener('owl:admin', dari)
  }, [])

  useEffect(() => {
    if (!buka) return
    input.current?.focus()
    const luar = (e: MouseEvent) => {
      if (kotak.current && !kotak.current.contains(e.target as Node)) setBuka(false)
    }
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false) }
    addEventListener('mousedown', luar)
    addEventListener('keydown', tekan)
    return () => { removeEventListener('mousedown', luar); removeEventListener('keydown', tekan) }
  }, [buka])

  const aktif = admin.trim() !== ''
  return (
    <div className="ka" ref={kotak}>
      <button
        className={`ka-tombol${aktif ? ' aktif' : ''}`} aria-expanded={buka}
        onClick={() => setBuka((b) => !b)}
      >
        <Ikon nama={aktif ? 'buka' : 'kunci'} size={16} />
        <span>{aktif ? (lang === 'id' ? 'Admin aktif' : 'Admin on') : (lang === 'id' ? 'Kunci admin' : 'Admin key')}</span>
      </button>
      {buka && (
        <div className="ka-pop" role="dialog" aria-label={lang === 'id' ? 'Kunci admin' : 'Admin key'}>
          <label htmlFor="ka-input">{lang === 'id' ? 'Kunci admin' : 'Admin key'}</label>
          <input
            id="ka-input" ref={input} type="password" autoComplete="off" value={admin}
            onChange={(e) => setAdmin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setBuka(false) }}
            placeholder={lang === 'id' ? 'Tempel kunci admin' : 'Paste the admin key'}
          />
          <p>
            {lang === 'id'
              ? 'Dibutuhkan untuk mengubah keadaan: mencabut perangkat, menerbitkan token, menangani kasus, dan mengimpor daftar. Hanya disimpan di memori halaman ini dan hilang saat dimuat ulang.'
              : 'Needed to change state: revoke a device, issue a token, handle a case, import a list. Kept in this page’s memory only and cleared on reload.'}
          </p>
          <div className="ka-aksi">
            <button className="btn" onClick={() => setBuka(false)}>{lang === 'id' ? 'Selesai' : 'Done'}</button>
            {aktif && <button className="btn ghost" onClick={() => setAdmin('')}>{lang === 'id' ? 'Hapus kunci' : 'Clear key'}</button>}
          </div>
        </div>
      )}
    </div>
  )
}
