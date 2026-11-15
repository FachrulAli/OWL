import { useEffect, useMemo, useState } from 'react'
import { Cip, Kosong, Segmen, SkorLencana } from '../components/Ui'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Page } from '../lib/nav'
import type { Catalog, Decision, DecisionKind, DeviceRow, Metrics, Sensitivity } from '../lib/types'

/**
 * Gerbang akses: uji keputusan, lalu baca atas dasar apa.
 *
 * Satu pertanyaan: siapa boleh masuk, dan mengapa. Kiri: kendali dan hasil
 * ujinya untuk seluruh armada, dengan ringkasan keputusan di atas tabel
 * (satu kartu per perangkat tidak muat saat perangkatnya puluhan). Kanan:
 * cara gerbang menimbang, yaitu ambang yang berlaku untuk sumber daya yang
 * dipilih, bauran keputusan yang sedang berlaku, dan telemetri yang ditolak.
 *
 * Keputusan tidak pernah dihitung di browser. Semuanya datang dari Policy
 * Decision Point; halaman ini hanya meminta dan menampilkan.
 */

const KEPUTUSAN: DecisionKind[] = ['allow', 'step_up', 'limited', 'deny']

const warna = (k: DecisionKind) =>
  k === 'deny' ? 'var(--red)' : k === 'limited' ? 'var(--amber)' : k === 'step_up' ? 'var(--gold-soft)' : 'var(--gold)'

const TEKS = {
  id: {
    uji: 'Uji gerbang', sumber: 'Sumber daya yang dituju',
    klas: 'Sistem terklasifikasi', std: 'Jaringan standar',
    klasB: 'Ditolak mulai skor 70', stdB: 'Ditolak mulai skor 90',
    jalan: 'Uji ulang semua perangkat', jalannya: (a: number, b: number) => `Menguji ${a} dari ${b}…`,
    belum: 'Belum diuji', belumI: 'Pilih sumber daya, lalu jalankan. Setiap perangkat ditanyakan ke Policy Decision Point.',
    kolPerangkat: 'Perangkat', kolSatuan: 'Satuan', kolSkor: 'Skor', kolKeputusan: 'Keputusan', kolAlasan: 'Alasan',
    semua: 'Semua', karantina: 'dikarantina',
    ambang: 'Cara gerbang menimbang', ambangI: 'Urutan pemeriksaan: dicabut, laporan basi, attestation gagal, aturan penentu, lalu skor.',
    bauran: 'Keputusan yang berlaku sekarang', basi: 'laporan basi', belumCek: (n: number) => `${n} perangkat belum dicek terhadap daftar pencabutan.`,
    ditolak: 'Telemetri ditolak sebelum dinilai', tidakDitolak: 'Tidak ada telemetri yang ditolak.',
    seedJ: 'Belum ada perangkat untuk diuji', seedI: 'Muat data contoh untuk melihat gerbang bekerja, atau daftarkan perangkat lewat halaman Pendaftaran agent.',
    seed: 'Muat data contoh', menyeed: 'Memuat…', daftar: 'Daftarkan perangkat',
    batas: 'Gerbang ini memberi rekomendasi. Pemblokiran sebenarnya butuh integrasi dengan gateway satuan, IAM, atau MDM.',
    skor: 'skor', lolos: 'lolos', tolak: 'ditolak',
  },
  en: {
    uji: 'Test the gate', sumber: 'Resource being accessed',
    klas: 'Classified system', std: 'Standard network',
    klasB: 'Denied from score 70', stdB: 'Denied from score 90',
    jalan: 'Test all devices again', jalannya: (a: number, b: number) => `Testing ${a} of ${b}…`,
    belum: 'Not tested yet', belumI: 'Pick a resource, then run. Every device is asked of the Policy Decision Point.',
    kolPerangkat: 'Device', kolSatuan: 'Unit', kolSkor: 'Score', kolKeputusan: 'Decision', kolAlasan: 'Reason',
    semua: 'All', karantina: 'quarantined',
    ambang: 'How the gate weighs', ambangI: 'Order of checks: revoked, stale report, failed attestation, decisive rule, then score.',
    bauran: 'Decisions in force now', basi: 'stale reports', belumCek: (n: number) => `${n} devices not yet checked against the revocation list.`,
    ditolak: 'Telemetry rejected before scoring', tidakDitolak: 'No telemetry was rejected.',
    seedJ: 'No devices to test yet', seedI: 'Load sample data to see the gate work, or enrol devices from the Agent enrolment page.',
    seed: 'Load sample data', menyeed: 'Loading…', daftar: 'Enrol a device',
    batas: 'This gate gives a recommendation. Actual blocking needs integration with the unit gateway, IAM, or MDM.',
    skor: 'score', lolos: 'pass', tolak: 'denied',
  },
} as const

export function Gerbang({
  devices, catalog, metrics, onRefresh, onPindah,
}: {
  devices: DeviceRow[]
  catalog: Catalog | null
  metrics: Metrics | null
  onRefresh: () => void
  onPindah: (p: Page, arg?: string) => void
}) {
  const { lang, decision, reason } = useT()
  const L = TEKS[lang]
  const [resource, setResource] = useState<Sensitivity>('classified')
  const [hasil, setHasil] = useState<Record<string, Decision>>({})
  const [sibuk, setSibuk] = useState(false)
  const [maju, setMaju] = useState(0)
  const [salah, setSalah] = useState('')
  const [saring, setSaring] = useState<'semua' | DecisionKind>('semua')

  async function jalankan() {
    setSibuk(true); setSalah(''); setMaju(0); setSaring('semua')
    try {
      const out: Record<string, Decision> = {}
      // Per kelompok sepuluh: cukup cepat untuk puluhan perangkat, dan tidak
      // membanjiri OWL Core dengan seratus permintaan sekaligus.
      for (let i = 0; i < devices.length; i += 10) {
        const kelompok = devices.slice(i, i + 10)
        const jawab = await Promise.all(kelompok.map((d) => api.gate(d.device_id, resource)))
        kelompok.forEach((d, j) => { out[d.device_id] = jawab[j] })
        setMaju(Object.keys(out).length)
      }
      setHasil(out)
    } catch (e) {
      setSalah(String(e instanceof Error ? e.message : e))
    } finally {
      setSibuk(false)
    }
  }

  // Halaman ini dibuka untuk melihat keputusan, bukan untuk menekan tombol
  // dulu. Gerbang diuji otomatis begitu dibuka dan tiap kali sumber daya
  // diganti; tombolnya tinggal untuk mengulang setelah ada perubahan.
  useEffect(() => {
    if (devices.length > 0) void jalankan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, devices.length])

  async function seed() {
    setSibuk(true); setSalah(''); setHasil({})
    try { await api.seed(); onRefresh() }
    catch (e) { setSalah(String(e instanceof Error ? e.message : e)) }
    finally { setSibuk(false) }
  }

  const ringkas = useMemo(() => {
    const h = {} as Record<DecisionKind, number>
    for (const k of KEPUTUSAN) h[k] = 0
    for (const r of Object.values(hasil)) h[r.decision] += 1
    return h
  }, [hasil])

  const baris = useMemo(() => {
    return devices
      .filter((d) => hasil[d.device_id] && (saring === 'semua' || hasil[d.device_id].decision === saring))
      .sort((a, b) => hasil[b.device_id].score - hasil[a.device_id].score)
  }, [devices, hasil, saring])

  const sudah = Object.keys(hasil).length
  const th = catalog?.thresholds
  const basi = (() => {
    const m = catalog?.parameters?.max_report_age_minutes ?? 0
    if (!m || !metrics) return 0
    return Object.values(metrics.report_age_seconds).filter((d) => d > m * 60).length
  })()
  const ditolak = Object.entries(metrics?.rejects_by_reason ?? {}).sort((a, b) => b[1] - a[1])

  if (devices.length === 0) {
    return (
      <div className="card">
        <Kosong
          judul={L.seedJ} isi={L.seedI}
          aksi={(
            <div className="aksi-baris">
              <button className="btn" onClick={() => void seed()} disabled={sibuk}>{sibuk ? L.menyeed : L.seed}</button>
              <button className="btn ghost" onClick={() => onPindah('pendaftaran')}>{L.daftar}</button>
            </div>
          )}
        />
        {salah && <p className="pesan salah">{salah}</p>}
      </div>
    )
  }

  return (
    <div className="dua-kolom gerbang">
      <div className="kolom">
        <section className="card">
          <div className="gb-atur">
            <div>
              <h2>{L.uji}</h2>
              <p className="bantu">{L.sumber}</p>
            </div>
            <Segmen
              label={L.sumber} nilai={resource} onUbah={(v) => setResource(v)}
              pilihan={[{ id: 'classified', teks: L.klas }, { id: 'standard', teks: L.std }]}
            />
          </div>
          <p className="gb-ambang">{resource === 'classified' ? L.klasB : L.stdB}</p>
          <button className="btn blok" disabled={sibuk} onClick={() => void jalankan()}>
            {sibuk ? L.jalannya(maju, devices.length) : L.jalan}
          </button>
          {salah && <p className="pesan salah" role="alert">{salah}</p>}
        </section>

        {sudah === 0 ? (
          <section className="card">
            {sibuk ? (
              <div className="gb-proses" role="status">
                <b>{L.jalannya(maju, devices.length)}</b>
                <div className="gb-bar"><i style={{ width: `${(maju / Math.max(1, devices.length)) * 100}%` }} /></div>
              </div>
            ) : <Kosong judul={L.belum} isi={L.belumI} />}
          </section>
        ) : (
          <section className="card tabel-kartu">
            <div className="gb-ringkas">
              {KEPUTUSAN.map((k) => (
                <button key={k} className="gb-ubin" aria-pressed={saring === k}
                        disabled={ringkas[k] === 0 && saring !== k}
                        onClick={() => setSaring(saring === k ? 'semua' : k)}>
                  <b style={{ color: warna(k) }}>{ringkas[k]}</b>
                  <span>{decision(k)}</span>
                </button>
              ))}
            </div>
            {saring !== 'semua' && (
              <div className="cip-baris pad">
                <Cip aktif={false} onKlik={() => setSaring('semua')} n={sudah}>{L.semua}</Cip>
              </div>
            )}
            <table>
              <thead>
                <tr><th>{L.kolPerangkat}</th><th>{L.kolSkor}</th><th>{L.kolKeputusan}</th><th>{L.kolAlasan}</th></tr>
              </thead>
              <tbody>
                {baris.map((d) => {
                  const r = hasil[d.device_id]
                  const lolos = r.decision === 'allow' || r.decision === 'step_up'
                  return (
                    <tr key={d.device_id} className="clickable" onClick={() => onPindah('perangkat', d.device_id)}>
                      <td><div className="sel-dev"><span><b>{d.device_id}</b><small>{d.unit || d.model}</small></span></div></td>
                      <td><SkorLencana skor={r.score} /></td>
                      <td>
                        <span className={`lencana ${lolos ? 'hijau' : 'merah'}`}>{decision(r.decision)}</span>
                        {r.quarantine && <small className="karantina">{L.karantina}</small>}
                      </td>
                      <td className="muted alasan-sel" title={reason(r.reason)}><span>{reason(r.reason)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <aside className="kolom">
        <section className="card">
          <h2>{L.ambang}</h2>
          <p className="bantu">{L.ambangI}</p>
          {th && (
            <div className="skala" aria-label={L.ambang}>
              <div className="skala-pita">
                <i style={{ width: `${th.medium}%`, background: '#C9A227' }} />
                <i style={{ width: `${th.high - th.medium}%`, background: '#E7C878' }} />
                <i style={{ width: `${th.critical - th.high}%`, background: '#E8A33D' }} />
                <i style={{ width: `${100 - th.critical}%`, background: '#D9534F' }} />
              </div>
              <div className="skala-angka">
                <span style={{ left: 0 }}>0</span>
                <span style={{ left: `${th.medium}%` }}>{th.medium}</span>
                <span style={{ left: `${th.high}%` }}>{th.high}</span>
                <span style={{ left: `${th.critical}%` }}>{th.critical}</span>
              </div>
            </div>
          )}
          <p className="bantu">{L.batas}</p>
        </section>

        {metrics && (
          <section className="card">
            <h2>{L.bauran}</h2>
            <div className="bauran">
              {KEPUTUSAN.map((k) => (
                <div key={k} className={metrics.decisions[k] ? '' : 'kosong'}>
                  <b style={{ color: warna(k) }}>{metrics.decisions[k] ?? 0}</b>
                  <span>{decision(k)}</span>
                </div>
              ))}
            </div>
            {basi > 0 && <p className="peringatan">{basi} {L.basi}</p>}
            {metrics.revocation_unchecked_devices.length > 0 && (
              <p className="peringatan">{L.belumCek(metrics.revocation_unchecked_devices.length)}</p>
            )}
          </section>
        )}

        {metrics && (
          <section className="card">
            <h2>{L.ditolak}</h2>
            {ditolak.length === 0 ? <p className="bantu">{L.tidakDitolak}</p> : (
              <ul className="daftar-tolak">
                {ditolak.map(([alasan, n]) => <li key={alasan}><b>{n}</b><span>{alasan}</span></li>)}
              </ul>
            )}
          </section>
        )}
      </aside>
    </div>
  )
}
