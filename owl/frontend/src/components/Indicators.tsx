import { AVAILABILITY_LABEL, INDICATOR_LABEL } from '../lib/api'
import type { IndicatorStatus } from '../lib/types'

const TONE: Record<string, string> = {
  ok: 'medium',
  partial: 'high',
  unavailable: 'critical',
  not_supported: 'low',
}

/**
 * Status tiap indikator pada pemeriksaan terakhir (FR-02 dan FR-03).
 *
 * Tabel ini ada supaya daftar kosong karena "sudah diperiksa dan memang
 * bersih" tidak terlihat sama dengan daftar kosong karena "tidak dapat
 * dibaca sama sekali". Tanpa pembedaan itu, perangkat yang tidak dapat
 * diperiksa akan tampak aman, dan itu kegagalan yang menyamar sebagai
 * keadaan normal.
 */
export function Indicators({
  availability,
  skipped,
}: {
  availability: Record<string, IndicatorStatus>
  skipped: string[]
}) {
  const entries = Object.entries(availability ?? {})
  if (entries.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        Agent tidak melaporkan status indikator. Laporan ini berasal dari versi
        agent sebelum status indikator ada, dan seluruh indikatornya
        diperlakukan sebagai terbaca.
      </p>
    )
  }
  return (
    <>
      <table>
        <thead>
          <tr><th>Indikator</th><th>Status</th><th>Sumber</th><th>Waktu periksa</th></tr>
        </thead>
        <tbody>
          {entries.map(([key, st]) => (
            <tr key={key}>
              <td>
                <div style={{ fontSize: 13 }}>{INDICATOR_LABEL[key] ?? key}</div>
                {st.reason && <div className="ev">{st.reason}</div>}
              </td>
              <td><span className={`sev ${TONE[st.status] ?? 'low'}`}>
                {AVAILABILITY_LABEL[st.status] ?? st.status}
              </span></td>
              <td className="muted" style={{ fontSize: 12 }}>{st.source}</td>
              <td className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                {st.checked_at ? new Date(st.checked_at).toLocaleTimeString('id-ID') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {skipped?.length > 0 && (
        <p className="flag" style={{ marginTop: 10 }}>
          {skipped.length} aturan tidak dijalankan karena indikatornya tidak terbaca:{' '}
          {skipped.join(', ')}. Aturan yang dilewati tidak dihitung lulus.
        </p>
      )}
    </>
  )
}
