import { Link2, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { LinkRow } from '../lib/project'
import { supabase } from '../lib/supabase'
import Button from './Button'
import styles from './LinksBar.module.css'

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Figma "Team folder": the project's shared links. Any member can add or remove them. */
export default function LinksBar({ projectId, links, onChange }: { projectId: number; links: LinkRow[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const clean = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`
    const { error } = await supabase.from('links').insert({ project_id: projectId, label: label.trim(), url: clean })
    if (error) return setError('Check the name and link, then try again.')
    setAdding(false)
    setLabel('')
    setUrl('')
    setError(null)
    onChange()
  }

  async function remove(id: number) {
    await supabase.from('links').delete().eq('id', id)
    onChange()
  }

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Team folder</span>
      {adding ? (
        <form className={styles.form} onSubmit={add}>
          <input className={styles.input} placeholder="Name, e.g. Slides" value={label} maxLength={60} required autoFocus onChange={(e) => setLabel(e.target.value)} />
          <input className={styles.input} style={{ flex: 1 }} placeholder="https://…" value={url} required onChange={(e) => setUrl(e.target.value)} />
          <Button type="submit">Add</Button>
          <Button variant="text" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          {error && <span className={styles.empty}>{error}</span>}
        </form>
      ) : (
        <>
          <div className={styles.links}>
            {links.length === 0 && <span className={styles.empty}>Shared docs, drives and decks go here.</span>}
            {links.map((l) => (
              <span key={l.id} className={styles.item}>
                <a className={styles.link} href={l.url} target="_blank" rel="noreferrer">
                  <Link2 size={15} strokeWidth={1.7} aria-hidden />
                  <span>{l.label}</span>
                  <span className={styles.domain}>{domain(l.url)}</span>
                </a>
                <button type="button" className={styles.remove} onClick={() => remove(l.id)} aria-label={`Remove ${l.label}`}>
                  <X size={13} strokeWidth={1.7} />
                </button>
              </span>
            ))}
          </div>
          <button type="button" className={styles.add} onClick={() => setAdding(true)}>
            <Plus size={16} strokeWidth={1.7} aria-hidden />
            Add link
          </button>
        </>
      )}
    </div>
  )
}
