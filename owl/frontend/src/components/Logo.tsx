import mark from '../assets/owl-mark.png'
import lockup from '../assets/owl-lockup.png'

/**
 * Lambang OWL: wajah burung hantu geometris di dalam kontur perisai.
 *
 * Berkasnya PNG beralfa, dipotong dari lambang resmi dan latar hitamnya
 * dibuang, sehingga lambang yang sama dipakai di bilah atas, layar kunci,
 * halaman depan, dan favicon tanpa digambar ulang.
 */
export function Logo({ size = 38 }: { size?: number }) {
  return <img className="logo-mark" src={mark} width={size} height={size} alt="OWL" />
}

/** Lambang beserta kata OWL dan tagline, untuk halaman depan dan layar kunci. */
export function Lockup({ width = 300 }: { width?: number }) {
  return (
    <img
      className="logo-lockup"
      src={lockup}
      width={width}
      alt="OWL — On Device Watch Layer"
    />
  )
}
