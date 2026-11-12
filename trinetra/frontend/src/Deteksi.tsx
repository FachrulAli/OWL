import { useEffect, useMemo, useState } from "react";
import { api, SigmaCatalog, SigmaRule, IndicatorStatus } from "./lib/api";
import { CAT_LABEL, STAGE_LABEL, RESPONSE_LABEL, fmtSpan, riskColor } from "./lib/util";
import { useLang } from "./lib/lang";
import { DOC } from "./lib/docText";
import { Ico } from "./components/Ico";

/**
 * Halaman "Deteksi sebagai Kode".
 *
 * Alasan halaman ini ada: aturan deteksi yang hanya hidup di dalam kode tidak
 * bisa diaudit oleh orang yang harus mempercayainya. Di sini setiap aturan
 * ditampilkan apa adanya: kondisinya, bobotnya, false positive yang diakui,
 * dan aturan atomik mana yang menyusun setiap rantai.
 */
export default function Deteksi(
  { onExit, onConsole }: { onExit: () => void; onConsole: () => void },
) {
  const [lang, setLang] = useLang();
  const t = DOC(lang).det;
  const nav = DOC(lang).nav;

  const [cat, setCat] = useState<SigmaCatalog | null>(null);
  const [ioc, setIoc] = useState<IndicatorStatus | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.sigma().then(setCat).catch(() => {});
    api.indicators().then(setIoc).catch(() => {});
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, SigmaRule>();
    cat?.atomic.forEach((r) => m.set(r.id, r));
    return m;
  }, [cat]);

  const corrSorted = useMemo(
    () => (cat?.correlation ?? []).slice().sort((a, b) => b.severity - a.severity), [cat]);
  const atomSorted = useMemo(
    () => (cat?.atomic ?? []).slice().sort((a, b) => b.severity - a.severity), [cat]);

  return (
    <div className="doc">
      <div className="doc-top">
        <button className="pg-nav" onClick={onExit}>
          <span className="ix">←</span> {nav.home}
        </button>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="lang-sw" role="group" aria-label="Language">
            <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
            <button aria-pressed={lang === "id"} onClick={() => setLang("id")}>ID</button>
          </div>
          <button className="pg-nav" onClick={onConsole}>
            {nav.console} <span className="ix">→</span>
          </button>
        </div>
      </div>

      <header className="doc-head">
        <div className="doc-head-main">
          <div className="doc-kicker">{t.kicker}</div>
          <h1>{t.title}</h1>
          <p className="doc-lede" dangerouslySetInnerHTML={{ __html: t.lede1 }} />
          <p className="doc-lede" dangerouslySetInnerHTML={{ __html: t.lede2 }} />
        </div>
        <div className="doc-head-side">
          <div className="doc-note" dangerouslySetInnerHTML={{ __html: t.note }} />
        </div>
      </header>

      {/* ───────── correlation rules ───────── */}
      <section className="doc-sec">
        <div className="doc-sec-label">
          <h2><Ico name="link" />{t.corrH}<span className="doc-count">{corrSorted.length}</span></h2>
          <p className="doc-sub" dangerouslySetInnerHTML={{ __html: t.corrSub }} />
        </div>
        <div className="doc-sec-body">
          <div className="doc-grid">
            {corrSorted.map((c) => (
              <article key={c.id} className="doc-card">
                <div className="doc-card-h">
                  <span className="corr-badge" data-type={c.type}>
                    {(t.badges as Record<string, string>)[c.type ?? ""] ?? c.type}
                  </span>
                  <span className="doc-sev" style={{ color: riskColor(c.severity) }}>
                    {c.severity}
                  </span>
                </div>
                <h3>{c.title}</h3>
                <div className="doc-id">{c.id}</div>
                <p className="doc-desc">{c.description}</p>

                <div className="doc-chain">
                  {(c.rules ?? []).map((rid, i) => {
                    const r = byId.get(rid);
                    return (
                      <span key={`${rid}-${i}`} className="doc-link-wrap">
                        {i > 0 && (
                          <span className="doc-arrow">
                            {c.type === "temporal_ordered" ? "→" : "+"}
                          </span>
                        )}
                        <button className="rule-chip" aria-expanded={open === rid}
                          onClick={() => setOpen(open === rid ? null : rid)}
                          title={r?.title ?? rid}>
                          {r?.stage ? (STAGE_LABEL[r.stage] ?? r.stage) : rid}
                        </button>
                      </span>
                    );
                  })}
                </div>

                <div className="doc-facts">
                  <span>{t.window} <b>{fmtSpan(c.timespan_s ?? 0)}</b></span>
                  {c.type === "event_count" && <span>{t.atLeast} <b>{c.count_gte}×</b></span>}
                  <span>{t.groupedBy} <b>{(c.group_by ?? []).join(", ")}</b></span>
                  <span>→ <b>{RESPONSE_LABEL[c.response ?? ""] ?? c.response}</b></span>
                </div>

                <div className="doc-tags">
                  <span className="cat-chip">{CAT_LABEL[c.category] ?? c.category}</span>
                  {(c.mitre ?? []).map((m) => <span className="cat-chip" key={m}>{m}</span>)}
                </div>

                {(c.rules ?? []).includes(open ?? "") && byId.get(open!) && (
                  <Detail rule={byId.get(open!)!} t={t} />
                )}
              </article>
            ))}
            {corrSorted.length === 0 && <div className="muted">{t.loading}</div>}
          </div>
        </div>
      </section>

      {/* ───────── atomic rules ───────── */}
      <section className="doc-sec">
        <div className="doc-sec-label">
          <h2><Ico name="rules" />{t.atomH}<span className="doc-count">{atomSorted.length}</span></h2>
          <p className="doc-sub">{t.atomSub}</p>
        </div>
        <div className="doc-sec-body">
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>{t.atomCols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {atomSorted.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.title}</b>
                      <div className="doc-id">{r.id}</div>
                    </td>
                    <td className="muted">{r.stage ? (STAGE_LABEL[r.stage] ?? r.stage) : "—"}</td>
                    <td><b style={{ color: riskColor(r.severity * 1.6) }}>{r.severity}</b></td>
                    <td>{(r.fields ?? []).map((f) => (
                      <span className="field-chip" key={f}>{f}</span>))}</td>
                    <td className="doc-fp-cell">
                      {(r.falsepositives ?? []).length
                        ? (r.falsepositives ?? []).join("; ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ───────── lapisan intel ───────── */}
      <section className="doc-sec">
        <div className="doc-sec-label">
          <h2><Ico name="shield" />{t.iocH}</h2>
          {ioc && (
            <p className="doc-sub">
              <b>{ioc.indicators.toLocaleString(lang === "id" ? "id-ID" : "en-US")}</b>{" "}
              {t.iocSub1} <b>{ioc.campaigns.length}</b>{" "}
              <span dangerouslySetInnerHTML={{ __html: t.iocSub2 }} />
            </p>
          )}
        </div>
        <div className="doc-sec-body">
          {ioc ? (
            <>
              <div className="doc-tags">
                {ioc.campaigns.map((c) => <span className="cat-chip" key={c}>{c}</span>)}
              </div>
              <div className="doc-facts" style={{ marginTop: 14 }}>
                {Object.entries(ioc.tables).map(([k, v]) => (
                  <span key={k}>{k} <b>{v}</b></span>
                ))}
              </div>
              <div className="doc-sources">
                {ioc.sources.map((s) => (
                  <div key={s.name}>
                    <b className="mono">{s.name}</b>, {t.license} {s.license}
                  </div>
                ))}
              </div>
              <div className="doc-note" style={{ marginTop: 14 }}>{ioc.catatan}</div>
            </>
          ) : <div className="muted">{t.loadingIoc}</div>}
        </div>
      </section>

      <footer className="doc-foot">
        <div>{t.format}: {cat?.format ?? "Sigma specification v2 (public domain)"}</div>
        <div className="muted">{cat?.note ?? ""}</div>
        <div className="muted" style={{ marginTop: 10 }}
          dangerouslySetInnerHTML={{ __html: t.footRepo }} />
      </footer>
    </div>
  );
}

/** Rincian satu aturan atomik, dibuka dari kartu correlation rule. */
function Detail({ rule, t }: { rule: SigmaRule; t: ReturnType<typeof DOC>["det"] }) {
  return (
    <div className="doc-detail">
      <div className="doc-detail-h">
        <b>{rule.title}</b>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
          {t.weight} {rule.severity}
        </span>
      </div>
      <p>{rule.description}</p>
      {rule.condition && <div className="doc-cond">condition: {rule.condition}</div>}
      <div className="doc-facts">
        {(rule.fields ?? []).map((f) => <span className="field-chip" key={f}>{f}</span>)}
      </div>
      {(rule.falsepositives ?? []).length > 0 && (
        <div className="doc-fp">
          <b>{t.becauseOf}</b> {(rule.falsepositives ?? []).join("; ")}
        </div>
      )}
    </div>
  );
}
