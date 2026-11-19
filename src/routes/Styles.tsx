import { ArrowRight, LockKeyhole, Plus } from 'lucide-react'
import { useState } from 'react'
import Avatar from '../components/Avatar'
import Button from '../components/Button'
import HourStepper from '../components/HourStepper'
import LayeredPile from '../components/LayeredPile'
import Nav from '../components/Nav'
import Stone, { type StoneVariant } from '../components/Stone'
import StonePopover from '../components/StonePopover'
import TaskChip from '../components/TaskChip'
import TaskPit from '../components/TaskPit'
import type { PitStone } from '../lib/pitLayout'
import styles from './Styles.module.css'

// Hello styles — requirement 5. Mirrors the Figma "Hello styles" frame (node 196:744).

const PALETTE = [
  ['Canvas', '#EDE6DA'],
  ['Presentation', '#9C8BC9'],
  ['Panel', '#E3DACB'],
  ['Card', '#FBF8F2'],
  ['Navy', '#14122B'],
  ['Body', '#55566F'],
  ['Line', '#D3C8B4'],
  ['Research', '#5FB3A8'],
  ['Slides', '#E8B65A'],
  ['Editing', '#D9695A'],
  ['Coding', '#7FA3D8'],
  ['Confirmation', '#5E9C7E'],
] as const

// Area ∝ hours: the 9 h boulder covers 9× the 1 h stone.
const WEIGHT_UNIT = 64
const WEIGHTS: { label: string; hours: number; color?: string; variant?: StoneVariant }[] = [
  { label: 'Pebble · 0.5 h', hours: 0.5, color: 'var(--slides)' },
  { label: 'Stone · 1 h', hours: 1, color: 'var(--research)' },
  { label: 'Custom boulder · 9 h', hours: 9, color: 'var(--editing)' },
  { label: 'Other work · dashed', hours: 1.5, variant: 'other' },
  { label: 'Sealed · grey', hours: 1, variant: 'sealed' },
  { label: 'Planned · outline', hours: 1, color: 'var(--coding)', variant: 'planned' },
]

export default function Styles() {
  const [pit, setPit] = useState<PitStone[]>([
    { id: 'pit-a', hours: 1 },
    { id: 'pit-b', hours: 1 },
  ])
  const [nextId, setNextId] = useState(0)
  const [stepper, setStepper] = useState(1)
  const [edit, setEdit] = useState<{ hours: number; note: string } | null>({ hours: 1, note: '' })

  const addPebble = () => {
    setPit((p) => [...p, { id: `pit-${nextId}`, hours: 0.5 }])
    setNextId((n) => n + 1)
  }
  const removeHalfHour = () =>
    setPit((p) => {
      if (p.length === 0) return p
      const last = p[p.length - 1]
      return last.hours > 0.5
        ? [...p.slice(0, -1), { ...last, hours: last.hours - 0.5 }]
        : p.slice(0, -1)
    })

  return (
    <div className={styles.page}>
      <Nav viewerName="Kwame" />
      <main className={styles.main}>
        <h1 className={styles.heading}>Hello styles</h1>

        <div className={styles.foundation}>
          <ul className={styles.palette} aria-label="Colour palette">
            {PALETTE.map(([name, hex]) => (
              <li key={name} className={styles.token}>
                <span className={styles.swatch} style={{ background: hex }} />
                <span>{name}</span>
                <span className={styles.hex}>{hex}</span>
              </li>
            ))}
          </ul>

          <div className={styles.row}>
            <div className={styles.type}>
              <div className={styles.typeLine}>
                <span className={styles.title}>Titles</span>
                <span className={styles.spec}>Lato Bold · 42</span>
              </div>
              <div className={styles.typeLine}>
                <span className={styles.headingSample}>Headings</span>
                <span className={styles.spec}>Lato Bold · 20</span>
              </div>
              <div className={styles.typeLine}>
                <span className={styles.bodySample}>Body, calm and clear.</span>
                <span className={styles.spec}>Lato Regular · 16</span>
              </div>
              <div className={styles.typeLine}>
                <span className={styles.smallSample}>Supporting details</span>
                <span className={styles.spec}>Lato Regular · 14</span>
              </div>
              <div className={styles.icons}>
                <LockKeyhole size={20} strokeWidth={1.7} aria-label="Lock" />
                <Plus size={20} strokeWidth={1.7} aria-label="Plus" />
                <ArrowRight size={20} strokeWidth={1.7} aria-label="Arrow right" />
                <span className={styles.spec}>1.7 px rounded line icons</span>
              </div>
            </div>

            <section className={styles.stones}>
              <h2 className={styles.stonesHeading}>Stones carry weight</h2>
              <div className={styles.stoneRow}>
                {WEIGHTS.map((w) => (
                  <div key={w.label} className={styles.stoneItem}>
                    <Stone
                      hours={w.hours}
                      seed={w.label}
                      color={w.color}
                      variant={w.variant}
                      unit={WEIGHT_UNIT}
                      title={w.label}
                    />
                    <span>{w.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className={styles.exemplars}>
            <TaskPit
              title="Task pit"
              category="Research"
              color="var(--research)"
              stones={pit}
              onAdd={addPebble}
              onRemove={removeHalfHour}
            />

            <LayeredPile />

            <section className={styles.controls}>
              <h2 className={styles.cardTitle}>Controls</h2>
              <TaskChip name="Final video" hours={4} />
              <HourStepper value={stepper} onChange={setStepper} />
              <div className={styles.controlRow}>
                <Button>Add category</Button>
                <Avatar name="Kwame" confirmed />
              </div>
            </section>

            <div className={styles.popoverSlot}>
              {edit ? (
                <StonePopover
                  hours={edit.hours}
                  note={edit.note}
                  onHoursChange={(hours) => setEdit({ ...edit, hours })}
                  onNoteChange={(note) => setEdit({ ...edit, note })}
                  onRemove={() => setEdit(null)}
                  onDone={() => setEdit(null)}
                  onClose={() => setEdit(null)}
                />
              ) : (
                <div className={styles.removed}>
                  Popover closed
                  <Button variant="text" onClick={() => setEdit({ hours: 1, note: '' })}>
                    Open “Edit a stone” again
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
