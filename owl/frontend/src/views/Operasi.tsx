import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import type { DeviceRow, Kasus, Pencabutan, StatusKasus } from '../lib/types'

/**
 * Operasi perangkat.
 *
 * Di sinilah yang dikerjakan ORANG atas keluaran mesin: menandai penanganan,
 * mencabut perangkat yang hilang, menerbitkan token pendaftaran, dan
 * memasukkan daftar yang datang dari luar. Tab lain menjawab "apa yang
 * terjadi"; tab ini satu-satunya yang mengubah keadaan.
 *
 * Tiga hal yang sengaja begini:
 *
 * 1. Tidak ada rekaman cadangan. Pencabutan dan penanganan adalah keadaan
 *    yang ditindaklanjuti petugas, dan menampilkan rekaman lama sebagai
 *    keadaan sekarang berarti menyuruh orang bertindak atas dunia yang sudah
 *    lewat. Pada tautan publik, layar ini menyatakan dirinya tidak tersedia.
 *
 * 2. Kunci admin hidup di memori halaman saja, tidak di `sessionStorage`
 *    seperti kunci baca. Kunci baca hanya membuka tampilan; kunci admin
 *    mengubah kebijakan, dan kunci semacam itu tidak pantas bertahan
 *    melewati satu kali muat halaman.
 *
 * 3. Seluruh berkas diimpor dari berkas yang dibawa petugas, bukan diunduh
 *    OWL Core. Daftar pencabutan Google pun begitu. Itu syarat air-gapped,
 *    bukan keterbatasan yang belum sempat diperbaiki.
 */

const STATUS: StatusKasus[] = ['baru', 'diperiksa', 'diselesaikan', 'dikecualikan']

export function Operasi({ devices, offline, onRefresh }: {
  devices: DeviceRow[]
  offline: boolean
  onRefresh: () => void
}) {
  const { t, locale } = useT()
  const [admin, setAdmin] = useState('')
  const [kasus, setKasus] = useState<Kasus[]>([])
  const [cabut, setCabut] = useState<Pencabutan | null>(null)
  const [perangkat, setPerangkat] = useState('')
  const [catatan, setCatatan] = useState('')
  const [status, setStatus] = useState<StatusKasus>('diperiksa')
  const [ttl, setTtl] = useState(30)
  const [tautan, setTautan] = useState('')
  const [pesan, setPesan] = useState('')
  const [salah, setSalah] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const salinan = useRef<HTMLInputElement>(null)

  const muat = useCallback(async () => {
    const [k, c] = await Promise.all([api.cases(), api.revocations()])
    setKasus(k)
    setCabut(c)
  }, [])

  useEffect(() => {
    if (offline) return
    void muat().catch((e) => setSalah(String(e instanceof Error ? e.message : e)))
  }, [muat, offline])

  /** Satu jalur untuk semua perubahan: kerjakan, muat ulang, lalu laporkan. */
  async function jalankan(apa: () => Promise<void>, kabar: string) {
    setSibuk(true); setPesan(''); setSalah('')
    try {
      await apa()
      await muat()
      onRefresh()
      setPesan(kabar)
    } catch (e) {
      setSalah(String(e instanceof Error ? e.message : e))
    } finally {
      setSibuk(false)
    }
  }

  async function impor(berkas: File | undefined, path: string, method: 'POST' | 'PUT') {
    if (!berkas) return
    await jalankan(async () => {
      let isi: unknown
      try {
        isi = JSON.parse(await berkas.text())
      } catch {
        throw new Error(t('ops.badJson', { nama: berkas.name }))
      }
      await api.importJson(path, method, isi, admin)
    }, t('ops.imported', { nama: berkas.name }))
  }

  if (offline) {
    return (
      <div className="card">
        <div className="kicker">{t('ops.kicker')}</div>
        <h3>{t('ops.offlineTitle')}</h3>
        <p className="muted" style={{ maxWidth: '72ch' }}>{t('ops.offlineBody')}</p>
      </div>
    )
  }

  const adaAdmin = admin.trim() !== ''
  const adaPerangkat = perangkat.trim() !== ''
  const catatanCukup = catatan.trim().length >= 3
  const dipilih = devices.find((d) => d.device_id === perangkat)

  return (
    <div className="ops">
      {/* ——— kunci admin ——— */}
      <div className="card ops-kunci">
        <div className="kicker">{t('ops.kicker')}</div>
        <label className="ops-label" htmlFor="ops-admin">{t('ops.adminKey')}</label>
        <input
          id="ops-admin"
          type="password"
          autoComplete="off"
          value={admin}
          onChange={(e) => setAdmin(e.target.value)}
          placeholder={t('ops.adminHint')}
        />
        <p className="muted">{t('ops.adminNote')}</p>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        {/* ——— daftar pencabutan attestation ——— */}
        <div className="card">
          <div className="kicker">{t('ops.revList')}</div>
          <div className="ops-cabut">
            <span className={`ops-lencana ${nadaCabut(cabut?.status)}`}>
              {cabut ? labelCabut(cabut.status, t) : '—'}
            </span>
            <div>
              <div className="n">{cabut?.entries ?? 0}</div>
              <div className="l">{t('ops.revEntries')}</div>
            </div>
            {cabut?.age_days !== undefined && (
              <div>
                <div className="n">{cabut.age_days}</div>
                <div className="l">{t('ops.revAge')}</div>
              </div>
            )}
          </div>
          <p className="muted">{t('ops.revNote')}</p>
          <label className="ops-berkas">
            <span>{t('ops.revImport')}</span>
            <input
              type="file" accept=".json" disabled={sibuk || !adaAdmin}
              onChange={(e) => void impor(e.target.files?.[0], '/api/attestation/revocations', 'POST')}
            />
          </label>
        </div>

        {/* ——— daftar larangan dan pengecualian pabrik ——— */}
        <div className="card">
          <div className="kicker">{t('ops.lists')}</div>
          <p className="muted">{t('ops.listsNote')}</p>
          <label className="ops-berkas">
            <span>{t('ops.blocklist')}</span>
            <input
              type="file" accept=".json" disabled={sibuk || !adaAdmin}
              onChange={(e) => void impor(e.target.files?.[0], '/api/blocklist/import', 'POST')}
            />
          </label>
          <label className="ops-berkas">
            <span>{t('ops.factory')}</span>
            <input
              type="file" accept=".json" disabled={sibuk || !adaAdmin}
              onChange={(e) => void impor(e.target.files?.[0], '/api/factory-allowlist', 'PUT')}
            />
          </label>
          <button
            className="btn ghost kecil" style={{ marginTop: 14 }}
            disabled={sibuk || !adaAdmin}
            onClick={() => void jalankan(() => api.scanAlarms(admin).then(() => undefined), t('ops.scanned'))}
          >
            {t('ops.scan')}
          </button>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>{t('ops.scanNote')}</p>
        </div>
      </div>

      {/* ——— satu perangkat: token, pencabutan, penanganan ——— */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="kicker">{t('ops.device')}</div>

        <div className="ops-pilih">
          <label className="ops-label" htmlFor="ops-dev">{t('ops.deviceId')}</label>
          <input
            id="ops-dev"
            list="ops-daftar-perangkat"
            value={perangkat}
            onChange={(e) => { setPerangkat(e.target.value); setTautan('') }}
            placeholder={t('ops.devicePick')}
          />
          <datalist id="ops-daftar-perangkat">
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>{d.label || d.device_id}</option>
            ))}
          </datalist>
          {dipilih && (
            <p className="ops-terpilih">
              {dipilih.label || dipilih.device_id} · {dipilih.unit || '—'}
              {dipilih.revoked ? <span className="ops-lencana merah">{t('ops.revoked')}</span> : null}
            </p>
          )}
        </div>

        <label className="ops-label" htmlFor="ops-note">{t('ops.note')}</label>
        <input
          id="ops-note"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder={t('ops.noteHint')}
        />

        <div className="ops-tombol">
          <button
            className="btn ghost"
            disabled={sibuk || !adaAdmin || !adaPerangkat}
            onClick={() => void jalankan(async () => {
              const r = await api.enrollToken(perangkat.trim(), admin)
              setTautan(r.provision_url)
            }, t('ops.tokenIssued'))}
          >
            {t('ops.token')}
          </button>
          <button
            className="btn amber"
            disabled={sibuk || !adaAdmin || !adaPerangkat || !catatanCukup}
            onClick={() => void jalankan(
              () => api.revokeDevice(perangkat.trim(), catatan.trim(), admin).then(() => undefined),
              t('ops.revokeDone'),
            )}
          >
            {t('ops.revoke')}
          </button>
          <button
            className="btn ghost"
            disabled={sibuk || !adaAdmin || !adaPerangkat}
            onClick={() => void jalankan(
              () => api.unrevokeDevice(perangkat.trim(), admin).then(() => undefined),
              t('ops.unrevokeDone'),
            )}
          >
            {t('ops.unrevoke')}
          </button>
        </div>

        {tautan && (
          <div className="ops-tautan">
            <div className="kicker" style={{ marginBottom: 6 }}>{t('ops.linkOnce')}</div>
            <input ref={salinan} readOnly value={tautan} onFocus={(e) => e.target.select()} />
            <p className="muted">{t('ops.linkNote')}</p>
          </div>
        )}

        <div className="ops-garis" />

        <div className="kicker">{t('ops.caseEdit')}</div>
        <div className="ops-kasus-atur">
          <label>
            <span>{t('ops.caseStatus')}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusKasus)}>
              {STATUS.map((x) => <option key={x} value={x}>{t(`ops.st.${x}` as never)}</option>)}
            </select>
          </label>
          <label className={status === 'dikecualikan' ? '' : 'redup'}>
            <span>{t('ops.caseTtl')}</span>
            <input
              type="number" min={1} max={1440} value={ttl}
              disabled={status !== 'dikecualikan'}
              onChange={(e) => setTtl(Number(e.target.value))}
            />
          </label>
          <button
            className="btn"
            disabled={sibuk || !adaAdmin || !adaPerangkat || !catatanCukup}
            onClick={() => void jalankan(
              () => api.setCase(perangkat.trim(), status, catatan.trim(), ttl, admin).then(() => undefined),
              t('ops.caseSaved'),
            )}
          >
            {t('ops.caseSave')}
          </button>
        </div>
        {status === 'dikecualikan' && <p className="ops-waspada">{t('ops.exceptionWarn')}</p>}
      </div>

      {/* ——— daftar penanganan ——— */}
      <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 0' }}>
          <div className="kicker">{t('ops.cases')}</div>
        </div>
        {kasus.length === 0 ? (
          <p className="empty">{t('ops.casesEmpty')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('dev.col.device')}</th>
                <th>{t('ops.caseStatus')}</th>
                <th>{t('ops.actor')}</th>
                <th>{t('ops.note')}</th>
                <th>{t('ops.expires')}</th>
              </tr>
            </thead>
            <tbody>
              {kasus.map((k) => (
                <tr
                  key={k.device_id}
                  className={`clickable${k.device_id === perangkat ? ' terpilih' : ''}`}
                  onClick={() => {
                    setPerangkat(k.device_id)
                    setStatus(k.status)
                    setCatatan(k.note)
                    setTautan('')
                  }}
                >
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{k.device_id}</td>
                  <td><span className={`ops-lencana ${nadaKasus(k.status)}`}>{t(`ops.st.${k.status}` as never)}</span></td>
                  <td className="muted">{k.actor}</td>
                  <td className="muted">{k.note}</td>
                  <td className="muted">
                    {k.expires_at ? new Date(k.expires_at).toLocaleString(locale) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(pesan || salah) && (
        <p className={`ops-pesan${salah ? ' salah' : ''}`} role="status">{salah || pesan}</p>
      )}
    </div>
  )
}

function nadaCabut(status?: string): string {
  if (status === 'terkini') return 'hijau'
  if (status === 'basi') return 'jingga'
  return 'merah'
}

function nadaKasus(status: StatusKasus): string {
  if (status === 'diselesaikan') return 'hijau'
  if (status === 'dikecualikan') return 'jingga'
  if (status === 'baru') return 'merah'
  return ''
}

function labelCabut(status: string, t: (k: never) => string): string {
  if (status === 'terkini') return t('ops.revFresh' as never)
  if (status === 'basi') return t('ops.revStale' as never)
  return t('ops.revMissing' as never)
}
