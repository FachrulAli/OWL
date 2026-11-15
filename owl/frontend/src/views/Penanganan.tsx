import { useEffect, useMemo, useState } from 'react'
import { Cip, Ikon, Kosong, Segmen, SkorLencana } from '../components/Ui'
import { useAdmin } from '../lib/admin'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Page } from '../lib/nav'
import type { DeviceRow, Kasus, StatusKasus } from '../lib/types'
import { Soc } from './Soc'

/**
 * Penanganan: siapa mengerjakan apa, dan apa yang sudah diputuskan.
 *
 * Satu layar untuk satu alur kerja petugas: gerbang menolak, peristiwa
 * keluar ke SOC, lalu penanganannya dicatat di sini. Kasus dan peristiwa SOC
 * ada di satu halaman karena dibaca bersamaan, dan dipisah dengan segmen
 * supaya masing-masing tabelnya tidak berdesakan.
 *
 * Mengubah keadaan perangkat (menandai, mengecualikan, mencabut) memakai
 * kunci admin dari bilah atas. Tidak ada rekaman cadangan untuk halaman ini:
 * menampilkan penanganan lama sebagai keadaan sekarang berarti menyuruh
 * petugas bertindak atas dunia yang sudah lewat.
 */

const STATUS: StatusKasus[] = ['baru', 'diperiksa', 'dikecualikan', 'diselesaikan']

const TEKS = {
  id: {
    kasus: 'Kasus', soc: 'Peristiwa ke SOC', semua: 'Semua',
    tangani: 'Tangani perangkat', pilih: 'Pilih perangkat dari tabel atau ketik ID-nya.',
    idLabel: 'ID perangkat', idHint: 'Mis. TACTICAL-07',
    status: 'Status', ttl: 'Berlaku (menit)', catatan: 'Catatan', catatanHint: 'Alasan atau temuan, minimal 3 huruf',
    simpan: 'Simpan penanganan', menyimpan: 'Menyimpan…',
    lain: 'Tindakan pada perangkat', cabut: 'Cabut perangkat', buka: 'Buka pencabutan',
    cabutNote: 'Perangkat yang dicabut ditolak lebih dulu daripada skor apa pun.',
    butuhAdmin: 'Butuh kunci admin.', isiKunci: 'Isi kunci admin',
    detail: 'Lihat detail perangkat',
    kosongJ: 'Belum ada kasus', kosongI: 'Kasus dibuka otomatis saat gerbang mengarantina perangkat. Anda juga dapat menandai perangkat secara manual di panel kanan.',
    kolPerangkat: 'Perangkat', kolStatus: 'Status', kolOleh: 'Oleh', kolCatatan: 'Catatan', kolBerakhir: 'Berakhir',
    luringJ: 'Penanganan butuh OWL Core yang berjalan',
    luringI: 'Pencabutan dan penanganan adalah keadaan yang ditindaklanjuti petugas. Menampilkan rekaman lama sebagai keadaan sekarang berarti menyuruh orang bertindak atas dunia yang sudah lewat. Jalankan OWL Core, lalu buka halaman ini lagi.',
    tersimpan: 'Penanganan tersimpan.', dicabutOk: 'Perangkat dicabut.', dibukaOk: 'Pencabutan dibuka.',
    peringatan: 'Pengecualian hanya melewati skor. Pencabutan, laporan basi, attestation gagal, dan aturan penentu tetap menolak.',
    dicabutLabel: 'Dicabut', tidakKasus: 'Tidak ada kasus pada saringan ini.',
  },
  en: {
    kasus: 'Cases', soc: 'SOC events', semua: 'All',
    tangani: 'Handle a device', pilih: 'Pick a device from the table or type its ID.',
    idLabel: 'Device ID', idHint: 'e.g. TACTICAL-07',
    status: 'Status', ttl: 'Valid for (minutes)', catatan: 'Note', catatanHint: 'Reason or finding, at least 3 characters',
    simpan: 'Save handling', menyimpan: 'Saving…',
    lain: 'Device actions', cabut: 'Revoke device', buka: 'Lift revocation',
    cabutNote: 'A revoked device is refused before any score is considered.',
    butuhAdmin: 'Admin key required.', isiKunci: 'Enter admin key',
    detail: 'View device details',
    kosongJ: 'No cases yet', kosongI: 'Cases open automatically when the gate quarantines a device. You can also mark a device manually in the right panel.',
    kolPerangkat: 'Device', kolStatus: 'Status', kolOleh: 'By', kolCatatan: 'Note', kolBerakhir: 'Expires',
    luringJ: 'Cases need a running OWL Core',
    luringI: 'Revocation and case handling are state that officers act on. Showing an old recording as the present means telling people to act on a world that has moved on. Start OWL Core, then open this page again.',
    tersimpan: 'Handling saved.', dicabutOk: 'Device revoked.', dibukaOk: 'Revocation lifted.',
    peringatan: 'An exception only bypasses the score. Revocation, stale reports, failed attestation, and decisive rules still refuse.',
    dicabutLabel: 'Revoked', tidakKasus: 'No cases match this filter.',
  },
} as const

const nada = (s: StatusKasus) =>
  s === 'diselesaikan' ? 'hijau' : s === 'dikecualikan' ? 'jingga' : s === 'baru' ? 'merah' : ''

export function Penanganan({
  devices, kasus, offline, awal, onRefresh, onKasus, onPindah,
}: {
  devices: DeviceRow[]
  kasus: Kasus[]
  offline: boolean
  /** ID perangkat dari tautan, mis. dari halaman Perangkat. */
  awal: string
  onRefresh: () => void
  onKasus: () => Promise<void>
  onPindah: (p: Page, arg?: string) => void
}) {
  const { t, lang, locale } = useT()
  const L = TEKS[lang]
  const { admin, minta } = useAdmin()
  const [tampil, setTampil] = useState<'kasus' | 'soc'>('kasus')
  const [saring, setSaring] = useState<'semua' | StatusKasus>('semua')
  const [id, setId] = useState(awal)
  const [status, setStatus] = useState<StatusKasus>('diperiksa')
  const [ttl, setTtl] = useState(30)
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState('')
  const [salah, setSalah] = useState('')

  useEffect(() => { if (awal) setId(awal) }, [awal])

  const hitung = useMemo(() => {
    const h = { semua: kasus.length } as Record<string, number>
    for (const s of STATUS) h[s] = kasus.filter((k) => k.status === s).length
    return h
  }, [kasus])

  const daftar = kasus.filter((k) => saring === 'semua' || k.status === saring)
  const dipilih = devices.find((d) => d.device_id === id.trim())
  const adaAdmin = admin.trim() !== ''
  const idSiap = id.trim() !== ''
  const catatanCukup = catatan.trim().length >= 3

  async function jalankan(apa: () => Promise<void>, kabar: string) {
    setSibuk(true); setPesan(''); setSalah('')
    try {
      await apa()
      await onKasus()
      onRefresh()
      setPesan(kabar)
    } catch (e) {
      setSalah(String(e instanceof Error ? e.message : e))
    } finally {
      setSibuk(false)
    }
  }

  if (offline) {
    return <div className="card"><Kosong judul={L.luringJ} isi={L.luringI} /></div>
  }

  return (
    <>
      <div className="bar-alat">
        <Segmen
          label={L.kasus} nilai={tampil} onUbah={setTampil}
          pilihan={[{ id: 'kasus', teks: L.kasus, n: kasus.length }, { id: 'soc', teks: L.soc }]}
        />
        {tampil === 'kasus' && (
          <div className="cip-baris" role="group" aria-label={L.status}>
            <Cip aktif={saring === 'semua'} onKlik={() => setSaring('semua')} n={hitung.semua}>{L.semua}</Cip>
            {STATUS.map((s) => (
              <Cip key={s} aktif={saring === s} nada={nada(s)} mati={hitung[s] === 0 && saring !== s}
                   onKlik={() => setSaring(saring === s ? 'semua' : s)} n={hitung[s]}>
                {t(`ops.st.${s}` as never)}
              </Cip>
            ))}
          </div>
        )}
      </div>

      {tampil === 'soc' ? (
        <Soc devices={devices} />
      ) : (
        <div className="dua-kolom kasus">
          <section className="card tabel-kartu">
            {daftar.length === 0 ? (
              <Kosong judul={kasus.length === 0 ? L.kosongJ : L.tidakKasus} isi={kasus.length === 0 ? L.kosongI : undefined} />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{L.kolPerangkat}</th><th>{L.kolStatus}</th><th>{L.kolOleh}</th>
                    <th>{L.kolCatatan}</th><th>{L.kolBerakhir}</th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((k) => {
                    const d = devices.find((x) => x.device_id === k.device_id)
                    return (
                      <tr key={k.device_id} className={`clickable${k.device_id === id ? ' terpilih' : ''}`}
                          onClick={() => { setId(k.device_id); setStatus(k.status); setCatatan(k.note); setPesan(''); setSalah('') }}>
                        <td>
                          <div className="sel-dev">
                            <SkorLencana skor={d?.score ?? null} />
                            <span><b>{k.device_id}</b><small>{d?.unit || d?.model || ''}</small></span>
                          </div>
                        </td>
                        <td><span className={`lencana ${nada(k.status)}`}>{t(`ops.st.${k.status}` as never)}</span></td>
                        <td className="muted">{k.actor}</td>
                        <td className="muted catatan-sel">{k.note}</td>
                        <td className="muted">{k.expires_at ? new Date(k.expires_at).toLocaleString(locale) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>

          <aside className="card panel-lekat">
            <h2>{L.tangani}</h2>
            <label className="fl-label" htmlFor="pn-id">{L.idLabel}</label>
            <input id="pn-id" list="pn-daftar" value={id} placeholder={L.idHint}
                   onChange={(e) => { setId(e.target.value); setPesan('') }} />
            <datalist id="pn-daftar">
              {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.label}</option>)}
            </datalist>

            {dipilih ? (
              <div className="pn-ringkas">
                <SkorLencana skor={dipilih.score} />
                <span>
                  <b>{dipilih.label || dipilih.device_id}</b>
                  <small>{dipilih.unit || '—'} · {dipilih.model}</small>
                </span>
                {Boolean(dipilih.revoked) && <span className="lencana merah">{L.dicabutLabel}</span>}
                <button className="tautan" onClick={() => onPindah('perangkat', dipilih.device_id)}>
                  {L.detail} <Ikon nama="panah" size={12} />
                </button>
              </div>
            ) : <p className="fl-bantu">{L.pilih}</p>}

            <div className="fl-dua">
              <div>
                <label className="fl-label" htmlFor="pn-st">{L.status}</label>
                <select id="pn-st" value={status} onChange={(e) => setStatus(e.target.value as StatusKasus)}>
                  {STATUS.map((s) => <option key={s} value={s}>{t(`ops.st.${s}` as never)}</option>)}
                </select>
              </div>
              <div className={status === 'dikecualikan' ? '' : 'redup'}>
                <label className="fl-label" htmlFor="pn-ttl">{L.ttl}</label>
                <input id="pn-ttl" type="number" min={1} max={1440} value={ttl}
                       disabled={status !== 'dikecualikan'} onChange={(e) => setTtl(Number(e.target.value))} />
              </div>
            </div>
            {status === 'dikecualikan' && <p className="peringatan">{L.peringatan}</p>}

            <label className="fl-label" htmlFor="pn-cat">{L.catatan}</label>
            <textarea id="pn-cat" rows={3} value={catatan} placeholder={L.catatanHint}
                      onChange={(e) => setCatatan(e.target.value)} />

            <button className="btn blok" disabled={sibuk || !adaAdmin || !idSiap || !catatanCukup}
                    onClick={() => void jalankan(() => api.setCase(id.trim(), status, catatan.trim(), ttl, admin).then(() => undefined), L.tersimpan)}>
              {sibuk ? L.menyimpan : L.simpan}
            </button>

            <div className="pn-garis" />
            <h3>{L.lain}</h3>
            <div className="fl-dua">
              <button className="btn amber" disabled={sibuk || !adaAdmin || !idSiap || !catatanCukup}
                      onClick={() => void jalankan(() => api.revokeDevice(id.trim(), catatan.trim(), admin).then(() => undefined), L.dicabutOk)}>
                {L.cabut}
              </button>
              <button className="btn ghost" disabled={sibuk || !adaAdmin || !idSiap}
                      onClick={() => void jalankan(() => api.unrevokeDevice(id.trim(), admin).then(() => undefined), L.dibukaOk)}>
                {L.buka}
              </button>
            </div>
            <p className="fl-bantu">{L.cabutNote}</p>

            {!adaAdmin && (
              <p className="fl-bantu">{L.butuhAdmin} <button className="tautan" onClick={minta}>{L.isiKunci}</button></p>
            )}
            {(pesan || salah) && <p className={`pesan${salah ? ' salah' : ''}`} role="status">{salah || pesan}</p>}
          </aside>
        </div>
      )}
    </>
  )
}
