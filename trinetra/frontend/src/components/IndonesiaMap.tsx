import { useMemo, useState } from "react";
import { Node } from "../lib/api";
import { riskColor } from "../lib/util";

// Geographic command map of Indonesia. Nodes are plotted at real city
// coordinates; the archipelago is drawn as a dot matrix (command-center style)
// so it reads as intentional without needing a pixel-accurate coastline.

const VB_W = 1000, VB_H = 440;
const LON0 = 95, LON1 = 141, LAT0 = 6, LAT1 = -11;
const PADX = 44, PADY = 40;
const fx = (lon: number) => PADX + ((lon - LON0) / (LON1 - LON0)) * (VB_W - 2 * PADX);
const fy = (lat: number) => PADY + ((LAT0 - lat) / (LAT0 - LAT1)) * (VB_H - 2 * PADY);

// node_id -> real location + short label
const GEO: Record<string, { lon: number; lat: number; city: string }> = {
  "pusat":     { lon: 106.8, lat: -6.2, city: "Jakarta" },
  "kodam-a":   { lon: 107.6, lat: -6.9, city: "Bandung" },
  "kodam-b":   { lon: 112.7, lat: -7.3, city: "Surabaya" },
  "kodam-c":   { lon: 119.4, lat: -5.1, city: "Makassar" },
  "satuan-a1": { lon: 106.9, lat: -6.55, city: "Bekasi" },
  "satuan-a2": { lon: 108.55, lat: -6.75, city: "Cirebon" },
  "satuan-b1": { lon: 110.4, lat: -7.0, city: "Semarang" },
  "satuan-c1": { lon: 119.9, lat: -5.5, city: "Gowa" },
  "satuan-c2": { lon: 117.6, lat: -3.9, city: "Mamuju" },
};

// island blobs as rotated ellipses (cx,cy,rx,ry,deg) in viewBox space
const ISLANDS: [number, number, number, number, number][] = [
  [175, 168, 138, 32, -50], // Sumatra
  [330, 322, 122, 14, -3],  // Java
  [478, 352, 88, 11, -2],   // Bali · Nusa Tenggara
  [440, 162, 102, 84, 0],   // Kalimantan
  [548, 232, 50, 72, 8],    // Sulawesi
  [676, 226, 34, 58, 0],    // Maluku
  [878, 232, 116, 58, 8],   // Papua
];

function inEllipse(px: number, py: number, e: [number, number, number, number, number]) {
  const [cx, cy, rx, ry, deg] = e;
  const r = (-deg * Math.PI) / 180;
  const dx = px - cx, dy = py - cy;
  const x = dx * Math.cos(r) - dy * Math.sin(r);
  const y = dx * Math.sin(r) + dy * Math.cos(r);
  return (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1;
}

export function IndonesiaMap({ nodes }: { nodes: Node[] }) {
  const [hover, setHover] = useState<Node | null>(null);

  const dots = useMemo(() => {
    const step = 15, out: { x: number; y: number }[] = [];
    for (let x = 10; x < VB_W - 10; x += step)
      for (let y = 10; y < VB_H - 10; y += step)
        if (ISLANDS.some((e) => inEllipse(x, y, e))) out.push({ x, y });
    return out;
  }, []);

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.node_id, n])), [nodes]);
  const pos = (id: string) => (GEO[id] ? { x: fx(GEO[id].lon), y: fy(GEO[id].lat) } : null);

  // command links: pusat -> kodam, kodam -> satuan (via parent_id)
  const links = nodes
    .filter((n) => n.parent_id && pos(n.node_id) && pos(n.parent_id!))
    .map((n) => ({ from: pos(n.parent_id!)!, to: pos(n.node_id)!, tier: n.tier, id: n.node_id }));

  const sorted = [...nodes].filter((n) => pos(n.node_id)).sort((a, b) => a.tier - b.tier);

  return (
    <div className="panel map-panel">
      <h2>Peta Komando — Sebaran Node TNI AD</h2>
      <div className="map-wrap">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="id-map" role="img" aria-label="Peta sebaran node Indonesia">
          <defs>
            <radialGradient id="mapGlow" cx="50%" cy="40%" r="70%">
              <stop offset="0%" stopColor="rgba(53,208,186,0.08)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#mapGlow)" />

          {/* archipelago dot matrix */}
          <g className="map-dots">
            {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="1.5" />)}
          </g>

          {/* command links */}
          {links.map((l, i) => (
            <line
              key={i}
              x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
              className={`map-link ${l.tier === 1 ? "to-kodam" : "to-satuan"}`}
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}

          {/* nodes */}
          {sorted.map((n) => {
            const p = pos(n.node_id)!;
            const risk = n.max_risk;
            const c = riskColor(risk);
            const isHub = n.tier === 0;
            const isKodam = n.tier === 1;
            const rad = isHub ? 7 : isKodam ? 5.5 : 3.5;
            const hot = risk >= 70;
            return (
              <g
                key={n.node_id}
                className="map-node"
                transform={`translate(${p.x} ${p.y})`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
              >
                {hot && <circle className="ping" r={rad} style={{ stroke: c }} />}
                {risk >= 50 && <circle className="halo" r={rad + 5} style={{ fill: c }} />}
                <circle r={rad} style={{ fill: isHub ? "var(--brand)" : c, stroke: "#05070b", strokeWidth: 1.5 }} />
                {isHub && <circle r={rad + 3} fill="none" stroke="var(--brand)" strokeWidth="1" opacity="0.6" />}
                {(isHub || isKodam) && (
                  <text className="map-label" x={rad + 7} y={4}>
                    {isHub ? "PUSSIBERAD" : n.name.replace(/^CSIRT\s*/i, "")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hover && (
          <div className="map-tip">
            <div className="mt-name">{hover.name}</div>
            <div className="mt-row">
              <span>{GEO[hover.node_id]?.city}</span>
              <b style={{ color: riskColor(hover.max_risk) }}>{hover.max_risk.toFixed(0)}</b>
            </div>
            <div className="mt-meta">{hover.total} entitas · {hover.high_count} berisiko tinggi</div>
          </div>
        )}

        {/* legend */}
        <div className="map-legend">
          <span><i style={{ background: "var(--brand)" }} /> Pusat</span>
          <span><i style={{ background: "var(--low)" }} /> Aman</span>
          <span><i style={{ background: "var(--high)" }} /> Waspada</span>
          <span><i style={{ background: "var(--critical)" }} /> Kritis</span>
        </div>
      </div>
    </div>
  );
}
