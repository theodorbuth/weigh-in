import { useId, type CSSProperties } from 'react'
import { stonePath, stoneSize } from '../lib/stoneShape'

export type StoneVariant = 'color' | 'other' | 'sealed' | 'planned'

interface StoneProps {
  /** Hours this stone represents. Area ∝ hours. */
  hours: number
  /** Stable id (e.g. the stone's database id). Same seed → same shape everywhere. */
  seed: string | number
  /** Category colour (any CSS colour, e.g. 'var(--research)'). Used by 'color' and 'planned'. */
  color?: string
  /** color = normal stone, other = dashed Other work, sealed = grey, planned = pale outline. */
  variant?: StoneVariant
  /** Width in px of a 1-hour stone. Keep it the same across piles that are compared. */
  unit?: number
  /** Draw the soft contact shadow under the stone. */
  shadow?: boolean
  className?: string
  style?: CSSProperties
  title?: string
}

const SHADE = '20, 18, 43' // navy, as rgb for rgba()

export default function Stone({
  hours,
  seed,
  color = 'var(--research)',
  variant = 'color',
  unit = 88,
  shadow = true,
  className,
  style,
  title,
}: StoneProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const { width: w, height: h } = stoneSize(hours, unit, seed)
  const d = stonePath(w, h, seed)

  const fill =
    variant === 'sealed' ? 'var(--stone-sealed)' : variant === 'other' ? 'var(--stone-other)' : color
  const glossy = variant === 'color' || variant === 'sealed'

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      overflow="visible"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0%" stopColor={`rgba(${SHADE}, 0.32)`} />
          <stop offset="100%" stopColor={`rgba(${SHADE}, 0)`} />
        </radialGradient>
        <linearGradient id={`${uid}-under`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="45%" stopColor={`rgba(${SHADE}, 0)`} />
          <stop offset="100%" stopColor={`rgba(${SHADE}, 0.3)`} />
        </linearGradient>
        <radialGradient id={`${uid}-light`} cx="34%" cy="26%" r="62%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={`${uid}-spec`}>
          <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={d} />
        </clipPath>
      </defs>

      {shadow && variant !== 'planned' && (
        <ellipse
          cx={w / 2}
          cy={h * 0.93}
          rx={w * 0.52}
          ry={h * 0.16}
          fill={`url(#${uid}-shadow)`}
        />
      )}

      {variant === 'planned' ? (
        <path
          d={d}
          style={{ fill: color, stroke: color }}
          fillOpacity={0.22}
          strokeWidth={1.5}
        />
      ) : variant === 'other' ? (
        <>
          <path d={d} style={{ fill }} />
          <path d={d} fill={`url(#${uid}-light)`} opacity={0.6} />
          <path
            d={d}
            fill="none"
            stroke="#9b917f"
            strokeWidth={1.2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path d={d} style={{ fill }} />
          {glossy && (
            <g clipPath={`url(#${uid}-clip)`}>
              <rect width={w} height={h} fill={`url(#${uid}-under)`} />
              <rect width={w} height={h} fill={`url(#${uid}-light)`} />
              <ellipse
                cx={w * 0.33}
                cy={h * 0.24}
                rx={w * 0.14}
                ry={h * 0.09}
                fill={`url(#${uid}-spec)`}
              />
            </g>
          )}
          <path d={d} fill="none" stroke={`rgba(${SHADE}, 0.1)`} strokeWidth={1} />
        </>
      )}
    </svg>
  )
}
