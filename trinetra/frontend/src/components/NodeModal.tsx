import { useEffect, useMemo, useState } from "react";
import { Node, Entity, Case } from "../lib/api";
import { LiveMsg } from "../lib/useLive";
import { riskColor, sevClass, sevFromRisk, ROLE_LABEL, CAT_LABEL, fmtTime } from "../lib/util";
import { NODE_GEO } from "./indonesiaGeo";
import { KODAM_BY_ID, PUSSIBERAD } from "../data/tniad";

// Popup command card for a node (Pusat / Kodam): identity + live monitoring
// condition + the entities and cases it owns. Clicking an entity drills into
// the full EntityDrawer.
const STATUS = (r: number) =>
  r >= 70 ? "KRITIS" : r >= 50 ? "WASPADA" : r >= 30 ? "PANTAU" : "AMAN";

// Ground-level HQ building photos. Explicit overrides here; otherwise the
// header auto-tries /hq/<node_id>.jpg — so adding a photo is just dropping a
// file in public/hq/ named by node_id, no code change. Missing → aerial banner.
const HQ_PHOTO: Record<string, string> = {
  pusat: "/hq/pusat.png",
};

// Generated crest banner for a node — a command-style insignia (rings, a
// radiant star, the Kodam numeral + nickname) over a navy HUD field tinted by
// the node's risk colour. Original art, so no sourcing/licensing issues, and
// it actually signifies the unit (unlike a blurry satellite tile).
function HqArt({ numeral, nick, c }: { numeral: string; nick: string; c: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);
  return (
    <div className="nm-banner nm-art" aria-hidden="true" style={{ ["--c" as any]: c }}>
      <svg viewBox="0 0 760 160" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="nmArtGlow" cx="79%" cy="32%" r="62%">
            <stop offset="0%" stopColor={c} stopOpacity="0.30" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
          <pattern id="nmArtGrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0H0V26" fill="none" stroke="rgba(120,170,235,0.10)" strokeWidth="1" />
          </pattern>
          <linearGradient id="nmArtBg" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#13263f" />
            <stop offset="100%" stopColor="#0a1626" />
          </linearGradient>
        </defs>
        <rect width="760" height="160" fill="url(#nmArtBg)" />
        <rect width="760" height="160" fill="url(#nmArtGrid)" />
        <rect width="760" height="160" fill="url(#nmArtGlow)" />
        {/* hazard chevrons, far left */}
        <g opacity="0.07" stroke="#9cc3ff" strokeWidth="11" fill="none">
          <path d="M-30 -10 L70 80 L-30 170" /><path d="M20 -10 L120 80 L20 170" />
        </g>
        {/* ghost nickname */}
        <text x="38" y="138" fontFamily="'Playfair Display', serif" fontSize="70" fontWeight="600" fill="rgba(234,244,255,0.05)">{nick}</text>
        {/* crest */}
        <g transform="translate(606 80)">
          <g className="nm-art-rays" opacity="0.5">
            {rays.map((a, i) => (
              <line key={i} x1="0" y1="-40" x2="0" y2="-52" stroke={c} strokeWidth="2"
                transform={`rotate(${a})`} />
            ))}
          </g>
          <circle r="62" fill="none" stroke={c} strokeWidth="1.5" opacity="0.45" />
          <circle className="nm-art-ring" r="54" fill="none" stroke={c} strokeWidth="2" strokeDasharray="3 9" opacity="0.65" />
          <circle r="40" fill="rgba(8,20,35,0.6)" stroke={c} strokeWidth="1.5" opacity="0.8" />
          <text textAnchor="middle" y="15" fontFamily="'Fira Code', monospace" fontSize="38" fontWeight="700" fill="#eaf4ff">{numeral}</text>
        </g>
      </svg>
    </div>
  );
}

export function NodeModal({
  node, entities, cases, feed, onClose, onSelectEntity,
}: {
  node: Node;
  entities: Entity[];
  cases: Case[];
  feed: LiveMsg[];
  onClose: () => void;
  onSelectEntity: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const geo = NODE_GEO[node.node_id];
  const ref = KODAM_BY_ID[node.node_id];
  const photoSrc = HQ_PHOTO[node.node_id] ?? `/hq/${node.node_id}.jpg`;
  const [photoOk, setPhotoOk] = useState(true);
  useEffect(() => { setPhotoOk(true); }, [node.node_id]);
  const isHub = node.tier === 0;
  const c = riskColor(node.max_risk);
  const status = STATUS(node.max_risk);

  const ents = useMemo(
    () => entities.filter((e) => e.node_id === node.node_id).sort((a, b) => b.risk_score - a.risk_score),
    [entities, node.node_id]);
  const nodeCases = useMemo(
    () => cases.filter((k) => k.node_id === node.node_id).sort((a, b) => b.risk_score - a.risk_score),
    [cases, node.node_id]);

  // threat categories seen on this node (from its cases)
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    nodeCases.forEach((k) => (k.categories ?? []).forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [nodeCases]);

  // recent telemetry for this node from the live feed
  const activity = useMemo(
    () => feed.filter((mm) => mm.kind === "event" && mm.data?.node_id === node.node_id).slice(0, 7),
    [feed, node.node_id]);

  const metrics = [
    { k: "Skor maks", v: node.max_risk.toFixed(0), color: c },
    { k: "Skor rata", v: node.avg_risk.toFixed(0), color: riskColor(node.avg_risk) },
    { k: "Berisiko tinggi", v: `${node.high_count}`, color: node.high_count ? "var(--high)" : "var(--muted)" },
    { k: "Entitas", v: `${node.total}`, color: "var(--text)" },
    { k: "Kasus", v: `${nodeCases.length}`, color: nodeCases.length ? "var(--critical)" : "var(--muted)" },
  ];

  return (
    <div className="nm-backdrop" onClick={onClose}>
      <div className="nm-modal" role="dialog" aria-modal="true" aria-label={node.name} onClick={(e) => e.stopPropagation()}>
        <button className="nm-close" onClick={onClose} aria-label="Tutup">×</button>

        <div className="nm-head-wrap" style={{ ["--c" as any]: c }}>
          {photoOk
            ? <div className="nm-banner"><img className="nm-photo" src={photoSrc} alt="" draggable={false} onError={() => setPhotoOk(false)} /></div>
            : <HqArt numeral={ref?.numeral ?? (isHub ? "★" : "•")} nick={ref?.nick ?? (isHub ? "PUSSIBERAD" : node.name)} c={c} />}
          <div className="nm-head">
          <span className="nm-glyph" aria-hidden="true" />
          <div className="nm-id">
            <div className="nm-tier">
              {isHub ? "Tier 0 · Pusat Kendali Siber" : "Tier 1 · Komando Daerah Militer"}
              {ref?.isNew && <i className="st-badge" style={{ marginLeft: 8 }}>BARU 2025</i>}
            </div>
            <h2>{node.name}</h2>
            <div className="nm-loc">
              {isHub
                ? PUSSIBERAD.name
                : <>Markas {geo?.city ?? "—"}{ref && <> · Wilayah {ref.territory}</>}</>}
              {geo && <span className="nm-coord"> · {Math.abs(geo.lat).toFixed(2)}°{geo.lat >= 0 ? "N" : "S"} {geo.lon.toFixed(2)}°E</span>}
            </div>
          </div>
          <div className="nm-score">
            <span className={`pill sev-${sevFromRisk(node.max_risk)}`}>{status}</span>
            <b style={{ color: c }}>{node.max_risk.toFixed(0)}</b>
            <small>indeks risiko</small>
          </div>
          </div>
        </div>

        {/* live monitoring condition */}
        <div className="nm-monitor">
          <span className="nm-live"><i /> Monitoring aktif</span>
          <div className="nm-gauge" aria-hidden="true">
            <span style={{ width: `${node.max_risk}%`, background: c }} />
          </div>
        </div>

        <div className="nm-stats">
          {metrics.map((m) => (
            <div className="nm-stat" key={m.k}>
              <div className="v" style={{ color: m.color }}>{m.v}</div>
              <div className="k">{m.k}</div>
            </div>
          ))}
        </div>

        {cats.length > 0 && (
          <div className="nm-sec">
            <div className="nm-h">Pola ancaman terdeteksi</div>
            <div className="nm-chips">
              {cats.map(([x, n]) => (
                <span className="cat-chip" key={x}>{CAT_LABEL[x] ?? x} ·{n}</span>
              ))}
            </div>
          </div>
        )}

        <div className="nm-sec">
          <div className="nm-h">Entitas terpantau <span>{ents.length}</span></div>
          <div className="nm-table-wrap">
            <table>
              <thead>
                <tr><th>Entity</th><th>Peran</th><th>Risk</th><th>Severity</th><th>Terakhir</th></tr>
              </thead>
              <tbody>
                {ents.map((e) => (
                  <tr key={e.entity_id} onClick={() => onSelectEntity(e.entity_id)}>
                    <td>{e.display_name}</td>
                    <td className="muted">{ROLE_LABEL[e.role] ?? e.role}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="riskbar"><span style={{ width: `${e.risk_score}%`, background: riskColor(e.risk_score) }} /></div>
                        <b style={{ color: riskColor(e.risk_score) }}>{e.risk_score.toFixed(0)}</b>
                      </div>
                    </td>
                    <td><span className={sevClass(e.severity)}>{e.severity}</span></td>
                    <td className="muted">{fmtTime(e.last_event)}</td>
                  </tr>
                ))}
                {ents.length === 0 && <tr><td colSpan={5} className="muted">Belum ada entitas di atas ambang baseline.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {activity.length > 0 && (
          <div className="nm-sec">
            <div className="nm-h">Aktivitas terbaru</div>
            <div className="nm-act">
              {activity.map((mm, i) => {
                const d = mm.data;
                const risk = d.entity_risk ?? d.risk_score ?? 0;
                return (
                  <div className="nm-act-row" key={i} style={{ borderLeftColor: riskColor(risk) }} onClick={() => d.entity_id && onSelectEntity(d.entity_id)}>
                    <span className="a-ent">{d.display_name ?? d.entity_id}</span>
                    <span className="a-cat">{CAT_LABEL[d.category] ?? d.category}</span>
                    <span className="a-sc" style={{ color: riskColor(risk) }}>{Number(risk).toFixed(0)}</span>
                    <span className="a-ts">{fmtTime(d.ts)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="nm-foot">
          Klik entitas untuk membuka investigasi lengkap · <kbd>Esc</kbd> untuk menutup
        </div>
      </div>
    </div>
  );
}
