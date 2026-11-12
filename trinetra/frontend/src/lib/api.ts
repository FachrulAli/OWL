// API base: default to the backend on the same host, port 8000.
// Override by setting window.__TRINETRA_API__ in index.html if needed.
const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
export const API_BASE =
  (typeof window !== "undefined" && (window as any).__TRINETRA_API__) ||
  `http://${host}:8000`;
export const WS_URL = `ws://${host}:8000/ws`;

async function get<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 3500);
  try {
    const r = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(to);
  }
}

// Route a call to the real backend, falling back to the in-browser demo engine
// the first time the backend proves unreachable (e.g. hosted with no backend).
type Eng = typeof import("./demo")["engine"];
async function route<T>(path: string, demoFn: (e: Eng) => T): Promise<T> {
  const { MODE, engine } = await import("./demo");
  if (MODE.demo) return demoFn(engine);
  try {
    const v = await get<T>(path);
    MODE.decided = true;
    return v;
  } catch {
    MODE.demo = true; MODE.decided = true;
    return demoFn(engine);
  }
}

export interface Entity {
  entity_id: string; display_name: string; role: string; node_id: string;
  tier: number; risk_score: number; severity: string; last_event: string | null;
}
export interface Case {
  case_id: number; entity_id: string; role: string; node_id: string; tier: number;
  severity: string; risk_score: number; categories: string[]; title: string;
  summary: string; status: string; verdict: string | null;
  created_at: string; updated_at: string;
}
export interface Node {
  node_id: string; name: string; tier: number; parent_id: string | null;
  max_risk: number; avg_risk: number; high_count: number; total: number;
}
export interface Correlation {
  corr_id: number; pattern: string; entity_ids: string[]; node_ids: string[];
  score: number; summary: string; created_at: string;
}
export interface Stats {
  events: number; alerts: number; signals: number; uptime_sec: number; eps: number;
  chains?: number;
  ingest?: { batches: number; events: number; rejected: number; devices: string[] };
  indicators?: { indicators: number; campaigns: string[] };
  yara?: { loaded: boolean; rules: number; engine: string | null };
}

// Satu anggota rantai: aturan atomik yang menyala pada tahap tertentu.
export interface ChainMember {
  rule: string; ts: string; event_id: string; stage: string;
}

// Satu rantai kill-chain yang TERBUKTI (correlation rule Sigma terpenuhi).
// Ini temuan inti TRINETRA: bukan indikator lepas, tapi urutan yang utuh.
export interface ChainHit {
  ts: string; entity_id: string; display_name?: string; node_id: string;
  tier: number; corr_id: string; corr_type: string; title: string;
  category: string; severity: number; level: string; response: string;
  span_s: number; timespan_s: number; kill_chain: string[]; mitre: string[];
  members: ChainMember[];
}

export interface SigmaRule {
  id: string; sigma_id: string; title: string; description: string;
  domain?: string; service?: string; level: string; category: string;
  severity: number; stage?: string; mitre: string[]; condition?: string;
  fields?: string[]; falsepositives?: string[];
  // khusus correlation rule
  type?: string; rules?: string[]; timespan_s?: number; group_by?: string[];
  count_gte?: number; kill_chain?: string[]; response?: string;
}

export interface SigmaCatalog {
  atomic: SigmaRule[]; correlation: SigmaRule[]; format: string; note: string;
}

export interface IndicatorStatus {
  indicators: number; files: number; campaigns: string[];
  tables: Record<string, number>;
  sources: { name: string; license: string; campaigns: string[] }[];
  catatan: string;
}
export interface HeatCell { node_id: string; role: string; risk: number; }

export const api = {
  stats: () => route<Stats>("/stats", (e) => e.stats()),
  entities: () => route<Entity[]>("/entities", (e) => e.entities()),
  entity: (id: string) => route<any>(`/entities/${id}`, (e) => e.entity(id)),
  cases: () => route<Case[]>("/cases", (e) => e.casesList()),
  nodes: () => route<Node[]>("/nodes", (e) => e.nodes()),
  correlations: () => route<Correlation[]>("/correlations", (e) => e.correlations()),
  heatmap: () => route<HeatCell[]>("/heatmap", (e) => e.heatmap()),
  categoryTimeline: () => route<any[]>("/categories/timeline?hours=6", (e) => e.categoryTimeline()),
  rules: () => route<any[]>("/rules", () => []),
  // ——— domain MTD (HP prajurit) ———
  chains: (limit = 50) =>
    route<ChainHit[]>(`/chains?limit=${limit}`, (e) => e.chains(limit)),
  entityChains: (id: string) =>
    route<ChainHit[]>(`/chains?entity_id=${encodeURIComponent(id)}`,
      (e) => e.chains(50, id)),
  sigma: () => route<SigmaCatalog>("/sigma/rules", (e) => e.sigma()),
  indicators: () => route<IndicatorStatus>("/indicators", (e) => e.indicators()),
  verdict: async (caseId: number, verdict: string) => {
    const { MODE, engine } = await import("./demo");
    if (MODE.demo) return engine.setVerdict(caseId, verdict);
    try {
      const r = await fetch(`${API_BASE}/cases/${caseId}/verdict`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict }),
      });
      return await r.json();
    } catch {
      MODE.demo = true;
      return engine.setVerdict(caseId, verdict);
    }
  },
};
