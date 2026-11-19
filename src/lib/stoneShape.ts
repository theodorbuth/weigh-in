// Deterministic stone geometry. The same seed (stone id) always produces the same
// outline, so a pile looks identical on every laptop (no Math.random()).

/** Width of a 1-hour stone at unit = 1. Height is ~62% of width (Figma: 88 × 55). */
const ASPECT = 0.62

/** FNV-1a hash → 32-bit unsigned int. */
function hash(seed: string | number): number {
  const s = String(seed)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: tiny seeded PRNG returning floats in [0, 1). */
function rng(seed: string | number): () => number {
  let a = hash(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic number in [0, 1) for a seed + purpose, e.g. seeded(stone.id, 'wobble'). */
export function seeded(seed: string | number, purpose: string): number {
  return rng(`${seed}:${purpose}`)()
}

export interface StoneSize {
  width: number
  height: number
}

/**
 * Size of a stone. AREA is proportional to hours (decided 11/19), so each side
 * scales with √hours. `unit` is the width in px of a 1-hour stone.
 * A small per-seed aspect jitter keeps stones from looking stamped out.
 */
export function stoneSize(hours: number, unit: number, seed: string | number = 0): StoneSize {
  const r = rng(`${seed}:size`)
  const stretch = 0.92 + r() * 0.16 // 0.92–1.08, area-preserving
  const side = unit * Math.sqrt(Math.max(hours, 0))
  return { width: side * stretch, height: (side * ASPECT) / stretch }
}

/**
 * Closed SVG path for a pebble outline inside a width × height box.
 * Points go around an ellipse with jittered radius; the bottom is flattened so the
 * stone looks like it is resting; Catmull-Rom → cubic Bézier keeps it smooth.
 */
export function stonePath(width: number, height: number, seed: string | number): string {
  const r = rng(`${seed}:shape`)
  const n = 9
  const cx = width / 2
  const cy = height / 2
  const pts: [number, number][] = []
  const turn = r() * Math.PI * 2
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35
    const k = 0.93 + r() * 0.1
    const dy = Math.sin(a)
    const flatten = dy > 0 ? 1 - 0.14 * dy : 1 // flatter underside
    pts.push([cx + Math.cos(a) * (width / 2) * k, cy + dy * (height / 2) * k * flatten])
  }

  const p = (i: number) => pts[(i + n) % n]
  let d = `M${p(0)[0].toFixed(2)},${p(0)[1].toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p(i - 1)
    const [x1, y1] = p(i)
    const [x2, y2] = p(i + 1)
    const [x3, y3] = p(i + 2)
    const c1x = x1 + (x2 - x0) / 6
    const c1y = y1 + (y2 - y0) / 6
    const c2x = x2 - (x3 - x1) / 6
    const c2y = y2 - (y3 - y1) / 6
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`
  }
  return d + 'Z'
}
