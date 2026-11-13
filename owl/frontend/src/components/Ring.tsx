import { scoreColor } from '../lib/api'

/** Cincin skor 0 sampai 100. Warnanya mengikuti ambang keputusan. */
export function Ring({ score, size = 104 }: { score: number | null; size?: number }) {
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100
  const color = score === null ? '#64748B' : scoreColor(score)
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="rgba(148,163,184,.16)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${c * pct} ${c}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dasharray .6s ease, stroke .3s ease' }} />
      </svg>
      <div className="val" style={{ color }}>{score === null ? '—' : score.toFixed(0)}</div>
      <div className="unit">/ 100</div>
    </div>
  )
}
