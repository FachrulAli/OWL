import { Entity } from "../lib/api";
import { riskColor, ROLE_LABEL, sevClass, fmtTime } from "../lib/util";

export function EntityTable({ entities, onSelect }: { entities: Entity[]; onSelect: (id: string) => void }) {
  const top = entities.slice(0, 12);
  return (
    <div className="panel">
      <h2>HP Dinas Berisiko Tertinggi
        <span className="muted" style={{ fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
          skor terakumulasi, meluruh seiring waktu
        </span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>Perangkat</th>
            <th>Pemegang</th>
            <th>Komando</th>
            <th>Risiko</th>
            <th>Tingkat</th>
            <th>Terakhir</th>
          </tr>
        </thead>
        <tbody>
          {top.map((e) => (
            <tr key={e.entity_id} onClick={() => onSelect(e.entity_id)}>
              <td>{e.display_name}</td>
              <td className="muted">{ROLE_LABEL[e.role] ?? e.role}</td>
              <td className="muted">{e.node_id}</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="riskbar">
                    <span style={{ width: `${e.risk_score}%`, background: riskColor(e.risk_score) }} />
                  </div>
                  <b style={{ color: riskColor(e.risk_score) }}>{e.risk_score.toFixed(0)}</b>
                </div>
              </td>
              <td><span className={sevClass(e.severity)}>{e.severity}</span></td>
              <td className="muted">{fmtTime(e.last_event)}</td>
            </tr>
          ))}
          {top.length === 0 && (
            <tr><td colSpan={6} className="muted">Menunggu telemetri HP… (warm-up baseline)</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
