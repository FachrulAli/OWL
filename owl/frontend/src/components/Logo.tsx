/** Lambang OWL: wajah burung hantu geometris di dalam kontur perisai. */
export function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-label="OWL" role="img">
      <path d="M36 3 L62 11 V33 C62 49 50 60 36 67 C22 60 10 49 10 33 V11 Z"
            stroke="#14B8A6" strokeWidth="2" fill="rgba(20,184,166,.06)" />
      <path d="M23 17 L20 6 L33 14 Z" fill="#0E2A4E" stroke="#14B8A6" strokeWidth="1.5" />
      <path d="M49 17 L52 6 L39 14 Z" fill="#0E2A4E" stroke="#14B8A6" strokeWidth="1.5" />
      <circle cx="28" cy="39" r="11" stroke="#F59E0B" strokeWidth="2" fill="none" />
      <circle cx="28" cy="39" r="5.5" fill="#F59E0B" />
      <circle cx="28" cy="39" r="2.2" fill="#0B1F3A" />
      <circle cx="44" cy="39" r="11" stroke="#F59E0B" strokeWidth="2" fill="none" />
      <circle cx="44" cy="39" r="5.5" fill="#F59E0B" />
      <circle cx="44" cy="39" r="2.2" fill="#0B1F3A" />
      <path d="M36 47 L33 53 L39 53 Z" fill="#14B8A6" />
    </svg>
  )
}
