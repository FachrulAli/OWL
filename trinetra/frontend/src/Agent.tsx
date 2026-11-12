import { useEffect, useState } from "react";
import { api, Entity } from "./lib/api";
import { fmtTime, silence } from "./lib/util";
import { useLang } from "./lib/lang";
import { DOC } from "./lib/docText";
import { Ico, PlatformMark } from "./components/Ico";

const APK = "/trinetra-agent.apk";

/**
 * Teks statis kami sendiri yang memuat penebalan. Bukan masukan pengguna dan
 * tidak pernah berasal dari jaringan, jadi aman dirender sebagai HTML.
 */
const H = ({ t, className }: { t: string; className?: string }) => (
  <p className={className} dangerouslySetInnerHTML={{ __html: t }} />
);

/**
 * Halaman pemasangan agent MTD.
 *
 * Ada karena kesenjangan yang nyata: seluruh sistem bergantung pada agent di
 * perangkat, tetapi tidak ada satu pun tempat untuk mengunduhnya atau
 * mengetahui cara memasangnya. Halaman ini sekaligus lembar persetujuan,
 * karena pemegang HP membaca apa yang dikumpulkan sebelum memasang.
 */
export default function Agent(
  { onExit, onConsole }: { onExit: () => void; onConsole: () => void },
) {
  const [lang, setLang] = useLang();
  const t = DOC(lang).agent;
  const nav = DOC(lang).nav;
  const [live, setLive] = useState<Entity[]>([]);

  useEffect(() => {
    const load = () => api.entities()
      .then((e) => setLive(e.filter((x) => x.live_agent)))
      .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

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
          <H className="doc-lede" t={t.lede1} />
          <H className="doc-lede" t={t.lede2} />
        </div>
        <div className="doc-head-side">
          <div className="dl-card">
            <a className="dl-btn" href={APK} download>
              <span className="dl-icon"><Ico name="download" className="" /></span>
              <span className="dl-text">
                <span className="dl-main">{t.dlMain}</span>
                <span className="dl-meta">{t.dlMeta}</span>
              </span>
              <PlatformMark name="android" className="pf-mark android" />
            </a>
            <div className="dl-btn soon" aria-disabled="true">
              <span className="dl-icon"><Ico name="download" className="" /></span>
              <span className="dl-text">
                <span className="dl-main">{t.iosMain}</span>
                <span className="dl-meta">{t.iosMeta}</span>
              </span>
              <span className="soon-tag">{t.iosSoon}</span>
              <PlatformMark name="apple" className="pf-mark apple" />
            </div>
            <H className="dl-side" t={t.dlNote} />
          </div>
        </div>
      </header>

      {/* ── agent yang sedang aktif ── */}
      <section className="doc-sec">
        <div className="doc-sec-label">
          <h2><Ico name="radar" />{t.liveH}<span className="doc-count">{live.length}</span></h2>
          <p className="doc-sub">{t.liveSub}</p>
        </div>
        <div className="doc-sec-body">
          {live.length === 0 ? (
            <div className="live-empty">{t.liveEmpty}</div>
          ) : (
            <div className="live-list">
              {live.map((e) => {
                const sil = silence(e.last_seen ?? e.last_event);
                return (
                  <div key={e.entity_id} className="live-row">
                    <div>
                      <b>{e.holder_rank} {e.holder_name}</b>
                      <div className="dev-sub">
                        <span className="mono">{e.entity_id}</span>
                        <span>{e.device_model}</span>
                        <span>Android {e.os_version}</span>
                      </div>
                    </div>
                    <div className="live-right">
                      <span className={`dev-tag ${sil.stale ? "" : "live"}`}>
                        {!sil.stale && <span className="live-dot" />}
                        {sil.stale ? sil.label : t.sending}
                      </span>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {fmtTime(e.last_seen ?? e.last_event)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── langkah pemasangan ── */}
      <section className="doc-sec">
        <div className="doc-sec-label">
          <h2><Ico name="steps" />{t.stepsH}</h2>
          <p className="doc-sub">{t.stepsSub}</p>
        </div>
        <div className="doc-sec-body">
          <ol className="steps">
            {t.steps.map((s, i) => (
              <li key={i}>
                <h3>{s.h}</h3>
                <H t={s.p} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── izin dan alasannya ── */}
      <section className="doc-sec">
        <div className="doc-sec-label">
          <h2><Ico name="lock" />{t.permH}</h2>
          <p className="doc-sub">{t.permSub}</p>
        </div>
        <div className="doc-sec-body">
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>{t.permCols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {t.perms.map((p) => (
                  <tr key={p.api}>
                    <td>
                      <b>{p.n}</b>
                      <div className="doc-id">{p.api}</div>
                    </td>
                    <td dangerouslySetInnerHTML={{ __html: p.u }} />
                    <td className="doc-fp-cell">{p.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── privasi ── */}
      <section className="doc-sec">
        <div className="doc-sec-label">
          <h2><Ico name="shield" />{t.privH}</h2>
          <p className="doc-sub">{t.privSub}</p>
        </div>
        <div className="doc-sec-body">
          <div className="privacy">
            <div className="privacy-col yes">
              <h3><Ico name="shield" className="doc-ico" />{t.privYes}</h3>
              <ul>{t.yes.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="privacy-col no">
              <h3><Ico name="lock" className="doc-ico" />{t.privNo}</h3>
              <ul>{t.no.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
          <div className="doc-note" style={{ marginTop: 16 }}
            dangerouslySetInnerHTML={{ __html: t.privNote }} />
        </div>
      </section>

      {/* ── batas yang diakui ── */}
      <section className="doc-sec">
        <div className="doc-sec-label">
          <h2><Ico name="alert" />{t.limH}</h2>
          <p className="doc-sub">{t.limSub}</p>
        </div>
        <div className="doc-sec-body">
          <div className="limits">
            {t.lims.map((x) => (
              <div className="limit-card" key={x.h}>
                <h3>{x.h}</h3>
                <p>{x.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="doc-foot" dangerouslySetInnerHTML={{ __html: t.foot }} />
    </div>
  );
}
