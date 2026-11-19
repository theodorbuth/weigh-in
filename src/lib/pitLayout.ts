import { seeded, stoneSize } from './stoneShape'

/** Stone area inside a My stones pit (Figma Task pit, 421 × 220 minus the heading). */
export const PIT_FLOOR = { width: 377, height: 160 }

export interface PitStone {
  id: string | number
  hours: number
}

export interface PlacedStone<T extends PitStone = PitStone> {
  stone: T
  x: number
  y: number
  width: number
  height: number
}

/**
 * Lays stones out on the floor of a pit: left → right, overlapping a little, then
 * the next row stacks on top (staggered like bricks). Fully deterministic — the
 * same stones always land in the same places on every laptop.
 * Returned x/y are the top-left of each stone inside a box `width` wide whose
 * floor is at y = `floor`. Draw in the returned order (later = in front).
 */
export function layoutPit<T extends PitStone>(
  stones: T[],
  { width, floor, unit, taper = 0 }: { width: number; floor: number; unit: number; taper?: number },
): PlacedStone<T>[] {
  const OVERLAP = 0.8 // each stone advances 80% of its width
  const RISE = 0.62 // each row rises 62% of the row below's height

  const sized = stones.map((stone) => ({ stone, ...stoneSize(stone.hours, unit, stone.id) }))

  const rows: (typeof sized)[] = []
  let row: typeof sized = []
  let used = 0
  // taper > 0 narrows each row above the floor, so stones settle into a mound.
  const rowLimit = (ri: number) => Math.max(width * 0.3, width * (1 - taper * ri))
  for (const s of sized) {
    const need = row.length === 0 ? s.width : s.width * OVERLAP
    if (row.length > 0 && used + need > rowLimit(rows.length)) {
      rows.push(row)
      row = []
      used = 0
    }
    used += row.length === 0 ? s.width : s.width * OVERLAP
    row.push(s)
  }
  if (row.length) rows.push(row)

  const placed: PlacedStone<T>[] = []
  let bottom = floor
  rows.forEach((r, ri) => {
    const rowWidth = r.reduce((sum, s, i) => sum + (i === 0 ? s.width : s.width * OVERLAP), 0)
    const stagger = ri % 2 === 1 ? r[0].width * 0.18 : 0
    let x = Math.max(0, (width - rowWidth) / 2 + stagger)
    let tallest = 0
    r.forEach((s, i) => {
      if (i > 0) x += r[i - 1].width * (OVERLAP - 1) // pull back to overlap
      // Small deterministic vertical wobble so the row doesn't look ruled.
      const wobble = (seeded(s.stone.id, 'wobble') - 0.5) * s.height * 0.12
      placed.push({ stone: s.stone, x, y: bottom - s.height + wobble, width: s.width, height: s.height })
      x += s.width
      tallest = Math.max(tallest, s.height)
    })
    bottom -= tallest * RISE
  })
  return placed
}

/** Height a layout reaches above its floor. */
export function layoutHeight(placed: PlacedStone[], floor: number): number {
  return placed.reduce((h, p) => Math.max(h, floor - p.y), 0)
}

/**
 * Largest stone unit (px width of a 1-hour stone) at which EVERY pile fits in
 * width × height. Use one unit for piles shown side by side so they stay comparable.
 */
export function fitUnit(
  piles: PitStone[][],
  { width, height, max = 40, min = 6, taper = 0 }: { width: number; height: number; max?: number; min?: number; taper?: number },
): number {
  for (let unit = max; unit > min; unit -= 1) {
    const fits = piles.every(
      (stones) => layoutHeight(layoutPit(stones, { width, floor: height, unit, taper }), height) <= height,
    )
    if (fits) return unit
  }
  return min
}
