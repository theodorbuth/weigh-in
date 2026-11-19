import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Button from '../components/Button'
import styles from '../components/Card.module.css'
import Nav from '../components/Nav'
import StoneTrio from '../components/StoneTrio'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

/**
 * Figma "Join project". Requirement 3: join_project() checks code + password and
 * inserts the membership in one transaction. Joining twice is rejected by the
 * members primary key (SQLSTATE 23505), shown as "You're already in this project".
 */
export default function JoinProject() {
  const { profile } = useAuth()
  const { code: codeFromLink } = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState((codeFromLink ?? '').toUpperCase())
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [alreadyIn, setAlreadyIn] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setAlreadyIn(false)
    const { data, error } = await supabase.rpc('join_project', {
      p_code: code.trim().toUpperCase(),
      p_password: password,
    })
    setBusy(false)
    if (!error) return navigate(`/p/${data}`, { replace: true })
    if (error.code === '23505') {
      setAlreadyIn(true)
      return setError('You’re already in this project.')
    }
    if (error.code === '28P01') return setError('Wrong project code or password.')
    setError('Couldn’t join right now. ' + error.message)
  }

  return (
    <>
      <Nav viewerName={profile?.name ?? undefined} />
      <main className={styles.page}>
        <form className={styles.card} onSubmit={submit}>
          <StoneTrio />
          <h1 className={styles.title}>Join project</h1>
          <label className={styles.field}>
            Project code
            <input
              className={styles.input}
              placeholder="WGH-4821"
              autoCapitalize="characters"
              autoFocus={!codeFromLink}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <label className={styles.field}>
            Password
            <input
              className={styles.input}
              type="password"
              autoComplete="off"
              autoFocus={!!codeFromLink}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error} {alreadyIn && <Link to="/">Go to your projects</Link>}
            </p>
          )}
          <Button type="submit" className={styles.submit} disabled={busy}>
            {busy ? 'Joining…' : 'Join project'}
          </Button>
        </form>
      </main>
    </>
  )
}
