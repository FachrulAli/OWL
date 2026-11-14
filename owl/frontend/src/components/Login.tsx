import { useState } from 'react'
import type { FormEvent } from 'react'
import { DEMO_PASSWORD, setKey, verifyKey } from '../lib/api'
import { useT } from '../lib/i18n'

/**
 * Layar kunci dashboard (NFR 5.1).
 *
 * Kata sandi diteruskan ke OWL Core sebagai kunci baca, jadi yang memutuskan
 * benar atau salah adalah backend. Ketika OWL Core tidak terjangkau, misalnya
 * pada tautan publik yang hanya memuat rekaman, keputusan itu tidak ada yang
 * memegangnya; dalam keadaan itu layar ini hanya menahan tampilan dan
 * mengatakannya terus terang kepada pembuka halaman.
 */
export function Login({ onOpen }: { onOpen: () => void }) {
  const { t } = useT()
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [luring, setLuring] = useState(false)

  /**
   * Mode tamu.
   *
   * Sementara ini dashboard belum memisahkan peran, jadi tamu memperoleh
   * akses yang sama dengan admin: tombol ini memakai kunci baca bawaan.
   * Begitu satuan mengganti `OWL_API_KEY`, kunci itu ditolak OWL Core dan
   * mode tamu berhenti bekerja dengan sendirinya, tanpa perlu dicabut.
   */
  async function masukTamu() {
    if (busy) return
    setBusy(true); setErr('')
    try {
      const hasil = await verifyKey(DEMO_PASSWORD)
      if (hasil === 'ok' || hasil === 'luring') {
        setKey(DEMO_PASSWORD)
        onOpen()
        return
      }
      setErr(t('login.guestUnavailable'))
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try {
      const hasil = await verifyKey(password)
      if (hasil === 'ok') {
        setKey(password)
        onOpen()
        return
      }
      if (hasil === 'luring') {
        setLuring(true)
        if (password === DEMO_PASSWORD) {
          setKey(password)
          onOpen()
          return
        }
      }
      setErr(t('login.wrong'))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lock">
      <form className="lock-card" onSubmit={submit}>
        <h3>{t('login.title')}</h3>
        <p className="muted">{t('login.body')}</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label={t('login.password')}
          placeholder={t('login.password')}
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || password === ''}>
          {busy ? t('login.checking') : t('login.open')}
        </button>
        <button className="btn ghost" type="button" disabled={busy} onClick={masukTamu}>
          {t('login.guest')}
        </button>
        <p className="muted small">{t('login.guestNote')}</p>
        {err && <p className="lock-err">{err}</p>}
        {luring && <p className="muted small">{t('login.offlineNote')}</p>}
      </form>
    </div>
  )
}
