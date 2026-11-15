import { useEffect, useRef, useState } from 'react'
import { snapshotGeneratedAt } from '../lib/api'
import { useT } from '../lib/i18n'

/**
 * Keadaan sambungan ke OWL Core, di bawah tombol bahasa.
 *
 * Lampunya berkedip merah saat OWL Core tidak terjangkau dan menyala hijau
 * tenang saat terjangkau. Kedipan sengaja hanya dipakai untuk keadaan luring:
 * yang berkedip menarik mata, dan yang pantas menarik mata adalah keadaan
 * ketika angka di layar berasal dari rekaman, bukan dari penilaian baru.
 *
 * Warna tidak berdiri sendiri. Teks di sebelahnya menyebut keadaannya dengan
 * kata, sebab pembaca yang tidak dapat membedakan merah dan hijau tetap harus
 * tahu dashboard ini sedang luring.
 */
export function StatusKoneksi({ offline }: { offline: boolean }) {
  const { t } = useT()
  return (
    <div className={`status-koneksi${offline ? ' luring' : ' daring'}`}>
      <span className="lampu" aria-hidden="true" />
      <span className="teks">{offline ? t('top.offline') : t('top.online')}</span>
    </div>
  )
}

/**
 * Versi build, di pojok kanan bawah.
 *
 * Nomor versi perlu ada dan perlu dapat disebut saat melapor, tetapi tidak
 * perlu menempati bilah atas bersama hal-hal yang benar-benar dioperasikan.
 * Di sini ia diam sebagai titik kecil sampai ditekan, lalu menerangkan
 * dirinya: mesin apa yang menilai, dan apakah penggelaran ini air-gapped.
 */
export function Versi({
  version, airGapped, offline,
}: {
  version: string | null
  airGapped: boolean
  offline: boolean
}) {
  const { t, locale } = useT()
  const [buka, setBuka] = useState(false)
  const kotak = useRef<HTMLDivElement>(null)

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

  const v = version ?? '1.0.0'

  return (
    <div className={`versi${buka ? ' buka' : ''}`} ref={kotak}>
      {buka && (
        <div className="versi-pop" role="dialog" aria-label={t('ver.title')}>
          <div className="kicker" style={{ marginBottom: 8 }}>{t('ver.title')}</div>
          <dl>
            <div><dt>{t('ver.build')}</dt><dd>v{v}</dd></div>
            <div>
              <dt>{t('ver.mode')}</dt>
              <dd className={offline ? 'warn' : ''}>
                {offline ? t('top.offline') : airGapped ? t('top.airgapped') : t('top.online')}
              </dd>
            </div>
            {offline && (
              <div>
                <dt>{t('ver.recorded')}</dt>
                <dd>{new Date(snapshotGeneratedAt).toLocaleString(locale)}</dd>
              </div>
            )}
          </dl>
          <p className="muted">{t('ver.note')}</p>
        </div>
      )}
      <button
        className="versi-pil"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        title={t('ver.title')}
      >
        v{v}
      </button>
    </div>
  )
}
