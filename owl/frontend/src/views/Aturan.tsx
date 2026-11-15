import { useState } from 'react'
import { Cip, Ikon } from '../components/Ui'
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
  const { t, lang, category, word, ruleTitle, ruleDetail } = useT()
  const [q, setQ] = useState('')
  const [kat, setKat] = useState<string>('semua')
  const [penentu, setPenentu] = useState(false)
  if (!catalog) return <div className="card"><p className="empty">{t('rules.loading')}</p></div>

  const cari = q.trim().toLowerCase()
  const lolos = (r: (typeof catalog.rules)[number]) =>
    (kat === 'semua' || r.category === kat)
    && (!penentu || r.decisive)
    && (!cari || [r.id, r.title, r.detail, r.mitre, ruleTitle(r.id, r.title)].some((v) => (v ?? '').toLowerCase().includes(cari)))
  const byCat = new Map<string, typeof catalog.rules>()
  for (const r of catalog.rules.filter(lolos)) {
    byCat.set(r.category, [...(byCat.get(r.category) ?? []), r])
  }
  const semuaKat = [...new Set(catalog.rules.map((r) => r.category))]
  const jumlah = [...byCat.values()].reduce((a, b) => a + b.length, 0)

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

      <div className="bar-alat bar-saring">
        <div className="cari-kotak lebar">
          <Ikon nama="cari" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder={lang === 'id' ? 'Cari kode aturan, judul, atau teknik MITRE' : 'Search rule code, title, or MITRE technique'}
                 aria-label={lang === 'id' ? 'Cari aturan' : 'Search rules'} />
        </div>
        <div className="cip-baris" role="group" aria-label={lang === 'id' ? 'Kategori' : 'Category'}>
          <Cip aktif={kat === 'semua'} onKlik={() => setKat('semua')} n={catalog.rules.length}>{lang === 'id' ? 'Semua' : 'All'}</Cip>
          {semuaKat.map((c) => (
            <Cip key={c} aktif={kat === c} onKlik={() => setKat(kat === c ? 'semua' : c)}
                 n={catalog.rules.filter((r) => r.category === c).length}>{category(c)}</Cip>
          ))}
          <Cip aktif={penentu} nada="merah" onKlik={() => setPenentu(!penentu)}>{lang === 'id' ? 'Aturan penentu' : 'Decisive rules'}</Cip>
        </div>
      </div>
      {jumlah === 0 && <div className="card"><p className="empty">{lang === 'id' ? 'Tidak ada aturan yang cocok.' : 'No rule matches.'}</p></div>}

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
                    {r.decisive && (
                      <div className="muted" style={{ marginTop: 5, fontSize: 12 }}>
                        <span className="penentu">{t('gate.decisive')}</span>{' '}
                        {t('gate.decisiveNote')}
                      </div>
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
