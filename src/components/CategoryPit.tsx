import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Pencil, Plus } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { formatHours } from '../lib/format'
import { layoutPit, PIT_FLOOR } from '../lib/pitLayout'
import type { StoneRow } from '../lib/project'
import Stone from './Stone'
import styles from './CategoryPit.module.css'

interface CategoryPitProps {
  title: string
  /** Category colour; omitted for Other work (dashed stones). */
  colour?: string
  stones: StoneRow[]
  /** Width in px of a 1-hour stone — the same for every pit on the page. */
  unit: number
  selectedId: number | null
  isPrivate?: boolean
  readOnly?: boolean
  onAdd: () => void
  onSelect: (stone: StoneRow) => void
  onEditCategory?: () => void
  /** dnd-kit drop target id for this pit (stones can be dragged between pits). */
  dropId: string
}

/** A stone you can click (edit) or drag (move to another pit). */
function DraggableStone({ stone, fromPit, className, style, onClick, label, children }: {
  stone: StoneRow
  fromPit: string
  className: string
  style: CSSProperties
  onClick: () => void
  label: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `stone-${stone.id}`, data: { stone, fromPit } })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={className}
      style={{ ...style, opacity: isDragging ? 0.25 : undefined }}
      onClick={onClick}
      aria-label={label}
      {...listeners}
      {...attributes}
      aria-roledescription="draggable stone"
    >
      {children}
    </button>
  )
}

const OTHER_FLOOR = { left: 270, width: 300, height: 110 }

/** One category's pit on My stones (Figma "Task pit"), or the dashed Other work strip. */
export default function CategoryPit({
  title,
  colour,
  stones,
  unit,
  selectedId,
  isPrivate = false,
  readOnly = false,
  onAdd,
  onSelect,
  onEditCategory,
  dropId,
}: CategoryPitProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id: dropId })
  const incoming = isOver && active?.data.current?.fromPit !== dropId
  const other = colour === undefined
  const total = stones.reduce((sum, s) => sum + (s.hours ?? 0), 0)
  const floor = other ? OTHER_FLOOR : PIT_FLOOR
  const placed = layoutPit(
    stones.map((s) => ({ ...s, hours: s.hours ?? 1 })),
    { width: floor.width, floor: floor.height, unit, taper: 0 },
  )

  return (
    <section
      ref={setNodeRef}
      className={`${styles.pit} ${other ? styles.other : ''} ${incoming ? styles.dropOver : ''}`}
      aria-label={`${title}, ${formatHours(total)}`}
    >
      <div className={styles.heading}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          {onEditCategory && (
            <button type="button" className={styles.pen} onClick={onEditCategory} aria-label={`Edit ${title}`}>
              <Pencil size={16} strokeWidth={1.7} />
            </button>
          )}
          {isPrivate && <span className={styles.private} title="Only you can see this category until the next reveal">Only you</span>}
        </div>
        <div className={styles.controls}>
          <span className={styles.total}>{formatHours(total)}</span>
          <button type="button" className={styles.add} onClick={onAdd} disabled={readOnly} aria-label={`Add a stone to ${title}`}>
            <Plus size={14} strokeWidth={1.7} aria-hidden />
            Add stone
          </button>
        </div>
      </div>

      <div className={styles.floor} style={other ? { left: OTHER_FLOOR.left, width: OTHER_FLOOR.width } : undefined}>
        {placed.map((p) => {
          const s = stones.find((x) => x.id === p.stone.id)!
          return (
            <DraggableStone
              key={s.id}
              stone={s}
              fromPit={dropId}
              className={`${styles.stone} ${s.id === selectedId ? styles.selected : ''}`}
              style={{ left: p.x, top: p.y }}
              onClick={() => onSelect(s)}
              label={`${s.hours == null ? 'Hours not set' : formatHours(s.hours)}${s.note ? `: ${s.note}` : ''}`}
            >
              {s.id !== selectedId && (
                <span className={styles.tip} role="tooltip">
                  <strong>{s.hours == null ? 'Hours not set' : formatHours(s.hours)}</strong>
                  <span className={s.note?.trim() ? styles.tipNote : styles.tipEmpty}>
                    {s.note?.trim() || 'No note yet'}
                  </span>
                </span>
              )}
              <Stone
                hours={s.hours ?? 1}
                seed={s.id}
                color={colour}
                variant={s.hours == null ? 'planned' : other ? 'other' : 'color'}
                unit={unit}
              />
            </DraggableStone>
          )
        })}
      </div>

      {!other && stones.length === 0 && <p className={styles.empty}>No stones yet</p>}
    </section>
  )
}
