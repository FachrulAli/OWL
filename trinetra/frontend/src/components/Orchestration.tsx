import { Node } from "../lib/api";
import { riskColor } from "../lib/util";

// 3-tier orchestration tree (pusat -> kodam -> satuan) with aggregated risk.
export function Orchestration({ nodes }: { nodes: Node[] }) {
  const byTier = (t: number) => nodes.filter((n) => n.tier === t);
  const tiers = [
    { t: 0, label: "Tier 0 — Satsiber TNI AD / Pussiberad (Pusat)" },
    { t: 1, label: "Tier 1 — CSIRT Kodam" },
    { t: 2, label: "Tier 2 — Satuan / Wilayah" },
  ];
  return (
    <div className="panel">
      <h2>Orkestrasi Berjenjang — Command Tree</h2>
      <div className="tier-tree">
        {tiers.map((tier) => (
          <div key={tier.t}>
            <div className="tier-label">{tier.label}</div>
            <div className="tier-row">
              {byTier(tier.t).map((n) => (
                <div
                  className="node-card"
                  key={n.node_id}
                  style={{ borderLeftColor: riskColor(n.max_risk) }}
                >
                  <div className="nm">{n.name}</div>
                  <div className="meta">
                    {n.total} entity · {n.high_count} berisiko tinggi
                  </div>
                  <div className="risk" style={{ color: riskColor(n.max_risk) }}>
                    {n.max_risk.toFixed(0)}
                    <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
                      {" "}max risk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
