import { useProjectContext } from '../lib/projectContext'

// The Team view (piles, reveal, rebalancing) is built with check-ins. Until then:
export default function TeamPlaceholder() {
  const { data } = useProjectContext()
  return (
    <p style={{ padding: '48px 0', color: 'var(--body)' }}>
      {data.members.map((m) => m.name).join(', ')} · The Team view (piles, reveal and live rebalancing) arrives
      with check-ins.
    </p>
  )
}
