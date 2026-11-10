// API base: default to the backend on the same host, port 8000.
// Override by setting window.__TRINETRA_API__ in index.html if needed.
const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
export const API_BASE =
  (typeof window !== "undefined" && (window as any).__TRINETRA_API__) ||
  `http://${host}:8000`;
export const WS_URL = `ws://${host}:8000/ws`;

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
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
  stats: () => get<Stats>("/stats"),
  entities: () => get<Entity[]>("/entities"),
  entity: (id: string) => get<any>(`/entities/${id}`),
  cases: () => get<Case[]>("/cases"),
  nodes: () => get<Node[]>("/nodes"),
  correlations: () => get<Correlation[]>("/correlations"),
  heatmap: () => get<HeatCell[]>("/heatmap"),
  categoryTimeline: () => get<any[]>("/categories/timeline?hours=6"),
  rules: () => get<any[]>("/rules"),
  verdict: async (caseId: number, verdict: string) => {
    const r = await fetch(`${API_BASE}/cases/${caseId}/verdict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict }),
    });
    return r.json();
  },
};
