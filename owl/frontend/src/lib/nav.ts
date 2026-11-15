import { useCallback, useEffect, useState } from 'react'

/**
 * Navigasi dashboard lewat hash: `/dashboard#/perangkat/ID`.
 *
 * Hash dipilih karena dua alasan. Server (nginx dan Vercel) sudah mengarahkan
 * semua jalur ke index.html, jadi tidak ada aturan baru yang perlu dipasang.
 * Dan tombol Kembali pada browser bekerja: petugas yang membuka perangkat
 * dari ikhtisar lalu menekan Kembali sampai di ikhtisar lagi, bukan di
 * halaman depan.
 */
export type Page =
  | 'ikhtisar' | 'perangkat' | 'gerbang' | 'penanganan'
  | 'pendaftaran' | 'aturan' | 'sistem'

export const PAGES: Page[] = [
  'ikhtisar', 'perangkat', 'gerbang', 'penanganan', 'pendaftaran', 'aturan', 'sistem',
]

/** Kelompok menurut pekerjaan, bukan menurut jenis data. */
export const GROUPS: { id: string; id_: { id: string; en: string }; pages: Page[] }[] = [
  { id: 'pantau', id_: { id: 'Pantau', en: 'Monitor' }, pages: ['ikhtisar', 'perangkat'] },
  { id: 'tindak', id_: { id: 'Tindak', en: 'Act' }, pages: ['gerbang', 'penanganan'] },
  { id: 'kelola', id_: { id: 'Kelola', en: 'Manage' }, pages: ['pendaftaran', 'aturan', 'sistem'] },
]

export const LABEL: Record<Page, { id: string; en: string }> = {
  ikhtisar: { id: 'Ikhtisar', en: 'Overview' },
  perangkat: { id: 'Perangkat', en: 'Devices' },
  gerbang: { id: 'Gerbang akses', en: 'Access gate' },
  penanganan: { id: 'Penanganan', en: 'Cases' },
  pendaftaran: { id: 'Pendaftaran agent', en: 'Agent enrolment' },
  aturan: { id: 'Aturan & bobot', en: 'Rules & weights' },
  sistem: { id: 'Sistem', en: 'System' },
}

/** Satu kalimat: untuk apa halaman ini dibuka. */
export const TUJUAN: Record<Page, { id: string; en: string }> = {
  ikhtisar: {
    id: 'Seberapa aman armada saat ini, di satuan mana, dan apa yang perlu ditangani lebih dulu.',
    en: 'How safe the fleet is right now, in which units, and what needs handling first.',
  },
  perangkat: {
    id: 'Cari satu perangkat, lihat mengapa skornya begitu, lalu ambil tindakan.',
    en: 'Find one device, see why it scored that way, then act on it.',
  },
  gerbang: {
    id: 'Uji siapa boleh masuk ke sistem satuan, dan atas dasar apa gerbang memutuskan.',
    en: 'Test who may enter the unit systems, and on what basis the gate decides.',
  },
  penanganan: {
    id: 'Catat siapa menangani perangkat bermasalah, beri pengecualian terbatas, atau cabut perangkat.',
    en: 'Record who is handling a problem device, grant a time-limited exception, or revoke it.',
  },
  pendaftaran: {
    id: 'Pasang agent di HP prajurit dan daftarkan perangkatnya, langkah demi langkah.',
    en: 'Install the agent on a soldier’s phone and enrol the device, step by step.',
  },
  aturan: {
    id: 'Seluruh aturan penilaian beserta bobotnya, supaya setiap skor dapat dibuktikan.',
    en: 'Every scoring rule and its weight, so each score can be proven.',
  },
  sistem: {
    id: 'Keadaan OWL Core, daftar pencabutan attestation, dan daftar yang dibawa lewat media.',
    en: 'OWL Core status, the attestation revocation list, and lists brought in by media.',
  },
}

function baca(): { page: Page; arg: string } {
  const h = location.hash.replace(/^#\/?/, '')
  const [p, ...rest] = h.split('/')
  const page = (PAGES as string[]).includes(p) ? (p as Page) : 'ikhtisar'
  let arg = ''
  try { arg = decodeURIComponent(rest.join('/')) } catch { arg = '' }
  return { page, arg }
}

export function useNav() {
  const [state, setState] = useState(baca)

  // Gulir ke atas hanya saat HALAMAN berganti. Memilih perangkat lain pada
  // daftar yang sama hanya mengganti argumen, dan melompat ke puncak di
  // tengah membaca daftar panjang adalah hal paling menjengkelkan di sini.
  useEffect(() => {
    let sebelum = baca().page
    const f = () => {
      const b = baca()
      setState(b)
      if (b.page !== sebelum) scrollTo({ top: 0 })
      sebelum = b.page
    }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])

  const go = useCallback((page: Page, arg?: string) => {
    location.hash = '/' + page + (arg ? '/' + encodeURIComponent(arg) : '')
  }, [])

  return { ...state, go }
}
