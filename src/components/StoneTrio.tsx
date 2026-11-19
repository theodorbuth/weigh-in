import Stone from './Stone'

/** The three-stone illustration on top of form cards (Figma "Stone cluster", 190 × 96). */
export default function StoneTrio() {
  return (
    <div style={{ position: 'relative', height: 96, width: 190, margin: '0 auto' }} aria-hidden>
      <Stone hours={1} seed="trio-slides" color="var(--slides)" unit={92} style={{ position: 'absolute', left: 48, top: 0 }} />
      <Stone hours={1} seed="trio-research" color="var(--research)" unit={92} style={{ position: 'absolute', left: 0, top: 34 }} />
      <Stone hours={1} seed="trio-coding" color="var(--coding)" unit={92} style={{ position: 'absolute', left: 92, top: 36 }} />
    </div>
  )
}
