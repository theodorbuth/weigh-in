import { ChevronDown, GripVertical } from 'lucide-react'
import { formatHours } from '../lib/format'
import styles from './TaskChip.module.css'

interface TaskChipProps {
  name: string
  hours: number
}

/** Open work item that can be dragged onto a pile while rebalancing. */
export default function TaskChip({ name, hours }: TaskChipProps) {
  return (
    <div className={styles.chip}>
      <span className={styles.grip} aria-hidden>
        <GripVertical size={14} strokeWidth={1.7} />
      </span>
      <span>{name}</span>
      <span className={styles.hours}>{formatHours(hours)}</span>
      <span className={styles.chevron} aria-hidden>
        <ChevronDown size={14} strokeWidth={1.7} />
      </span>
    </div>
  )
}
