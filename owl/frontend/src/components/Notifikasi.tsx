import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'

/**
 * Pusat pemberitahuan di bilah atas.
 *
 * Keadaan yang perlu diketahui tetapi tidak perlu menguasai layar tinggal di
 * sini: mode luring, kegagalan memuat data, dan sejenisnya. Sebelumnya
 * masing-masing memasang spanduk selebar halaman di atas setiap tab, dan
 * spanduk itu memakan ruang yang sama besar pada kunjungan kesepuluh seperti
 * pada kunjungan pertama, padahal isinya tidak berubah.
 *
 * Yang TIDAK boleh ikut pindah ke sini adalah pernyataan bahwa dashboard
 * sedang memakai rekaman. Itu sebabnya lampu dan tulisan "mode luring"
 * tetap menyala di bilah atas sepanjang waktu, dan tombol ini hanya
 * menyimpan uraian panjangnya. Demo yang tidak mengaku sedang luring adalah
 * demo yang menipu penontonnya, dan menyembunyikan pengakuan itu di balik
 * satu ketukan sama saja dengan tidak mengakuinya.
 */
export interface Kabar {
  id: string
  judul: string
  isi: string
  nada: 'warn' | 'err' | 'info'
}

export function Notifikasi({ kabar }: { kabar: Kabar[] }) {
  const { t } = useT()
  const [buka, setBuka] = useState(false)
  const [dibaca, setDibaca] = useState<string[]>([])
  const kotak = useRef<HTMLDivElement>(null)

  const belum = kabar.filter((k) => !dibaca.includes(k.id)).length

  useEffect(() => {
    if (!buka) return
    const luar = (e: MouseEvent) => {
      if (kotak.current && !kotak.current.contains(e.target as Node)) setBuka(false)
    }
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false) }
    addEventListener('mousedown', luar)
    addEventListener('keydown', tekan)
    return () => { removeEventListener('mousedown', luar); removeEventListener('keydown', tekan) }
  }, [buka])

  // Membuka daftarnya berarti membacanya. Tanda belum dibaca yang bertahan
  // setelah dibuka hanya melatih orang untuk mengabaikannya.
  function alih() {
    setBuka((b) => {
      if (!b) setDibaca(kabar.map((k) => k.id))
      return !b
    })
  }

  return (
    <div className={`notif${buka ? ' buka' : ''}`} ref={kotak}>
      <button
        className="notif-tombol"
        onClick={alih}
        aria-expanded={buka}
        aria-label={belum > 0 ? t('notif.openN', { n: belum }) : t('notif.open')}
        title={t('notif.title')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.2a5.6 5.6 0 0 0-5.6 5.6c0 3.4-.8 5-1.7 6.1-.4.5 0 1.3.7 1.3h13.2c.7 0 1.1-.8.7-1.3-.9-1.1-1.7-2.7-1.7-6.1A5.6 5.6 0 0 0 12 3.2Z"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
          />
          <path
            d="M10 18.6a2.1 2.1 0 0 0 4 0"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          />
        </svg>
        {belum > 0 && <i className="notif-titik" aria-hidden="true" />}
      </button>

      {buka && (
        <div className="notif-pop" role="dialog" aria-label={t('notif.title')}>
          <div className="notif-kepala">
            <div className="kicker" style={{ marginBottom: 0 }}>{t('notif.title')}</div>
            <span className="notif-jumlah">{kabar.length}</span>
          </div>

          {kabar.length === 0 ? (
            <p className="notif-sepi">{t('notif.empty')}</p>
          ) : (
            <ul className="notif-daftar">
              {kabar.map((k) => (
                <li key={k.id} className={k.nada}>
                  <span className="notif-nada" aria-hidden="true" />
                  <div>
                    <div className="notif-judul">{k.judul}</div>
                    <p className="notif-isi">{k.isi}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
