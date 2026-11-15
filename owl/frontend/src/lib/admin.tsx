import { createContext, useContext } from 'react'

/**
 * Kunci admin, satu tempat untuk seluruh dashboard.
 *
 * Dulu kotak kunci ada di dalam halaman Operasi, sehingga petugas yang
 * mencabut perangkat dari satu halaman dan menerbitkan token dari halaman
 * lain mengetik kuncinya dua kali. Sekarang kunci diisi sekali lewat tombol
 * di bilah atas dan dipakai di mana pun.
 *
 * Kuncinya hidup di memori halaman saja, tidak di sessionStorage seperti
 * kunci baca. Kunci baca hanya membuka tampilan; kunci admin mengubah
 * kebijakan, dan kunci semacam itu tidak pantas bertahan melewati satu kali
 * muat halaman.
 */
export interface AdminCtx {
  admin: string
  setAdmin: (v: string) => void
  /** Buka kotak kunci di bilah atas, dari halaman mana pun. */
  minta: () => void
}

export const AdminContext = createContext<AdminCtx>({
  admin: '', setAdmin: () => undefined, minta: () => undefined,
})

export const useAdmin = () => useContext(AdminContext)
