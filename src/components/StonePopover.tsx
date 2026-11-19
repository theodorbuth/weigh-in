import { X } from 'lucide-react'
import Button from './Button'
import HourStepper from './HourStepper'
import styles from './StonePopover.module.css'

interface StonePopoverProps {
  hours: number
  note: string
  onHoursChange: (hours: number) => void
  onNoteChange: (note: string) => void
  onRemove: () => void
  onDone: () => void
  onClose: () => void
}

/** "Edit a stone": hours, what you did, remove / done. */
export default function StonePopover({
  hours,
  note,
  onHoursChange,
  onNoteChange,
  onRemove,
  onDone,
  onClose,
}: StonePopoverProps) {
  return (
    <div className={styles.popover} role="dialog" aria-labelledby="stone-popover-title">
      <div className={styles.header}>
        <h3 id="stone-popover-title" className={styles.title}>
          Edit a stone
        </h3>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={1.7} />
        </button>
      </div>
      <div>
        <HourStepper value={hours} onChange={onHoursChange} />
      </div>
      <textarea
        className={styles.note}
        rows={1}
        placeholder="What did you do?"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        aria-label="What did you do?"
      />
      <div className={styles.actions}>
        <Button variant="text" onClick={onRemove}>
          Remove
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}
