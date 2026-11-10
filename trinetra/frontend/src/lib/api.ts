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
