import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { riskColor, ROLE_LABEL, sevClass, CAT_LABEL, fmtTime } from "../lib/util";

export function EntityDrawer({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.entity(entityId).then((x) => alive && setD(x)).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [entityId]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <span className="close-x" onClick={onClose}>×</span>
          {!d ? <h2>Memuat…</h2> : (
            <>
              <h2 style={{ color: "var(--text)", fontSize: 18, letterSpacing: 0 }}>
                {d.entity.display_name}
              </h2>
              <div className="muted">
                {ROLE_LABEL[d.entity.role] ?? d.entity.role} · {d.entity.node_id} · {d.entity.entity_id}
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span className={sevClass(d.severity)}>{d.severity}</span>
                <b style={{ color: riskColor(d.risk_score), fontSize: 22 }}>{d.risk_score.toFixed(0)}</b>
                <span className="muted">/ 100 risk score</span>
              </div>
            </>
          )}
        </div>
        {d && (
          <div className="drawer-body">
            <BaselineChart baselines={d.baselines} />
            <RiskTimeline timeline={d.timeline} />
            <RecentEvents events={d.events} />
          </div>
        )}
      </div>
    </>
  );
}

function BaselineChart({ baselines }: { baselines: any[] }) {
  const data = baselines.map((b) => ({
    name: b.parameter,
    actual: b.actual,
    normal: b.normal_high ?? 0,
    crit: b.static_crit ?? 0,
    over: b.static_crit ? b.actual >= b.static_crit : false,
  }));
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 12 }}>Baseline vs Aktual (24 jam)</h2>
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 42)}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" stroke="#8698b0" fontSize={11} />
          <YAxis type="category" dataKey="name" stroke="#8698b0" fontSize={11} width={110} />
          <Tooltip contentStyle={{ background: "#0e1621", border: "1px solid #22364d", borderRadius: 8 }} />
          <Bar dataKey="normal" name="Batas Normal" fill="#24344a" radius={3} />
          <Bar dataKey="actual" name="Aktual" radius={3}>
            {data.map((e, i) => <Cell key={i} fill={e.over ? "#ff4d57" : "#1fe08f"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RiskTimeline({ timeline }: { timeline: any[] }) {
  const data = [...timeline].reverse().map((t) => ({
    t: fmtTime(t.ts),
    risk: t.risk_score,
    event: t.event_score,
  }));
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 12 }}>Investigation Timeline — Evolusi Risk Score</h2>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid stroke="#182435" strokeDasharray="3 3" />
          <XAxis dataKey="t" stroke="#8698b0" fontSize={10} />
          <YAxis stroke="#8698b0" fontSize={11} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: "#0e1621", border: "1px solid #22364d", borderRadius: 8 }} />
          <Line type="monotone" dataKey="risk" name="Entity Risk" stroke="#f0883c" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="event" name="Event Score" stroke="#4f8cff" dot={false} strokeWidth={1} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecentEvents({ events }: { events: any[] }) {
  return (
    <div>
      <h2 style={{ fontSize: 12 }}>Event Terakhir</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>Waktu</th><th>Kategori</th><th>Aktivitas</th><th>Detail</th></tr></thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} style={e.label_scenario !== "normal" ? { background: "rgba(226,66,74,0.08)" } : {}}>
                <td className="muted">{fmtTime(e.ts)}</td>
                <td>{e.category}</td>
                <td>{e.activity}</td>
                <td className="muted" style={{ fontSize: 11 }}>
                  {e.command && `cmd: ${e.command} `}
                  {e.egress_mb > 0 && `· ${e.egress_mb}MB `}
                  {e.files_accessed > 50 && `· ${e.files_accessed} files `}
                  {e.src_geo && e.src_geo !== "ID-OFFICE" && `· geo: ${e.src_geo} `}
                  {e.label_scenario !== "normal" && (
                    <span className="cat-chip" style={{ background: "rgba(226,66,74,0.2)", color: "#ff7b82" }}>
                      {CAT_LABEL[e.label_scenario] ?? e.label_scenario}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
