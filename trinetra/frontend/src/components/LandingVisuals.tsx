// Inline SVG visuals for the landing page — theme-aware, dependency-free.
import type { ReactNode } from "react";

/* Animated "third eye" radar: concentric rings, a sweeping beam, and blips
   that pulse as if contacts are being detected. Anchors the hero visually. */
export function RadarEye() {
  const blips = [
    { x: 118, y: 92, c: "var(--critical)", d: "0s" },
    { x: 196, y: 150, c: "var(--brand)", d: "0.8s" },
    { x: 92, y: 178, c: "var(--high)", d: "1.5s" },
    { x: 168, y: 214, c: "var(--brand)", d: "2.1s" },
    { x: 228, y: 104, c: "var(--brand)", d: "2.7s" },
  ];
  return (
    <svg className="radar" viewBox="0 0 320 320" role="img" aria-label="Behavioral radar">
      <defs>
        <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eef6ff" />
          <stop offset="35%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="#052018" />
        </radialGradient>
      </defs>
      {[150, 112, 74, 36].map((r) => (
        <circle key={r} cx="160" cy="160" r={r} fill="none" stroke="var(--border-2)" strokeWidth="1" opacity="0.6" />
      ))}
      <line x1="10" y1="160" x2="310" y2="160" stroke="var(--border)" strokeWidth="1" />
      <line x1="160" y1="10" x2="160" y2="310" stroke="var(--border)" strokeWidth="1" />
      {/* sweeping beam */}
      <g className="radar-sweep" style={{ transformOrigin: "160px 160px" }}>
        <path d="M160 160 L160 10 A150 150 0 0 1 290 95 Z" fill="url(#sweepGrad)" />
      </g>
      {/* contact blips */}
      {blips.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r="4" fill={b.c} className="radar-blip" style={{ animationDelay: b.d }} />
      ))}
      {/* the eye */}
      <circle cx="160" cy="160" r="22" fill="url(#irisGrad)" className="radar-iris" />
      <circle cx="160" cy="160" r="7" fill="#03120d" />
      <circle cx="153" cy="153" r="3" fill="#eef6ff" opacity="0.8" />
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
