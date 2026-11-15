import snapshot from '../data/snapshot.json'
import type { Catalog, Decision, DeviceRow, Sensitivity, SocEvent } from './types'

const BASE = import.meta.env.VITE_OWL_API ?? ''

/**
 * Kunci baca dashboard (NFR 5.1).
 *
 * Kata sandi yang diketik pada layar kunci dipakai apa adanya sebagai
 * `X-OWL-API-Key`, jadi yang menentukan benar atau salah adalah OWL Core,
 * bukan browser: kata sandi yang keliru membuat seluruh API menjawab 401 dan
 * tidak ada data yang keluar.
 *
 * Pada tautan publik tidak ada OWL Core yang menjawab, jadi di sana layar
 * kunci hanya menahan tampilan rekaman dan TIDAK melindungi apa pun. Itu
 * dinyatakan terang-terangan di layar kuncinya.
 *
 * Kuncinya disimpan di `sessionStorage`, bukan `localStorage`, supaya tab
 * yang ditutup menutup sesinya juga.
 */
const KEY_STORE = 'owl.key'
export const DEMO_PASSWORD = 'adminowl'

let apiKey = ''
try { apiKey = sessionStorage.getItem(KEY_STORE) ?? '' } catch { apiKey = '' }

export function hasKey(): boolean {
  return apiKey !== ''
}

/**
 * Kunci untuk WebSocket. Browser tidak dapat menyetel header pada WebSocket,
 * jadi OWL Core menerimanya lewat parameter kueri `key`.
 */
export function wsQuery(): string {
  return apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''
}

export function setKey(k: string): void {
  apiKey = k
  try { sessionStorage.setItem(KEY_STORE, k) } catch { /* jendela privat */ }
}

export function clearKey(): void {
  apiKey = ''
  try { sessionStorage.removeItem(KEY_STORE) } catch { /* jendela privat */ }
}

/** Ditolak 401: kuncinya tidak sah, dan itu bukan keadaan luring. */
export class Unauthorized extends Error {}

const unauthorized = new Set<() => void>()

export function onUnauthorized(fn: () => void): () => void {
  unauthorized.add(fn)
  return () => { unauthorized.delete(fn) }
}

/**
 * Uji kata sandi terhadap endpoint yang memang dilindungi.
 *
 * `luring` berarti OWL Core tidak terjangkau, sehingga benar atau salahnya
 * tidak dapat diputuskan di sini dan penilaiannya diserahkan ke pemanggil.
 */
export async function verifyKey(k: string): Promise<'ok' | 'salah' | 'luring'> {
  try {
    const r = await fetch(BASE + '/api/devices', { headers: { 'X-OWL-API-Key': k } })
    if (r.status === 401) return 'salah'
    if (!r.ok) return 'luring'
    // Jawaban 200 belum tentu datang dari OWL Core. Tautan publik
    // mengembalikan index.html untuk setiap jalur, dan jawaban itu pernah
    // membuat kata sandi apa pun diterima. Jadi badannya harus benar-benar
    // berupa daftar perangkat, bukan sekadar berstatus 200.
    const body: unknown = await r.json()
    return Array.isArray(body) ? 'ok' : 'luring'
  } catch {
    return 'luring'
  }
}

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
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-OWL-API-Key': apiKey } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (r.status === 401) {
    // Kunci ditolak. Jangan jatuh ke rekaman, sebab layar yang menampilkan
    // rekaman setelah kunci dicabut terlihat seperti akses yang masih sah.
    clearKey()
    for (const fn of unauthorized) fn()
    throw new Unauthorized('kunci API tidak sah')
  }
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
  } catch (e) {
    if (e instanceof Unauthorized) throw e
    setOffline(true)
    return recorded()
  }
}

export const api = {
  operations: <T,>(path: string, method = 'GET', body?: unknown, admin = '') =>
    req<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: admin ? { 'X-OWL-Admin': admin } : {} }),
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

/*
 * Label antarmuka pindah ke lib/i18n.tsx sejak dashboard dapat berganti
 * bahasa. Berkas ini kembali mengurus satu hal saja: bicara dengan OWL Core
 * dan jatuh ke rekaman ketika Core tidak terjangkau.
 */

/**
 * Warna skor.
 *
 * Emas untuk keadaan tenang, jingga dan merah untuk bahaya. Dua warna
 * terakhir sengaja tidak diemaskan: skala yang seluruhnya emas membuat
 * perangkat kritis terlihat sama dengan perangkat bersih.
 */
export function scoreColor(score: number): string {
  if (score >= 90) return '#D9534F'
  if (score >= 70) return '#E8A33D'
  if (score >= 30) return '#E7C878'
  return '#C9A227'
}
