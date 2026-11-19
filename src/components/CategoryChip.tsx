import { Pencil, Plus } from 'lucide-react'
import styles from './CategoryChip.module.css'

interface CategoryChipProps {
  name: string
  colour: string
  onEdit?: () => void
}

export function CategoryChip({ name, colour, onEdit }: CategoryChipProps) {
  return (
    <button type="button" className={styles.chip} onClick={onEdit} aria-label={`Edit ${name}`}>
      <span className={styles.dot} style={{ background: colour }} />
      {name}
      <Pencil className={styles.pen} size={14} strokeWidth={1.7} aria-hidden />
    </button>
  )
}

export function AddChip({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.add} onClick={onClick}>
      <Plus size={14} strokeWidth={1.7} aria-hidden />
      Add
    </button>
  )
}
