import { Case, api } from "../lib/api";
import { sevClass, CAT_LABEL, fmtTime } from "../lib/util";

// Case management with analyst verdict (feedback loop §9.1).
export function Cases({ cases, onSelect, onChange }: {
  cases: Case[]; onSelect: (id: string) => void; onChange: () => void;
}) {
  const open = cases.filter((c) => c.status !== "closed").slice(0, 10);
  const verdict = async (e: React.MouseEvent, id: number, v: string) => {
    e.stopPropagation();
    await api.verdict(id, v);
    onChange();
  };
  return (
    <div className="panel">
      <h2>Manajemen Kasus · Triase dan Investigasi</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Case</th><th>Severity</th><th>Risk</th><th>Kategori</th><th>Status</th><th>Verdict</th></tr>
          </thead>
          <tbody>
            {open.map((c) => (
              <tr key={c.case_id} onClick={() => onSelect(c.entity_id)}>
                <td>
                  <div style={{ fontWeight: 600 }}>#{c.case_id} {c.title}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{c.node_id} · {fmtTime(c.created_at)}</div>
                </td>
                <td><span className={sevClass(c.severity)}>{c.severity}</span></td>
                <td><b>{c.risk_score.toFixed(0)}</b></td>
                <td>{c.categories.map((x) => <span className="cat-chip" key={x}>{CAT_LABEL[x] ?? x}</span>)}</td>
                <td className="muted">{c.status}</td>
                <td>
                  {c.verdict ? (
                    <span className="muted">{c.verdict === "true_positive" ? "✔ TP" : "✘ FP"}</span>
                  ) : (
                    <div style={{ display: "flex", gap: 5 }}>
                      <button className="btn tp" onClick={(e) => verdict(e, c.case_id, "true_positive")}>TP</button>
                      <button className="btn fp" onClick={(e) => verdict(e, c.case_id, "false_positive")}>FP</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {open.length === 0 && <tr><td colSpan={6} className="muted">Belum ada case terbuka.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
