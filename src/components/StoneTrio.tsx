import Stone from './Stone'

/** The three-stone illustration on top of form cards (Figma "New project"). */
export default function StoneTrio() {
  return (
    <div style={{ position: 'relative', height: 74, width: 140, margin: '0 auto -4px' }} aria-hidden>
      <Stone hours={1} seed="trio-slides" color="var(--slides)" unit={70} style={{ position: 'absolute', left: 36, top: 0 }} />
      <Stone hours={1} seed="trio-research" color="var(--research)" unit={70} style={{ position: 'absolute', left: 0, top: 26 }} />
      <Stone hours={1} seed="trio-coding" color="var(--coding)" unit={70} style={{ position: 'absolute', left: 70, top: 28 }} />
    </div>
  )
}
