import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import styles from '../components/Card.module.css'
import Nav from '../components/Nav'
import StoneTrio from '../components/StoneTrio'
import { safeNext, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

/** Asked once, right after someone's first sign-in. */
export default function Welcome() {
  const { profile, refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!profile) return null // RequireAuth renders this route only once a profile exists
  if (profile.name) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('users').update({ name: trimmed }).eq('id', profile!.id)
    if (error) {
      setBusy(false)
      return setError('Couldn’t save your name. Try again.')
    }
    await refreshProfile()
    navigate(next, { replace: true })
  }

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.card}>
          <StoneTrio />
          <h1 className={styles.title}>What should your team call you?</h1>
          <p className={styles.subtitle}>Your name labels your pile and your avatar.</p>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              Name
              <input
                className={styles.input}
                autoComplete="given-name"
                maxLength={40}
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className={styles.submit} disabled={busy || !name.trim()}>
              {busy ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </div>
      </main>
    </>
  )
}
