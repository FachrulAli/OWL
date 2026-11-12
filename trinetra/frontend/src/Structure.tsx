import { useEffect, useState } from "react";
import { LEADERSHIP, STAF_UMUM, KOTAMA, PUSSIBERAD, KODAM } from "./data/tniad";

type Lang = "en" | "id";
const getLang = (): Lang => {
  try { return (localStorage.getItem("trinetra_lang") as Lang) || "en"; } catch { return "en"; }
};

const T = {
  en: {
    back: "← Home", console: "Open console →",
    kicker: "Reference · order of battle",
    title: "Indonesian Army", title2: "command structure",
    lede: "How the TNI Angkatan Darat is organised — from the Chief of Staff down to the 21 territorial commands TRINETRA watches over. Reflects the August 2025 expansion from 15 to 21 Kodam.",
    chain: "Chain of command", staff: "General staff — Mabesad",
    kotama: "Main commands — Kotama & centres",
    cyber: "Where TRINETRA lives",
    kodamH: "Territorial commands — 21 Kodam",
    kodamSub: "Each Kodam is a node on the command map. Six were raised in the 2025 expansion.",
    cols: { n: "No.", name: "Kodam", hq: "Markas", terr: "Wilayah" },
    neu: "NEW 2025", open: "View on command map →",
    disclaimer: "Reference compiled from TNI AD and public reporting (2025–2026). Leadership and territorial boundaries shift; verify against official sources before operational use.",
  },
  id: {
    back: "← Beranda", console: "Buka console →",
    kicker: "Referensi · struktur kekuatan",
    title: "Struktur Komando", title2: "TNI Angkatan Darat",
    lede: "Bagaimana TNI Angkatan Darat tersusun, dari Kepala Staf hingga 21 komando kewilayahan yang dipantau TRINETRA. Mencerminkan perluasan Agustus 2025 dari 15 menjadi 21 Kodam.",
    chain: "Rantai komando", staff: "Staf Umum · Mabesad",
    kotama: "Komando Utama · Kotama dan pusat pembinaan",
    cyber: "Rumah TRINETRA",
    kodamH: "Komando kewilayahan · 21 Kodam",
    kodamSub: "Tiap Kodam adalah node di peta komando. Enam di antaranya dibentuk pada perluasan 2025.",
    cols: { n: "No.", name: "Kodam", hq: "Markas", terr: "Wilayah" },
    neu: "BARU 2025", open: "Lihat di peta komando →",
    disclaimer: "Referensi dirangkum dari TNI AD dan pemberitaan publik tahun 2025 dan 2026. Kepemimpinan dan batas wilayah dapat berubah; verifikasi ke sumber resmi sebelum penggunaan operasional.",
  },
};

export default function Structure({ onExit, onConsole }: { onExit: () => void; onConsole: () => void }) {
  const [lang, setLang] = useState<Lang>(getLang);
  const t = T[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("trinetra_lang", lang); } catch { /* ignore */ }
  }, [lang]);

  return (
    <div className="st">
      <div className="lp-nav scrolled">
        <div className="wm" onClick={onExit} style={{ cursor: "pointer" }}>
          <div className="eye-sm" /><h1>TRINETRA</h1>
        </div>
        <nav className="links"><a onClick={onExit} style={{ cursor: "pointer" }}>{t.back}</a></nav>
        <span className="spacer" />
        <div className="lang-toggle" role="group" aria-label="Language">
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          <button className={lang === "id" ? "on" : ""} onClick={() => setLang("id")}>ID</button>
        </div>
        <a className="lp-cta-btn" onClick={onConsole}>{t.console}</a>
      </div>

      <header className="st-hero">
        <div className="st-kicker">{t.kicker}</div>
        <h1>{t.title} <span>{t.title2}</span></h1>
        <p>{t.lede}</p>
      </header>

      {/* chain of command */}
      <section className="st-sec">
        <div className="st-h">{t.chain}</div>
        <div className="st-chain">
          <div className="st-top">
            <div className="st-tier-tag">{LEADERSHIP.head}</div>
            <div className="st-lead">{LEADERSHIP.holder}</div>
            <div className="st-lead-note">{LEADERSHIP.holderNote} · {LEADERSHIP.hq}</div>
          </div>
          <div className="st-conn" />
          <div className="st-staff">
            {STAF_UMUM.map((s) => (
              <div className="st-staff-chip" key={s.acr} title={s.name}>
                <b>{s.acr}</b><span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* kotama */}
      <section className="st-sec">
        <div className="st-h">{t.kotama}</div>
        <div className="st-grid">
          {KOTAMA.map((k) => (
            <div className="st-card" key={k.acr}>
              <div className="st-card-top"><b>{k.acr}</b>{k.hq && <span className="st-hq">{k.hq}</span>}</div>
              <div className="st-card-name">{k.name}</div>
              <div className="st-card-role">{k.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* pussiberad highlight */}
      <section className="st-sec">
        <div className="st-h">{t.cyber}</div>
        <div className="st-cyber">
          <div className="st-cyber-eye" aria-hidden="true" />
          <div>
            <div className="st-card-top"><b style={{ fontSize: 15 }}>{PUSSIBERAD.acr}</b><span className="st-hq">{PUSSIBERAD.parent}</span></div>
            <div className="st-card-name" style={{ fontSize: 16 }}>{PUSSIBERAD.name}</div>
            <p className="st-cyber-role">{PUSSIBERAD.role}</p>
            <a className="lp-cta-btn" onClick={onConsole} style={{ marginTop: 6, display: "inline-block" }}>{t.open}</a>
          </div>
        </div>
      </section>

      {/* 21 kodam */}
      <section className="st-sec">
        <div className="st-h">{t.kodamH}</div>
        <p className="st-sub">{t.kodamSub}</p>
        <div className="st-kodam-grid">
          {KODAM.map((k) => (
            <button className={`st-kodam${k.isNew ? " is-new" : ""}`} key={k.id} onClick={onConsole} title={t.open}>
              <span className="st-num">{k.numeral}</span>
              <span className="st-kd-main">
                <span className="st-kd-name">{k.name}{k.isNew && <i className="st-badge">{t.neu}</i>}</span>
                <span className="st-kd-meta">{k.hq} · {k.territory}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <footer className="st-foot">{t.disclaimer}</footer>
    </div>
  );
}
