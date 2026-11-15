export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type Category = 'runtime' | 'app' | 'config' | 'device' | 'identity'
export type DecisionKind = 'allow' | 'step_up' | 'limited' | 'deny'
export type Sensitivity = 'standard' | 'classified'
export type Availability = 'ok' | 'partial' | 'unavailable' | 'not_supported'

/** Status satu indikator pada satu pemeriksaan (FR-02 dan FR-03). */
export interface IndicatorStatus {
  status: Availability
  reason: string
  source: string
  checked_at: string | null
}

export interface Finding {
  rule_id: string
  category: Category
  severity: Severity
  base_severity: Severity
  title: string
  detail: string
  mitre: string
  confidence: string
  evidence: string[]
  downgraded: boolean
  /**
   * Aturan penentu: menyala pada severitas critical berarti gerbang menolak
   * tanpa menimbang skor sama sekali (lihat kepala `app/pdp.py`).
   */
  decisive: boolean
  points: number
}

export interface CategoryScore {
  category: Category
  weight: number
  severity_sum: number
  score: number
  saturated: boolean
}

export interface Assessment {
  device_id: string
  assessed_at: string
  score: number
  level: 'rendah' | 'sedang' | 'tinggi' | 'kritis'
  findings: Finding[]
  categories: CategoryScore[]
  decay_applied: number
  previous_score: number | null
  attestation_ok: boolean
  availability: Record<string, IndicatorStatus>
  skipped_rules: string[]
}

export interface Decision {
  device_id: string
  resource: Sensitivity
  decision: DecisionKind
  score: number
  reason: string
  quarantine: boolean
  top_contributors: string[]
}

export interface DeviceRow {
  device_id: string
  label: string
  owner_role: string
  unit: string
  model: string
  os_version: string
  enrolled_at: string
  score: number | null
  level: string | null
  assessed_at: string | null
  findings: Finding[]
  attestation_ok: boolean | null
  availability: Record<string, IndicatorStatus>
  skipped_rules: string[]
  /** Dicabut administrator: ditolak lebih dahulu daripada apa pun. */
  revoked?: boolean
  revoked_reason?: string
  revoked_at?: string
}

export interface Rule {
  id: string
  category: Category
  severity: Severity
  title: string
  detail: string
  mitre: string
  confidence: string
  corroborate: boolean
  decisive?: boolean
}

export interface Catalog {
  version: number
  updated: string
  /** "rekomendasi": OWL menyarankan, tidak memblokir. Requirements §8. */
  enforcement?: string
  allowlists?: Record<string, string[]>
  blocklists?: { packages: string[]; signers: string[] }
  rules: Rule[]
  weights: Record<Category, number>
  severity: Record<Severity, number>
  saturation: number
  thresholds: { medium: number; high: number; critical: number }
  parameters: Record<string, number>
}

export interface SocEvent {
  id: number
  device_id: string
  sent_at: string
  kind: 'stix' | 'cef'
  delivered: boolean
  payload: string
}


/* ———————————————————————————————————————————————————————————————
   OPERASI PERANGKAT

   Kemampuan yang datang bersama roadmap A dan B: penanganan kasus,
   pencabutan perangkat, daftar pencabutan attestation, dan metrik gerbang.
   Semuanya menuntut OWL Core; tidak ada rekamannya pada tautan publik.
   ——————————————————————————————————————————————————————————————— */

export type StatusKasus = 'baru' | 'diperiksa' | 'diselesaikan' | 'dikecualikan'

export interface Kasus {
  device_id: string
  status: StatusKasus
  note: string
  actor: string
  updated_at?: string
  /** Terisi hanya pada status `dikecualikan`. */
  expires_at: string | null
}

export interface Pencabutan {
  /** "belum diimpor" | "terkini" | "basi" */
  status: string
  entries: number
  age_days?: number
  imported_at?: string
  source_date?: string
}

export interface Metrics {
  devices: number
  decisions: Record<DecisionKind, number>
  revocation_unchecked_devices: string[]
  report_age_seconds: Record<string, number>
  rejects_by_reason: Record<string, number>
}

export interface TokenDaftar {
  device_id: string
  token: string
  expires_at: string
  provision_url: string
}
