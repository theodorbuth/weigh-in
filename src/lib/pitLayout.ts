import { seeded, stoneSize } from './stoneShape'

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
  { width, floor, unit }: { width: number; floor: number; unit: number },
): PlacedStone<T>[] {
  const OVERLAP = 0.8 // each stone advances 80% of its width
  const RISE = 0.62 // each row rises 62% of the row below's height

  const sized = stones.map((stone) => ({ stone, ...stoneSize(stone.hours, unit, stone.id) }))

  const rows: (typeof sized)[] = []
  let row: typeof sized = []
  let used = 0
  for (const s of sized) {
    const need = row.length === 0 ? s.width : s.width * OVERLAP
    if (row.length > 0 && used + need > width) {
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
