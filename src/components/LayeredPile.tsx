import plinthGlow from '../assets/plinth-glow.svg'
import stonePlinth from '../assets/stone-plinth.svg'
import Stone, { type StoneVariant } from './Stone'
import styles from './LayeredPile.module.css'

// Style-guide specimen of a layered pile. Stone centres come from the Figma
// "Layered pile" exemplar; sizes come from hours (area ∝ hours, unit 80).
// The real Team-view pile layout is computed, not hand-placed.
const UNIT = 80
const SPECIMEN: { id: string; hours: number; color?: string; variant?: StoneVariant; cx: number; cy: number }[] = [
  { id: 'pile-other', hours: 0.6, variant: 'other', cx: 106, cy: 66 },
  { id: 'pile-coding', hours: 1.5, color: 'var(--coding)', cx: 96, cy: 88 },
  { id: 'pile-slides', hours: 1.5, color: 'var(--slides)', cx: 132, cy: 101 },
  { id: 'pile-research', hours: 1.5, color: 'var(--research)', cx: 77, cy: 114 },
  { id: 'pile-editing', hours: 1.8, color: 'var(--editing)', cx: 103, cy: 124 },
]

export default function LayeredPile() {
  return (
    <section className={styles.card}>
      <h3 className={styles.title}>Layered pile</h3>
      <div className={styles.specimen}>
        <img className={styles.glow} src={plinthGlow} width={205} height={50} alt="" />
        <img className={styles.plinth} src={stonePlinth} width={177} height={25} alt="" />
        {SPECIMEN.map((s) => (
          <Stone
            key={s.id}
            className={styles.stone}
            style={{ left: s.cx, top: s.cy }}
            hours={s.hours}
            seed={s.id}
            color={s.color}
            variant={s.variant}
            unit={UNIT}
          />
        ))}
      </div>
    </section>
  )
}
