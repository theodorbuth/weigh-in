import { X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { Category } from '../lib/project'
import Button from './Button'
import styles from './CategoryDialog.module.css'
import HourStepper from './HourStepper'

export interface WorkDraft {
  name: string
  hours: number
  categoryId: number
}

interface WorkDialogProps {
  mode: 'new' | 'edit'
  initial: WorkDraft
  categories: Category[]
  busy?: boolean
  error?: string | null
  onSave: (draft: WorkDraft) => void
  onNewCategory: () => void
  /** A category just created from this dialog; selected automatically. */
  createdCategoryId?: number | null
  onClose: () => void
}

const NEW_CATEGORY = -1

/** "+ Add work": task name, estimated hours, and a category (or create a shared one). */
export default function WorkDialog({ mode, initial, categories, busy, error, onSave, onNewCategory, createdCategoryId, onClose }: WorkDialogProps) {
  const [name, setName] = useState(initial.name)
  const [hours, setHours] = useState(initial.hours)
  const [categoryId, setCategoryId] = useState(initial.categoryId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // If nothing valid is chosen (e.g. right after "+ New category…"), use the newest category.
  const exists = (id: number | null | undefined) => id != null && categories.some((c) => c.id === id)
  const selectedId =
    categoryId === NEW_CATEGORY && exists(createdCategoryId)
      ? createdCategoryId!
      : exists(categoryId)
        ? categoryId
        : (categories.at(-1)?.id ?? NEW_CATEGORY)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || selectedId === NEW_CATEGORY) return
    onSave({ name: name.trim(), hours, categoryId: selectedId })
  }

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="work-title" onSubmit={submit}>
        <div className={styles.header}>
          <h2 id="work-title" className={styles.title}>
            {mode === 'new' ? 'Add work' : 'Edit work'}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={1.7} />
          </button>
        </div>
        <label className={styles.field}>
          Task
          <input className={styles.input} value={name} maxLength={80} autoFocus placeholder="e.g. Final video" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className={styles.field}>
          Estimated hours
          <div>
            <HourStepper value={hours} onChange={setHours} max={99} label="Estimated hours" />
          </div>
        </div>
        <label className={styles.field}>
          Category
          <select
            className={styles.input}
            value={selectedId}
            onChange={(e) => {
              const id = Number(e.target.value)
              if (id === NEW_CATEGORY) {
                setCategoryId(NEW_CATEGORY) // falls back to the newest category once it's created
                onNewCategory()
              } else setCategoryId(id)
            }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <span />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : mode === 'new' ? 'Add work' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
