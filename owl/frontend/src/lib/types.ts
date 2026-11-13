export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type Category = 'runtime' | 'app' | 'config' | 'device' | 'identity'
export type DecisionKind = 'allow' | 'step_up' | 'limited' | 'deny'
export type Sensitivity = 'standard' | 'classified'

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
}

export interface Catalog {
  version: number
  updated: string
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
