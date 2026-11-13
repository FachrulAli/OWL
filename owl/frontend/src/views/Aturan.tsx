import { useT } from '../lib/i18n'
import type { Catalog } from '../lib/types'

/**
 * Katalog aturan dan bobotnya, ditampilkan apa adanya dari backend.
 *
 * Halaman ini ada karena satu alasan: skor yang tidak dapat dibuka adalah
 * skor yang tidak dapat dipercaya. Juri, analis SOC, dan pemeriksa dapat
 * melihat seluruh aturan beserta bobot dan tingkat keyakinannya di sini.
 */
export function Aturan({ catalog }: { catalog: Catalog | null }) {
  const { t, category, word, ruleTitle, ruleDetail } = useT()
  if (!catalog) return <div className="card"><p className="empty">{t('rules.loading')}</p></div>

  const byCat = new Map<string, typeof catalog.rules>()
  for (const r of catalog.rules) {
    byCat.set(r.category, [...(byCat.get(r.category) ?? []), r])
  }

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="kicker">{t('rules.weights')}</div>
          {Object.entries(catalog.weights).map(([c, w]) => (
            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span className="muted">{category(c)}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{w}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="kicker">{t('rules.severity')}</div>
          {Object.entries(catalog.severity).map(([s, v]) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span className={`sev ${s}`}>{s}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{v}</span>
            </div>
          ))}
          <p className="muted" style={{ marginTop: 10 }}>
            {t('rules.saturation', { n: catalog.saturation })}
          </p>
        </div>
        <div className="card">
          <div className="kicker">{t('rules.thresholds')}</div>
          <p className="muted">{t('rules.th1', { n: catalog.thresholds.medium - 1 })}</p>
          <p className="muted">
            {t('rules.th2', { a: catalog.thresholds.medium, b: catalog.thresholds.high - 1 })}
          </p>
          <p className="muted">
            {t('rules.th3', { a: catalog.thresholds.high, b: catalog.thresholds.critical - 1 })}
          </p>
          <p className="muted">{t('rules.th4', { n: catalog.thresholds.critical })}</p>
        </div>
      </div>

      {[...byCat.entries()].map(([cat, rs]) => (
        <div key={cat} className="card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 0' }}>
            <div className="kicker" style={{ marginBottom: 2 }}>
              {category(cat)} ·{' '}
              {t('rules.weightOf', { n: catalog.weights[cat as keyof typeof catalog.weights] })}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('rules.col.id')}</th><th>{t('rules.col.rule')}</th>
                <th>{t('rules.col.severity')}</th><th>{t('rules.col.mitre')}</th>
                <th>{t('rules.col.confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {rs.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{r.id}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ruleTitle(r.id, r.title)}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                      {ruleDetail(r.id, r.detail)}
                    </div>
                    {r.corroborate && (
                      <div className="flag" style={{ marginTop: 5 }}>{t('rules.corroborate')}</div>
                    )}
                  </td>
                  <td><span className={`sev ${r.severity}`}>{r.severity}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.mitre || '—'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{word(r.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
