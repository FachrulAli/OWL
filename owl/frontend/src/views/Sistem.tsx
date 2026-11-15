import { useCallback, useEffect, useState } from 'react'
import { Kosong } from '../components/Ui'
import { useAdmin } from '../lib/admin'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Metrics, Pencabutan } from '../lib/types'

/**
 * Sistem: keadaan OWL Core dan daftar yang dibawa lewat media.
 *
 * Seluruh berkas diimpor dari media yang dibawa petugas, bukan diunduh OWL
 * Core. Daftar pencabutan Google pun begitu. Itu syarat air-gapped, bukan
 * keterbatasan yang belum sempat diperbaiki, dan halaman ini menyebutnya.
 */

interface Kesehatan {
  version?: string
  air_gapped?: boolean
  api_auth?: string
  attestation?: string
  enroll?: string
  agent_signers?: string
  retention_days?: number
  enforcement?: string
}

const TEKS = {
  id: {
    inti: 'OWL Core', versi: 'Versi', mode: 'Mode jaringan', airgap: 'Air-gapped', daring: 'Terhubung',
    attest: 'Verifikasi attestation', enroll: 'Pendaftaran', signer: 'Pengikatan penanda tangan',
    retensi: 'Retensi data', hari: (n: number) => `${n} hari`,
    auth: 'Autentikasi API', enf: 'Penegakan',
    verify: 'Diverifikasi server', claim: 'Klaim agent (hanya uji)',
    token: 'Token sekali pakai', shared: 'Token bersama (hanya uji)',
    aktif: 'Aktif', kosong: 'Belum diikat', terbuka: 'Terbuka (uji)', terkunci: 'Dikunci kunci API', rekomendasi: 'Rekomendasi saja',
    rev: 'Daftar pencabutan attestation', revB: 'Daftar dari Google yang membatalkan sertifikat perangkat. Unduh di mesin yang terhubung, lalu bawa lewat media.',
    revIsi: 'entri', revUmur: 'hari sejak sumber', impor: 'Impor daftar pencabutan',
    lists: 'Daftar larangan dan pengecualian', listsB: 'Paket terlarang (bundel STIX) dan aplikasi bawaan pabrik yang dikecualikan.',
    blok: 'Impor daftar larangan (STIX)', pabrik: 'Impor pengecualian pabrik',
    alarm: 'Pemeriksaan alarm', alarmB: 'Pemeriksaan berjalan otomatis tiap menit. Tombol ini menjalankannya sekarang.', jalan: 'Periksa sekarang',
    perhatian: 'Perlu perhatian', bersih: 'Tidak ada yang perlu diperhatikan.',
    belumCek: (n: number) => `${n} perangkat belum diperiksa terhadap daftar pencabutan. Daftarkan ulang perangkat itu agar nomor serinya tersimpan.`,
    ditolak: 'Telemetri ditolak sebelum dinilai',
    fresh: 'Terkini', stale: 'Basi', missing: 'Belum diimpor',
    butuhAdmin: 'Butuh kunci admin.', isiKunci: 'Isi kunci admin',
    diimpor: (n: string) => `${n} diimpor.`, rusak: (n: string) => `${n} bukan berkas JSON yang sah.`, diperiksa: 'Pemeriksaan alarm selesai.',
    luringJ: 'Halaman sistem butuh OWL Core yang berjalan',
    luringI: 'Impor daftar dan pemeriksaan alarm mengubah keadaan server, jadi tidak ada rekamannya. Jalankan OWL Core, lalu buka halaman ini lagi.',
  },
  en: {
    inti: 'OWL Core', versi: 'Version', mode: 'Network mode', airgap: 'Air-gapped', daring: 'Connected',
    attest: 'Attestation verification', enroll: 'Enrolment', signer: 'Signer binding',
    retensi: 'Data retention', hari: (n: number) => `${n} days`,
    auth: 'API authentication', enf: 'Enforcement',
    verify: 'Verified by the server', claim: 'Agent claim (test only)',
    token: 'Single-use token', shared: 'Shared token (test only)',
    aktif: 'Active', kosong: 'Not bound', terbuka: 'Open (test)', terkunci: 'Locked by API key', rekomendasi: 'Recommend only',
    rev: 'Attestation revocation list', revB: 'Google’s list of revoked device certificates. Download on a connected machine, then bring it in by media.',
    revIsi: 'entries', revUmur: 'days since source', impor: 'Import revocation list',
    lists: 'Blocklist and factory exceptions', listsB: 'Banned packages (STIX bundle) and factory-installed apps that are exempt.',
    blok: 'Import blocklist (STIX)', pabrik: 'Import factory exceptions',
    alarm: 'Alarm check', alarmB: 'The check runs every minute on its own. This button runs it now.', jalan: 'Check now',
    perhatian: 'Needs attention', bersih: 'Nothing needs attention.',
    belumCek: (n: number) => `${n} devices have not been checked against the revocation list. Re-enrol them so their serial numbers are stored.`,
    ditolak: 'Telemetry rejected before scoring',
    fresh: 'Current', stale: 'Stale', missing: 'Not imported',
    butuhAdmin: 'Admin key required.', isiKunci: 'Enter admin key',
    diimpor: (n: string) => `${n} imported.`, rusak: (n: string) => `${n} is not valid JSON.`, diperiksa: 'Alarm check finished.',
    luringJ: 'The system page needs a running OWL Core',
    luringI: 'Importing lists and running the alarm check change server state, so there is no recording. Start OWL Core, then open this page again.',
  },
} as const

export function Sistem({
  offline, metrics, onRefresh,
}: {
  offline: boolean
  metrics: Metrics | null
  onRefresh: () => void
}) {
  const { lang } = useT()
  const L = TEKS[lang]
  const { admin, minta } = useAdmin()
  const [sehat, setSehat] = useState<Kesehatan | null>(null)
  const [cabut, setCabut] = useState<Pencabutan | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState('')
  const [salah, setSalah] = useState('')
  const adaAdmin = admin.trim() !== ''

  const muat = useCallback(async () => {
    const [h, c] = await Promise.all([
      fetch('/health').then((r) => r.json() as Promise<Kesehatan>).catch(() => null),
      api.revocations(),
    ])
    setSehat(h); setCabut(c)
  }, [])

  useEffect(() => {
    if (offline) return
    void muat().catch((e) => setSalah(String(e instanceof Error ? e.message : e)))
  }, [muat, offline])

  async function jalankan(apa: () => Promise<void>, kabar: string) {
    setSibuk(true); setPesan(''); setSalah('')
    try { await apa(); await muat(); onRefresh(); setPesan(kabar) }
    catch (e) { setSalah(String(e instanceof Error ? e.message : e)) }
    finally { setSibuk(false) }
  }

  async function impor(berkas: File | undefined, path: string, method: 'POST' | 'PUT') {
    if (!berkas) return
    await jalankan(async () => {
      let isi: unknown
      try { isi = JSON.parse(await berkas.text()) } catch { throw new Error(L.rusak(berkas.name)) }
      await api.importJson(path, method, isi, admin)
    }, L.diimpor(berkas.name))
  }

  if (offline) return <div className="card"><Kosong judul={L.luringJ} isi={L.luringI} /></div>

  const labelCabut = cabut?.status === 'terkini' ? L.fresh : cabut?.status === 'basi' ? L.stale : L.missing
  const nadaCabut = cabut?.status === 'terkini' ? 'hijau' : cabut?.status === 'basi' ? 'jingga' : 'merah'
  const baris = (k: string, v: string, nada = '') => (
    <div key={k}><dt>{k}</dt><dd className={nada}>{v}</dd></div>
  )
  const belumCek = metrics?.revocation_unchecked_devices.length ?? 0
  const ditolak = Object.entries(metrics?.rejects_by_reason ?? {}).sort((a, b) => b[1] - a[1])
  const perhatian = belumCek > 0 || cabut?.status !== 'terkini'

  return (
    <>
      {!adaAdmin && (
        <p className="catatan-atas">{L.butuhAdmin} <button className="tautan" onClick={minta}>{L.isiKunci}</button></p>
      )}

      {(perhatian || ditolak.length > 0) && (
        <section className="card">
            <h2>{L.perhatian}</h2>
            {!perhatian && ditolak.length === 0 ? (
              <p className="bantu">{L.bersih}</p>
            ) : (
              <ul className="daftar-perhatian">
                {cabut?.status !== 'terkini' && <li className="jingga">{labelCabut}: {L.rev}</li>}
                {belumCek > 0 && <li className="jingga">{L.belumCek(belumCek)}</li>}
              </ul>
            )}
            {ditolak.length > 0 && (
              <>
                <h3>{L.ditolak}</h3>
                <ul className="daftar-tolak">
                  {ditolak.map(([alasan, n]) => <li key={alasan}><b>{n}</b><span>{alasan}</span></li>)}
                </ul>
              </>
            )}
          </section>
      )}

      <div className="dua-sistem">
        <div className="kolom">
          <section className="card">
              <h2>{L.inti}</h2>
              <dl className="dl-baris">
                {baris(L.versi, sehat?.version ? `v${sehat.version}` : '—')}
                {baris(L.mode, sehat?.air_gapped ? L.airgap : L.daring)}
                {baris(L.attest, sehat?.attestation === 'verify' ? L.verify : L.claim, sehat?.attestation === 'verify' ? '' : 'jingga')}
                {baris(L.enroll, sehat?.enroll === 'token' ? L.token : L.shared, sehat?.enroll === 'token' ? '' : 'jingga')}
                {baris(L.signer, sehat?.agent_signers && sehat.agent_signers !== 'kosong' ? L.aktif : L.kosong, sehat?.agent_signers && sehat.agent_signers !== 'kosong' ? '' : 'jingga')}
                {baris(L.auth, sehat?.api_auth === 'terbuka' ? L.terbuka : L.terkunci, sehat?.api_auth === 'terbuka' ? 'jingga' : '')}
                {baris(L.enf, L.rekomendasi)}
                {sehat?.retention_days !== undefined && baris(L.retensi, L.hari(sehat.retention_days))}
              </dl>
            </section>
          <section className="card">
              <h2>{L.alarm}</h2>
              <p className="bantu">{L.alarmB}</p>
              <button className="btn ghost" disabled={sibuk || !adaAdmin}
                      onClick={() => void jalankan(() => api.scanAlarms(admin).then(() => undefined), L.diperiksa)}>
                {L.jalan}
              </button>
            </section>
        </div>
        <div className="kolom">
          <section className="card">
              <h2>{L.rev}</h2>
              <p className="bantu">{L.revB}</p>
              <div className="rev-angka">
                <span className={`lencana ${nadaCabut}`}>{labelCabut}</span>
                <div><b>{cabut?.entries ?? 0}</b><small>{L.revIsi}</small></div>
                {cabut?.age_days !== undefined && <div><b>{cabut.age_days}</b><small>{L.revUmur}</small></div>}
              </div>
              <label className="berkas">
                <span>{L.impor}</span>
                <input type="file" accept=".json" disabled={sibuk || !adaAdmin}
                       onChange={(e) => void impor(e.target.files?.[0], '/api/attestation/revocations', 'POST')} />
              </label>
            </section>
          <section className="card">
              <h2>{L.lists}</h2>
              <p className="bantu">{L.listsB}</p>
              <label className="berkas">
                <span>{L.blok}</span>
                <input type="file" accept=".json" disabled={sibuk || !adaAdmin}
                       onChange={(e) => void impor(e.target.files?.[0], '/api/blocklist/import', 'POST')} />
              </label>
              <label className="berkas">
                <span>{L.pabrik}</span>
                <input type="file" accept=".json" disabled={sibuk || !adaAdmin}
                       onChange={(e) => void impor(e.target.files?.[0], '/api/factory-allowlist', 'PUT')} />
              </label>
            </section>
        </div>
      </div>

      {(pesan || salah) && <p className={`pesan${salah ? ' salah' : ''}`} role="status">{salah || pesan}</p>}
    </>
  )
}
