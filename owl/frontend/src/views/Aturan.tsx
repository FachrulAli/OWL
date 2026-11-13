import { CATEGORY_LABEL } from '../lib/api'
import type { Catalog } from '../lib/types'

/**
 * Katalog aturan dan bobotnya, ditampilkan apa adanya dari backend.
 *
 * Halaman ini ada karena satu alasan: skor yang tidak dapat dibuka adalah
 * skor yang tidak dapat dipercaya. Juri, analis SOC, dan pemeriksa dapat
 * melihat seluruh aturan beserta bobot dan tingkat keyakinannya di sini.
 */
export function Aturan({ catalog }: { catalog: Catalog | null }) {
  if (!catalog) return <div className="card"><p className="empty">Memuat katalog…</p></div>

  const byCat = new Map<string, typeof catalog.rules>()
  for (const r of catalog.rules) {
    byCat.set(r.category, [...(byCat.get(r.category) ?? []), r])
  }

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="kicker">Bobot kategori</div>
          {Object.entries(catalog.weights).map(([c, w]) => (
            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span className="muted">{CATEGORY_LABEL[c] ?? c}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{w}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="kicker">Severitas</div>
          {Object.entries(catalog.severity).map(([s, v]) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span className={`sev ${s}`}>{s}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{v}</span>
            </div>
          ))}
          <p className="muted" style={{ marginTop: 10 }}>
            Satu kategori mencapai bobot penuhnya pada jumlah severitas {catalog.saturation}.
          </p>
        </div>
        <div className="card">
          <div className="kicker">Ambang keputusan</div>
          <p className="muted">0 sampai {catalog.thresholds.medium - 1}: lolos</p>
          <p className="muted">{catalog.thresholds.medium} sampai {catalog.thresholds.high - 1}: lolos dengan MFA</p>
          <p className="muted">{catalog.thresholds.high} sampai {catalog.thresholds.critical - 1}: akses terbatas, dan ditolak untuk sistem terklasifikasi</p>
          <p className="muted">{catalog.thresholds.critical} ke atas: ditolak dan dikarantina di mana pun</p>
        </div>
      </div>

      {[...byCat.entries()].map(([cat, rs]) => (
        <div key={cat} className="card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 0' }}>
            <div className="kicker" style={{ marginBottom: 2 }}>
              {CATEGORY_LABEL[cat] ?? cat} · bobot {catalog.weights[cat as keyof typeof catalog.weights]}
            </div>
          </div>
          <table>
            <thead>
              <tr><th>Id</th><th>Aturan</th><th>Severitas</th><th>MITRE</th><th>Keyakinan</th></tr>
            </thead>
            <tbody>
              {rs.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{r.id}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{r.detail}</div>
                    {r.corroborate && (
                      <div className="flag" style={{ marginTop: 5 }}>
                        turun satu tingkat jika menyala sendirian
                      </div>
                    )}
                  </td>
                  <td><span className={`sev ${r.severity}`}>{r.severity}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.mitre || '—'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
