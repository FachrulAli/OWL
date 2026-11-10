import { LiveMsg } from "../lib/useLive";
import { riskColor, CAT_LABEL, fmtTime } from "../lib/util";

// Live event/alert feed from the WebSocket stream.
export function LiveFeed({ feed, onSelect }: { feed: LiveMsg[]; onSelect: (id: string) => void }) {
  const items = feed.filter((m) => m.kind === "event" || m.kind === "case" || m.kind === "correlation");
  return (
    <div className="panel" style={{ height: "100%" }}>
      <h2>Live Detection Feed</h2>
      <div className="feed">
        {items.map((m, i) => {
          if (m.kind === "correlation") return <CorrLine key={i} d={m.data} />;
          const d = m.data;
          const risk = d.entity_risk ?? d.risk_score ?? 0;
          const cats: string[] = d.categories ?? [];
          const isCase = m.kind === "case";
          return (
            <div
              key={i}
              className="feed-item"
              style={{ borderLeftColor: riskColor(risk), cursor: "pointer" }}
              onClick={() => onSelect(d.entity_id)}
            >
              <div className="line1">
                <span className="ent">
                  {isCase && <span style={{ color: riskColor(risk) }}>● </span>}
                  {d.display_name ?? d.entity_id}
                </span>
                <span style={{ color: riskColor(risk), fontWeight: 700 }}>{Number(risk).toFixed(0)}</span>
              </div>
              <div className="cats">
                {d.node_id} · {isCase ? "CASE" : d.category}
                {d.ml_anomaly ? ` · UEBA ${Number(d.ml_anomaly).toFixed(2)}` : ""}
                {d.ts ? ` · ${fmtTime(d.ts)}` : ""}
              </div>
              <div>{cats.map((c) => <span className="cat-chip" key={c}>{CAT_LABEL[c] ?? c}</span>)}</div>
            </div>
          );
        })}
        {items.length === 0 && <div className="muted">Menunggu event…</div>}
      </div>
    </div>
  );
}

function CorrLine({ d }: { d: any }) {
  return (
    <div className="feed-item" style={{ borderLeftColor: "#b06cff", background: "rgba(176,108,255,0.08)" }}>
      <div className="line1">
        <span className="ent" style={{ color: "#c79bff" }}>⟐ KORELASI LINTAS NODE</span>
        <span style={{ color: "#c79bff", fontWeight: 700 }}>{Number(d.score).toFixed(0)}</span>
      </div>
      <div className="cats">{d.summary}</div>
    </div>
  );
}
