import { useMemo, useState } from "react";
import { Node } from "../lib/api";
import { riskColor } from "../lib/util";
import { INDONESIA_PATH, NODE_GEO, projX, projY } from "./indonesiaGeo";

// Geographic command map: real Indonesia coastline (50m Natural Earth) with
// TNI AD Kodam HQs plotted at their real city coordinates.
const VB_W = 1000, VB_H = 440;

export function IndonesiaMap({ nodes }: { nodes: Node[] }) {
  const [hover, setHover] = useState<{ n: Node; x: number; y: number } | null>(null);

  const dots = useMemo(() => {
    const step = 12, out: { x: number; y: number }[] = [];
    for (let x = 4; x < VB_W - 4; x += step)
      for (let y = 4; y < VB_H - 4; y += step) out.push({ x, y });
    return out;
  }, []);

  const pos = (id: string) => { const g = NODE_GEO[id]; return g ? { x: projX(g.lon), y: projY(g.lat) } : null; };
  const plotted = nodes.filter((n) => NODE_GEO[n.node_id]);
  const hub = pos("pusat");

  return (
    <div className="panel map-panel">
      <h2>Peta Komando — 21 Kodam TNI AD</h2>
      <div className="map-wrap">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="id-map" role="img" aria-label="Peta sebaran Kodam Indonesia">
          <defs>
            <radialGradient id="mapGlow" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="rgba(53,208,186,0.07)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <clipPath id="idLand"><path d={INDONESIA_PATH} /></clipPath>
          </defs>
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#mapGlow)" />

          <path d={INDONESIA_PATH} className="id-land" />
          <g className="map-dots" clipPath="url(#idLand)">
            {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="1.2" />)}
          </g>
          <path d={INDONESIA_PATH} className="id-coast" />

          {/* command links: pusat -> each kodam */}
          {hub && plotted.filter((n) => n.tier === 1).map((n, i) => {
            const p = pos(n.node_id)!;
            return <line key={n.node_id} x1={hub.x} y1={hub.y} x2={p.x} y2={p.y}
              className="map-link to-kodam" style={{ animationDelay: `${i * 0.08}s` }} />;
          })}

          {/* nodes */}
          {[...plotted].sort((a, b) => a.tier - b.tier).map((n) => {
            const p = pos(n.node_id)!;
            const risk = n.max_risk;
            const c = riskColor(risk);
            const isHub = n.tier === 0;
            const rad = isHub ? 6.5 : 4.5;
            const hot = risk >= 70;
            const showLabel = isHub || risk >= 50;
            return (
              <g key={n.node_id} className="map-node" transform={`translate(${p.x} ${p.y})`}
                onMouseEnter={() => setHover({ n, x: p.x, y: p.y })} onMouseLeave={() => setHover(null)}>
                {hot && <circle className="ping" r={rad} style={{ stroke: c }} />}
                {risk >= 50 && <circle className="halo" r={rad + 5} style={{ fill: c }} />}
                <circle r={rad} style={{ fill: isHub ? "var(--brand)" : c, stroke: "#05070b", strokeWidth: 1.4 }} />
                {isHub && <circle r={rad + 3} fill="none" stroke="var(--brand)" strokeWidth="1" opacity="0.6" />}
                {showLabel && (
                  <text className="map-label" x={rad + 6} y={3.5}>
                    {isHub ? "PUSSIBERAD" : n.name.replace(/^Kodam\s*/i, "").replace(/\s*\/.*$/, "")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hover && (
          <div className="map-tip">
            <div className="mt-name">{hover.n.name}</div>
            <div className="mt-row">
              <span>{NODE_GEO[hover.n.node_id]?.city}</span>
              <b style={{ color: riskColor(hover.n.max_risk) }}>{hover.n.max_risk.toFixed(0)}</b>
            </div>
            <div className="mt-meta">{hover.n.total} entitas · {hover.n.high_count} berisiko tinggi</div>
          </div>
        )}

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
