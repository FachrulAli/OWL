import { useMemo } from 'react'
import { scoreColor } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Catalog, Category, DeviceRow } from '../lib/types'

/**
 * Wawasan armada: yang dibaca pimpinan di bawah peta.
 *
 * Peta menjawab "di mana"; bagian ini menjawab "seberapa parah, apa
 * sebabnya, dan siapa dulu". Semua angka DITURUNKAN dari penilaian yang
 * sudah dikeluarkan mesin aturan; tidak ada ambang baru. Kalimat sorotan
 * dirakit dari angka itu, bukan ditulis tangan, sehingga tidak dapat
 * menyimpang dari data.
 */

const LEVEL = ['rendah', 'sedang', 'tinggi', 'kritis'] as const
const WARNA: Record<string, string> = {
  rendah: '#C9A227', sedang: '#E7C878', tinggi: '#E8A33D', kritis: '#D9534F',
}

const TEKS = {
  id: {
    sorotan: 'Sorotan',
    total: 'Perangkat terdaftar', totalN: (n: number) => `${n} sudah dinilai`,
    aman: 'Tingkat rendah', amanN: 'tidak perlu tindakan',
    awas: 'Perlu tindakan', awasN: 'tingkat tinggi atau kritis',
    attest: 'Attestation gagal', attestN: 'identitas tidak terbukti',
    senyap: 'Tidak melapor', senyapN: (m: number) => `lebih dari ${m} menit`,
    rata: 'Skor rata-rata', rataN: 'semakin tinggi semakin berisiko',
    sebaran: 'Sebaran tingkat risiko', sumber: 'Sumber risiko',
    sumberN: 'poin risiko per kategori, seluruh perangkat',
    temuan: 'Temuan paling sering', temuanN: (n: number) => `${n} perangkat`,
    satuan: 'Satuan paling berisiko', satuanN: 'skor rata-rata, hanya satuan dengan minimal 2 perangkat',
    prioritas: 'Perangkat yang ditangani lebih dulu', prioritasN: 'urut skor tertinggi',
    kolPerangkat: 'Perangkat', kolSatuan: 'Satuan', kolModel: 'Model', kolSkor: 'Skor', kolTemuan: 'Temuan utama', kolLapor: 'Laporan',
    menit: (m: number) => (m < 60 ? `${m} mnt lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`),
    perangkat: 'perangkat',
    s1: (a: number, n: number, p: number) => `${a} dari ${n} perangkat (${p}%) perlu tindakan: tingkat tinggi atau kritis.`,
    s1ok: (n: number) => `Seluruh ${n} perangkat berada di tingkat rendah atau sedang.`,
    s2: (judul: string, n: number) => `Temuan paling luas: "${judul}", pada ${n} perangkat.`,
    s3: (nama: string, skor: number) => `Satuan dengan skor rata-rata tertinggi: ${nama} (${skor}).`,
    s4: (n: number) => `${n} perangkat gagal attestation, jadi laporannya tidak dapat dipercaya.`,
    s5: (n: number) => `${n} perangkat tidak melapor lebih dari batas waktu.`,
    kosong: 'Belum ada perangkat. Daftarkan perangkat atau muat data contoh.',
  },
  en: {
    sorotan: 'Highlights',
    total: 'Registered devices', totalN: (n: number) => `${n} assessed`,
    aman: 'Low risk', amanN: 'no action needed',
    awas: 'Needs action', awasN: 'high or critical level',
    attest: 'Attestation failed', attestN: 'identity not proven',
    senyap: 'Not reporting', senyapN: (m: number) => `over ${m} minutes`,
    rata: 'Average score', rataN: 'higher means riskier',
    sebaran: 'Risk level spread', sumber: 'Where risk comes from',
    sumberN: 'risk points per category, all devices',
    temuan: 'Most common findings', temuanN: (n: number) => `${n} devices`,
    satuan: 'Highest-risk units', satuanN: 'average score, units with at least 2 devices',
    prioritas: 'Devices to handle first', prioritasN: 'highest score first',
    kolPerangkat: 'Device', kolSatuan: 'Unit', kolModel: 'Model', kolSkor: 'Score', kolTemuan: 'Main finding', kolLapor: 'Report',
    menit: (m: number) => (m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`),
    perangkat: 'devices',
    s1: (a: number, n: number, p: number) => `${a} of ${n} devices (${p}%) need action: high or critical level.`,
    s1ok: (n: number) => `All ${n} devices are at low or medium level.`,
    s2: (judul: string, n: number) => `Widest finding: "${judul}", on ${n} devices.`,
    s3: (nama: string, skor: number) => `Unit with the highest average score: ${nama} (${skor}).`,
    s4: (n: number) => `${n} devices failed attestation, so their reports cannot be trusted.`,
    s5: (n: number) => `${n} devices have not reported within the time limit.`,
    kosong: 'No devices yet. Enrol a device or load the sample data.',
  },
} as const

function satuanDari(unit: string): string {
  const u = unit.split('·')[0].trim()
  return u || '-'
}

export function Wawasan({ devices, catalog }: { devices: DeviceRow[]; catalog: Catalog | null }) {
  const { lang, category, ruleTitle, word } = useT()
  const L = TEKS[lang]
  const batas = catalog?.parameters?.max_report_age_minutes ?? 60

  const r = useMemo(() => {
    const now = Date.now()
    const dinilai = devices.filter((d) => d.score !== null)
    const menit = (d: DeviceRow) =>
      d.assessed_at ? Math.max(0, Math.round((now - Date.parse(d.assessed_at)) / 60000)) : null
    const sebaran = Object.fromEntries(LEVEL.map((l) => [l, 0])) as Record<string, number>
    for (const d of dinilai) if (d.level) sebaran[d.level] = (sebaran[d.level] ?? 0) + 1

    const kategori: Record<string, number> = {}
    const aturan = new Map<string, { id: string; judul: string; n: number; mitre: string }>()
    for (const d of dinilai) {
      for (const f of d.findings) {
        kategori[f.category] = (kategori[f.category] ?? 0) + f.points
        const a = aturan.get(f.rule_id) ?? { id: f.rule_id, judul: f.title, n: 0, mitre: f.mitre }
        a.n += 1
        aturan.set(f.rule_id, a)
      }
    }

    const perSatuan = new Map<string, { nama: string; skor: number[]; awas: number }>()
    for (const d of dinilai) {
      const nama = satuanDari(d.unit)
      const s = perSatuan.get(nama) ?? { nama, skor: [], awas: 0 }
      s.skor.push(d.score ?? 0)
      if (d.level === 'tinggi' || d.level === 'kritis') s.awas += 1
      perSatuan.set(nama, s)
    }
    const satuan = [...perSatuan.values()]
      .filter((s) => s.skor.length >= 2) // satu perangkat bukan ukuran satuan
      .map((s) => ({ ...s, rata: s.skor.reduce((a, b) => a + b, 0) / s.skor.length }))
      .sort((a, b) => b.rata - a.rata)

    const rata = dinilai.length ? dinilai.reduce((a, d) => a + (d.score ?? 0), 0) / dinilai.length : null
    const senyap = devices.filter((d) => (menit(d) ?? Infinity) > batas).length
    return {
      total: devices.length,
      dinilai: dinilai.length,
      sebaran,
      awas: (sebaran.tinggi ?? 0) + (sebaran.kritis ?? 0),
      attestasi: devices.filter((d) => d.attestation_ok === false).length,
      senyap,
      rata,
      kategori: Object.entries(kategori).sort((a, b) => b[1] - a[1]),
      temuan: [...aturan.values()].sort((a, b) => b.n - a.n).slice(0, 5),
      satuan: satuan.slice(0, 6),
      prioritas: [...dinilai].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 8),
      menit,
    }
  }, [devices, batas])

  if (r.total === 0) return <p className="muted" style={{ marginTop: 24 }}>{L.kosong}</p>

  const maxKat = Math.max(1, ...r.kategori.map(([, v]) => v))
  const sorotan: string[] = []
  if (r.awas > 0) sorotan.push(L.s1(r.awas, r.dinilai, Math.round((r.awas / Math.max(1, r.dinilai)) * 100)))
  else sorotan.push(L.s1ok(r.dinilai))
  if (r.temuan[0]) sorotan.push(L.s2(ruleTitle(r.temuan[0].id, r.temuan[0].judul), r.temuan[0].n))
  if (r.satuan[0]) sorotan.push(L.s3(r.satuan[0].nama, Math.round(r.satuan[0].rata)))
  if (r.attestasi > 0) sorotan.push(L.s4(r.attestasi))
  if (r.senyap > 0) sorotan.push(L.s5(r.senyap))

  const kpi = [
    { l: L.total, n: String(r.total), k: L.totalN(r.dinilai) },
    { l: L.aman, n: String(r.sebaran.rendah ?? 0), k: L.amanN },
    { l: L.awas, n: String(r.awas), k: L.awasN, nyala: r.awas > 0 },
    { l: L.attest, n: String(r.attestasi), k: L.attestN, nyala: r.attestasi > 0 },
    { l: L.senyap, n: String(r.senyap), k: L.senyapN(batas), nyala: r.senyap > 0 },
    { l: L.rata, n: r.rata === null ? '-' : String(Math.round(r.rata)), k: L.rataN },
  ]

  return (
    <section className="wk">
      <h2 className="seksi">{L.sorotan}</h2>
      <ul className="wk-sorot">
        {sorotan.map((s) => <li key={s}>{s}</li>)}
      </ul>

      <div className="wk-kpi">
        {kpi.map((k) => (
          <div key={k.l} className={`wk-k${k.nyala ? ' nyala' : ''}`}>
            <span className="l">{k.l}</span>
            <span className="n">{k.n}</span>
            <span className="k">{k.k}</span>
          </div>
        ))}
      </div>

      <div className="wk-baris">
        <div className="card">
          <h3>{L.sebaran}</h3>
          <div className="wk-tumpuk" role="img" aria-label={L.sebaran}>
            {LEVEL.map((l) => (r.sebaran[l] ?? 0) > 0 && (
              <i key={l} style={{ flexGrow: r.sebaran[l], background: WARNA[l] }} title={`${word(l)}: ${r.sebaran[l]}`} />
            ))}
          </div>
          <ul className="wk-legenda">
            {LEVEL.map((l) => (
              <li key={l}>
                <i style={{ background: WARNA[l] }} />
                <span>{word(l)}</span>
                <b>{r.sebaran[l] ?? 0}</b>
                <em>{Math.round(((r.sebaran[l] ?? 0) / Math.max(1, r.dinilai)) * 100)}%</em>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>{L.sumber}</h3>
          <p className="muted">{L.sumberN}</p>
          <ul className="wk-bar">
            {r.kategori.map(([c, v]) => (
              <li key={c}>
                <span>{category(c as Category)}</span>
                <div><i style={{ width: `${(v / maxKat) * 100}%` }} /></div>
                <b>{Math.round(v)}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>{L.temuan}</h3>
          <ul className="wk-temuan">
            {r.temuan.map((a) => (
              <li key={a.id}>
                <div>
                  <span>{ruleTitle(a.id, a.judul)}</span>
                  <small>{a.id} · {a.mitre}</small>
                </div>
                <b>{L.temuanN(a.n)}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="wk-baris dua">
        <div className="card">
          <h3>{L.satuan}</h3>
          <p className="muted">{L.satuanN}</p>
          <ul className="wk-bar">
            {r.satuan.map((s) => (
              <li key={s.nama}>
                <span>{s.nama}<small>{s.skor.length} {L.perangkat}</small></span>
                <div><i style={{ width: `${Math.min(100, s.rata)}%`, background: scoreColor(s.rata) }} /></div>
                <b>{Math.round(s.rata)}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>{L.prioritas}</h3>
          <p className="muted">{L.prioritasN}</p>
          <div className="wk-tabel">
            <table>
              <thead>
                <tr>
                  <th>{L.kolPerangkat}</th><th>{L.kolSatuan}</th><th>{L.kolModel}</th>
                  <th>{L.kolSkor}</th><th>{L.kolTemuan}</th><th>{L.kolLapor}</th>
                </tr>
              </thead>
              <tbody>
                {r.prioritas.map((d) => {
                  const f = [...d.findings].sort((a, b) => b.points - a.points)[0]
                  const m = r.menit(d)
                  return (
                    <tr key={d.device_id}>
                      <td><b>{d.device_id}</b></td>
                      <td>{satuanDari(d.unit)}</td>
                      <td>{d.model}</td>
                      <td><span className="wk-skor" style={{ color: scoreColor(d.score ?? 0), borderColor: scoreColor(d.score ?? 0) }}>{Math.round(d.score ?? 0)}</span></td>
                      <td>{f ? ruleTitle(f.rule_id, f.title) : '-'}</td>
                      <td className={m !== null && m > batas ? 'lama' : undefined}>{m === null ? '-' : L.menit(m)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
