import plinthGlow from '../assets/plinth-glow.svg'
import stonePlinth from '../assets/stone-plinth.svg'
import { layoutPit } from '../lib/pitLayout'
import Stone from './Stone'
import styles from './TeamPile.module.css'

export interface PileStone {
  id: number | string
  hours: number
  /** Category colour; ignored when the pile is grey. */
  colour: string
}

interface TeamPileProps {
  /** Ordered bottom → top (by category order, then id). */
  stones: PileStone[]
  /** Width in px of a 1-hour stone; share one unit between piles that are compared. */
  unit: number
  width: number
  height: number
  /** Grey while a check-in is collecting (no colours leak before the reveal). */
  grey?: boolean
  emptyText?: string
}

/** Base row width as a share of the pile box, and how much each row above narrows. */
export const PILE_BASE = 0.6
export const PILE_TAPER = 0.16
const PLINTH_H = 18

/** One combined pile of stones sitting on a plinth (Home cards). */
export default function TeamPile({ stones, unit, width, height, grey = false, emptyText }: TeamPileProps) {
  const floor = height - PLINTH_H / 2
  const placed = layoutPit(stones, { width: width * PILE_BASE, floor, unit, taper: PILE_TAPER })
  const offset = (width * (1 - PILE_BASE)) / 2

  return (
    <div className={styles.pile} style={{ width, height }}>
      <img className={styles.glow} src={plinthGlow} alt="" style={{ top: height - 26, width: width * 0.95, height: 36 }} />
      <img className={styles.plinth} src={stonePlinth} alt="" style={{ top: height - PLINTH_H, width: width * 0.75, height: PLINTH_H }} />
      {placed.map((p) => (
        <Stone
          key={p.stone.id}
          className={styles.stone}
          style={{ left: p.x + offset, top: p.y }}
          hours={p.stone.hours}
          seed={p.stone.id}
          color={p.stone.colour}
          variant={grey ? 'sealed' : 'color'}
          unit={unit}
        />
      ))}
      {stones.length === 0 && emptyText && <p className={styles.empty}>{emptyText}</p>}
    </div>
  )
}
