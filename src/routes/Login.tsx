import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import styles from '../components/Card.module.css'
import Nav from '../components/Nav'
import StoneTrio from '../components/StoneTrio'
import { safeNext, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.'
  if (/already registered|already been registered/i.test(message))
    return 'That email already has an account. Sign in instead.'
  if (/password should be at least/i.test(message)) return 'Use a password with at least 6 characters.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.'
  return message
}

export default function Login() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const creds = { email: email.trim().toLowerCase(), password }
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword(creds)
        : await supabase.auth.signUp(creds)
    setBusy(false)
    if (error) return setError(friendly(error.message))
    if (mode === 'signup' && !data.session) {
      setError('Account created, but email confirmation is switched on in Supabase, so you can’t sign in yet.')
    }
    // On success the AuthProvider sees the new session and this page redirects.
  }

  const signup = mode === 'signup'
  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.card}>
          <StoneTrio />
          <h1 className={styles.title}>{signup ? 'Create your account' : 'Sign in to Weigh In'}</h1>
          <p className={styles.subtitle}>
            {signup ? 'Use any email; nothing is sent to it.' : 'Welcome back.'}
          </p>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              Email
              <input
                className={styles.input}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Password
              <input
                className={styles.input}
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className={styles.submit} disabled={busy}>
              {busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
            </Button>
          </form>
          <p className={styles.switch}>
            {signup ? 'Already have an account? ' : 'New here? '}
            <Button
              variant="text"
              onClick={() => {
                setMode(signup ? 'signin' : 'signup')
                setError(null)
              }}
            >
              {signup ? 'Sign in' : 'Create an account'}
            </Button>
          </p>
        </div>
      </main>
    </>
  )
}
