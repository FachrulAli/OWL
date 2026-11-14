import { useEffect, useRef, useState } from 'react'

/**
 * Gerak pada halaman depan.
 *
 * Tiga kait kecil, tanpa pustaka tambahan. Semuanya menghormati
 * `prefers-reduced-motion`: pembaca yang mematikan animasi mendapat halaman
 * yang sama, lengkap, dan langsung jadi, bukan halaman yang kosong karena
 * pemicunya tidak pernah jalan.
 */
function diamSaja(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Menyalakan kelas `is-in` ketika elemen masuk layar. */
export function useReveal<T extends HTMLElement>(sekaliSaja = true) {
  const ref = useRef<T | null>(null)
  const [masuk, setMasuk] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (diamSaja() || typeof IntersectionObserver === 'undefined') {
      setMasuk(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setMasuk(true)
          if (sekaliSaja) { io.disconnect(); lepasGulir() }
        } else if (!sekaliSaja) {
          setMasuk(false)
        }
      },
      { rootMargin: '-12% 0px -12% 0px', threshold: 0.01 },
    )
    io.observe(el)

    // Jaring pengaman. Isi halaman ini disembunyikan sampai dinyatakan
    // terlihat, jadi pengamat yang tidak pernah memanggil balik akan
    // meninggalkan halaman kosong, dan halaman kosong jauh lebih buruk
    // daripada halaman tanpa animasi. Perhitungan posisi yang sederhana
    // ikut berjalan sebagai cadangan, lalu keduanya saling melepas.
    const periksa = () => {
      const r = el.getBoundingClientRect()
      if (r.top < innerHeight * 0.92 && r.bottom > 0) {
        setMasuk(true)
        io.disconnect()
        lepasGulir()
      }
    }
    // Sengaja TIDAK lewat requestAnimationFrame. Pada mesin yang menahan
    // rAF, pengecekannya tidak pernah jalan dan halaman tinggal kosong.
    // Satu pembacaan posisi per peristiwa gulir jauh lebih murah daripada
    // risiko itu, dan pendengarnya dilepas begitu bagiannya terlihat.
    const onGulir = () => periksa()
    function lepasGulir() {
      removeEventListener('scroll', onGulir)
      removeEventListener('resize', onGulir)
    }
    addEventListener('scroll', onGulir, { passive: true })
    addEventListener('resize', onGulir)
    periksa()

    return () => { io.disconnect(); lepasGulir() }
  }, [sekaliSaja])

  return { ref, masuk }
}

/**
 * Angka yang naik dari nol ketika terlihat.
 *
 * Dipakai untuk skor 18 dan 87. Nilai akhirnya tetap angka yang dihasilkan
 * mesin aturan; yang dianimasikan hanya cara angka itu muncul.
 */
export function useCountUp(target: number, jalan: boolean, durasi = 1100): number {
  const [nilai, setNilai] = useState(0)

  useEffect(() => {
    if (!jalan) return
    if (diamSaja()) { setNilai(target); return }

    let raf = 0
    const mulai = performance.now()
    const langkah = (t: number) => {
      const p = Math.min(1, (t - mulai) / durasi)
      // pelan di ujung, supaya angkanya terasa mendarat
      const e = 1 - Math.pow(1 - p, 3)
      setNilai(target * e)
      if (p < 1) raf = requestAnimationFrame(langkah)
    }
    raf = requestAnimationFrame(langkah)

    // Pengaman: tab latar, mesin yang membatasi animasi, dan perambah yang
    // menahan requestAnimationFrame membuat hitungan berhenti di tengah
    // jalan. Angka skor tidak boleh ikut berhenti setengah, jadi nilainya
    // dipastikan mendarat walau geraknya tidak pernah jalan.
    const pasti = setTimeout(() => setNilai(target), durasi + 180)

    return () => { cancelAnimationFrame(raf); clearTimeout(pasti) }
  }, [target, jalan, durasi])

  return nilai
}

/** Kemajuan gulir 0 sampai 1, untuk bilah tipis di tepi atas. */
export function useScrollProgress(): number {
  const [p, setP] = useState(0)

  useEffect(() => {
    let raf = 0
    const hitung = () => {
      raf = 0
      const h = document.documentElement
      const bisa = h.scrollHeight - h.clientHeight
      setP(bisa > 0 ? Math.min(1, h.scrollTop / bisa) : 0)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(hitung) }
    hitung()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return p
}
