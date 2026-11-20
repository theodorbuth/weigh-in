import { Check, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { CATEGORY_COLOURS } from '../lib/colours'
import Button from './Button'
import styles from './CategoryDialog.module.css'

export interface CategoryDraft {
  name: string
  colour: string
}

interface CategoryDialogProps {
  /** Existing category to edit, or a starting draft for a new one. */
  initial: CategoryDraft
  mode: 'new' | 'edit'
  /** Names already in use (case-insensitive), to block duplicates. */
  takenNames: string[]
  onSave: (draft: CategoryDraft) => void
  onRemove?: () => void
  /** Categories this one may be merged into (edit mode only). */
  mergeTargets?: { id: number; name: string; colour: string }[]
  onMerge?: (intoId: number) => void
  onClose: () => void
}

/** Figma "Overlay · New category" / "Edit category": name + 8 colour swatches. */
export default function CategoryDialog({ initial, mode, takenNames, onSave, onRemove, mergeTargets = [], onMerge, onClose }: CategoryDialogProps) {
  const [name, setName] = useState(initial.name)
  const [colour, setColour] = useState(initial.colour.toUpperCase())
  const [mergeInto, setMergeInto] = useState<number | null>(null)
  const target = mergeTargets.find((t) => t.id === mergeInto)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const trimmed = name.trim()
  const duplicate = takenNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())

  function submit(e: FormEvent) {
    e.preventDefault()
    // Picking a merge target turns the main button into "Merge into …" — one click merges.
    if (target && onMerge) return onMerge(target.id)
    if (!trimmed || duplicate) return
    onSave({ name: trimmed, colour })
  }

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" onSubmit={submit}>
        <div className={styles.header}>
          <h2 id="category-dialog-title" className={styles.title}>
            {mode === 'new' ? 'New category' : 'Edit category'}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={1.7} />
          </button>
        </div>

        <label className={styles.field}>
          Name
          <input
            className={styles.input}
            disabled={!!target}
            value={name}
            maxLength={40}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {duplicate && <p className={styles.error}>There’s already a category called “{trimmed}”.</p>}

        <div className={styles.field} style={target ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          Colour
          <div className={styles.swatches} role="radiogroup" aria-label="Colour">
            {CATEGORY_COLOURS.map((c) => (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={colour === c.hex}
                aria-label={c.name}
                className={styles.swatch}
                style={{ background: c.hex }}
                onClick={() => setColour(c.hex)}
              >
                {colour === c.hex && <Check size={16} strokeWidth={2.2} />}
              </button>
            ))}
          </div>
        </div>

        {onMerge && mergeTargets.length > 0 && (
          <div className={styles.merge}>
            <label className={styles.field}>
              Merge into another category
              <select
                className={styles.input}
                value={mergeInto ?? ''}
                onChange={(e) => setMergeInto(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Choose a category…</option>
                {mergeTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {target && (
              <p className={styles.mergeConfirm}>
                Every stone and task in “{initial.name}” moves into “{target.name}”, and “{initial.name}” disappears.
                Nothing is deleted.
              </p>
            )}
          </div>
        )}

        <div className={styles.actions}>
          {onRemove ? (
            <Button variant="text" onClick={onRemove}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={!target && (!trimmed || duplicate)}>
            {target ? `Merge into “${target.name}”` : mode === 'new' ? 'Add category' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
