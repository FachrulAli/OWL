import { useEffect, useRef, useState } from "react";
import { setLang as setLangShared } from "./lib/lang";
import { api, Stats, Entity, Node, Case } from "./lib/api";
import { C, Lang } from "./i18n";
import { RadarEye, Sparkline, TierDiagram, CapIcon, EyeGlyph, StdMark } from "./components/LandingVisuals";

function useReveal(dep: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

function useLiveNumbers() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [epsHist, setEpsHist] = useState<number[]>([]);
  useEffect(() => {
    const load = () => {
      api.stats().then((s) => {
        setStats(s);
        setEpsHist((h) => [...h, s.eps].slice(-40));
      }).catch(() => {});
      api.entities().then(setEntities).catch(() => {});
      api.nodes().then(setNodes).catch(() => {});
      api.cases().then(setCases).catch(() => {});
    };
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, []);
  return { stats, entities, nodes, cases, epsHist };
}

function getInitialLang(): Lang {
  try {
    const v = localStorage.getItem("trinetra_lang");
    if (v === "en" || v === "id") return v;
  } catch { /* ignore */ }
  return "en"; // visitors default to English
}

const RAIL = [
  { id: "gap", ix: "01", k: "approach" as const },
  { id: "eyes", ix: "02", k: "capabilities" as const },
  { id: "arch", ix: "03", k: "architecture" as const },
  { id: "standar", ix: "04", k: "standards" as const },
];

export default function Landing({ onEnter, onStructure, onRules }:
  { onEnter: () => void; onStructure: () => void; onRules?: () => void }) {
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const [fading, setFading] = useState(false);
  const t = C[lang];
  useReveal(lang);

  // cross-fade the copy when the language changes instead of snapping
  const changeLang = (l: Lang) => {
    if (l === lang) return;
    setFading(true);
    window.setTimeout(() => { setLang(l); setFading(false); }, 200);
  };
  const { stats, entities, nodes, cases, epsHist } = useLiveNumbers();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // highlight the rail item for whichever section is centred in view
  useEffect(() => {
    const els = RAIL.map((r) => document.getElementById(r.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { threshold: 0.5 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    setLangShared(lang);   // siarkan agar console & halaman lain ikut berubah
  }, [lang]);

  const openCases = cases.filter((c) => c.status !== "closed").length;
  const num = (v: number) => (v || v === 0 ? v : "—");

  return (
    <div className="lp" style={{ transition: "opacity .22s ease", opacity: fading ? 0.25 : 1 }}
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 24)}>
      {/* ── nav ── */}
      <div ref={navRef} className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="wm" onClick={(e) => (e.currentTarget.closest(".lp") as HTMLElement)?.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="eye-sm" />
          <h1>TRINETRA</h1>
        </div>
        <span className="spacer" />
        <div className="lang-toggle" role="group" aria-label="Language">
          <button className={lang === "en" ? "on" : ""} onClick={() => changeLang("en")}>EN</button>
          <button className={lang === "id" ? "on" : ""} onClick={() => changeLang("id")}>ID</button>
        </div>
        <a className="lp-cta-btn" onClick={onEnter}>{t.nav.openConsole}</a>
      </div>

      {/* ── bottom-right section navigator (moved from the top bar) ── */}
      <nav className="lp-rail" aria-label="Sections">
        {[
          ...RAIL.map((r) => ({ id: r.id, ix: r.ix, label: t.nav[r.k], route: "" })),
          // Katalog aturan deteksi: ditaruh di navigasi utama dengan sengaja,
          // keterbukaan logika deteksi adalah bagian dari argumen produk,
          // bukan lampiran teknis yang disembunyikan.
          { id: "deteksi", ix: "↗", label: lang === "en" ? "Detection rules" : "Aturan deteksi", route: "/deteksi" },
          { id: "agent", ix: "↓", label: lang === "en" ? "Install agent" : "Pasang agent", route: "/agent" },
          { id: "struktur", ix: "↗", label: lang === "en" ? "Army structure" : "Struktur TNI AD", route: "/struktur" },
        ].map((it) => (
          <a key={it.id} href={it.route ? `#${it.route}` : `#${it.id}`}
            className={`${it.route ? "rt " : ""}${active === it.id ? "on" : ""}`.trim()}
            onClick={it.route
              ? (e) => {
                  e.preventDefault();
                  if (it.id === "deteksi" || it.id === "agent") {
                    window.location.hash = it.route;
                  } else onStructure();
                }
              : () => setActive(it.id)}>
            <span className="lbl">{it.label}</span>
            <span className="ix">{it.ix}</span>
            <span className="tick" />
          </a>
        ))}
      </nav>

      {/* ── hero ── */}
      <header className="lp-hero">
        <div className="lp-hero-grid">
          <div className="lp-hero-text">
            <span className="eyebrow">{t.hero.eyebrow}</span>
            <h2>{t.hero.lead}<span className="hl">{t.hero.hl}</span></h2>
            <p className="sub">{t.hero.sub}</p>
            <p className="quote">{t.hero.quote}</p>
            <div className="lp-hero-actions">
              <a className="lp-cta-btn" onClick={onEnter}>{t.hero.ctaPrimary}</a>
              <a className="lp-cta-btn ghost" href="#arch">{t.hero.ctaGhost}</a>
            </div>
          </div>
          <div className="lp-hero-visual"><RadarEye /></div>
        </div>

        <div className="lp-live">
          <div className="cell">
            <span className="live-tag"><span className="dot" /> {t.hero.liveTag}</span>
            <div className="v">{stats ? stats.eps.toFixed(0) : "—"}</div>
            <div className="k">{t.hero.eps}</div>
            <div className="spark-wrap"><Sparkline data={epsHist} /></div>
          </div>
          <div className="cell"><div className="v">{num(entities.length)}</div><div className="k">{t.hero.entities}</div></div>
          <div className="cell"><div className="v">{num(openCases)}</div><div className="k">{t.hero.cases}</div></div>
          <div className="cell"><div className="v">{num(nodes.length)}</div><div className="k">{t.hero.nodes}</div></div>
        </div>
      </header>

      {/* ── 01 the gap ── */}
      <section className="lp-section" id="gap">
        <div className="head reveal">
          <span className="eyebrow">01 · {t.gap.eyebrow}</span>
          <h3>{t.gap.h}</h3>
          <p>{t.gap.p}</p>
        </div>
        <div className="lp-gap reveal">
          <div className="col">
            <div className="col-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /></svg>
            </div>
            <h4>{t.gap.perimeterTitle}</h4>
            {t.gap.perimeter.map((r, i) => (
              <div className="row" key={i}><span className="mk">{String(i + 1).padStart(2, "0")}</span>{r}</div>
            ))}
          </div>
          <div className="col us">
            <div className="col-ico"><EyeGlyph n={1} /></div>
            <h4>{t.gap.usTitle}</h4>
            {t.gap.us.map((r, i) => (
              <div className="row" key={i}><span className="mk">{String(i + 1).padStart(2, "0")}</span>{r}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 three eyes ── */}
      <section className="lp-section alt" id="eyes">
        <div className="head reveal">
          <span className="eyebrow">02 · {t.eyes.eyebrow}</span>
          <h3>{t.eyes.h}</h3>
          <p>{t.eyes.p}</p>
        </div>
        <div className="lp-eyes">
          {t.eyes.cards.map((c, i) => (
            <div className="lp-eye-card reveal" key={i}>
              <div className="eye-ico"><EyeGlyph n={i + 1} /></div>
              <div className="idx">{c.idx}</div>
              <h4>{c.title}</h4>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 03 architecture ── */}
      <section className="lp-section" id="arch">
        <div className="head reveal">
          <span className="eyebrow">03 · {t.arch.eyebrow}</span>
          <h3>{t.arch.h}</h3>
          <p>{t.arch.p}</p>
        </div>
        <div className="lp-arch-grid reveal">
          <div className="lp-arch-diagram">
            <TierDiagram labels={{ t0: "Pusat", t1: "Kodam", t2: "Satuan" }} />
            <div className="flow-legend">
              <span>{t.arch.flow1}</span><span>{t.arch.flow2}</span>
            </div>
          </div>
          <div className="lp-arch-list">
            {t.arch.tiers.map((tr, i) => (
              <div className="arch-item" key={i}>
                <div className="arch-tier">{tr.tier}</div>
                <div>
                  <b>{tr.name}</b>
                  <p>{tr.body}</p>
                  <div className="chips">{tr.chips.map((c) => <span className="cat-chip" key={c}>{c}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 04 capabilities ── */}
      <section className="lp-section alt">
        <div className="head reveal">
          <span className="eyebrow">04 · {t.caps.eyebrow}</span>
          <h3>{t.caps.h}</h3>
          <p>{t.caps.p}</p>
        </div>
        <div className="lp-caps reveal">
          {t.caps.items.map((c) => (
            <div className="lp-cap" key={c.mk}>
              <div className="cap-top"><span className="cap-ico-wrap"><CapIcon id={c.mk} /></span><span className="mk">{c.mk}</span></div>
              <h5>{c.title}</h5>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 standards ── */}
      <section className="lp-section" id="standar">
        <div className="head reveal">
          <span className="eyebrow">05 · {t.standards.eyebrow}</span>
          <h3>{t.standards.h}</h3>
        </div>
        <div className="lp-standards reveal">
          {t.standards.badges.map((b) => (
            <div className="lp-badge" key={b.n}>
              <StdMark name={b.n} />
              <div><div className="n">{b.n}</div><div className="d">{b.d}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* ── cta band + footer (final slide) ── */}
      <div className="lp-end">
      <section className="lp-cta-band">
        <span className="eyebrow" style={{ justifyContent: "center" }}>{t.cta.eyebrow}</span>
        <h3>{t.cta.h}</h3>
        <p>{t.cta.p}</p>
        <div className="cta-spark"><Sparkline data={epsHist} w={320} h={54} /></div>
        <a className="lp-cta-btn" onClick={onEnter} style={{ fontSize: 15, padding: "13px 26px" }}>{t.cta.button}</a>
      </section>

      {/* ── footer ── */}
      <footer className="lp-footer">
        <div className="wm">
          <div className="eye-sm" style={{ width: 22, height: 22 }} />
          <h1>TRINETRA</h1>
        </div>
        <div className="meta">{t.footer.meta1}</div>
        <div className="meta">{t.footer.meta2}</div>
      </footer>
      </div>
    </div>
  );
}
