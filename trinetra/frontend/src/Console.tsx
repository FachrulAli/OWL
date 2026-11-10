import { useCallback, useEffect, useState } from "react";
import { api, Stats, Entity, Node, Case, Correlation, HeatCell } from "./lib/api";
import { useLive } from "./lib/useLive";
import { StatBar } from "./components/StatBar";
import { Orchestration } from "./components/Orchestration";
import { Heatmap } from "./components/Heatmap";
import { EntityTable } from "./components/EntityTable";
import { LiveFeed } from "./components/LiveFeed";
import { CategoryTrend } from "./components/CategoryTrend";
import { Cases } from "./components/Cases";
import { Correlations } from "./components/Correlations";
import { EntityDrawer } from "./components/EntityDrawer";

// Tier-0 command console. Reached from the landing page via #/console.
export default function Console({ onExit }: { onExit: () => void }) {
  const { feed, connected } = useLive();
  const [stats, setStats] = useState<Stats | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [corr, setCorr] = useState<Correlation[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.stats().then(setStats).catch(() => {});
    api.entities().then(setEntities).catch(() => {});
    api.nodes().then(setNodes).catch(() => {});
    api.cases().then(setCases).catch(() => {});
    api.correlations().then(setCorr).catch(() => {});
    api.heatmap().then(setHeat).catch(() => {});
    api.categoryTimeline().then(setTrend).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand" style={{ cursor: "pointer" }} onClick={onExit} title="Kembali ke beranda">
          <div className="eye" />
          <div>
            <h1>TRINETRA</h1>
            <small>Tier 0 · Command Console</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 18 }}>
          <span className={`status-dot ${connected ? "on" : "off"}`} />
          <span className="muted" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
            {connected ? "STREAM AKTIF" : "menyambung ulang…"}
          </span>
        </div>
        <div className="tagline">
          Satsiber TNI AD / Pussiberad — korelasi lintas node, triase, dan eskalasi
        </div>
      </div>

      <div className="grid" style={{ paddingBottom: 0 }}>
        <StatBar stats={stats} />
      </div>

      <div className="grid cols">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Orchestration nodes={nodes} />
          <EntityTable entities={entities} onSelect={setSelected} />
          <Cases cases={cases} onSelect={setSelected} onChange={refresh} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <LiveFeed feed={feed} onSelect={setSelected} />
          <Correlations items={corr} />
        </div>
      </div>

      <div className="grid cols">
        <Heatmap cells={heat} />
        <CategoryTrend rows={trend} />
      </div>

      <div style={{ textAlign: "center", padding: "10px 0 24px", color: "var(--faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
        TRINETRA v2.0 · Kartika Cyber Hackathon 2026
      </div>

      {selected && <EntityDrawer entityId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
