import { HeatCell } from "../lib/api";
import { riskColor, ROLE_LABEL } from "../lib/util";

// Risk heatmap: node (rows) x role (cols).
export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const nodes = Array.from(new Set(cells.map((c) => c.node_id)));
  const roles = Array.from(new Set(cells.map((c) => c.role)));
  const map = new Map(cells.map((c) => [`${c.node_id}|${c.role}`, c.risk]));

  const grid = `110px repeat(${roles.length}, 1fr)`;
  return (
    <div className="panel">
      <h2>Risk Heatmap — Node × Role</h2>
      <div className="heatmap" style={{ gridTemplateColumns: grid }}>
        <div className="heat-corner" />
        {roles.map((r) => (
          <div className="heat-head" key={r}>{ROLE_LABEL[r] ?? r}</div>
        ))}
        {nodes.map((n) => (
          <Row key={n} node={n} roles={roles} map={map} grid={grid} />
        ))}
      </div>
    </div>
  );
}

function Row({ node, roles, map }: { node: string; roles: string[]; map: Map<string, number>; grid: string }) {
  return (
    <>
      <div className="heat-head">{node}</div>
      {roles.map((r) => {
        const v = map.get(`${node}|${r}`);
        const has = v !== undefined;
        return (
          <div
            className="heat-cell"
            key={r}
            style={{
              background: has ? riskColor(v!) + "33" : "#0e1524",
              border: has ? `1px solid ${riskColor(v!)}66` : "1px solid #16203400",
              color: has ? riskColor(v!) : "#2b3a55",
            }}
            title={`${node} / ${r}: ${has ? v!.toFixed(0) : "—"}`}
          >
            {has ? v!.toFixed(0) : "·"}
          </div>
        );
      })}
    </>
  );
}
