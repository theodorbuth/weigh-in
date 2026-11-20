import { ExternalLink, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatHours } from '../lib/format'
import Stone, { type StoneVariant } from './Stone'
import styles from './StoneEditor.module.css'
import own from './StoneDetails.module.css'

interface StoneDetailsProps {
  /** The clicked stone on screen; the card sits beside it. */
  anchor: HTMLElement
  title: string
  hours: number
  seed: number | string
  colour: string
  variant: StoneVariant
  note: string | null
  link: string | null
  /** Label above the note; planned stones show their task name instead of a "what did you do". */
  noteLabel?: string
  onClose: () => void
}

const WIDTH = 330
const GAP = 14

/**
 * Read-only version of the My stones editor (Team view): same card, same two fields
 * ("What did you do?" and the link), shown on click. Hover keeps the short preview.
 */
export default function StoneDetails({ anchor, title, hours, seed, colour, variant, note, link, noteLabel = 'What did you do?', onClose }: StoneDetailsProps) {
  const card = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const h = card.current?.offsetHeight ?? 300
    const right = r.right + GAP
    const left = right + WIDTH <= window.innerWidth - 8 ? right : Math.max(8, r.left - GAP - WIDTH)
    const top = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), Math.max(8, window.innerHeight - h - 8))
    setPos({ left: left + window.scrollX, top: top + window.scrollY })
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!card.current?.contains(t) && !anchor.contains(t)) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={card}
      className={`${styles.panel} ${own.card}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      role="dialog"
      aria-label={title}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={1.7} />
        </button>
      </div>

      <div className={styles.sizeRow}>
        <span className={own.hours}>{formatHours(hours)}</span>
        <div className={styles.preview} aria-hidden>
          <Stone hours={hours} seed={seed} color={colour} variant={variant} unit={60} />
        </div>
      </div>

      <div className={styles.field}>
        {noteLabel}
        <p className={`${own.value} ${note ? '' : own.empty}`}>{note || 'No note'}</p>
      </div>
      <div className={styles.field}>
        Link
        {link ? (
          <a className={`${own.value} ${own.link}`} href={link} target="_blank" rel="noopener noreferrer">
            <span>{link.replace(/^https?:\/\//i, '')}</span>
            <ExternalLink size={16} strokeWidth={1.7} aria-hidden />
          </a>
        ) : (
          <p className={`${own.value} ${own.empty}`}>No link</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
