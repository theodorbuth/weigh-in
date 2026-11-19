import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import Button from '../components/Button'
import styles from '../components/Card.module.css'
import { AddChip, CategoryChip } from '../components/CategoryChip'
import CategoryDialog, { type CategoryDraft } from '../components/CategoryDialog'
import CopyField from '../components/CopyField'
import Nav from '../components/Nav'
import StoneTrio from '../components/StoneTrio'
import { useAuth } from '../lib/auth'
import { DEFAULT_CATEGORIES, nextFreeColour } from '../lib/colours'
import { joinLink } from '../lib/joinLink'
import { supabase } from '../lib/supabase'

type Editing = { index: number } | { index: 'new' } | null

/** Figma "Create project": name, categories, invite code (+ copy join link), password. */
export default function NewProject() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [categories, setCategories] = useState<CategoryDraft[]>(DEFAULT_CATEGORIES)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Reserve-free suggestion shown before creating; the server picks another if it's taken by then.
  useEffect(() => {
    supabase.rpc('suggest_invite_code').then(({ data }) => data && setCode(String(data)))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Give the project a name.')
    if (password.length < 4) return setError('Use a project password with at least 4 characters.')
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_project', {
      p_name: name.trim(),
      p_password: password,
      p_categories: categories,
      p_invite_code: code || null,
    })
    setBusy(false)
    if (error) return setError('Couldn’t create the project. ' + error.message)
    const created = Array.isArray(data) ? data[0] : data
    navigate(created?.project_id ? `/p/${created.project_id}` : '/', { replace: true })
  }

  const editingDraft =
    editing === null
      ? null
      : editing.index === 'new'
        ? { name: '', colour: nextFreeColour(categories.map((c) => c.colour)) }
        : categories[editing.index]

  return (
    <>
      <Nav viewerName={profile?.name ?? undefined} />
      <main className={styles.page}>
        <form className={`${styles.card} ${styles.wide}`} onSubmit={submit}>
          <StoneTrio />
          <h1 className={styles.title}>New project</h1>

          <label className={styles.field}>
            Project name
            <input
              className={styles.input}
              placeholder="CIS 5120 Final"
              maxLength={80}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className={styles.field}>
            Categories
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((c, i) => (
                <CategoryChip key={c.name} name={c.name} colour={c.colour} onEdit={() => setEditing({ index: i })} />
              ))}
              <AddChip onClick={() => setEditing({ index: 'new' })} />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              Invite code
              <CopyField value={code} copyText={code ? joinLink(code) : ''} label="Copy join link" copiedText="Link copied" />
            </div>
            <label className={styles.field}>
              Password
              <input
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder="Teammates need this"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </div>

          <p className={styles.hint}>Teammates in the project can see this password, so don’t reuse a personal one.</p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className={styles.submit} disabled={busy}>
            {busy ? 'Creating…' : 'Create project'}
          </Button>
        </form>
      </main>

      {editing && editingDraft && (
        <CategoryDialog
          mode={editing.index === 'new' ? 'new' : 'edit'}
          initial={editingDraft}
          takenNames={categories.filter((_, i) => i !== editing.index).map((c) => c.name)}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            setCategories((cs) =>
              editing.index === 'new' ? [...cs, draft] : cs.map((c, i) => (i === editing.index ? draft : c)),
            )
            setEditing(null)
          }}
          onRemove={
            editing.index === 'new'
              ? undefined
              : () => {
                  setCategories((cs) => cs.filter((_, i) => i !== editing.index))
                  setEditing(null)
                }
          }
        />
      )}
    </>
  )
}
