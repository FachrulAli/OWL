// Inline SVG visuals for the landing page — theme-aware, dependency-free.
import type { ReactNode } from "react";

/* Animated tactical night-vision helmet — quad GPNVG optics that scan and
   glow, a glass shimmer sweep, HUD sweep + scanline, as if the operator is
   actively monitoring. Anchors the hero and carries the "third eye" theme. */
export function RadarEye() {
  // four night-vision tubes in the characteristic quad splay (symmetric about x=160)
  const lenses = [
    { cx: 106, cy: 176, r: 19, d: "0s" },
    { cx: 144, cy: 164, r: 23, d: ".5s" },
    { cx: 192, cy: 164, r: 23, d: "1s" },
    { cx: 230, cy: 176, r: 19, d: "1.6s" },
  ];
  return (
    <svg className="helm" viewBox="0 0 320 320" role="img" aria-label="Operator night-vision scanner">
      <defs>
        <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="irisGrad" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#eef6ff" />
          <stop offset="26%" stopColor="#7cc4ff" />
          <stop offset="60%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="#031a33" />
        </radialGradient>
        <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a3a52" />
          <stop offset="48%" stopColor="#111b2b" />
          <stop offset="100%" stopColor="#060c16" />
        </linearGradient>
        <linearGradient id="shellG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2740" />
          <stop offset="100%" stopColor="#070d18" />
        </linearGradient>
        <linearGradient id="glintG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#dff0ff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="opticsClip">
          {lenses.map((l, i) => <circle key={i} cx={l.cx} cy={l.cy} r={l.r} />)}
        </clipPath>
      </defs>

      {/* backdrop: third-eye triangle + HUD arcs + sweep */}
      <path className="helm-tri" d="M160 26 L300 290 L20 290 Z" fill="none" stroke="var(--brand)" strokeWidth="1.3" opacity="0.28" />
      {[150, 116, 82].map((r) => (
        <circle key={r} cx="160" cy="168" r={r} fill="none" stroke="var(--border-2)" strokeWidth="1" opacity="0.5" />
      ))}
      <g className="helm-sweep" style={{ transformOrigin: "160px 168px" }}>
        <path d="M160 168 L160 18 A150 150 0 0 1 290 103 Z" fill="url(#sweepGrad)" />
      </g>

      {/* helmet shell */}
      <path d="M78 150 Q70 70 160 60 Q250 70 242 150 Q244 128 220 120 L100 120 Q76 128 78 150 Z"
        fill="url(#shellG)" stroke="#2b3f5c" strokeWidth="1.5" />
      <path d="M104 118 Q160 104 216 118" fill="none" stroke="#35507a" strokeWidth="2" opacity="0.7" />
      <path d="M150 62 Q160 60 170 62 L168 116 L152 116 Z" fill="#0c1726" stroke="#2b3f5c" strokeWidth="1" />
      {/* rails / side pods */}
      <rect x="70" y="128" width="20" height="34" rx="5" fill="url(#metal)" stroke="#2b3f5c" strokeWidth="1" />
      <rect x="230" y="128" width="20" height="34" rx="5" fill="url(#metal)" stroke="#2b3f5c" strokeWidth="1" />
      <rect x="150" y="98" width="20" height="9" rx="2" fill="none" stroke="var(--brand)" strokeWidth="1" opacity="0.5" />

      {/* goggle mount bridge */}
      <rect x="120" y="134" width="80" height="22" rx="8" fill="url(#metal)" stroke="#2b3f5c" strokeWidth="1.2" />

      {/* the four night-vision optics */}
      {lenses.map((l, i) => (
        <g key={i}>
          {/* tube body */}
          <circle cx={l.cx} cy={l.cy} r={l.r + 6} fill="url(#metal)" stroke="#324a6c" strokeWidth="1.5" />
          <circle cx={l.cx} cy={l.cy} r={l.r + 2} fill="#05101f" stroke="#1d2d44" strokeWidth="1" />
          {/* glowing lens */}
          <circle cx={l.cx} cy={l.cy} r={l.r} fill="url(#irisGrad)" className="helm-iris" style={{ animationDelay: l.d }} />
          {/* expanding scan ring */}
          <circle cx={l.cx} cy={l.cy} r={l.r} fill="none" stroke="#bfe3ff" strokeWidth="1.4"
            className="lens-ring" style={{ animationDelay: l.d }} />
          {/* rotating scan line */}
          <line x1={l.cx - l.r} y1={l.cy} x2={l.cx + l.r} y2={l.cy} stroke="#eaf5ff" strokeWidth="1" opacity="0.6"
            className="lens-scan" style={{ animationDelay: l.d }} />
          {/* pupil + highlight */}
          <circle cx={l.cx} cy={l.cy} r={l.r * 0.3} fill="#03101f" />
          <circle cx={l.cx - l.r * 0.32} cy={l.cy - l.r * 0.34} r={l.r * 0.16} fill="#eef6ff" opacity="0.9" />
        </g>
      ))}

      {/* glass shimmer sweeping across the optics (google-glass glint) */}
      <g clipPath="url(#opticsClip)">
        <rect className="helm-shimmer" x="-80" y="130" width="46" height="80" fill="url(#glintG)" transform="skewX(-18)" />
      </g>

      {/* monitoring scanline sweeping down over the head */}
      <rect className="helm-scanline" x="62" y="60" width="196" height="2.5" fill="var(--brand)" opacity="0.5" />

      {/* pipeline data flow at base */}
      {[232, 246, 260].map((y, i) => (
        <line key={y} x1="92" y1={y} x2="228" y2={y} stroke="var(--brand)" strokeWidth="1.4"
          strokeDasharray="3 9" opacity="0.5" className="helm-pipe" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
    </svg>
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
      <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.18" /><circle cx="24" cy="24" r="6" />
      <circle cx="24" cy="24" r="2" fill="currentColor" />
    </svg>
  );
  if (n === 2) return (
    <svg viewBox="0 0 48 48" className="eye-glyph" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M24 6l18 8-18 8-18-8 18-8z" /><path d="M6 24l18 8 18-8" /><path d="M6 32l18 8 18-8" opacity="0.5" />
    </svg>
  );
  return (
    <svg viewBox="0 0 48 48" className="eye-glyph" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="24" cy="12" r="4" /><circle cx="10" cy="34" r="4" /><circle cx="38" cy="34" r="4" />
      <path d="M24 16v8M22 26l-10 6M26 26l10 6" /><circle cx="24" cy="26" r="2" fill="currentColor" />
    </svg>
  );
}
