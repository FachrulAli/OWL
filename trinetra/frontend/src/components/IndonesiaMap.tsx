import { useEffect, useMemo, useRef, useState } from "react";
import { Node } from "../lib/api";
import { riskColor } from "../lib/util";
import { VB, PROJ, projX, projY, PROVINCES, LAND_PATH, NODE_GEO } from "./indonesiaGeo";

// Interactive geographic command map: provinces + graticule, pan/zoom, animated
// threat arcs converging on HQ, and click-to-drill on any node.

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function IndonesiaMap({ nodes, onPick }: { nodes: Node[]; onPick?: (nodeId: string) => void }) {
  const [hover, setHover] = useState<{ n: Node; x: number; y: number } | null>(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [coord, setCoord] = useState<{ lon: number; lat: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Zoom only on a pinch gesture (trackpad pinch / ctrl+wheel sends ctrlKey);
  // a normal two-finger scroll is left alone so the page scrolls as usual.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // normal scroll -> let the page handle it
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * VB.w;
      const py = ((e.clientY - r.top) / r.height) * VB.h;
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k = clamp(v.k * factor, 1, 7);
      setView({ k, tx: px - (px - v.tx) * (k / v.k), ty: py - (py - v.ty) * (k / v.k) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const graticule = useMemo(() => {
    const lon: number[] = [], lat: number[] = [];
    for (let l = 95; l <= 140; l += 5) lon.push(l);
    for (let l = 5; l >= -10; l -= 5) lat.push(l);
    return { lon, lat };
  }, []);

  const pos = (id: string) => { const g = NODE_GEO[id]; return g ? { x: projX(g.lon), y: projY(g.lat) } : null; };
  const plotted = nodes.filter((n) => NODE_GEO[n.node_id]);
  const hub = pos("pusat");

  // viewBox point from a client event
  const toVB = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VB.w, y: ((e.clientY - r.top) / r.height) * VB.h };
  };
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    if (drag.current) {
      const dx = ((e.clientX - drag.current.x) / r.width) * VB.w;
      const dy = ((e.clientY - drag.current.y) / r.height) * VB.h;
      drag.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
    // coordinate readout (inverse projection through the pan/zoom transform)
    const p = toVB(e);
    const wx = (p.x - view.tx) / view.k, wy = (p.y - view.ty) / view.k;
    const lon = PROJ.lonMin + (wx - PROJ.ox) / PROJ.scale;
    const lat = PROJ.latMax - (wy - PROJ.oy) / PROJ.scale;
    if (lon > 93 && lon < 143 && lat > -12 && lat < 8) setCoord({ lon, lat }); else setCoord(null);
  };
  const onUp = () => { drag.current = null; };
  const reset = () => setView({ k: 1, tx: 0, ty: 0 });

  const threats = plotted.filter((n) => n.tier === 1 && n.max_risk >= 50);
  const arc = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; const lift = len * 0.22;
    return `M ${a.x} ${a.y} Q ${mx + nx * lift} ${my + ny * lift} ${b.x} ${b.y}`;
  };
  const inv = 1 / view.k;

  return (
    <div className="panel map-panel">
      <h2>Peta Komando — 21 Kodam TNI AD</h2>
      <div className="map-wrap">
        <div className="map-hud">
          <span className="hud-dot" /> LIVE · {plotted.length} NODE ·
          <b style={{ color: "var(--critical)" }}> {threats.length} ANCAMAN</b>
          {coord && <span className="hud-coord">{Math.abs(coord.lat).toFixed(2)}°{coord.lat >= 0 ? "N" : "S"} {coord.lon.toFixed(2)}°E</span>}
        </div>
        <div className="map-ctrls">
          <button onClick={() => setView((v) => ({ ...v, k: clamp(v.k * 1.3, 1, 7) }))} title="Perbesar">+</button>
          <button onClick={() => setView((v) => ({ ...v, k: clamp(v.k / 1.3, 1, 7) }))} title="Perkecil">−</button>
          <button onClick={reset} title="Reset tampilan">⌖</button>
        </div>

        <svg ref={svgRef} viewBox={`0 0 ${VB.w} ${VB.h}`} className="id-map"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { onUp(); setCoord(null); }}
          style={{ cursor: drag.current ? "grabbing" : "grab" }} role="img" aria-label="Peta sebaran Kodam TNI AD">
          <defs>
            <radialGradient id="mapGlow" cx="50%" cy="42%" r="72%">
              <stop offset="0%" stopColor="rgba(53,208,186,0.08)" /><stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <clipPath id="idLand"><path d={LAND_PATH} /></clipPath>
            <linearGradient id="sweepG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="transparent" /><stop offset="100%" stopColor="rgba(53,208,186,0.14)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={VB.w} height={VB.h} fill="url(#mapGlow)" />

          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            {/* graticule */}
            <g className="graticule">
              {graticule.lon.map((l) => <line key={"x" + l} x1={projX(l)} y1={projY(6)} x2={projX(l)} y2={projY(-11)} />)}
              {graticule.lat.map((l) => <line key={"y" + l} x1={projX(95)} y1={projY(l)} x2={projX(141)} y2={projY(l)} />)}
            </g>

            {/* provinces: coastline + internal borders */}
            <g className="provinces" clipPath="url(#idLand)">
              <g className="map-sweep"><rect x={projX(95)} y={projY(6)} width={projX(141) - projX(95)} height={projY(-11) - projY(6)} fill="url(#sweepG)" /></g>
            </g>
            <g className="provinces">
              {PROVINCES.map((p, i) => <path key={i} d={p.d} className="province" />)}
            </g>

            {/* base command links */}
            {hub && plotted.filter((n) => n.tier === 1).map((n) => {
              const p = pos(n.node_id)!;
              return <line key={"b" + n.node_id} x1={hub.x} y1={hub.y} x2={p.x} y2={p.y} className="base-link" strokeWidth={0.6 * inv} />;
            })}

            {/* animated threat arcs converging on HQ */}
            {hub && threats.map((n) => {
              const p = pos(n.node_id)!; const c = riskColor(n.max_risk); const d = arc(p, hub);
              return (
                <g key={"t" + n.node_id}>
                  <path d={d} fill="none" stroke={c} strokeWidth={1.4 * inv} className="threat-arc" style={{ ["--c" as any]: c }} />
                  <circle r={2.6 * inv} fill={c}><animateMotion dur="2.4s" repeatCount="indefinite" path={d} /></circle>
                </g>
              );
            })}

            {/* nodes */}
            {[...plotted].sort((a, b) => a.tier - b.tier).map((n) => {
              const p = pos(n.node_id)!; const risk = n.max_risk; const c = riskColor(risk);
              const isHub = n.tier === 0; const rad = (isHub ? 6.5 : 4.5) * inv;
              const hot = risk >= 70; const showLabel = isHub || risk >= 50 || view.k > 2.4;
              return (
                <g key={n.node_id} className="map-node" transform={`translate(${p.x} ${p.y})`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onPick?.(n.node_id)}
                  onMouseEnter={() => setHover({ n, x: p.x, y: p.y })} onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}>
                  {hot && <circle className="ping" r={rad} style={{ stroke: c, strokeWidth: 1.4 * inv }} />}
                  {risk >= 50 && <circle className="halo" r={rad + 5 * inv} style={{ fill: c }} />}
                  <circle r={rad} style={{ fill: isHub ? "var(--brand)" : c, stroke: "#05070b", strokeWidth: 1.4 * inv }} />
                  {isHub && <circle r={rad + 3 * inv} fill="none" stroke="var(--brand)" strokeWidth={inv} opacity="0.6" />}
                  {showLabel && (
                    <text className="map-label" x={(rad + 6 * inv)} y={3.5 * inv} style={{ fontSize: `${11 * inv}px`, strokeWidth: 3 * inv }}>
                      {isHub ? "PUSSIBERAD" : n.name.replace(/^Kodam\s*/i, "").replace(/\s*\/.*$/, "")}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {hover && (
          <div className="map-tip">
            <div className="mt-name">{hover.n.name}</div>
            <div className="mt-row"><span>{NODE_GEO[hover.n.node_id]?.city}</span><b style={{ color: riskColor(hover.n.max_risk) }}>{hover.n.max_risk.toFixed(0)}</b></div>
            <div className="mt-meta">{hover.n.total} entitas · {hover.n.high_count} berisiko tinggi · klik untuk detail</div>
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
