import { useEffect, useState } from 'react'
import { formatHours } from '../lib/format'

/** Hours that count up from 0 (used in the reveal). Without `delay` it just shows the value. */
export default function CountUp({ value, delay, duration = 900 }: { value: number; delay?: number; duration?: number }) {
  const [shown, setShown] = useState(delay === undefined ? value : 0)

  useEffect(() => {
    if (delay === undefined) return
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      setShown(Math.round(value * (1 - (1 - t) ** 3) * 2) / 2) // ease-out, half-hour steps
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, delay, duration])

  return <>{formatHours(delay === undefined ? value : shown)}</>
}
