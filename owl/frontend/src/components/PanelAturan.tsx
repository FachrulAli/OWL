import { useEffect } from 'react'
import { useT } from '../lib/i18n'
import type { Catalog } from '../lib/types'
import { Aturan } from '../views/Aturan'

/**
 * Aturan dan bobot, dipindahkan dari tab ke panel sisi kiri.
 *
 * Halaman ini sifatnya rujukan, bukan alur kerja: dibuka saat ada yang perlu
 * dibuktikan, lalu ditutup lagi. Sebagai tab, ia menuntut tempat yang sama
 * dengan Gerbang dan Perangkat padahal tidak dipakai sesering keduanya, dan
 * membukanya berarti meninggalkan layar yang sedang dikerjakan.
 *
 * Sebagai panel, ia dapat dibuka di sebelah pekerjaan dan ditutup tanpa
 * kehilangan apa pun. Lidahnya berbentuk trapesium seperti pembatas buku
 * dan tetap menempel di tepi kiri layar, sehingga jalan masuknya selalu
 * terlihat tanpa memakan satu slot navigasi.
 */
export function PanelAturan({
  catalog, buka, onToggle,
}: {
  catalog: Catalog | null
  buka: boolean
  onToggle: (v: boolean) => void
}) {
  const { t } = useT()

  useEffect(() => {
    if (!buka) return
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggle(false) }
    addEventListener('keydown', tekan)
    return () => removeEventListener('keydown', tekan)
  }, [buka, onToggle])

  return (
    <div className={`pnl${buka ? ' buka' : ''}`}>
      <div className="pnl-tirai" onClick={() => onToggle(false)} aria-hidden="true" />

      <button
        className="pnl-lidah"
        onClick={() => onToggle(!buka)}
        aria-expanded={buka}
        aria-controls="panel-aturan"
        title={buka ? t('panel.close') : t('panel.open')}
      >
        <span className="pnl-lidah-teks">{t('tab.aturan')}</span>
        <span className="pnl-lidah-panah" aria-hidden="true">{buka ? '‹' : '›'}</span>
      </button>

      <aside className="pnl-isi" id="panel-aturan" aria-hidden={!buka}>
        <header className="pnl-kepala">
          <div>
            <div className="kicker" style={{ marginBottom: 2 }}>{t('panel.kicker')}</div>
            <h3>{t('tab.aturan')}</h3>
          </div>
          <button className="pnl-tutup" onClick={() => onToggle(false)} aria-label={t('panel.close')}>×</button>
        </header>
        <p className="muted pnl-lead">{t('panel.lead')}</p>
        <div className="pnl-gulir">
          {buka && <Aturan catalog={catalog} />}
        </div>
      </aside>
    </div>
  )
}
