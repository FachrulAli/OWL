import { useEffect, useMemo, useState } from 'react'
import { Contributors } from '../components/Contributors'
import { Indicators } from '../components/Indicators'
import { Ring } from '../components/Ring'
import { Cip, Ikon, Kosong, SkorLencana } from '../components/Ui'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Page } from '../lib/nav'
import type { Catalog, Decision, DeviceRow, Sensitivity } from '../lib/types'

/**
 * Perangkat: cari satu, pahami skornya, lalu bertindak.
 *
 * Daftar di kiri dan rincian di kanan berdampingan, dan rincian tidak pernah
 * kosong: perangkat dengan skor tertinggi langsung terpilih, sebab pembaca
 * yang membuka halaman ini hampir selalu mencari yang paling bermasalah.
 * Tindakan (uji gerbang, tangani, daftarkan ulang) ada di kepala rincian,
 * tepat di tempat pertanyaan "lalu apa?" muncul.
 *
 * Penyaringan terjadi pada daftar yang SUDAH dinilai backend. Tidak ada skor
 * dihitung di sini dan tidak ada ambang baru.
 */

const TINGKAT = ['rendah', 'sedang', 'tinggi', 'kritis'] as const
type Saring = 'semua' | (typeof TINGKAT)[number] | 'belum' | 'senyap'
type Urut = 'skor' | 'nama' | 'temuan'

const TEKS = {
  id: {
    cari: 'Cari ID, satuan, model, atau kode aturan', hapus: 'Hapus pencarian',
    semua: 'Semua', belum: 'Belum dinilai', senyap: 'Senyap', urut: 'Urut', uSkor: 'Skor tertinggi', uTemuan: 'Temuan terbanyak', uNama: 'Nama',
    menampilkan: (n: number, total: number) => `Menampilkan ${n} dari ${total} perangkat`, reset: 'Atur ulang',
    kosongJ: 'Belum ada perangkat', kosongI: 'Muat data contoh dari halaman Gerbang akses, atau daftarkan perangkat lewat Pendaftaran agent.',
    kosongCari: 'Tidak ada perangkat yang cocok', kosongCariI: 'Ubah kata kunci atau lepas saringan tingkat.',
    ke: 'Daftarkan perangkat', gerbang: 'Buka gerbang',
    uji: 'Uji gerbang', menguji: 'Menguji…', tangani: 'Tangani', daftarUlang: 'Terbitkan token',
    lapor: 'Laporan terakhir', belumLapor: 'Belum pernah melapor', lalu: (m: number) => m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`,
    dicabut: 'Dicabut', attestGagal: 'Attestation gagal', senyapL: 'Senyap',
    mengapa: 'Mengapa skornya begitu', indikator: 'Apa yang bisa dibaca agent', mitre: 'Pemetaan MITRE ATT&CK',
    klas: 'Sistem terklasifikasi', std: 'Jaringan standar', tiapAman: 'Tidak ada temuan. Perangkat ini bersih menurut aturan saat ini.',
    kolPerangkat: 'Perangkat', kolModel: 'Model', kolTemuan: 'Temuan', kolLapor: 'Laporan',
    keyakinan: 'Keyakinan',
  },
  en: {
    cari: 'Search ID, unit, model, or rule code', hapus: 'Clear search',
    semua: 'All', belum: 'Not assessed', senyap: 'Silent', urut: 'Sort', uSkor: 'Highest score', uTemuan: 'Most findings', uNama: 'Name',
    menampilkan: (n: number, total: number) => `Showing ${n} of ${total} devices`, reset: 'Reset',
    kosongJ: 'No devices yet', kosongI: 'Load sample data from the Access gate page, or enrol a device from Agent enrolment.',
    kosongCari: 'No device matches', kosongCariI: 'Change the keyword or lift the level filter.',
    ke: 'Enrol a device', gerbang: 'Open the gate',
    uji: 'Test gate', menguji: 'Testing…', tangani: 'Handle', daftarUlang: 'Issue token',
    lapor: 'Last report', belumLapor: 'Never reported', lalu: (m: number) => m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`,
    dicabut: 'Revoked', attestGagal: 'Attestation failed', senyapL: 'Silent',
    mengapa: 'Why it scored this way', indikator: 'What the agent could read', mitre: 'MITRE ATT&CK mapping',
    klas: 'Classified system', std: 'Standard network', tiapAman: 'No findings. This device is clean under the current rules.',
    kolPerangkat: 'Device', kolModel: 'Model', kolTemuan: 'Findings', kolLapor: 'Report',
    keyakinan: 'Confidence',
  },
} as const

export function Perangkat({
  devices, catalog, terpilih, onPindah,
}: {
  devices: DeviceRow[]
  catalog: Catalog | null
  /** ID dari tautan: `#/perangkat/ID`. */
  terpilih: string
  onPindah: (p: Page, arg?: string) => void
}) {
  const { lang, locale, category, word, decision, reason } = useT()
  const L = TEKS[lang]
  const [cari, setCari] = useState('')
  const [saring, setSaring] = useState<Saring>('semua')
  const [urut, setUrut] = useState<Urut>('skor')
  const [gerbang, setGerbang] = useState<Partial<Record<Sensitivity, Decision>>>({})
  const [sibuk, setSibuk] = useState(false)
  const batas = catalog?.parameters?.max_report_age_minutes ?? 60

  const menit = (d: DeviceRow) =>
    d.assessed_at ? Math.max(0, Math.round((Date.now() - Date.parse(d.assessed_at)) / 60000)) : null
  const senyap = (d: DeviceRow) => (menit(d) ?? Infinity) > batas

  const hitung = useMemo(() => {
    const h = { semua: devices.length, belum: 0, senyap: 0 } as Record<Saring, number>
    for (const k of TINGKAT) h[k] = 0
    for (const d of devices) {
      if (d.score === null) h.belum += 1
      else if (d.level && d.level in h) h[d.level as Saring] += 1
      if (d.assessed_at && senyap(d)) h.senyap += 1
    }
    return h
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, batas])

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    const out = devices.filter((d) => {
      if (saring === 'belum' && d.score !== null) return false
      if (saring === 'senyap' && !(d.assessed_at && senyap(d))) return false
      if ((TINGKAT as readonly string[]).includes(saring) && d.level !== saring) return false
      if (!q) return true
      return [d.label, d.device_id, d.unit, d.owner_role, d.model, d.os_version]
        .some((v) => (v ?? '').toLowerCase().includes(q))
        || d.findings.some((f) => f.rule_id.toLowerCase().includes(q))
    })
    out.sort((a, b) => {
      if (urut === 'nama') return a.device_id.localeCompare(b.device_id)
      if (urut === 'temuan') return b.findings.length - a.findings.length
      return (b.score ?? -1) - (a.score ?? -1)
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, cari, saring, urut, batas])

  // Rincian tidak pernah kosong: tanpa pilihan, ambil perangkat teratas pada daftar.
  const sel = devices.find((d) => d.device_id === terpilih) ?? tampil[0] ?? null

  useEffect(() => { setGerbang({}) }, [sel?.device_id])

  // Di layar sempit rincian berada di bawah daftar. Setelah satu baris
  // dipilih, bawa rincian ke layar; tanpa ini pilihannya tampak tak berbuat apa-apa.
  useEffect(() => {
    if (!terpilih || typeof matchMedia !== 'function' || !matchMedia('(max-width: 1280px)').matches) return
    document.querySelector('.rincian')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [terpilih])

  async function uji() {
    if (!sel) return
    setSibuk(true)
    try {
      const [a, b] = await Promise.all([api.gate(sel.device_id, 'classified'), api.gate(sel.device_id, 'standard')])
      setGerbang({ classified: a, standard: b })
    } catch { setGerbang({}) }
    finally { setSibuk(false) }
  }

  if (devices.length === 0) {
    return (
      <div className="card">
        <Kosong judul={L.kosongJ} isi={L.kosongI}
                aksi={<div className="aksi-baris">
                  <button className="btn" onClick={() => onPindah('gerbang')}>{L.gerbang}</button>
                  <button className="btn ghost" onClick={() => onPindah('pendaftaran')}>{L.ke}</button>
                </div>} />
      </div>
    )
  }

  const disaring = cari.trim() !== '' || saring !== 'semua'
  const lalu = (d: DeviceRow) => { const m = menit(d); return m === null ? L.belumLapor : L.lalu(m) }

  return (
    <>
      <div className="bar-alat bar-saring">
        <div className="cari-kotak lebar">
          <Ikon nama="cari" size={16} />
          <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder={L.cari} aria-label={L.cari} />
          {cari && <button className="cari-hapus" onClick={() => setCari('')} aria-label={L.hapus}><Ikon nama="tutup" size={14} /></button>}
        </div>
        <div className="cip-baris" role="group" aria-label="Level">
          {(['semua', ...TINGKAT, 'senyap', 'belum'] as Saring[]).map((k) => (
            <Cip key={k} aktif={saring === k} nada={k === 'tinggi' ? 'jingga' : k === 'kritis' ? 'merah' : ''}
                 mati={k !== 'semua' && hitung[k] === 0 && saring !== k}
                 onKlik={() => setSaring(saring === k ? 'semua' : k)} n={hitung[k]}>
              {k === 'semua' ? L.semua : k === 'belum' ? L.belum : k === 'senyap' ? L.senyap : word(k)}
            </Cip>
          ))}
        </div>
        <label className="urut">
          <span>{L.urut}</span>
          <select value={urut} onChange={(e) => setUrut(e.target.value as Urut)}>
            <option value="skor">{L.uSkor}</option>
            <option value="temuan">{L.uTemuan}</option>
            <option value="nama">{L.uNama}</option>
          </select>
        </label>
      </div>

      {disaring && (
        <p className="hasil-saring">
          {L.menampilkan(tampil.length, devices.length)}
          <button className="tautan" onClick={() => { setCari(''); setSaring('semua') }}>{L.reset}</button>
        </p>
      )}

      <div className="dua-kolom perangkat">
        <section className="card tabel-kartu daftar-perangkat">
          {tampil.length === 0 ? (
            <Kosong judul={L.kosongCari} isi={L.kosongCariI} />
          ) : (
            <table>
              <thead>
                <tr><th>{L.kolPerangkat}</th><th>{L.kolModel}</th><th className="rata-kanan">{L.kolTemuan}</th><th>{L.kolLapor}</th></tr>
              </thead>
              <tbody>
                {tampil.map((d) => (
                  <tr key={d.device_id} className={`clickable${sel?.device_id === d.device_id ? ' terpilih' : ''}`}
                      onClick={() => onPindah('perangkat', d.device_id)}>
                    <td>
                      <div className="sel-dev">
                        <SkorLencana skor={d.score} />
                        <span>
                          <b>{sorot(d.device_id, cari)}</b>
                          <small>{sorot(d.unit || '—', cari)}</small>
                        </span>
                        {Boolean(d.revoked) && <span className="lencana merah">{L.dicabut}</span>}
                      </div>
                    </td>
                    <td className="muted">{sorot(d.model || '—', cari)}</td>
                    <td className="muted rata-kanan">{d.findings.length}</td>
                    <td className={`muted${d.assessed_at && senyap(d) ? ' lama' : ''}`}>{lalu(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {sel && (
          <aside className="card panel-lekat rincian" aria-live="polite">
            <div className="rc-kepala">
              <Ring score={sel.score} size={84} />
              <div>
                <h2>{sel.label || sel.device_id}</h2>
                <p>{sel.device_id}</p>
                <p>{sel.unit || '—'} · {sel.model} · {sel.os_version}</p>
                <p className={sel.assessed_at && senyap(sel) ? 'lama' : ''}>{L.lapor}: {sel.assessed_at ? new Date(sel.assessed_at).toLocaleString(locale) : L.belumLapor}</p>
              </div>
            </div>

            <div className="rc-lencana">
              {sel.level && <span className={`lencana lv-${sel.level}`}>{word(sel.level)}</span>}
              {Boolean(sel.revoked) && <span className="lencana merah">{L.dicabut}</span>}
              {sel.attestation_ok === false && <span className="lencana jingga">{L.attestGagal}</span>}
              {sel.assessed_at && senyap(sel) && <span className="lencana jingga">{L.senyapL}</span>}
            </div>

            <div className="rc-aksi">
              <button className="btn" onClick={() => void uji()} disabled={sibuk}>{sibuk ? L.menguji : L.uji}</button>
              <button className="btn ghost" onClick={() => onPindah('penanganan', sel.device_id)}>{L.tangani}</button>
              <button className="btn ghost" onClick={() => onPindah('pendaftaran', sel.device_id)}>{L.daftarUlang}</button>
            </div>

            {(gerbang.classified || gerbang.standard) && (
              <ul className="rc-gerbang">
                {(['classified', 'standard'] as Sensitivity[]).map((s) => {
                  const r = gerbang[s]
                  if (!r) return null
                  const lolos = r.decision === 'allow' || r.decision === 'step_up'
                  return (
                    <li key={s}>
                      <span>{s === 'classified' ? L.klas : L.std}</span>
                      <b className={lolos ? 'ok' : 'no'}>{decision(r.decision)}</b>
                      <small>{reason(r.reason)}</small>
                    </li>
                  )
                })}
              </ul>
            )}

            <h3>{L.mengapa}</h3>
            {sel.findings.length === 0 ? <p className="bantu">{L.tiapAman}</p> : <Contributors findings={sel.findings} />}

            <h3>{L.indikator}</h3>
            <Indicators availability={sel.availability} skipped={sel.skipped_rules} />

            {sel.findings.some((f) => f.mitre) && (
              <>
                <h3>{L.mitre}</h3>
                <table className="mitre">
                  <tbody>
                    {sel.findings.filter((f) => f.mitre).map((f) => (
                      <tr key={f.rule_id}>
                        <td><span className="kode">{f.rule_id}</span></td>
                        <td className="muted">{category(f.category)}</td>
                        <td className="muted">{f.mitre}</td>
                        <td className="muted">{L.keyakinan}: {word(f.confidence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </aside>
        )}
      </div>
    </>
  )
}

/** Tandai bagian teks yang cocok dengan pencarian, supaya baris yang cocok di kolom tersembunyi tak tampak nyasar. */
function sorot(teks: string, q: string) {
  const cari = q.trim()
  if (!cari) return teks
  const i = teks.toLowerCase().indexOf(cari.toLowerCase())
  if (i < 0) return teks
  return <>{teks.slice(0, i)}<mark>{teks.slice(i, i + cari.length)}</mark>{teks.slice(i + cari.length)}</>
}
