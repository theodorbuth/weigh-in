import { Minus, Plus } from 'lucide-react'
import { formatHours } from '../lib/format'
import { layoutPit, type PitStone } from '../lib/pitLayout'
import Stone from './Stone'
import styles from './TaskPit.module.css'

interface TaskPitProps {
  title: string
  category: string
  color: string
  stones: PitStone[]
  /** Width in px of a 1-hour stone. */
  unit?: number
  onAdd?: () => void
  onRemove?: () => void
}

const FLOOR_WIDTH = 232
const FLOOR_Y = 190

export default function TaskPit({ title, category, color, stones, unit = 88, onAdd, onRemove }: TaskPitProps) {
  const total = stones.reduce((sum, s) => sum + s.hours, 0)
  const placed = layoutPit(stones, { width: FLOOR_WIDTH, floor: FLOOR_Y, unit })

  return (
    <section className={styles.pit} aria-label={`${title}: ${category}, ${formatHours(total)}`}>
      <div className={styles.label}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.meta}>
          {category} · {formatHours(total)}
        </p>
      </div>
      <div className={styles.floor}>
        {placed.map((p) => (
          <Stone
            key={p.stone.id}
            className={styles.stone}
            style={{ left: p.x, top: p.y }}
            hours={p.stone.hours}
            seed={p.stone.id}
            color={color}
            unit={unit}
          />
        ))}
      </div>
      <div className={styles.control}>
        <button type="button" onClick={onRemove} disabled={!onRemove || stones.length === 0} aria-label="Remove half an hour">
          <Minus size={14} strokeWidth={1.7} />
        </button>
        <span>0.5 h</span>
        <button type="button" onClick={onAdd} disabled={!onAdd} aria-label="Add half an hour">
          <Plus size={14} strokeWidth={1.7} />
        </button>
      </div>
    </section>
  )
}
