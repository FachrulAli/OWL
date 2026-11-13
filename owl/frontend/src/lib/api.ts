import snapshot from '../data/snapshot.json'
import type { Catalog, Decision, DeviceRow, Sensitivity, SocEvent } from './types'

const BASE = import.meta.env.VITE_OWL_API ?? ''

/**
 * Mode luring.
 *
 * Dashboard ini dapat dibuka tanpa OWL Core, misalnya lewat tautan publik
 * yang dibuka juri sebelum stack dijalankan. Yang ditampilkan pada keadaan
 * itu adalah `snapshot.json`, yaitu REKAMAN keluaran mesin aturan dan mesin
 * skor yang sungguhan, dibuat oleh `make snapshot`. Bukan angka yang
 * dihitung di browser, dan bukan angka yang ditulis tangan.
 *
 * Keadaan ini selalu dinyatakan di layar lewat spanduk, karena demo yang
 * tidak mengaku sedang luring adalah demo yang menipu penontonnya.
 */
let offline = false
const listeners = new Set<(v: boolean) => void>()

export function isOffline(): boolean {
  return offline
}

export function onOfflineChange(fn: (v: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function setOffline(v: boolean): void {
  if (offline === v) return
  offline = v
  for (const fn of listeners) fn(v)
}

export const snapshotGeneratedAt: string = snapshot.generated_at

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`${r.status} ${r.statusText}${body ? ` — ${body.slice(0, 180)}` : ''}`)
  }
  return r.json() as Promise<T>
}

/** Coba backend lebih dahulu; jika tidak terjangkau, pakai rekaman. */
async function withFallback<T>(live: () => Promise<T>, recorded: () => T): Promise<T> {
  try {
    const out = await live()
    setOffline(false)
    return out
  } catch {
    setOffline(true)
    return recorded()
  }
}

export const api = {
  health: () =>
    withFallback(
      () => req<{ service: string; version: string; air_gapped: boolean }>('/health'),
      () => ({ service: 'OWL Core', version: snapshot.engine_version, air_gapped: true }),
    ),

  devices: () =>
    withFallback(
      () => req<DeviceRow[]>('/api/devices'),
      () => snapshot.devices as unknown as DeviceRow[],
    ),

  catalog: () =>
    withFallback(
      () => req<Catalog>('/api/catalog'),
      () => snapshot.catalog as unknown as Catalog,
    ),

  socEvents: (limit = 12) =>
    withFallback(
      () => req<SocEvent[]>(`/api/soc/events?limit=${limit}`),
      () => (snapshot.soc_events as unknown as SocEvent[]).slice(0, limit),
    ),

  seed: () =>
    withFallback(
      () => req<{ ok: boolean }>('/api/demo/seed', { method: 'POST' }),
      () => ({ ok: true }),
    ),

  reset: () => req<{ ok: boolean }>('/api/demo/reset', { method: 'POST' }),

  gate: (id: string, resource: Sensitivity) =>
    withFallback(
      () => req<Decision>(`/api/gate/${encodeURIComponent(id)}?resource=${resource}`, { method: 'POST' }),
      () => {
        const table = snapshot.decisions as Record<string, Record<string, unknown>>
        const d = table[id]?.[resource]
        if (!d) throw new Error(`tidak ada rekaman keputusan untuk ${id}`)
        return d as unknown as Decision
      },
    ),

  stix: (id: string, resource: Sensitivity = 'classified') =>
    req<unknown>(`/api/devices/${encodeURIComponent(id)}/stix?resource=${resource}`),

  cef: (id: string, resource: Sensitivity = 'classified') =>
    req<{ cef: string }>(`/api/devices/${encodeURIComponent(id)}/cef?resource=${resource}`),
}

/** Nama kategori dalam bahasa Indonesia, dipakai di beberapa tampilan. */
export const CATEGORY_LABEL: Record<string, string> = {
  runtime: 'Perilaku runtime',
  app: 'Integritas aplikasi',
  config: 'Konfigurasi',
  device: 'Integritas perangkat',
  identity: 'Perilaku jaringan',
}

export const DECISION_LABEL: Record<string, string> = {
  allow: 'LOLOS',
  step_up: 'LOLOS + MFA',
  limited: 'TERBATAS',
  deny: 'DITOLAK',
}

export function scoreColor(score: number): string {
  if (score >= 90) return '#F87171'
  if (score >= 70) return '#F59E0B'
  if (score >= 30) return '#5EEAD4'
  return '#14B8A6'
}
