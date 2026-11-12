// Mesin demo in-browser (mode MTD / zero-click).
//
// Dipakai ketika backend tidak terjangkau — misalnya saat frontend dihosting di
// Vercel tanpa backend. Mesin ini MENIRU pipeline asli, bukan menggantinya
// dengan cerita lain: roster perangkat, daftar HP yang dikompromikan, tahap
// kill-chain, dan ambang risiko semuanya sama dengan yang ada di
// services/simulator + services/backend. Dengan begitu demo publik
// menunjukkan perilaku sistem yang sebenarnya.
//
// Yang TIDAK bisa ditiru di browser: ClickHouse, Kafka, UEBA Isolation Forest,
// dan pencocokan 3.166 indikator STIX2 — angka indikator di sini dilaporkan
// sebagai metadata, bukan hasil pencocokan nyata.

import type {
  Stats, Entity, Node, Case, Correlation, HeatCell, ChainHit, ChainMember,
  SigmaCatalog, IndicatorStatus,
} from "./api";
import type { LiveMsg } from "./useLive";
import { NODE_GEO } from "../components/indonesiaGeo";

export const MODE = { demo: false, decided: false };

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

const JAB: Record<string, string> = {
  pati: "Pangdam", pamen_intel: "Pamen Intel", pamen_ops: "Pamen Ops",
  pama_siber: "Pama Siber", bintara_komlek: "Ba Komlek", ajudan: "Ajudan",
  prajurit: "Prajurit",
};

interface Dev {
  id: string; role: string; node: string; tier: number;
  platform: string; os: string; model: string; patch: number;
}

// Roster identik dengan services/simulator/devices.py
const DEVICES: Dev[] = [
  ["hp-pusat-pangti", "pati", "pusat", 0, "ios", "17.5.1", "iPhone 15 Pro", 21],
  ["hp-pusat-intel", "pamen_intel", "pusat", 0, "android", "14", "Samsung S24", 33],
  ["hp-pusat-siber", "pama_siber", "pusat", 0, "android", "15", "Pixel 8", 8],
  ["hp-pusat-ajudan", "ajudan", "pusat", 0, "ios", "16.7.8", "iPhone 13", 194],
  ["hp-kodam-jaya-01", "pati", "kodam-jaya", 1, "ios", "17.4", "iPhone 15", 57],
  ["hp-kodam-jaya-02", "pamen_intel", "kodam-jaya", 1, "android", "14", "Samsung S23", 40],
  ["hp-kodam-im-01", "pamen_ops", "kodam-im", 1, "android", "13", "Oppo Reno 10", 88],
  ["hp-kodam-1-01", "pamen_intel", "kodam-1", 1, "android", "14", "Samsung A54", 62],
  ["hp-kodam-2-01", "bintara_komlek", "kodam-2", 1, "android", "12", "Xiaomi Redmi 12", 212],
  ["hp-kodam-3-01", "pati", "kodam-3", 1, "ios", "17.5", "iPhone 14 Pro", 19],
  ["hp-kodam-4-01", "prajurit", "kodam-4", 1, "android", "13", "Vivo Y27", 95],
  ["hp-kodam-5-01", "pamen_intel", "kodam-5", 1, "ios", "16.6", "iPhone 13 Pro", 151],
  ["hp-kodam-5-02", "prajurit", "kodam-5", 1, "android", "14", "Samsung A34", 44],
  ["hp-kodam-6-01", "pamen_ops", "kodam-6", 1, "android", "14", "Pixel 7a", 12],
  ["hp-kodam-9-01", "bintara_komlek", "kodam-9", 1, "android", "13", "Samsung A24", 73],
  ["hp-kodam-12-01", "prajurit", "kodam-12", 1, "android", "12", "Realme C55", 231],
  ["hp-kodam-13-01", "pamen_ops", "kodam-13", 1, "android", "14", "Samsung S22", 36],
  ["hp-kodam-14-01", "pamen_intel", "kodam-14", 1, "android", "15", "Pixel 8 Pro", 6],
  ["hp-kodam-16-01", "prajurit", "kodam-16", 1, "android", "13", "Infinix Note 30", 118],
  ["hp-kodam-17-01", "pamen_intel", "kodam-17", 1, "android", "14", "Samsung S23 FE", 48],
  ["hp-kodam-17-02", "bintara_komlek", "kodam-17", 1, "android", "12", "Xiaomi Poco M5", 176],
  ["hp-kodam-18-01", "prajurit", "kodam-18", 1, "android", "13", "Oppo A78", 102],
  ["hp-kodam-19-01", "pamen_ops", "kodam-19", 1, "android", "14", "Samsung A55", 27],
  ["hp-kodam-20-01", "prajurit", "kodam-20", 1, "android", "13", "Vivo Y36", 84],
  ["hp-kodam-21-01", "bintara_komlek", "kodam-21", 1, "android", "12", "Redmi Note 12", 199],
  ["hp-kodam-22-01", "prajurit", "kodam-22", 1, "android", "14", "Samsung A15", 51],
  ["hp-kodam-23-01", "pamen_ops", "kodam-23", 1, "android", "14", "Pixel 7", 15],
  ["hp-kodam-24-01", "pamen_intel", "kodam-24", 1, "ios", "17.2", "iPhone 14", 69],
  ["hp-kodam-24-02", "prajurit", "kodam-24", 1, "android", "13", "Itel P55", 143],
].map((d: any) => ({
  id: d[0], role: d[1], node: d[2], tier: d[3], platform: d[4], os: d[5],
  model: d[6], patch: d[7],
}));

const devName = (d: Dev) => `${JAB[d.role]} · ${d.model}`;

// Definisi rantai — tahap, aturan yang menyala, dan narasinya. Sama dengan
// mobile_scenarios.py + mobile_correlation.yml di backend.
interface ChainDef {
  corr_id: string; title: string; category: string; severity: number;
  level: string; response: string; corr_type: string; timespan_s: number;
  mitre: string[];
  steps: { stage: string; rule: string; detail: string }[];
}

const CHAIN_DEFS: Record<string, ChainDef> = {
  zeroclick_imessage: {
    corr_id: "corr_zeroclick_fullchain",
    title: "Rantai zero-click lengkap — pengiriman, eksploitasi, eksfiltrasi",
    category: "zero_click_exploit", severity: 85, level: "critical",
    response: "isolate", corr_type: "temporal_ordered", timespan_s: 600,
    mitre: ["T1203", "T1660", "T1639"],
    steps: [
      { stage: "delivery", rule: "mob_silent_inbound", detail: "lampiran iMessage dari pengirim tak dikenal, tanpa notifikasi, layar mati" },
      { stage: "exploit", rule: "mob_parser_crash_idle", detail: "IMTransferAgent berhenti tidak wajar (SIGSEGV), CPU 94%" },
      { stage: "implant", rule: "mob_thermal_idle", detail: "termal 4/4, baterai turun 11,2% saat idle & tidak dicas" },
      { stage: "c2", rule: "mob_covert_egress_idle", detail: "unggah 68 MB ke AS210644 AEZA, domain baru terdaftar" },
      { stage: "collection", rule: "mob_covert_sensor", detail: "mikrofon aktif tanpa aplikasi di depan" },
    ],
  },
  zeroclick_whatsapp: {
    corr_id: "corr_zeroclick_fullchain",
    title: "Rantai zero-click lengkap — pengiriman, eksploitasi, eksfiltrasi",
    category: "zero_click_exploit", severity: 85, level: "critical",
    response: "isolate", corr_type: "temporal_ordered", timespan_s: 600,
    mitre: ["T1203", "T1660", "T1639"],
    steps: [
      { stage: "delivery", rule: "mob_silent_inbound", detail: "setup panggilan WhatsApp dari nomor tak dikenal, tanpa notifikasi" },
      { stage: "exploit", rule: "mob_parser_crash_idle", detail: "media.codec berhenti tidak wajar (SIGABRT), CPU 88%" },
      { stage: "implant", rule: "mob_hidden_persistent_app", detail: "service baru persisten com.system.sync.service, izin sensitif" },
      { stage: "c2", rule: "mob_covert_egress_idle", detail: "unggah 41 MB ke AS51167 Contabo saat layar mati" },
    ],
  },
  zeroclick_sms_wap: {
    corr_id: "corr_zeroclick_beacon_chain",
    title: "Rantai zero-click via SMS biner — pengiriman, eksploitasi, denyut kendali",
    category: "zero_click_exploit", severity: 82, level: "critical",
    response: "isolate", corr_type: "temporal_ordered", timespan_s: 900,
    mitre: ["T1203", "T1437"],
    steps: [
      { stage: "delivery", rule: "mob_silent_inbound", detail: "SMS biner dari pengirim tak dikenal, tidak muncul di inbox" },
      { stage: "exploit", rule: "mob_parser_crash_idle", detail: "com.android.phone berhenti tidak wajar" },
      { stage: "persistence", rule: "mob_ca_cert_added", detail: "DNS perangkat ditimpa tanpa sepengetahuan pengguna" },
      { stage: "c2", rule: "mob_beacon_regular", detail: "denyut 0,12 MB tiap 300 detik — pola mesin, bukan manusia" },
    ],
  },
  sideload_rat: {
    corr_id: "corr_sideload_to_surveillance",
    title: "APK sideload menjadi penyadapan penuh",
    category: "malicious_app", severity: 75, level: "critical",
    response: "quarantine", corr_type: "temporal_ordered", timespan_s: 1800,
    mitre: ["T1476", "T1626", "T1429"],
    steps: [
      { stage: "install", rule: "mob_sideload_install", detail: "com.android.securityupdate dipasang dari luar Play Store" },
      { stage: "privilege", rule: "mob_accessibility_abuse", detail: "Accessibility + Device Admin aktif tanpa interaksi pengguna" },
      { stage: "collection", rule: "mob_covert_sensor", detail: "mikrofon dan kamera aktif bersamaan, layar mati" },
    ],
  },
  ioc_c2_beacon: {
    corr_id: "corr_beacon_persistent",
    title: "Denyut kendali berulang ke luar",
    category: "c2_beacon", severity: 55, level: "high",
    response: "investigate", corr_type: "event_count", timespan_s: 900,
    mitre: ["T1437"],
    steps: [
      { stage: "c2", rule: "mob_ioc_domain", detail: "tujuan cocok indikator kampanye Pegasus (daftar Amnesty)" },
      { stage: "c2", rule: "mob_beacon_regular", detail: "denyut berinterval tetap saat perangkat idle" },
      { stage: "c2", rule: "mob_beacon_regular", detail: "denyut berulang — bukan keep-alive aplikasi sah" },
    ],
  },
  imsi_catcher: {
    corr_id: "corr_imsi_catcher",
    title: "Indikasi IMSI catcher berulang",
    category: "radio_attack", severity: 52, level: "high",
    response: "investigate", corr_type: "event_count", timespan_s: 600,
    mitre: ["T1430"],
    steps: [
      { stage: "radio", rule: "mob_radio_downgrade", detail: "dipaksa turun ke 2G, enkripsi radio mati, cell ID tak dikenal" },
      { stage: "radio", rule: "mob_radio_downgrade", detail: "terulang dalam 10 menit — bukan sekadar area blankspot" },
    ],
  },
};

// 6 HP yang dikompromikan — identik dengan COMPROMISED di mobile_sim.py
const COMPROMISED: Record<string, string> = {
  "hp-pusat-pangti": "zeroclick_imessage",
  "hp-kodam-17-01": "zeroclick_whatsapp",
  "hp-kodam-2-01": "zeroclick_sms_wap",
  "hp-kodam-12-01": "sideload_rat",
  "hp-kodam-24-01": "ioc_c2_beacon",
  "hp-kodam-9-01": "imsi_catcher",
};

// Penyimpangan jinak: satu indikator menyala, TIDAK membentuk rantai, tidak
// pernah menjadi kasus. Inilah yang membedakan detektor bagus dari yang berisik.
const BENIGN = [
  { rule: "mob_covert_egress_idle", detail: "backup iCloud tengah malam — satu indikator, tanpa rantai" },
  { rule: "mob_thermal_idle", detail: "HP panas saat sinyal lemah di daerah blankspot" },
  { rule: "mob_silent_inbound", detail: "notifikasi dibisukan pengguna sendiri" },
  { rule: "mob_patch_stale", detail: "patch keamanan tertinggal — postur, bukan serangan" },
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const sev = (r: number) => (r >= 70 ? "critical" : r >= 50 ? "high" : r >= 30 ? "medium" : "low");

interface St {
  risk: number; cats: Set<string>; hist: { ts: number; risk: number }[];
  events: any[]; chains: ChainHit[];
}

class Engine {
  started = Date.now();
  events = 0; signals = 0; chainCount = 0;
  state = new Map<string, St>();
  cases = new Map<string, Case>();
  caseSeq = 1;
  corr: Correlation[] = [];
  allChains: ChainHit[] = [];
  buckets = new Map<string, Map<string, number>>();
  feed: LiveMsg[] = [];
  // Meniru warm-up baseline sebelum skoring dinyalakan. Di backend ini 4.000
  // event; di browser cukup beberapa putaran agar perilakunya tetap jujur
  // (ada fase belajar) tanpa membuat penonton menunggu.
  warmup = 3;
  tickN = 0;

  constructor() {
    DEVICES.forEach((d) => this.state.set(d.id,
      { risk: 0, cats: new Set(), hist: [], events: [], chains: [] }));
    setInterval(() => this.tick(), 1400);
    this.tick();
  }

  private bucketKey() { const d = new Date(); d.setSeconds(0, 0); return d.toISOString(); }
  private emit(m: LiveMsg) { this.feed = [m, ...this.feed].slice(0, 60); }

  tick() {
    this.tickN++;
    const eps = 55 + Math.random() * 25;
    this.events += Math.round(eps * 1.4);
    // peluruhan risiko (meniru DECAY_HALF_LIFE_MIN di backend)
    for (const s of this.state.values()) s.risk = Math.max(0, s.risk * 0.985);

    const warming = this.tickN <= this.warmup;

    // 1) satu rantai pada salah satu HP terkompromi
    if (!warming && Math.random() < 0.62) {
      const id = pick(Object.keys(COMPROMISED));
      this.runChain(id, COMPROMISED[id]);
    }

    // 2) telemetri normal + sesekali penyimpangan jinak pada HP biasa
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const d = pick(DEVICES.filter((x) => !COMPROMISED[x.id]));
      const s = this.state.get(d.id)!;
      const odd = Math.random() < 0.18;
      if (odd) {
        const b = pick(BENIGN);
        this.signals += 1;
        s.events.unshift({
          ts: new Date().toISOString(), category: "net",
          activity: b.rule, detail: b.detail, idle: 1, screen_on: 0,
          label_scenario: "benign_oddity",
        });
        // Penting: risiko TIDAK naik melewati ambang kasus. Satu indikator
        // tanpa rantai tidak boleh menuduh siapa pun.
        s.risk = Math.max(0, Math.min(16, s.risk + 2 + Math.random() * 3));
        this.emit({
          kind: "event", data: {
            entity_id: d.id, display_name: devName(d), role: d.role,
            node_id: d.node, tier: d.tier, category: "vulnerable_posture",
            activity: b.rule, event_score: 10 + Math.round(Math.random() * 8),
            entity_risk: Math.round(s.risk), categories: [],
            benign: true, detail: b.detail, ts: new Date().toISOString(),
          },
        });
      } else {
        s.risk = Math.max(0, s.risk * 0.97);
        s.events.unshift({
          ts: new Date().toISOString(),
          category: pick(["net", "power", "msg", "media", "proc"]),
          activity: "normal_telemetry", idle: Math.random() < 0.5 ? 1 : 0,
          screen_on: Math.random() < 0.5 ? 1 : 0, label_scenario: "normal",
        });
      }
      s.events = s.events.slice(0, 40);
      s.hist.push({ ts: Date.now(), risk: s.risk });
      s.hist = s.hist.slice(-60);
    }
    this.updateCorrelations();
  }

  /** Jalankan satu rantai utuh: tahap-tahap berurutan lalu korelasi menyala. */
  private runChain(deviceId: string, scenario: string) {
    const d = DEVICES.find((x) => x.id === deviceId)!;
    const def = CHAIN_DEFS[scenario];
    const s = this.state.get(deviceId)!;
    const now = Date.now();

    // tahap diberi jarak waktu nyata (3–45 detik) seperti di simulator
    const gaps = def.steps.map(() => 3000 + Math.random() * 42000);
    const total = gaps.reduce((a, b) => a + b, 0);
    let t = now - total;
    const members: ChainMember[] = def.steps.map((st, i) => {
      t += gaps[i];
      return {
        rule: st.rule, stage: st.stage, event_id: `${deviceId}-${now}-${i}`,
        ts: new Date(t).toISOString(),
      };
    });

    // event per tahap masuk riwayat perangkat
    def.steps.forEach((st, i) => {
      s.events.unshift({
        ts: members[i].ts, category: "chain", activity: st.rule,
        detail: st.detail, stage: st.stage, idle: 1, screen_on: 0,
        label_scenario: scenario, chain_step: i + 1, chain_len: def.steps.length,
      });
      this.signals += 1;
      this.bump(def.category);
    });
    s.events = s.events.slice(0, 40);

    // Rantai terbukti -> risiko naik tajam. Di backend ini diwujudkan dengan
    // menaikkan PER_EVENT_CAP dari 35 ke 95 khusus signal korelasi.
    const contribution = Math.min(95, def.severity);
    s.risk = Math.min(100, s.risk + contribution * (1 - s.risk / 100));
    s.cats.add(def.category);
    this.chainCount += 1;

    const hit: ChainHit = {
      ts: new Date(now).toISOString(), entity_id: deviceId,
      display_name: devName(d), node_id: d.node, tier: d.tier,
      corr_id: def.corr_id, corr_type: def.corr_type, title: def.title,
      category: def.category, severity: def.severity, level: def.level,
      response: def.response, span_s: Math.round(total / 1000),
      timespan_s: def.timespan_s, mitre: def.mitre,
      kill_chain: def.steps.map((x) => x.stage),
      members,
    };
    s.chains.unshift(hit);
    s.chains = s.chains.slice(0, 10);
    this.allChains.unshift(hit);
    this.allChains = this.allChains.slice(0, 60);

    this.emit({
      kind: "chain", data: {
        ...hit, role: d.role, entity_risk: Math.round(s.risk),
        details: def.steps.map((x) => x.detail),
      },
    });
    s.hist.push({ ts: Date.now(), risk: s.risk });
    s.hist = s.hist.slice(-60);
    this.upsertCase(d, s, def);
  }

  private bump(cat: string) {
    const k = this.bucketKey();
    if (!this.buckets.has(k)) this.buckets.set(k, new Map());
    const m = this.buckets.get(k)!;
    m.set(cat, (m.get(cat) || 0) + 1);
    if (this.buckets.size > 16) {
      const first = this.buckets.keys().next().value;
      if (first) this.buckets.delete(first);
    }
  }

  private upsertCase(d: Dev, s: St, def: ChainDef) {
    if (s.risk < 50) return;
    const cats = Array.from(s.cats);
    const existing = this.cases.get(d.id);
    if (existing) {
      existing.risk_score = Math.round(s.risk);
      existing.severity = sev(s.risk);
      existing.categories = cats;
      existing.updated_at = new Date().toISOString();
      return;
    }
    const c: Case = {
      case_id: this.caseSeq++, entity_id: d.id, role: d.role, node_id: d.node,
      tier: d.tier, severity: sev(s.risk), risk_score: Math.round(s.risk),
      categories: cats, title: `${devName(d)} — ${def.title}`,
      summary: `Rantai ${def.corr_type} terpenuhi pada ${d.model} `
        + `(${d.platform.toUpperCase()} ${d.os}) di ${d.node}. `
        + `Tindakan disarankan: ${def.response}.`,
      status: sev(s.risk) === "critical" ? "escalated" : "open", verdict: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.cases.set(d.id, c);
    this.emit({ kind: "case", data: { ...c, is_new: true } });
  }

  /** Korelasi lintas node: kampanye yang sama menyentuh beberapa Kodam. */
  private updateCorrelations() {
    const byCorr = new Map<string, Set<string>>();
    for (const h of this.allChains.slice(0, 24)) {
      if (!byCorr.has(h.corr_id)) byCorr.set(h.corr_id, new Set());
      byCorr.get(h.corr_id)!.add(h.node_id);
    }
    const next: Correlation[] = [];
    let id = 1;
    for (const [corrId, nodes] of byCorr) {
      if (nodes.size < 2) continue;
      next.push({
        corr_id: id++, pattern: corrId, entity_ids: [],
        node_ids: Array.from(nodes),
        score: Math.min(100, 72 + nodes.size * 7),
        summary: `Rantai '${corrId}' terdeteksi di ${nodes.size} komando `
          + `(${Array.from(nodes).join(", ")}) — indikasi kampanye terkoordinasi, `
          + `bukan insiden tunggal.`,
        created_at: new Date().toISOString(),
      });
    }
    if (next.length && next.length !== this.corr.length) {
      this.emit({ kind: "correlation", data: next[0] });
    }
    this.corr = next;
  }

  // ———————————————— API demo ————————————————
  stats(): Stats {
    const up = (Date.now() - this.started) / 1000;
    return {
      events: this.events, alerts: this.cases.size, signals: this.signals,
      chains: this.chainCount, uptime_sec: Math.round(up),
      eps: Math.round((this.events / Math.max(up, 1)) * 10) / 10,
      indicators: { indicators: 3166, campaigns: IOC_CAMPAIGNS },
      yara: { loaded: true, rules: 9, engine: "YARA-X 1.23.0" },
    };
  }

  entities(): Entity[] {
    return DEVICES.map((d) => {
      const r = Math.round(this.state.get(d.id)!.risk);
      return {
        entity_id: d.id, display_name: devName(d), role: d.role,
        node_id: d.node, tier: d.tier, risk_score: r, severity: sev(r),
        last_event: new Date().toISOString(),
      };
    }).sort((a, b) => b.risk_score - a.risk_score);
  }

  nodes(): Node[] {
    return NODES.map((n) => {
      const members = DEVICES.filter((d) => d.node === n.node_id);
      const risks = members.map((d) => this.state.get(d.id)!.risk);
      const max = risks.length ? Math.max(...risks) : 0;
      const avg = risks.length ? risks.reduce((a, b) => a + b, 0) / risks.length : 0;
      return {
        ...n, max_risk: Math.round(max), avg_risk: Math.round(avg),
        high_count: risks.filter((r) => r >= 50).length, total: members.length,
      };
    });
  }

  casesList(): Case[] {
    return Array.from(this.cases.values()).sort((a, b) => b.risk_score - a.risk_score);
  }
  correlations(): Correlation[] { return this.corr; }
  chains(limit = 50, entityId?: string): ChainHit[] {
    const src = entityId
      ? (this.state.get(entityId)?.chains ?? [])
      : this.allChains;
    return src.slice(0, limit);
  }

  heatmap(): HeatCell[] {
    const out: HeatCell[] = []; const seen = new Set<string>();
    for (const d of DEVICES) {
      const k = `${d.node}|${d.role}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const risks = DEVICES.filter((x) => x.node === d.node && x.role === d.role)
        .map((x) => this.state.get(x.id)!.risk);
      out.push({ node_id: d.node, role: d.role, risk: Math.round(Math.max(...risks)) });
    }
    return out;
  }

  categoryTimeline() {
    const rows: { bucket: string; category: string; count: number }[] = [];
    for (const [b, m] of this.buckets)
      for (const [cat, c] of m) rows.push({ bucket: b, category: cat, count: c });
    return rows;
  }

  entity(id: string) {
    const d = DEVICES.find((x) => x.id === id);
    const s = this.state.get(id);
    if (!d || !s) return null;
    const r = Math.round(s.risk);
    // Baseline HP: semua diukur saat perangkat idle, karena di situlah
    // pemakaian sah seharusnya mendekati nol.
    const baselines = [
      { parameter: "idle_egress_mb", normal_low: 0, normal_high: 3, static_crit: 8, actual: r > 50 ? 68 : 1 },
      { parameter: "thermal_state", normal_low: 0, normal_high: 2, static_crit: 3, actual: r > 50 ? 4 : 1 },
      { parameter: "battery_drop_pct", normal_low: 0, normal_high: 2.4, static_crit: 4, actual: r > 50 ? 11.2 : 1.1 },
      { parameter: "crash_count", normal_low: 0, normal_high: 1, static_crit: 2, actual: r > 50 ? 4 : 0 },
    ];
    return {
      entity: {
        entity_id: d.id, display_name: devName(d), role: d.role,
        node_id: d.node, tier: d.tier, platform: d.platform,
        os_version: d.os, device_model: d.model, patch_age_days: d.patch,
      },
      risk_score: r, severity: sev(r), baselines, actual_24h: {},
      chains: s.chains,
      timeline: s.hist.slice().reverse().map((h) => ({
        ts: new Date(h.ts).toISOString(), risk_score: Math.round(h.risk),
        event_score: Math.round(h.risk * 0.6), categories: Array.from(s.cats),
        ml_anomaly: 0.5,
      })),
      events: s.events,
    };
  }

  sigma(): SigmaCatalog { return SIGMA_DEMO; }

  indicators(): IndicatorStatus {
    return {
      indicators: 3166, files: 15, campaigns: IOC_CAMPAIGNS,
      tables: {
        domains: 2616, ips: 73, hashes: 237, app_ids: 28, processes: 83,
        file_paths: 48, file_names: 15, emails: 65, profiles: 1,
      },
      sources: [
        { name: "AmnestyTech/investigations", license: "CC-BY 2.0", campaigns: ["Pegasus"] },
        { name: "mvt-project/mvt-indicators", license: "MIT", campaigns: IOC_CAMPAIGNS.filter((c) => c !== "Pegasus") },
      ],
      catatan: "Indikator bersifat historis dan bisa menghasilkan false positive, "
        + "karena itu tidak pernah dipakai sebagai bukti tunggal — selalu "
        + "dikorelasikan dengan perilaku perangkat.",
    };
  }

  setVerdict(caseId: number, verdict: string) {
    for (const c of this.cases.values())
      if (c.case_id === caseId) {
        c.verdict = verdict;
        c.status = verdict === "false_positive" ? "closed" : "escalated";
      }
    return { ok: true, case_id: caseId, verdict };
  }
}

const IOC_CAMPAIGNS = ["BTMOB", "Candiru", "Cellebrite", "Coruna", "DarkSword",
  "EagleMsgSpy", "KingSpawn", "Morpheus", "OperationTriangulation", "Pegasus",
  "Predator", "RCSLab", "ResidentBat", "Spyrtacus", "WyrmSpy_DragonEgg"];

// Ringkasan katalog aturan yang sesungguhnya dipakai backend. Teks lengkapnya
// ada di services/backend/app/rules/sigma/*.yml
const SIGMA_DEMO: SigmaCatalog = {
  format: "Sigma specification v2 (public domain)",
  note: "Aturan dievaluasi oleh engine streaming TRINETRA sendiri, bukan "
    + "diterjemahkan ke backend SIEM eksternal.",
  atomic: [
    { id: "mob_silent_inbound", sigma_id: "", title: "Pesan masuk senyap dari pengirim tak dikenal", description: "Pesan/lampiran dari pengirim tak dikenal, tanpa notifikasi, saat perangkat idle. Pola PENGIRIMAN zero-click. Sendirian bukan bukti.", level: "low", category: "zero_click_delivery", severity: 12, stage: "delivery", mitre: ["T1660"], domain: "mobile", service: "messaging", fields: ["silent_inbound"], falsepositives: ["Aplikasi pesan yang notifikasinya dibisukan pengguna"] },
    { id: "mob_parser_crash_idle", sigma_id: "", title: "Crash proses parser OS saat perangkat idle", description: "Proses sistem pemroses masukan luar (IMTransferAgent, BlastDoor, mediaserver) berhenti tidak wajar saat idle — permukaan tahap EKSPLOITASI.", level: "medium", category: "zero_click_exploit", severity: 30, stage: "exploit", mitre: ["T1203"], domain: "mobile", service: "process", fields: ["parser_crash"], falsepositives: ["Bug OS setelah pembaruan besar"] },
    { id: "mob_thermal_idle", sigma_id: "", title: "Perangkat panas dan baterai terkuras saat idle", description: "Proksi beban komputasi tersembunyi: implan baru aktif atau sedang mengompresi data sebelum eksfiltrasi.", level: "medium", category: "spyware_implant", severity: 22, stage: "implant", mitre: [], domain: "mobile", service: "power", fields: ["idle_thermal", "battery_drop_pct"], falsepositives: ["Sinkronisasi besar di latar belakang", "Sinyal lemah membuat radio bekerja keras"] },
    { id: "mob_covert_egress_idle", sigma_id: "", title: "Trafik keluar tersembunyi saat perangkat idle", description: "Unggahan bervolume ke ASN non-arus-utama saat idle. Backup resmi Apple/Google/Microsoft dikecualikan oleh filter.", level: "medium", category: "covert_exfiltration", severity: 28, stage: "c2", mitre: ["T1639"], domain: "mobile", service: "network", fields: ["idle", "egress_mb", "dest_asn"], falsepositives: ["Backup pihak ketiga terjadwal tengah malam"] },
    { id: "mob_covert_sensor", sigma_id: "", title: "Mikrofon atau kamera aktif tanpa aplikasi di depan", description: "Layar mati, tanpa interaksi, tanpa aplikasi foreground. Hampir tidak ada alasan sah pada HP dinas.", level: "high", category: "covert_surveillance", severity: 35, stage: "collection", mitre: ["T1429", "T1512"], domain: "mobile", service: "media", fields: ["covert_sensor"], falsepositives: ["Asisten suara selalu-siaga (perlu allowlist)", "Perekam panggilan resmi"] },
    { id: "mob_sideload_install", sigma_id: "", title: "Aplikasi dipasang dari luar toko resmi", description: "Vektor utama RAT Android pada perangkat dinas. Berkas APK dipindai terpisah dengan YARA-X di server.", level: "medium", category: "malicious_app", severity: 25, stage: "install", mitre: ["T1476"], domain: "mobile", service: "package", fields: ["sideloaded"], falsepositives: ["Aplikasi internal TNI AD yang didistribusikan manual"] },
    { id: "mob_accessibility_abuse", sigma_id: "", title: "Izin Accessibility atau Device Admin diberikan saat idle", description: "Dua izin yang memberi kendali penuh layar & masukan. Pemberian tanpa interaksi berarti otomatis.", level: "high", category: "malicious_app", severity: 30, stage: "privilege", mitre: ["T1626"], domain: "mobile", service: "integrity", fields: ["idle", "accessibility_granted", "device_admin_granted"], falsepositives: [] },
    { id: "mob_hidden_persistent_app", sigma_id: "", title: "Aplikasi tersembunyi persisten dengan izin sensitif", description: "Tanpa ikon launcher, berjalan terus, memegang izin mikrofon/kamera/lokasi/SMS. Pola khas stalkerware.", level: "high", category: "spyware_implant", severity: 30, stage: "implant", mitre: ["T1625"], domain: "mobile", service: "package", fields: ["pkg_hidden", "perm_sensitive"], falsepositives: [] },
    { id: "mob_ioc_domain", sigma_id: "", title: "Koneksi ke infrastruktur spyware yang sudah dikenal", description: "Tujuan cocok indikator STIX2 publik (Pegasus, Predator, KingsPawn dsb). Historis dan bisa salah, jadi tetap dikorelasikan.", level: "high", category: "c2_beacon", severity: 45, stage: "c2", mitre: ["T1437"], domain: "mobile", service: "network", fields: ["ioc_match"], falsepositives: ["Domain yang pernah disalahgunakan lalu kembali sah", "Kunjungan lampau yang tidak lagi aktif"] },
    { id: "mob_beacon_regular", sigma_id: "", title: "Beacon berpola teratur saat perangkat idle", description: "Koneksi kecil berinterval tetap — pola denyut kendali, bukan pola pemakaian manusia.", level: "medium", category: "c2_beacon", severity: 24, stage: "c2", mitre: [], domain: "mobile", service: "network", fields: ["idle", "beacon_interval_s"], falsepositives: ["Keep-alive push notification aplikasi sah"] },
    { id: "mob_rogue_profile", sigma_id: "", title: "Profil manajemen perangkat tidak terpercaya terpasang", description: "Jalur klasik pengambilalihan perangkat lewat rekayasa sosial.", level: "high", category: "device_tampering", severity: 30, stage: "tampering", mitre: [], domain: "mobile", service: "integrity", fields: ["profile_added", "profile_trusted"], falsepositives: [] },
    { id: "mob_ca_cert_added", sigma_id: "", title: "Sertifikat CA atau konfigurasi jaringan diubah diam-diam", description: "Penambahan CA, penimpaan DNS, atau proxy — membuka penyadapan TLS seluruh perangkat.", level: "high", category: "device_tampering", severity: 32, stage: "tampering", mitre: ["T1557"], domain: "mobile", service: "integrity", fields: ["tamper_detail"], falsepositives: [] },
    { id: "mob_tls_mitm", sigma_id: "", title: "Indikasi penyadapan TLS pada lalu lintas perangkat", description: "Rantai sertifikat tidak cocok dengan yang disematkan (pinning gagal).", level: "high", category: "mitm", severity: 30, stage: "mitm", mitre: ["T1557"], domain: "mobile", service: "network", fields: ["tls_mitm"], falsepositives: [] },
    { id: "mob_radio_downgrade", sigma_id: "", title: "Penurunan paksa ke 2G tanpa enkripsi pada sel tak dikenal", description: "Pola IMSI catcher / BTS palsu — relevan untuk pengamanan kegiatan pimpinan di lapangan.", level: "high", category: "radio_attack", severity: 28, stage: "radio", mitre: ["T1430"], domain: "mobile", service: "radio", fields: ["net_gen", "cell_unknown", "cell_encryption"], falsepositives: ["Daerah blankspot yang hanya terlayani 2G"] },
    { id: "mob_integrity_fail", sigma_id: "", title: "Integritas perangkat gagal (root/jailbreak/bootloader terbuka)", description: "Pada HP dinas ini pelanggaran kebijakan sekaligus prasyarat banyak implan.", level: "medium", category: "device_tampering", severity: 25, stage: "tampering", mitre: ["T1631"], domain: "mobile", service: "integrity", fields: ["integrity_fail"], falsepositives: [] },
    { id: "mob_patch_stale", sigma_id: "", title: "Patch keamanan perangkat kedaluwarsa", description: "Lebih tua dari 180 hari. Bukan serangan melainkan POSTUR — dipakai sebagai pengali risiko, bukan alarm.", level: "informational", category: "vulnerable_posture", severity: 8, stage: "posture", mitre: [], domain: "mobile", service: "integrity", fields: ["patch_age_days"], falsepositives: [] },
  ],
  correlation: [
    { id: "corr_zeroclick_fullchain", sigma_id: "", title: "Rantai zero-click lengkap — pengiriman, eksploitasi, eksfiltrasi", description: "Pesan senyap, lalu crash proses parser OS, lalu unggahan keluar — satu perangkat, 10 menit, perangkat idle. Praktis tidak punya padanan sah.", type: "temporal_ordered", rules: ["mob_silent_inbound", "mob_parser_crash_idle", "mob_covert_egress_idle"], timespan_s: 600, group_by: ["entity_id"], count_gte: 1, level: "critical", category: "zero_click_exploit", severity: 85, kill_chain: ["delivery", "exploit", "c2"], response: "isolate", mitre: ["T1203"] },
    { id: "corr_zeroclick_beacon_chain", sigma_id: "", title: "Rantai zero-click via SMS biner — pengiriman, eksploitasi, denyut kendali", description: "Varian yang TIDAK mengunggah data besar; implan hanya berdenyut dan menunggu perintah. Menutup celah aturan fullchain yang menuntut volume.", type: "temporal_ordered", rules: ["mob_silent_inbound", "mob_parser_crash_idle", "mob_beacon_regular"], timespan_s: 900, group_by: ["entity_id"], count_gte: 1, level: "critical", category: "zero_click_exploit", severity: 82, kill_chain: ["delivery", "exploit", "c2"], response: "isolate", mitre: ["T1203", "T1437"] },
    { id: "corr_zeroclick_surveillance", sigma_id: "", title: "Rantai zero-click dengan penyadapan sensor", description: "Crash parser OS diikuti mikrofon/kamera aktif tanpa aplikasi di depan: implan sudah berjalan dan mulai menyadap.", type: "temporal_ordered", rules: ["mob_parser_crash_idle", "mob_covert_sensor"], timespan_s: 900, group_by: ["entity_id"], count_gte: 1, level: "critical", category: "covert_surveillance", severity: 78, kill_chain: ["exploit", "collection"], response: "isolate", mitre: ["T1429"] },
    { id: "corr_sideload_to_surveillance", sigma_id: "", title: "APK sideload menjadi penyadapan penuh", description: "Sideload, lalu Accessibility/Device Admin tanpa interaksi, lalu sensor menyala. Rantai khas RAT Android.", type: "temporal_ordered", rules: ["mob_sideload_install", "mob_accessibility_abuse", "mob_covert_sensor"], timespan_s: 1800, group_by: ["entity_id"], count_gte: 1, level: "critical", category: "malicious_app", severity: 75, kill_chain: ["install", "privilege", "collection"], response: "quarantine", mitre: ["T1476"] },
    { id: "corr_mitm_chain", sigma_id: "", title: "Penyadapan TLS melalui profil dan sertifikat jahat", description: "Profil tidak terpercaya, lalu CA/DNS diubah, lalu indikasi penyadapan TLS. Seluruh komunikasi perangkat terbuka.", type: "temporal_ordered", rules: ["mob_rogue_profile", "mob_ca_cert_added", "mob_tls_mitm"], timespan_s: 1800, group_by: ["entity_id"], count_gte: 1, level: "critical", category: "mitm", severity: 70, kill_chain: ["install", "tampering", "mitm"], response: "isolate", mitre: ["T1557"] },
    { id: "corr_implant_active", sigma_id: "", title: "Implan aktif — beban tersembunyi diikuti eksfiltrasi", description: "Panas & baterai terkuras saat idle, lalu unggahan ke ASN non-arus-utama.", type: "temporal_ordered", rules: ["mob_thermal_idle", "mob_covert_egress_idle"], timespan_s: 1200, group_by: ["entity_id"], count_gte: 1, level: "high", category: "spyware_implant", severity: 60, kill_chain: ["implant", "c2"], response: "investigate", mitre: [] },
    { id: "corr_beacon_persistent", sigma_id: "", title: "Denyut kendali berulang ke luar", description: "Satu beacon bisa keep-alive sah; tiga dengan interval seragam saat idle tidak.", type: "event_count", rules: ["mob_beacon_regular"], timespan_s: 900, group_by: ["entity_id"], count_gte: 3, level: "high", category: "c2_beacon", severity: 55, kill_chain: ["c2"], response: "investigate", mitre: ["T1437"] },
    { id: "corr_imsi_catcher", sigma_id: "", title: "Indikasi IMSI catcher berulang", description: "Penurunan paksa ke 2G tanpa enkripsi lebih dari sekali dalam 10 menit — bukan sekadar blankspot.", type: "event_count", rules: ["mob_radio_downgrade"], timespan_s: 600, group_by: ["entity_id"], count_gte: 2, level: "high", category: "radio_attack", severity: 52, kill_chain: ["radio"], response: "investigate", mitre: ["T1430"] },
    { id: "corr_silent_delivery_burst", sigma_id: "", title: "Gelombang pengiriman senyap ke satu perangkat", description: "Penyerang sering mencoba beberapa kali ketika upaya pertama gagal.", type: "event_count", rules: ["mob_silent_inbound"], timespan_s: 300, group_by: ["entity_id"], count_gte: 3, level: "medium", category: "zero_click_delivery", severity: 40, kill_chain: ["delivery"], response: "investigate", mitre: ["T1660"] },
    { id: "corr_vulnerable_targeted", sigma_id: "", title: "Perangkat rentan menjadi sasaran pengiriman senyap", description: "Bukan bukti kompromi, tapi menentukan perangkat mana yang harus ditambal lebih dulu.", type: "temporal", rules: ["mob_patch_stale", "mob_silent_inbound"], timespan_s: 3600, group_by: ["entity_id"], count_gte: 1, level: "medium", category: "vulnerable_posture", severity: 30, kill_chain: ["posture", "delivery"], response: "patch", mitre: [] },
  ],
};

export const engine = new Engine();
