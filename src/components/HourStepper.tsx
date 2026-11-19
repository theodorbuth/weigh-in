import { Minus, Plus } from 'lucide-react'
import { formatHours } from '../lib/format'
import styles from './HourStepper.module.css'

interface HourStepperProps {
  value: number
  onChange: (hours: number) => void
  step?: number
  min?: number
  max?: number
  label?: string
}

/** Pill-shaped − / value / + control. Steps in half hours by default. */
export default function HourStepper({
  value,
  onChange,
  step = 0.5,
  min = 0.5,
  max = 24,
  label = 'Hours',
}: HourStepperProps) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label={`Decrease by ${step} h`}
      >
        <Minus size={16} strokeWidth={1.7} />
      </button>
      <span className={styles.value} aria-live="polite">
        {formatHours(value)}
      </span>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        aria-label={`Increase by ${step} h`}
      >
        <Plus size={16} strokeWidth={1.7} />
      </button>
    </div>
  )
}
