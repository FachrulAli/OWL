import { useEffect, useRef } from 'react'

/**
 * Latar bergerak.
 *
 * Bukan video: satu kanvas yang menggambar jaring sinyal emas di atas
 * hitam, dengan satu pita pemindai yang turun perlahan. Dipilih kanvas
 * karena berkas video berukuran megabyte akan merusak satu-satunya janji
 * yang paling sering diucapkan produk ini, yaitu berjalan di jaringan
 * satuan yang terisolasi dan lambat, sedangkan gambar ini berukuran
 * beberapa kilobyte kode dan ikut mengecil sendiri pada layar kecil.
 *
 * Tiga penjagaan supaya latar tidak pernah mengganggu:
 *   - berhenti ketika tab tidak terlihat,
 *   - tidak pernah menyala pada prefers-reduced-motion (digambar sekali,
 *     diam),
 *   - jumlah simpul mengikuti luas layar, bukan angka tetap.
 */
interface Simpul {
  x: number
  y: number
  vx: number
  vy: number
}

const WARNA_SIMPUL = 'rgba(231, 200, 120, '
const WARNA_GARIS = 'rgba(201, 162, 39, '

export function Latar({ redup = false }: { redup?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const kanvas = ref.current
    if (!kanvas) return
    const ctx = kanvas.getContext('2d')
    if (!ctx) return

    const diam = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches

    let lebar = 0
    let tinggi = 0
    let simpul: Simpul[] = []
    let raf = 0
    let waktu = 0
    let jalan = true

    const ukur = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      lebar = innerWidth
      tinggi = innerHeight
      kanvas.width = Math.floor(lebar * dpr)
      kanvas.height = Math.floor(tinggi * dpr)
      kanvas.style.width = `${lebar}px`
      kanvas.style.height = `${tinggi}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Kerapatan mengikuti luas layar: ponsel tidak perlu menggambar
      // sebanyak layar lebar, dan baterainya yang membayar kalau dipaksa.
      const jumlah = Math.round(Math.min(70, Math.max(18, (lebar * tinggi) / 26000)))
      simpul = Array.from({ length: jumlah }, () => ({
        x: Math.random() * lebar,
        y: Math.random() * tinggi,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
      }))
    }

    const kisi = () => {
      const jarak = 96
      ctx.lineWidth = 1
      ctx.strokeStyle = `${WARNA_GARIS}0.045)`
      ctx.beginPath()
      for (let x = 0; x <= lebar; x += jarak) { ctx.moveTo(x, 0); ctx.lineTo(x, tinggi) }
      for (let y = 0; y <= tinggi; y += jarak) { ctx.moveTo(0, y); ctx.lineTo(lebar, y) }
      ctx.stroke()
    }

    const jaring = () => {
      const batas = Math.min(170, Math.max(110, lebar / 9))
      for (let i = 0; i < simpul.length; i++) {
        const a = simpul[i]
        for (let j = i + 1; j < simpul.length; j++) {
          const b = simpul[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d > batas) continue
          ctx.strokeStyle = `${WARNA_GARIS}${(1 - d / batas) * 0.13})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
      for (const s of simpul) {
        ctx.fillStyle = `${WARNA_SIMPUL}0.42)`
        ctx.beginPath()
        ctx.arc(s.x, s.y, 1.25, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    /** Pita pemindai yang turun, gagasan yang sama dengan halaman depan. */
    const pita = (t: number) => {
      const putaran = 9000
      const p = (t % putaran) / putaran
      const y = p * (tinggi + 300) - 150
      const g = ctx.createLinearGradient(0, y - 150, 0, y + 150)
      g.addColorStop(0, `${WARNA_GARIS}0)`)
      g.addColorStop(0.5, `${WARNA_GARIS}0.055)`)
      g.addColorStop(1, `${WARNA_GARIS}0)`)
      ctx.fillStyle = g
      ctx.fillRect(0, y - 150, lebar, 300)

      ctx.strokeStyle = `${WARNA_SIMPUL}0.1)`
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(lebar, y)
      ctx.stroke()
    }

    const gambar = (t: number) => {
      ctx.clearRect(0, 0, lebar, tinggi)
      kisi()
      jaring()
      if (!diam) pita(t)
    }

    const langkah = (t: number) => {
      raf = 0
      if (!jalan) return
      const dt = Math.min(32, t - waktu || 16)
      waktu = t
      for (const s of simpul) {
        s.x += s.vx * dt * 0.06
        s.y += s.vy * dt * 0.06
        if (s.x < -20) s.x = lebar + 20
        if (s.x > lebar + 20) s.x = -20
        if (s.y < -20) s.y = tinggi + 20
        if (s.y > tinggi + 20) s.y = -20
      }
      gambar(t)
      raf = requestAnimationFrame(langkah)
    }

    const mulai = () => { if (!raf && jalan && !diam) raf = requestAnimationFrame(langkah) }
    const henti = () => { if (raf) { cancelAnimationFrame(raf); raf = 0 } }

    const onUkur = () => { ukur(); if (diam) gambar(0) }
    const onTampak = () => {
      jalan = !document.hidden
      if (jalan) mulai(); else henti()
    }

    ukur()
    gambar(0)
    if (!diam) mulai()

    addEventListener('resize', onUkur)
    document.addEventListener('visibilitychange', onTampak)
    return () => {
      henti()
      removeEventListener('resize', onUkur)
      document.removeEventListener('visibilitychange', onTampak)
    }
  }, [])

  return <canvas ref={ref} className={`latar${redup ? ' redup' : ''}`} aria-hidden="true" />
}
