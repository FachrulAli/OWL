import { useT } from '../lib/i18n'
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
  const { t, locale, indicator, availability: availabilityLabel, word, indicatorReason } = useT()
  const entries = Object.entries(availability ?? {})
  if (entries.length === 0) {
    return <p className="muted" style={{ marginTop: 8 }}>{t('ind.noReport')}</p>
  }
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>{t('ind.col.indicator')}</th><th>{t('ind.col.status')}</th>
            <th>{t('ind.col.source')}</th><th>{t('ind.col.checkedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, st]) => (
            <tr key={key}>
              <td>
                <div style={{ fontSize: 13 }}>{indicator(key)}</div>
                {st.reason && <div className="ev">{indicatorReason(st.reason)}</div>}
              </td>
              <td><span className={`sev ${TONE[st.status] ?? 'low'}`}>
                {availabilityLabel(st.status)}
              </span></td>
              <td className="muted" style={{ fontSize: 12 }}>{word(st.source)}</td>
              <td className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                {st.checked_at ? new Date(st.checked_at).toLocaleTimeString(locale) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {skipped?.length > 0 && (
        <p className="flag" style={{ marginTop: 10 }}>
          {t('ind.skipped', { n: skipped.length, list: skipped.join(', ') })}
        </p>
      )}
    </>
  )
}
