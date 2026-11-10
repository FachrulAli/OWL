import { Correlation } from "../lib/api";

// Tier 0 cross-node correlation findings.
export function Correlations({ items }: { items: Correlation[] }) {
  return (
    <div className="panel">
      <h2>Korelasi Lintas Node (Tier 0)</h2>
      <div className="scroll">
        {items.map((c) => (
          <div className="corr-item" key={c.corr_id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b style={{ color: "#c79bff" }}>⟐ {c.pattern}</b>
              <b style={{ color: "#c79bff" }}>{c.score.toFixed(0)}</b>
            </div>
            <div className="muted" style={{ marginTop: 3 }}>{c.summary}</div>
            <div style={{ marginTop: 4 }}>
              {c.node_ids.map((n) => <span className="cat-chip" key={n}>{n}</span>)}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="muted">Belum ada pola terdistribusi terdeteksi.</div>
        )}
      </div>
    </div>
  );
}
