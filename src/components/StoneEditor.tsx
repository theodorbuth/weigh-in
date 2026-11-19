import { Minus, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { formatHours } from '../lib/format'
import Button from './Button'
import Stone, { type StoneVariant } from './Stone'
import styles from './StoneEditor.module.css'

export interface StoneDraft {
  hours: number
  note: string
  link: string
}

interface StoneEditorProps {
  title: string
  seed: number
  colour?: string
  variant: StoneVariant
  initial: StoneDraft
  saving?: boolean
  error?: string | null
  onSave: (draft: StoneDraft) => void
  onRemove: () => void
  onClose: () => void
}

const MAX_HOURS = 24

/** Figma "Selected stone popover": hours (½-h steps) with a live stone preview, note, optional link. */
export default function StoneEditor({ title, seed, colour, variant, initial, saving, error, onSave, onRemove, onClose }: StoneEditorProps) {
  const [hours, setHours] = useState(initial.hours)
  const [note, setNote] = useState(initial.note)
  const [link, setLink] = useState(initial.link)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const linkOk = !link.trim() || /^https?:\/\/\S+$/i.test(link.trim())

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!linkOk) return
    onSave({ hours, note: note.trim(), link: link.trim() })
  }

  return (
    <form className={styles.panel} role="dialog" aria-label={title} onSubmit={submit}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close without saving">
          <X size={18} strokeWidth={1.7} />
        </button>
      </div>

      <div className={styles.sizeRow}>
        <div className={styles.stepper} role="group" aria-label="Hours">
          <button type="button" className={styles.step} onClick={() => setHours((h) => Math.max(0.5, h - 0.5))} disabled={hours <= 0.5} aria-label="Half an hour less">
            <Minus size={18} strokeWidth={1.7} />
          </button>
          <span className={styles.hours} aria-live="polite">
            {formatHours(hours)}
          </span>
          <button type="button" className={styles.step} onClick={() => setHours((h) => Math.min(MAX_HOURS, h + 0.5))} disabled={hours >= MAX_HOURS} aria-label="Half an hour more">
            <Plus size={18} strokeWidth={1.7} />
          </button>
        </div>
        <div className={styles.preview} aria-hidden>
          <Stone hours={hours} seed={seed} color={colour} variant={variant === 'planned' ? 'color' : variant} unit={60} />
        </div>
      </div>

      <label className={styles.field}>
        What did you do?
        <textarea className={styles.input} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Edited the final film and captions" />
      </label>
      <label className={styles.field}>
        Link (optional)
        <input className={styles.input} type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
      </label>
      {!linkOk && <p className={styles.error}>Links need to start with http:// or https://</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.iconButton} onClick={onRemove} aria-label="Remove stone" title="Remove stone">
          <Trash2 size={20} strokeWidth={1.7} />
        </button>
        <Button type="submit" disabled={saving || !linkOk}>
          {saving ? 'Saving…' : 'Done'}
        </Button>
      </div>
    </form>
  )
}
