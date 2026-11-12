import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Stats, Entity, Node, Case, ChainHit } from "./lib/api";
import { useLive } from "./lib/useLive";
import { riskColor, CAT_LABEL, fmtTime, STAGE_LABEL } from "./lib/util";
import { NODE_GEO } from "./components/indonesiaGeo";
import { StatBar } from "./components/StatBar";
import { EntityTable } from "./components/EntityTable";
import { Cases } from "./components/Cases";
import { EntityDrawer } from "./components/EntityDrawer";
import { NodeModal } from "./components/NodeModal";
import { IndonesiaMap } from "./components/IndonesiaMap";
import { ChainList, KillChainTimeline } from "./components/KillChain";
import { MODE } from "./lib/demo";

type TierFilter = "all" | "pusat" | "kodam";

// Tier-0 command console — cockpit layout (map centerpiece flanked by HUD rails).
export default function Console({ onExit }: { onExit: () => void }) {
  const { feed, connected } = useLive();
  const [stats, setStats] = useState<Stats | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [nodeSel, setNodeSel] = useState<string | null>(null);
  const [tier, setTier] = useState<TierFilter>("all");
  const [chains, setChains] = useState<ChainHit[]>([]);

  const refresh = useCallback(() => {
    api.stats().then(setStats).catch(() => {});
    api.entities().then(setEntities).catch(() => {});
    api.nodes().then(setNodes).catch(() => {});
    api.cases().then(setCases).catch(() => {});
    api.chains(24).then(setChains).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  // clicking a node (map or roster) opens its command card popup
  const openNode = useCallback((nid: string) => setNodeSel(nid), []);

  // left-rail roster: hub first, then nodes by descending risk, filtered by tier
  const roster = useMemo(() => {
    const plotted = nodes.filter((n) => NODE_GEO[n.node_id]);
    const filtered = plotted.filter((n) =>
      tier === "all" ? true : tier === "pusat" ? n.tier === 0 : n.tier === 1);
    return filtered.sort((a, b) =>
      (a.tier - b.tier) || (b.max_risk - a.max_risk));
  }, [nodes, tier]);

  // right-rail intel summary
  const intel = useMemo(() => {
    const total = entities.length;
    const high = entities.filter((e) => e.risk_score >= 70).length;
    const top = entities.reduce((m, e) => Math.max(m, e.risk_score), 0);
    const critNodes = nodes.filter((n) => n.max_risk >= 70).length;
    // perangkat yang punya rantai terbukti — angka inilah yang benar-benar
    // berarti; "indikator menyala" saja tidak dihitung sebagai temuan.
    const chained = new Set(chains.map((c) => c.entity_id)).size;
    return { total, high, top, critNodes, cases: cases.length, chained };
  }, [entities, nodes, cases, chains]);

  const feedItems = feed.filter((m) => m.kind === "event" || m.kind === "case"
    || m.kind === "correlation" || m.kind === "chain").slice(0, 40);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand" style={{ cursor: "pointer" }} onClick={onExit} title="Kembali ke beranda">
          <div className="eye" />
          <div>
            <h1>TRINETRA</h1>
            <small>Tier 0 · Mobile Threat Defense</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 18 }}>
          <span className={`status-dot ${connected ? "on" : "off"}`} />
          <span className="muted" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
            {connected ? (MODE.demo ? "DEMO LANGSUNG" : "STREAM AKTIF") : "menyambung ulang…"}
          </span>
        </div>
        <div className="tagline">
          Satsiber TNI AD / Pussiberad — deteksi zero-click pada HP dinas, korelasi kill-chain, triase, dan eskalasi
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
          <button className="base-link"
            onClick={() => { window.location.hash = "/deteksi"; }}
            title="Lihat seluruh aturan deteksi yang dipakai — bobot, field yang dibaca, dan false positive yang diakui">
            Aturan deteksi →
          </button>
          <button className="base-link"
            onClick={() => { window.location.hash = "/agent"; }}
            title="Unduh agent MTD dan panduan pemasangannya di HP dinas">
            Pasang agent →
          </button>
        </div>
      </div>

      {/* ───────── command-center cockpit ───────── */}
      <div className="cc">
        <div className="cc-grid">
          {/* LEFT — command roster */}
          <aside className="cc-rail anim-left" aria-label="Sebaran komando">
            <div className="cc-h">Sebaran Komando <span>{roster.length} NODE</span></div>
            <div className="cc-seg" role="group" aria-label="Saring tier">
              <button aria-pressed={tier === "all"} onClick={() => setTier("all")}>Semua</button>
              <button aria-pressed={tier === "pusat"} onClick={() => setTier("pusat")}>Pusat</button>
              <button aria-pressed={tier === "kodam"} onClick={() => setTier("kodam")}>Kodam</button>
            </div>
            <div className="cc-roster cc-scroll">
              {roster.map((n) => {
                const isHub = n.tier === 0;
                const c = riskColor(n.max_risk);
                const label = isHub ? "Pussiberad" : n.name.replace(/^Kodam\s*/i, "");
                return (
                  <button
                    key={n.node_id}
                    className={`cc-node${isHub ? " is-hub" : ""}`}
                    style={{ ["--c" as any]: c }}
                    onClick={() => openNode(n.node_id)}
                    title={`${n.name} — buka kartu komando`}>
                    <span className="nm">{label}</span>
                    <span className="rk">{n.max_risk.toFixed(0)}</span>
                    <span className="cy">{NODE_GEO[n.node_id]?.city ?? "—"} · {n.high_count}/{n.total} tinggi</span>
                    <span className="cc-bar"><i style={{ ["--c" as any]: c, transform: `scaleX(${Math.max(0.03, n.max_risk / 100)})` }} /></span>
                  </button>
                );
              })}
              {roster.length === 0 && <div className="cc-note">Memuat node…</div>}
            </div>
          </aside>

          {/* CENTER — map scope + telemetry strip */}
          <section className="cc-center">
            <div className="cc-map anim-scale" style={{ animationDelay: ".06s" }}>
              <IndonesiaMap nodes={nodes} onPick={openNode} />
            </div>
            <div className="anim-up" style={{ animationDelay: ".12s" }}><StatBar stats={stats} /></div>
          </section>

          {/* RIGHT — intel summary + live feed */}
          <aside className="cc-rail anim-right" aria-label="Ringkasan intel">
            <div className="cc-h">Ringkasan Intel</div>
            <div className="cc-metric">
              <span className="lb">HP dinas terpantau</span>
              <span className="v accent">{intel.total}</span>
              <span className="cc-bar"><i style={{ transform: "scaleX(1)" }} /></span>
            </div>
            <div className="cc-metric">
              <span className="lb">Berisiko tinggi (≥70)</span>
              <span className="v danger">{intel.high}</span>
              <span className="cc-bar"><i style={{ ["--c" as any]: "var(--critical)", transform: `scaleX(${Math.max(0.02, intel.high / Math.max(1, intel.total))})` }} /></span>
            </div>
            <div className="cc-metric">
              <span className="lb">Rantai kill-chain terbukti</span>
              <span className="v danger">{intel.chained}</span>
              <span className="cc-bar"><i style={{ ["--c" as any]: "var(--critical)", transform: `scaleX(${Math.max(0.02, intel.chained / Math.max(1, intel.total))})` }} /></span>
            </div>
            <div className="cc-metric">
              <span className="lb">Kasus aktif</span>
              <span className="v">{intel.cases}</span>
              <span className="cc-bar"><i style={{ ["--c" as any]: "var(--high)", transform: `scaleX(${Math.max(0.02, Math.min(1, intel.cases / 12))})` }} /></span>
            </div>
            <div className="cc-metric">
              <span className="lb">Skor tertinggi · node kritis</span>
              <span className="v" style={{ color: riskColor(intel.top) }}>{intel.top.toFixed(0)}<small style={{ color: "var(--faint)", fontSize: 13, fontFamily: "var(--font-mono)" }}> ·{intel.critNodes}</small></span>
              <span className="cc-bar"><i style={{ ["--c" as any]: riskColor(intel.top), transform: `scaleX(${Math.max(0.02, intel.top / 100)})` }} /></span>
            </div>

            <div className="cc-div" />
            <div className="cc-h">Aliran Langsung <span className="cc-note">realtime</span></div>
            <div className="cc-feed">
              {feedItems.map((m, i) => {
                if (m.kind === "chain") {
                  const d = m.data;
                  const stages: string[] = d.kill_chain ?? [];
                  return (
                    <div key={i} className="feed-item"
                      style={{ borderLeftColor: "var(--critical)", background: "rgba(226,66,74,0.09)", cursor: "pointer" }}
                      onClick={() => setSelected(d.entity_id)}>
                      <div className="line1">
                        <span className="ent" style={{ color: "#ff9d9d" }}>
                          ⛓ RANTAI TERBUKTI
                        </span>
                        <span style={{ color: "#ff9d9d", fontWeight: 700 }}>
                          {Number(d.severity).toFixed(0)}
                        </span>
                      </div>
                      <div className="cats">
                        {d.display_name ?? d.entity_id} · {d.node_id}
                        {d.ts ? ` · ${fmtTime(d.ts)}` : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                        {stages.map((s) => STAGE_LABEL[s] ?? s).join(" → ")}
                      </div>
                    </div>
                  );
                }
                if (m.kind === "correlation") {
                  const d = m.data;
                  return (
                    <div key={i} className="feed-item" style={{ borderLeftColor: "#b06cff", background: "rgba(176,108,255,0.08)" }}>
                      <div className="line1">
                        <span className="ent" style={{ color: "#c79bff" }}>⟐ KORELASI LINTAS NODE</span>
                        <span style={{ color: "#c79bff", fontWeight: 700 }}>{Number(d.score).toFixed(0)}</span>
                      </div>
                      <div className="cats">{d.summary}</div>
                    </div>
                  );
                }
                const d = m.data;
                const risk = d.entity_risk ?? d.risk_score ?? 0;
                const cats: string[] = d.categories ?? [];
                const isCase = m.kind === "case";
                return (
                  <div key={i} className="feed-item" style={{ borderLeftColor: riskColor(risk), cursor: "pointer" }} onClick={() => setSelected(d.entity_id)}>
                    <div className="line1">
                      <span className="ent">{isCase && <span style={{ color: riskColor(risk) }}>● </span>}{d.display_name ?? d.entity_id}</span>
                      <span style={{ color: riskColor(risk), fontWeight: 700 }}>{Number(risk).toFixed(0)}</span>
                    </div>
                    <div className="cats">
                      {d.node_id} · {isCase ? "CASE" : (CAT_LABEL[d.category] ?? d.category)}
                      {d.benign ? " · indikator tunggal (bukan kasus)" : ""}
                      {d.ml_anomaly ? ` · UEBA ${Number(d.ml_anomaly).toFixed(2)}` : ""}
                      {d.ts ? ` · ${fmtTime(d.ts)}` : ""}
                    </div>
                    <div>{cats.map((c) => <span className="cat-chip" key={c}>{CAT_LABEL[c] ?? c}</span>)}</div>
                  </div>
                );
              })}
              {feedItems.length === 0 && <div className="cc-note">Menunggu event…</div>}
            </div>
          </aside>
        </div>
      </div>

      {/* ───────── satu slide investigasi di bawah cockpit ───────── */}
      <div className="grid cols" style={{ paddingTop: 4 }}>
        <div className="anim-up"><ChainList chains={chains} onSelect={setSelected} /></div>
        <div className="anim-up" style={{ animationDelay: ".04s" }}>
          <EntityTable entities={entities} onSelect={setSelected} />
        </div>
      </div>

      <div className="grid cols">
        <div className="anim-up" style={{ animationDelay: ".08s" }}>
          <Cases cases={cases} onSelect={setSelected} onChange={refresh} />
        </div>
        <div className="anim-up" style={{ animationDelay: ".12s" }}>
          <div className="panel">
            <h2>Rantai Terbaru — Rinci</h2>
            {chains[0]
              ? <KillChainTimeline hit={chains[0]} />
              : <div className="muted">Menunggu rantai pertama…</div>}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "6px 0 22px", color: "var(--faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
        TRINETRA v2.0 · Mobile Threat Defense · Kartika Cyber Hackathon 2026
      </div>

      {nodeSel && nodes.find((n) => n.node_id === nodeSel) && (
        <NodeModal
          node={nodes.find((n) => n.node_id === nodeSel)!}
          entities={entities}
          cases={cases}
          feed={feed}
          onClose={() => setNodeSel(null)}
          onSelectEntity={(id) => { setNodeSel(null); setSelected(id); }}
        />
      )}
      {selected && <EntityDrawer entityId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
