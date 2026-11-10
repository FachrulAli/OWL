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

// Real Indonesia outline (public-domain GeoJSON → SVG path, same lon/lat
// projection as the node markers so land and markers align exactly).
const INDONESIA = "M553.8 383.9 L545.5 384.3 L519.2 369.5 L537.7 365.3 L548.1 371.7 L555.0 378.2 L553.8 383.9Z M627.6 381.8 L610.6 386.4 L608.3 383.9 L610.0 376.7 L618.6 363.8 L638.2 355.4 L640.2 359.6 L640.5 366.0 L627.6 381.8Z M498.0 338.5 L505.2 344.1 L517.4 342.4 L522.3 351.4 L499.4 355.7 L485.7 358.5 L475.0 358.3 L481.8 346.2 L492.7 346.0 L498.0 338.5Z M597.2 338.5 L594.3 350.2 L564.5 356.2 L538.2 353.6 L538.1 345.9 L553.8 341.5 L566.3 347.8 L579.5 346.2 L597.2 338.5Z M314.1 310.6 L352.1 312.7 L356.5 304.0 L393.2 314.2 L400.4 327.9 L430.2 331.7 L454.5 344.3 L431.9 352.4 L410.1 343.9 L392.1 344.4 L371.6 342.9 L353.0 339.1 L330.0 331.0 L315.5 328.9 L307.2 331.5 L271.1 322.8 L267.7 313.7 L249.5 312.1 L263.1 291.9 L287.2 293.2 L303.2 301.4 L311.4 303.1 L314.1 310.6Z M831.6 298.7 L821.4 313.1 L819.5 297.1 L823.0 289.5 L827.1 282.4 L831.6 288.6 L831.6 298.7Z M683.4 240.3 L676.0 247.3 L662.3 243.5 L658.4 234.3 L678.4 233.3 L683.4 240.3Z M747.3 232.6 L754.5 248.8 L737.7 240.0 L721.2 238.3 L710.0 239.7 L696.3 238.9 L701.0 227.3 L725.4 226.4 L747.3 232.6Z M820.1 191.5 L825.6 225.7 L846.1 238.4 L862.7 215.9 L885.4 203.1 L903.1 203.1 L920.0 210.5 L934.7 218.1 L956.0 222.1 L956.3 291.1 L956.7 360.1 L939.0 342.8 L918.9 338.5 L914.0 344.5 L888.9 345.2 L897.3 328.0 L909.8 322.1 L904.6 299.0 L895.1 281.3 L856.7 263.3 L840.3 261.6 L810.5 242.0 L804.7 252.3 L797.1 254.2 L792.6 246.4 L792.5 237.2 L777.4 226.8 L798.7 219.2 L812.9 219.6 L811.2 214.0 L782.2 213.9 L774.3 201.3 L756.6 197.4 L748.2 186.9 L774.9 181.8 L785.1 174.9 L816.9 183.6 L820.1 191.5Z M643.6 137.0 L627.6 158.0 L612.7 162.1 L593.6 157.9 L560.6 159.0 L543.3 162.0 L540.5 178.1 L558.2 196.9 L568.9 187.3 L605.9 180.1 L604.3 189.8 L595.6 186.8 L587.0 199.2 L569.6 207.4 L588.3 234.5 L584.7 241.8 L602.5 266.2 L602.3 280.2 L591.8 286.4 L584.0 278.9 L593.6 261.6 L574.1 269.8 L569.2 263.9 L571.8 255.8 L557.5 243.3 L558.9 222.7 L545.7 229.1 L547.4 253.8 L548.2 284.1 L535.6 287.2 L527.1 281.0 L532.8 261.5 L529.7 241.1 L521.4 240.9 L515.2 226.4 L523.4 212.5 L526.2 195.7 L536.2 163.8 L540.4 155.1 L557.2 139.3 L572.7 145.6 L597.7 148.5 L620.5 147.6 L640.1 132.3 L643.6 137.0Z M711.9 143.1 L710.9 161.6 L700.6 159.5 L697.6 172.4 L705.8 183.6 L700.2 186.1 L692.2 172.7 L686.4 145.6 L690.3 128.7 L696.9 121.0 L698.3 132.6 L710.0 134.4 L711.9 143.1Z M497.5 128.4 L519.8 148.0 L496.3 150.5 L489.7 164.9 L490.5 184.1 L471.5 198.6 L470.9 219.7 L463.3 252.0 L460.4 244.5 L437.8 254.0 L430.0 241.1 L415.9 239.9 L406.0 233.1 L382.4 240.7 L375.2 230.5 L362.2 231.6 L345.8 229.2 L342.8 200.8 L332.9 194.9 L323.4 176.8 L320.6 158.3 L322.9 138.6 L334.7 124.6 L338.0 138.7 L351.6 150.7 L364.4 146.4 L377.0 147.9 L388.6 137.2 L398.1 135.3 L416.8 141.3 L433.0 136.8 L443.2 107.3 L450.8 99.9 L457.7 75.9 L480.5 75.9 L497.7 79.4 L486.4 98.6 L501.0 118.6 L497.5 128.4Z M258.5 291.0 L236.5 291.4 L219.8 273.7 L194.4 256.4 L185.9 243.6 L170.9 226.3 L161.0 210.5 L145.9 180.8 L128.5 163.2 L122.7 145.0 L115.4 128.4 L97.5 115.1 L87.2 97.0 L72.2 85.1 L51.6 61.8 L49.8 51.0 L62.6 51.9 L93.3 56.0 L110.8 76.7 L126.1 91.0 L137.1 99.8 L155.8 122.6 L176.0 122.9 L192.7 137.4 L204.1 155.2 L219.2 164.8 L211.3 182.1 L222.6 189.5 L229.8 190.0 L233.1 204.8 L240.0 216.6 L254.6 218.5 L264.2 231.9 L259.3 258.2 L258.5 291.0Z";

export function IndonesiaMap({ nodes }: { nodes: Node[] }) {
  const [hover, setHover] = useState<Node | null>(null);

  const dots = useMemo(() => {
    const step = 13, out: { x: number; y: number }[] = [];
    for (let x = 6; x < VB_W - 6; x += step)
      for (let y = 6; y < VB_H - 6; y += step) out.push({ x, y });
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
            <clipPath id="idLand"><path d={INDONESIA} /></clipPath>
          </defs>
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#mapGlow)" />

          {/* Indonesia land: subtle fill + outline */}
          <path d={INDONESIA} className="id-land" />
          {/* dot texture clipped to the landmass (command-center look) */}
          <g className="map-dots" clipPath="url(#idLand)">
            {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="1.4" />)}
          </g>
          <path d={INDONESIA} className="id-coast" />

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
