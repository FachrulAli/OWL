import type { ReactNode } from 'react'
import { scoreColor } from '../lib/api'

/**
 * Bahan dasar antarmuka: ikon, segmen, cip, keadaan kosong.
 *
 * Satu gaya untuk satu fungsi. Segmen selalu berarti "pilih satu dari
 * beberapa tampilan", cip selalu berarti "saring", dan keadaan kosong selalu
 * menyebut apa yang bisa dilakukan berikutnya, bukan hanya bahwa tidak ada isi.
 */

const IKON: Record<string, ReactNode> = {
  ikhtisar: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  perangkat: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  gerbang: <><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6a3 3 0 0 1 6 0v6" /></>,
  penanganan: <><path d="M9 11l2 2 4-4" /><rect x="4" y="3.5" width="16" height="17" rx="2" /></>,
  pendaftaran: <><path d="M12 3v12" /><path d="M7.5 10.5 12 15l4.5-4.5" /><path d="M4 19h16" /></>,
  aturan: <><path d="M5 4h11l3 3v13H5z" /><path d="M9 11h6M9 15h6" /></>,
  sistem: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  tutup: <><path d="M6 6l12 12M18 6L6 18" /></>,
  kunci: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  buka: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></>,
  segar: <><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v5h-5" /></>,
  unduh: <><path d="M12 3v12" /><path d="M7.5 10.5 12 15l4.5-4.5" /><path d="M4 20h16" /></>,
  salin: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  cari: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  centang: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  panah: <><path d="M9 6l6 6-6 6" /></>,
  kiri: <><path d="M11 6l-6 6 6 6M19 6l-6 6 6 6" /></>,
  kanan: <><path d="M13 6l6 6-6 6M5 6l6 6-6 6" /></>,
  keluar: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
}

export function Ikon({ nama, size = 18 }: { nama: string; size?: number }) {
  return (
    <svg
      className="ikon" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {IKON[nama] ?? null}
    </svg>
  )
}

/** Pilih satu dari beberapa tampilan yang setara. */
export function Segmen<T extends string>({
  nilai, onUbah, pilihan, label,
}: {
  nilai: T
  onUbah: (v: T) => void
  pilihan: { id: T; teks: string; n?: number }[]
  label: string
}) {
  return (
    <div className="segmen" role="tablist" aria-label={label}>
      {pilihan.map((p) => (
        <button
          key={p.id} role="tab" aria-selected={nilai === p.id}
          onClick={() => onUbah(p.id)}
        >
          {p.teks}{p.n !== undefined && <i>{p.n}</i>}
        </button>
      ))}
    </div>
  )
}

/** Cip penyaring: tekan untuk menyaring, tekan lagi untuk melepas. */
export function Cip({
  aktif, onKlik, children, n, nada, mati,
}: {
  aktif: boolean
  onKlik: () => void
  children: ReactNode
  n?: number
  nada?: string
  mati?: boolean
}) {
  return (
    <button
      className={`cip${nada ? ' ' + nada : ''}`} aria-pressed={aktif}
      disabled={mati} onClick={onKlik}
    >
      {children}{n !== undefined && <i>{n}</i>}
    </button>
  )
}

/** Skor sebagai lencana berwarna; warna yang sama dengan cincin dan peta. */
export function SkorLencana({ skor }: { skor: number | null }) {
  if (skor === null) return <span className="skor-len kosong">—</span>
  const w = scoreColor(skor)
  return <span className="skor-len" style={{ color: w, borderColor: w }}>{Math.round(skor)}</span>
}

/**
 * Keadaan kosong yang mengarahkan.
 *
 * Layar kosong adalah ajakan bertindak: ia menyebut apa yang belum ada, dan
 * satu hal yang dapat dilakukan petugas untuk mengisinya.
 */
export function Kosong({
  judul, isi, aksi,
}: {
  judul: string
  isi?: string
  aksi?: ReactNode
}) {
  return (
    <div className="kosong-blok">
      <strong>{judul}</strong>
      {isi && <p>{isi}</p>}
      {aksi}
    </div>
  )
}

/** Kepala halaman: judul, tujuan, dan tindakan utama di kanan. */
export function KepalaHalaman({
  judul, tujuan, aksi,
}: {
  judul: string
  tujuan: string
  aksi?: ReactNode
}) {
  return (
    <header className="kh">
      <div>
        <h1>{judul}</h1>
        <p>{tujuan}</p>
      </div>
      {aksi && <div className="kh-aksi">{aksi}</div>}
    </header>
  )
}
