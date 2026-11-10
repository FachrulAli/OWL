// In-browser demo engine. When the real backend is unreachable (e.g. hosted on
// Vercel), the frontend falls back to this engine so the console runs fully on
// self-generated synthetic telemetry — a national view of the 21 TNI AD Kodam
// with a handful of insiders lighting up across the map.

import type { Stats, Entity, Node, Case, Correlation, HeatCell } from "./api";
import type { LiveMsg } from "./useLive";
import { NODE_GEO } from "../components/indonesiaGeo";

export const MODE = { demo: false, decided: false };

const ROLE_LABEL: Record<string, string> = {
  admin_satsiber: "Admin Satsiber", csirt_analyst: "Analis CSIRT", team_lead: "Komandan",
  operator: "Operator", data_custodian: "Custodian", personel: "Personel", auditor: "Auditor",
};

// 21 Kodam (15 lama + 6 baru XIX–XXIV per Agustus 2025), node_id -> official name.
const KODAM: [string, string][] = [
  ["kodam-jaya", "Kodam Jaya / Jayakarta"],
  ["kodam-im", "Kodam Iskandar Muda"],
  ["kodam-1", "Kodam I / Bukit Barisan"],
  ["kodam-2", "Kodam II / Sriwijaya"],
  ["kodam-3", "Kodam III / Siliwangi"],
  ["kodam-4", "Kodam IV / Diponegoro"],
  ["kodam-5", "Kodam V / Brawijaya"],
  ["kodam-6", "Kodam VI / Mulawarman"],
  ["kodam-9", "Kodam IX / Udayana"],
  ["kodam-12", "Kodam XII / Tanjungpura"],
  ["kodam-13", "Kodam XIII / Merdeka"],
  ["kodam-14", "Kodam XIV / Hasanuddin"],
  ["kodam-16", "Kodam XVI / Pattimura"],
  ["kodam-17", "Kodam XVII / Cenderawasih"],
  ["kodam-18", "Kodam XVIII / Kasuari"],
  ["kodam-19", "Kodam XIX / Tuanku Tambusai"],
  ["kodam-20", "Kodam XX / Tuanku Imam Bonjol"],
  ["kodam-21", "Kodam XXI / Radin Inten"],
  ["kodam-22", "Kodam XXII / Tambun Bungai"],
  ["kodam-23", "Kodam XXIII / Palaka Wira"],
  ["kodam-24", "Kodam XXIV / Mandala Trikora"],
];

const NODES: Node[] = [
  { node_id: "pusat", name: "Mabes TNI AD / Pussiberad", tier: 0, parent_id: null, max_risk: 0, avg_risk: 0, high_count: 0, total: 0 },
  ...KODAM.map(([id, name]) => ({ node_id: id, name, tier: 1, parent_id: "pusat", max_risk: 0, avg_risk: 0, high_count: 0, total: 0 })),
];

interface Ent { id: string; name: string; role: string; node: string; tier: number; }

// insiders spread across the archipelago (Jakarta, Surabaya, Makassar, Papua)
const INSIDER_KODAM: Record<string, { role: string; cat: string }> = {
  "kodam-5": { role: "csirt_analyst", cat: "lateral_movement" },
  "kodam-14": { role: "operator", cat: "config_tampering" },
  "kodam-17": { role: "personel", cat: "usb_exfiltration" },
};
const ROLE_CYCLE = ["operator", "csirt_analyst", "personel", "data_custodian", "team_lead"];

const ENTITIES: Ent[] = [
  { id: "usr-admin-01", name: "Admin Pusat 01", role: "admin_satsiber", node: "pusat", tier: 0 },
  { id: "usr-admin-02", name: "Admin Pusat 02", role: "admin_satsiber", node: "pusat", tier: 0 },
  { id: "usr-auditor-01", name: "Auditor Pusat", role: "auditor", node: "pusat", tier: 0 },
  ...KODAM.map(([id], i) => {
    const city = NODE_GEO[id]?.city ?? id;
    const role = INSIDER_KODAM[id]?.role ?? ROLE_CYCLE[i % ROLE_CYCLE.length];
    return { id: `usr-${id}`, name: `${ROLE_LABEL[role]} ${city}`, role, node: id, tier: 1 };
  }),
];

const INSIDERS: Record<string, string> = {
  "usr-admin-02": "data_exfiltration",
  ...Object.fromEntries(Object.entries(INSIDER_KODAM).map(([id, v]) => [`usr-${id}`, v.cat])),
};

const CATS = ["data_exfiltration", "privilege_abuse", "lateral_movement", "logon_anomaly",
  "suspicious_process", "mass_file_access", "usb_exfiltration", "config_tampering"];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const sev = (r: number) => (r >= 70 ? "critical" : r >= 50 ? "high" : r >= 30 ? "medium" : "low");

interface St { risk: number; cats: Set<string>; hist: { ts: number; risk: number }[]; events: any[]; }

class Engine {
  started = Date.now();
  events = 0; signals = 0;
  state = new Map<string, St>();
  cases = new Map<string, Case>();
  caseSeq = 1;
  corr: Correlation[] = [];
  buckets = new Map<string, Map<string, number>>();
  feed: LiveMsg[] = [];
  warmup = 16;
  tickN = 0;

  constructor() {
    ENTITIES.forEach((e) => this.state.set(e.id, { risk: 0, cats: new Set(), hist: [], events: [] }));
    setInterval(() => this.tick(), 1400);
    this.tick();
  }

  private bucketKey() { const d = new Date(); d.setSeconds(0, 0); return d.toISOString(); }
  private emit(m: LiveMsg) { this.feed = [m, ...this.feed].slice(0, 60); }

  tick() {
    this.tickN++;
    const eps = 60 + Math.random() * 20;
    this.events += Math.round(eps * 1.4);
    for (const s of this.state.values()) s.risk = Math.max(0, s.risk * 0.985);

    const insiderIds = Object.keys(INSIDERS);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const warming = this.tickN <= this.warmup;
      const insiderActive = !warming && Math.random() < 0.72;
      const ent = insiderActive ? ENTITIES.find((e) => e.id === pick(insiderIds))! : pick(ENTITIES);
      const s = this.state.get(ent.id)!;
      const isInsider = !!INSIDERS[ent.id] && !warming;

      if (isInsider) {
        const cat = Math.random() < 0.68 ? INSIDERS[ent.id] : pick(CATS);
        const score = 55 + Math.random() * 42;
        s.risk = Math.min(100, s.risk + Math.min(35, score) * (1 - s.risk / 100));
        s.cats.add(cat);
        this.signals += 1;
        this.bump(cat);
        s.events.unshift({ ts: new Date().toISOString(), category: cat.split("_")[0], activity: cat, command: "", egress_mb: cat.includes("exfil") ? Math.round(600 + Math.random() * 3000) : 0, files_accessed: cat === "mass_file_access" ? 1800 : 12, endpoints_touched: cat === "lateral_movement" ? 95 : 2, src_geo: cat === "logon_anomaly" ? pick(["CN", "RU", "NL-VPN"]) : "ID-OFFICE", login_hour: 3, label_scenario: cat });
        s.events = s.events.slice(0, 40);
        this.emit({ kind: "event", data: { entity_id: ent.id, display_name: ent.name, role: ent.role, node_id: ent.node, tier: ent.tier, category: cat, event_score: Math.round(score), entity_risk: Math.round(s.risk), categories: [cat], ml_anomaly: 0.6 + Math.random() * 0.3, ts: new Date().toISOString() } });
        this.upsertCase(ent, s);
      } else {
        s.risk = Math.max(0, Math.min(18, s.risk + (Math.random() * 3 - 1.6)));
        s.events.unshift({ ts: new Date().toISOString(), category: pick(["process", "file", "network", "logon"]), activity: "normal_activity", command: "", egress_mb: Math.round(Math.random() * 5), files_accessed: Math.round(Math.random() * 20), endpoints_touched: 1, src_geo: "ID-OFFICE", login_hour: 10, label_scenario: "normal" });
        s.events = s.events.slice(0, 40);
      }
      s.hist.push({ ts: Date.now(), risk: s.risk });
      s.hist = s.hist.slice(-60);
    }
    this.updateCorrelations();
  }

  private bump(cat: string) {
    const k = this.bucketKey();
    if (!this.buckets.has(k)) this.buckets.set(k, new Map());
    const m = this.buckets.get(k)!;
    m.set(cat, (m.get(cat) || 0) + 1);
    if (this.buckets.size > 16) { const first = this.buckets.keys().next().value; if (first) this.buckets.delete(first); }
  }

  private upsertCase(ent: Ent, s: St) {
    if (s.risk < 50) return;
    const cats = Array.from(s.cats);
    const existing = this.cases.get(ent.id);
    if (existing) {
      existing.risk_score = Math.round(s.risk); existing.severity = sev(s.risk); existing.categories = cats;
    } else {
      const c: Case = {
        case_id: this.caseSeq++, entity_id: ent.id, role: ent.role, node_id: ent.node, tier: ent.tier,
        severity: sev(s.risk), risk_score: Math.round(s.risk), categories: cats,
        title: `${ent.name} — ${cats.join(", ")}`, summary: `Risiko ${Math.round(s.risk)}/100 pada ${ROLE_LABEL[ent.role]} di ${ent.node}.`,
        status: sev(s.risk) === "critical" ? "escalated" : "open", verdict: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      this.cases.set(ent.id, c);
      this.emit({ kind: "case", data: { ...c, is_new: true } });
    }
  }

  private updateCorrelations() {
    const byCat = new Map<string, Set<string>>();
    for (const [id, s] of this.state) {
      if (s.risk < 50) continue;
      const ent = ENTITIES.find((e) => e.id === id)!;
      s.cats.forEach((c) => { if (!byCat.has(c)) byCat.set(c, new Set()); byCat.get(c)!.add(ent.node); });
    }
    const next: Correlation[] = [];
    let id = 1;
    for (const [cat, nodes] of byCat)
      if (nodes.size >= 2)
        next.push({ corr_id: id++, pattern: cat, entity_ids: [], node_ids: Array.from(nodes), score: Math.min(100, 70 + nodes.size * 8), summary: `Pola '${cat}' terdeteksi serempak di ${nodes.size} node (${Array.from(nodes).join(", ")}).`, created_at: new Date().toISOString() });
    if (next.length && next.length !== this.corr.length) this.emit({ kind: "correlation", data: next[0] });
    this.corr = next;
  }

  stats(): Stats {
    const up = (Date.now() - this.started) / 1000;
    return { events: this.events, alerts: this.cases.size, signals: this.signals, uptime_sec: Math.round(up), eps: Math.round((this.events / Math.max(up, 1)) * 10) / 10 };
  }
  entities(): Entity[] {
    return ENTITIES.map((e) => { const r = Math.round(this.state.get(e.id)!.risk); return { entity_id: e.id, display_name: e.name, role: e.role, node_id: e.node, tier: e.tier, risk_score: r, severity: sev(r), last_event: new Date().toISOString() }; }).sort((a, b) => b.risk_score - a.risk_score);
  }
  nodes(): Node[] {
    return NODES.map((n) => {
      const members = ENTITIES.filter((e) => e.node === n.node_id);
      const risks = members.map((e) => this.state.get(e.id)!.risk);
      const max = risks.length ? Math.max(...risks) : 0;
      const avg = risks.length ? risks.reduce((a, b) => a + b, 0) / risks.length : 0;
      return { ...n, max_risk: Math.round(max), avg_risk: Math.round(avg), high_count: risks.filter((r) => r >= 50).length, total: members.length };
    });
  }
  casesList(): Case[] { return Array.from(this.cases.values()).sort((a, b) => b.risk_score - a.risk_score); }
  correlations(): Correlation[] { return this.corr; }
  heatmap(): HeatCell[] {
    const out: HeatCell[] = []; const seen = new Set<string>();
    for (const e of ENTITIES) { const k = `${e.node}|${e.role}`; if (seen.has(k)) continue; seen.add(k);
      const risks = ENTITIES.filter((x) => x.node === e.node && x.role === e.role).map((x) => this.state.get(x.id)!.risk);
      out.push({ node_id: e.node, role: e.role, risk: Math.round(Math.max(...risks)) }); }
    return out;
  }
  categoryTimeline() {
    const rows: { bucket: string; category: string; count: number }[] = [];
    for (const [b, m] of this.buckets) for (const [cat, c] of m) rows.push({ bucket: b, category: cat, count: c });
    return rows;
  }
  entity(id: string) {
    const e = ENTITIES.find((x) => x.id === id); const s = this.state.get(id);
    if (!e || !s) return null;
    const r = Math.round(s.risk);
    const BL: Record<string, any[]> = {
      admin_satsiber: [{ parameter: "egress_mb", normal_high: 100, static_crit: 500 }, { parameter: "privilege_change", normal_high: 2, static_crit: 5 }],
      personel: [{ parameter: "files_accessed", normal_high: 50, static_crit: 500 }, { parameter: "usb_event", normal_high: 0, static_crit: 1 }],
      operator: [{ parameter: "egress_mb", normal_high: 30, static_crit: 200 }, { parameter: "config_change", normal_high: 3, static_crit: 10 }],
      csirt_analyst: [{ parameter: "endpoints_touched", normal_high: 20, static_crit: 100 }, { parameter: "egress_mb", normal_high: 50, static_crit: 300 }],
    };
    const baselines = (BL[e.role] || [{ parameter: "egress_mb", normal_high: 50, static_crit: 300 }]).map((b) => ({ ...b, normal_low: 0, actual: r > 50 ? b.static_crit * 1.4 : Math.round(b.normal_high * 0.5) }));
    return {
      entity: { entity_id: e.id, display_name: e.name, role: e.role, node_id: e.node, tier: e.tier },
      risk_score: r, severity: sev(r), baselines, actual_24h: {},
      timeline: s.hist.slice().reverse().map((h) => ({ ts: new Date(h.ts).toISOString(), risk_score: Math.round(h.risk), event_score: Math.round(h.risk * 0.6), categories: Array.from(s.cats), ml_anomaly: 0.5 })),
      events: s.events,
    };
  }
  setVerdict(caseId: number, verdict: string) {
    for (const c of this.cases.values()) if (c.case_id === caseId) { c.verdict = verdict; c.status = verdict === "false_positive" ? "closed" : "escalated"; }
    return { ok: true, case_id: caseId, verdict };
  }
}

export const engine = new Engine();
