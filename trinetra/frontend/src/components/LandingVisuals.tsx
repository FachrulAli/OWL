// Inline SVG visuals for the landing page — theme-aware, dependency-free.
import type { ReactNode } from "react";

/* Operator hero: the real night-vision helmet photo with live scan overlays —
   a sweeping scanline, pulsing glow on each glowing optic, and a glass glint,
   so it reads as an operator actively monitoring. Carries the hero visual. */
export function RadarEye() {
  const lenses = [
    { left: "76%", top: "49%", d: "0s" },
    { left: "65%", top: "62%", d: ".7s" },
    { left: "80%", top: "70%", d: "1.3s" },
  ];
  return (
    <div className="helm-photo" role="img" aria-label="Operator tactical night-vision helmet, scanning">
      <img src="/helmet.png" alt="" loading="eager" draggable={false} />
      <div className="hp-fx" aria-hidden="true">
        {lenses.map((l, i) => (
          <span key={i} className="hp-lens" style={{ left: l.left, top: l.top, animationDelay: l.d }} />
        ))}
        <span className="hp-glint" />
        <span className="hp-scan" />
        <span className="hp-grid" />
      </div>
    </div>
  );
}

/* Live-ish sparkline from a numeric history array. */
export function Sparkline({ data, color = "var(--brand)", h = 44, w = 220 }: { data: number[]; color?: string; h?: number; w?: number }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `0,${h} ${pts.join(" ")} ${w},${h}`;
  return (
    <svg width={w} height={h} className="sparkline" preserveAspectRatio="none" viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark)" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={h - 4 - ((data[data.length - 1] - min) / span) * (h - 8)} r="3" fill={color} />
    </svg>
  );
}

/* 3-tier topology diagram with upward data-flow animation on the links. */
export function TierDiagram({ labels }: { labels: { t0: string; t1: string; t2: string } }) {
  const t1 = [90, 300, 510];
  const t2 = [40, 150, 300, 450, 560];
  const links = [
    [1, 0], [1, 1], [1, 2], // t0 -> each t1 (by index into t1)
  ];
  const t2links: [number, number][] = [[0, 0], [0, 1], [1, 2], [2, 3], [2, 4]]; // t1index -> t2index
  return (
    <svg className="tier-diagram" viewBox="0 0 600 300" role="img" aria-label="Three-tier topology">
      {/* links t1 -> t2 */}
      {t2links.map(([a, b], i) => (
        <line key={`l2${i}`} x1={t1[a]} y1="150" x2={t2[b]} y2="250" stroke="var(--border-2)" strokeWidth="1.5" className="flow-line" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
      {/* links t0 -> t1 */}
      {links.map(([, b], i) => (
        <line key={`l1${i}`} x1="300" y1="50" x2={t1[b]} y2="150" stroke="var(--border-2)" strokeWidth="1.5" className="flow-line" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
      {/* tier 0 */}
      <g className="node n0">
        <rect x="235" y="30" width="130" height="40" rx="8" />
        <circle cx="252" cy="50" r="5" fill="var(--brand)" />
        <text x="266" y="54">{labels.t0}</text>
      </g>
      {/* tier 1 */}
      {t1.map((x, i) => (
        <g className="node n1" key={`n1${i}`}>
          <rect x={x - 55} y="130" width="110" height="40" rx="8" />
          <circle cx={x - 38} cy="150" r="4" fill="var(--data)" />
          <text x={x - 26} y="154">{labels.t1} {String.fromCharCode(65 + i)}</text>
        </g>
      ))}
      {/* tier 2 */}
      {t2.map((x, i) => (
        <g className="node n2" key={`n2${i}`}>
          <rect x={x - 34} y="232" width="68" height="34" rx="7" />
          <text x={x} y="253" textAnchor="middle">{labels.t2}&nbsp;{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

/* Minimal line icons for the 8 detection classes, keyed by MITRE id. */
export function CapIcon({ id }: { id: string }) {
  const svg = (children: ReactNode) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="cap-icon">{children}</svg>
  );
  switch (id) {
    case "T1567": return svg(<><rect x="3" y="4" width="10" height="16" rx="1.5" /><path d="M13 12h8M18 9l3 3-3 3" /></>); // exfil: arrow out of box
    case "T1548": return svg(<><path d="M12 3l3 4H9z" /><path d="M12 7v9" /><rect x="7" y="16" width="10" height="5" rx="1.5" /></>); // privilege up
    case "T1021": return svg(<><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M6 8l5 8M18 8l-5 8" /></>); // lateral graph
    case "T1078": return svg(<><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>); // clock logon
    case "T1059": return svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></>); // terminal
    case "T1119": return svg(<><path d="M6 4h8l4 4v12H6z" /><path d="M14 4v4h4M9 13h6M9 16h6" /></>); // files
    case "T1052": return svg(<><rect x="9" y="3" width="6" height="9" rx="1" /><path d="M12 12v6M10 7h.01M14 7h.01" /><circle cx="12" cy="20" r="2" /></>); // usb
    case "T1562": return svg(<><circle cx="12" cy="12" r="3.2" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1" /><path d="M5 19L19 5" stroke="var(--critical)" /></>); // gear + slash
    default: return svg(<circle cx="12" cy="12" r="8" />);
  }
}

/* Distinct glyphs for the three "eyes". */
export function EyeGlyph({ n }: { n: number }) {
  if (n === 1) return (
    <svg viewBox="0 0 48 48" className="eye-glyph" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24z" />
      <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.18" className="eg-iris" />
      <circle cx="24" cy="24" r="6" className="eg-iris" />
      <circle cx="24" cy="24" r="2" fill="currentColor" className="eg-pupil" />
    </svg>
  );
  if (n === 2) return (
    <svg viewBox="0 0 48 48" className="eye-glyph" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M24 6l18 8-18 8-18-8 18-8z" className="eg-l1" />
      <path d="M6 24l18 8 18-8" className="eg-l2" />
      <path d="M6 32l18 8 18-8" opacity="0.5" className="eg-l3" />
    </svg>
  );
  return (
    <svg viewBox="0 0 48 48" className="eye-glyph" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M24 16v8M22 26l-10 6M26 26l10 6" />
      <circle cx="24" cy="12" r="4" className="eg-node" />
      <circle cx="10" cy="34" r="4" className="eg-node" style={{ animationDelay: ".5s" }} />
      <circle cx="38" cy="34" r="4" className="eg-node" style={{ animationDelay: "1s" }} />
      <circle cx="24" cy="26" r="2" fill="currentColor" className="eg-core" />
    </svg>
  );
}

// Original symbol-marks for the standards badges (brand-safe, not official
// logos). Each sits in a chip to the left of the badge and animates subtly.
const MARK: Record<string, ReactNode> = {
  nist: (<g><path d="M3.5 9 12 4l8.5 5" /><path d="M4.5 9h15" /><path d="M6.5 10v8M10 10v8M14 10v8M17.5 10v8" /><path d="M4 20h16" /></g>),
  attack: (
    <g fill="var(--brand)" stroke="none">
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
        <rect key={`${r}-${c}`} className="sm-cell" x={4.5 + c * 5.4} y={4.5 + r * 5.4} width="4" height="4" rx="1" style={{ animationDelay: `${(r + c) * 0.16}s` }} />
      )))}
    </g>
  ),
  insider: (<g><path d="M12 3l7 3v5c0 4.2-3 7.2-7 8.2-4-1-7-4-7-8.2V6z" /><circle cx="12" cy="10.2" r="1.7" fill="var(--brand)" stroke="none" /><path d="M8.9 15.4c.3-1.7 1.6-2.6 3.1-2.6s2.8.9 3.1 2.6" /></g>),
  ocsf: (<g><ellipse cx="12" cy="6" rx="7" ry="2.4" /><path d="M5 6v12c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4V6" /><path d="M5 12c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4" /></g>),
  sigma: (<text x="12" y="17.5" textAnchor="middle" fontFamily="'Fira Code', monospace" fontSize="16" fontWeight="700" fill="var(--brand)" stroke="none">Σ</text>),
  cisa: (<g><path d="M12 3l7 3v5c0 4.2-3 7.2-7 8.2-4-1-7-4-7-8.2V6z" /><path d="M12 7.5l1.1 2.4 2.6.3-1.9 1.8.5 2.6L12 13.6l-2.4 1.1.5-2.6-1.9-1.8 2.6-.3z" fill="var(--brand)" stroke="none" /></g>),
};

export function StdMark({ name }: { name: string }) {
  const id = name.startsWith("NIST") ? "nist"
    : /ATT/i.test(name) ? "attack"
    : /Insider/i.test(name) ? "insider"
    : name.startsWith("OCSF") ? "ocsf"
    : /^Sigma/i.test(name) ? "sigma"
    : /^CISA/i.test(name) ? "cisa" : "nist";
  return (
    <span className={`std-chip sm-${id}`} aria-hidden="true">
      <svg className="std-mark" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {MARK[id]}
      </svg>
    </span>
  );
}
