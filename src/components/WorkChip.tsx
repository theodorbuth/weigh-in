import { useDraggable } from '@dnd-kit/core'
import { ChevronDown, GripVertical, Minus, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatHours } from '../lib/format'
import type { Member, OpenWork } from '../lib/project'
import styles from './WorkChip.module.css'

interface WorkChipProps {
  work: OpenWork
  colour: string
  /** Members who can take on work (sealed this round). */
  assignable: Member[]
  /** Under a pile: show −/+ hours and an unassign ×. */
  compact?: boolean
  disabled?: boolean
  onAssign: (userId: number | null) => void
  onHours: (hours: number) => void
  onEdit: () => void
  onRemove: () => void
}

/** An open-work task. Drag it onto a pile, or use the ⌄ menu (keyboard friendly). */
export default function WorkChip({ work, colour, assignable, compact, disabled, onAssign, onHours, onEdit, onRemove }: WorkChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `work-${work.id}`, data: { workId: work.id }, disabled })
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  return (
    <div
      ref={(el) => {
        setNodeRef(el)
        ref.current = el
      }}
      className={`${styles.chip} ${compact ? styles.small : ''} ${isDragging ? styles.dragging : ''}`}
    >
      <button type="button" className={styles.handle} {...listeners} {...attributes} aria-label={`Drag ${work.name}`} disabled={disabled}>
        <GripVertical size={14} strokeWidth={1.7} />
      </button>
      <span className={styles.dot} style={{ background: colour }} />
      <span>{work.name}</span>
      {compact ? (
        <>
          <button type="button" className={styles.iconButton} onClick={() => onHours(Math.max(0.5, work.hours - 0.5))} disabled={disabled || work.hours <= 0.5} aria-label="Half an hour less">
            <Minus size={13} strokeWidth={1.7} />
          </button>
          <span className={styles.hours}>{formatHours(work.hours)}</span>
          <button type="button" className={styles.iconButton} onClick={() => onHours(Math.min(99, work.hours + 0.5))} disabled={disabled} aria-label="Half an hour more">
            <Plus size={13} strokeWidth={1.7} />
          </button>
          <button type="button" className={styles.iconButton} onClick={() => onAssign(null)} disabled={disabled} aria-label={`Unassign ${work.name}`}>
            <X size={13} strokeWidth={1.7} />
          </button>
        </>
      ) : (
        <>
          <span className={styles.hours}>{formatHours(work.hours)}</span>
          <button type="button" className={styles.iconButton} onClick={() => setMenu((m) => !m)} disabled={disabled} aria-label={`Options for ${work.name}`} aria-expanded={menu}>
            <ChevronDown size={14} strokeWidth={1.7} />
          </button>
        </>
      )}
      {menu && (
        <div className={styles.menu} role="menu">
          <span className={styles.menuLabel}>Assign to</span>
          {assignable.map((m) => (
            <button key={m.user_id} type="button" role="menuitem" onClick={() => (setMenu(false), onAssign(m.user_id))}>
              {m.name}
            </button>
          ))}
          <hr />
          <button type="button" role="menuitem" onClick={() => (setMenu(false), onEdit())}>
            Edit…
          </button>
          <button type="button" role="menuitem" className={styles.danger} onClick={() => (setMenu(false), onRemove())}>
            Remove task
          </button>
        </div>
      )}
    </div>
  )
}

/** Static look-alike shown under the cursor while dragging. */
export function WorkChipGhost({ work, colour }: { work: OpenWork; colour: string }) {
  return (
    <div className={`${styles.chip} ${styles.overlay}`}>
      <span className={styles.handle}>
        <GripVertical size={14} strokeWidth={1.7} />
      </span>
      <span className={styles.dot} style={{ background: colour }} />
      <span>{work.name}</span>
      <span className={styles.hours}>{formatHours(work.hours)}</span>
    </div>
  )
}
