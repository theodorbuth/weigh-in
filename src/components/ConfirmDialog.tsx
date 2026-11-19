import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import Button from './Button'
import styles from './CategoryDialog.module.css'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

/** Small modal asking to confirm an action that can't be undone (start a check-in, seal). */
export default function ConfirmDialog({ title, children, confirmLabel, busy, error, onConfirm, onClose }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className={styles.header}>
          <h2 id="confirm-title" className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={1.7} />
          </button>
        </div>
        <div style={{ font: 'var(--text)', color: 'var(--body)' }}>{children}</div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy} autoFocus>
            {busy ? 'One moment…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
