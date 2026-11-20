import { useDraggable } from '@dnd-kit/core'
import { useState, type CSSProperties, type ReactNode } from 'react'
import plinthGlow from '../assets/plinth-glow.svg'
import stonePlinth from '../assets/stone-plinth.svg'
import { formatHours } from '../lib/format'
import { layoutPit } from '../lib/pitLayout'
import Stone from './Stone'
import StoneDetails from './StoneDetails'
import styles from './TeamPile.module.css'

export interface PileStone {
  id: number | string
  hours: number
  /** Category colour; ignored when the pile is grey. */
  colour: string
  /** Other work stones are drawn dashed. */
  other?: boolean
  /** Planned (assigned, not yet done) work: pale outlined stone on top of the pile. */
  planned?: boolean
  /** Dim it, e.g. the chip that's being dragged away. */
  faded?: boolean
  /** Rebalancing: this stone can be dragged (dnd-kit id + data). Only use inside a DndContext. */
  drag?: { id: string; data: Record<string, unknown>; label: string }
  /** Shown in a hover preview when given (e.g. after the reveal); a click opens the full read-only card. */
  detail?: { category: string; note: string | null; link?: string | null }
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
  /** Reveal animation: first stone lands after `start` ms, each next one `step` ms later (bottom → top). */
  reveal?: { start: number; step: number }
}

/** A planned stone you can pick up off the pile and drop on another (rebalancing). */
function DraggableSpan({ drag, className, style, children }: {
  drag: NonNullable<PileStone['drag']>
  className: string
  style: CSSProperties
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: drag.id, data: drag.data })
  return (
    <span
      ref={setNodeRef}
      className={className}
      style={{ ...style, opacity: isDragging ? 0.3 : style.opacity, cursor: 'grab', touchAction: 'none' }}
      {...listeners}
      {...attributes}
      aria-label={drag.label}
      aria-roledescription="draggable task"
    >
      {children}
    </span>
  )
}

/** Base row width as a share of the pile box, and how much each row above narrows. */
export const PILE_BASE = 0.6
export const PILE_TAPER = 0.16
const PLINTH_H = 18

/** One combined pile of stones sitting on a plinth (Home cards). */
export default function TeamPile({ stones, unit, width, height, grey = false, emptyText, reveal }: TeamPileProps) {
  const floor = height - PLINTH_H / 2
  const placed = layoutPit(stones, { width: width * PILE_BASE, floor, unit, taper: PILE_TAPER })
  const offset = (width * (1 - PILE_BASE)) / 2
  // Click a revealed stone → read-only card with both fields (like My stones: hover previews, click opens).
  const [open, setOpen] = useState<{ id: PileStone['id']; el: HTMLElement } | null>(null)
  const openStone = open ? stones.find((s) => s.id === open.id) : undefined

  return (
    <div className={styles.pile} style={{ width, height }}>
      <img className={styles.glow} src={plinthGlow} alt="" style={{ top: height - 26, width: width * 0.95, height: 36 }} />
      <img className={styles.plinth} src={stonePlinth} alt="" style={{ top: height - PLINTH_H, width: width * 0.75, height: PLINTH_H }} />
      {placed.map((p, i) => {
        const delay = reveal ? reveal.start + i * reveal.step : 0
        const revealStyle: CSSProperties = reveal ? { animationDelay: `${delay}ms, ${delay + 380}ms` } : {}
        const revealClass = reveal ? ` ${styles.reveal}` : ''
        const stone = (
          <Stone
            hours={p.stone.hours}
            seed={p.stone.id}
            color={p.stone.colour}
            variant={grey ? 'sealed' : p.stone.planned ? 'planned' : p.stone.other ? 'other' : 'color'}
            unit={unit}
          />
        )
        const d = p.stone.detail
        if (p.stone.drag && !grey) {
          return (
            <DraggableSpan
              key={p.stone.id}
              drag={p.stone.drag}
              className={`${styles.stone} ${styles.hoverable}${revealClass}`}
              style={{ left: p.x + offset, top: p.y, ...revealStyle }}
            >
              {d && (
                <span className={styles.tip} role="tooltip">
                  <strong>
                    {d.category} · {formatHours(p.stone.hours)}
                  </strong>
                  <span className={d.note ? styles.tipNote : styles.tipEmpty}>{d.note || 'No note'}</span>
                </span>
              )}
              {stone}
            </DraggableSpan>
          )
        }
        if (!d || grey) {
          return (
            <span
              key={p.stone.id}
              className={`${styles.stone}${revealClass}`}
              style={{ left: p.x + offset, top: p.y, opacity: p.stone.faded ? 0.35 : undefined, ...revealStyle }}
            >
              {stone}
            </span>
          )
        }
        return (
          <span
            key={p.stone.id}
            className={`${styles.stone} ${styles.hoverable} ${styles.clickable}${open?.id === p.stone.id ? ` ${styles.selected}` : ''}${revealClass}`}
            style={{ left: p.x + offset, top: p.y, ...revealStyle }}
            tabIndex={0}
            role="button"
            aria-haspopup="dialog"
            aria-label={`${d.category}, ${formatHours(p.stone.hours)}${d.note ? `: ${d.note}` : ''}. Show details`}
            onClick={(e) => {
              const el = e.currentTarget
              setOpen((o) => (o?.id === p.stone.id ? null : { id: p.stone.id, el }))
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              const el = e.currentTarget
              setOpen((o) => (o?.id === p.stone.id ? null : { id: p.stone.id, el }))
            }}
          >
            <span className={styles.tip} role="tooltip">
              <strong>
                {d.category} · {formatHours(p.stone.hours)}
              </strong>
              <span className={d.note ? styles.tipNote : styles.tipEmpty}>{d.note || 'No note'}</span>
            </span>
            {stone}
          </span>
        )
      })}
      {stones.length === 0 && emptyText && <p className={styles.empty}>{emptyText}</p>}
      {open && openStone?.detail && !grey && (
        <StoneDetails
          anchor={open.el}
          title={openStone.detail.category}
          hours={openStone.hours}
          seed={openStone.id}
          colour={openStone.colour}
          variant={openStone.planned ? 'planned' : openStone.other ? 'other' : 'color'}
          note={openStone.detail.note}
          link={openStone.detail.link ?? null}
          noteLabel={openStone.planned ? 'Planned task' : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
