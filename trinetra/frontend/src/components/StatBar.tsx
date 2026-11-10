import { Stats } from "../lib/api";

export function StatBar({ stats }: { stats: Stats | null }) {
  const s = stats ?? { events: 0, alerts: 0, signals: 0, uptime_sec: 0, eps: 0 };
  const cells = [
    { k: "Events Diproses", v: s.events.toLocaleString("id-ID"), cls: "" },
    { k: "Events / detik", v: s.eps.toFixed(1), cls: "accent" },
    { k: "Rule Signals", v: s.signals.toLocaleString("id-ID"), cls: "" },
    { k: "Alert / Case", v: s.alerts.toLocaleString("id-ID"), cls: "danger" },
    { k: "Uptime", v: `${Math.floor(s.uptime_sec / 60)}m`, cls: "" },
  ];
  return (
    <div className="stats">
      {cells.map((c) => (
        <div className="stat" key={c.k}>
          <div className={`v ${c.cls}`}>{c.v}</div>
          <div className="k">{c.k}</div>
        </div>
      ))}
    </div>
  );
}
