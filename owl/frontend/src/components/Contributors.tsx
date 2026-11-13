import { scoreColor } from '../lib/api'
import type { Finding } from '../lib/types'

/**
 * Rincian kontributor skor. Jumlah poin di sini selalu sama dengan skor
 * akhir perangkat; sifat itu dikunci oleh uji di tests/test_scoring.py.
 */
export function Contributors({ findings, max }: { findings: Finding[]; max?: number }) {
  if (findings.length === 0) {
    return <p className="muted" style={{ marginTop: 10 }}>Tidak ada temuan pada laporan terakhir.</p>
  }
  const top = Math.max(...findings.map((f) => f.points), 1)
  const list = max ? findings.slice(0, max) : findings
  return (
    <div className="contrib">
      {list.map((f) => (
        <div key={f.rule_id} className="contrib-row" title={f.detail}>
          <span className="rid">{f.rule_id}</span>
          <span>
            <span style={{ fontSize: 13 }}>{f.title}</span>{' '}
            <span className={`sev ${f.severity}`}>{f.severity}</span>
            {f.downgraded && <span className="flag"> diturunkan, berdiri sendiri</span>}
            <span className="bar" style={{ marginTop: 6 }}>
              <span style={{ width: `${(f.points / top) * 100}%`, background: scoreColor(f.points * 3) }} />
            </span>
            {f.evidence.length > 0 && <span className="ev">{f.evidence.join(' · ')}</span>}
          </span>
          <span className="pts" style={{ color: scoreColor(f.points * 3) }}>+{f.points.toFixed(1)}</span>
        </div>
      ))}
      {max && findings.length > max && (
        <p className="muted">dan {findings.length - max} temuan lain</p>
      )}
    </div>
  )
}
