import type { PileStone } from '../components/TeamPile'
import { supabase } from './supabase'

export interface HomeProject {
  id: number
  name: string
  teamSize: number
  members: { id: number; name: string }[]
  hoursWorked: number
  /** Revealed stones, ordered bottom → top by category order. */
  pile: PileStone[]
  /** A check-in is collecting stones right now. */
  collecting: boolean
}

const OTHER_WORK = '#DDD5C7'

/**
 * Everything the Home page needs. Row-level security already limits every query to
 * the viewer's projects; only REVEALED rounds' stones go into piles and hour totals.
 */
export async function loadHome(): Promise<HomeProject[]> {
  const [projects, rounds, categories, stones] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, team_size, created_at, members(user_id, joined_at, users(name))')
      .order('created_at'),
    supabase.from('rounds').select('id, project_id, phase'),
    supabase.from('categories').select('id, project_id, colour, sort_order'),
    supabase.from('stones').select('id, project_id, category_id, hours, round_id').not('round_id', 'is', null),
  ])
  for (const r of [projects, rounds, categories, stones]) if (r.error) throw r.error

  const revealedRounds = new Set(rounds.data!.filter((r) => r.phase !== 'placing').map((r) => r.id))
  const collecting = new Set(rounds.data!.filter((r) => r.phase === 'placing').map((r) => r.project_id))
  const category = new Map(categories.data!.map((c) => [c.id, c]))

  return projects.data!.map((p) => {
    const pile = stones
      .data!.filter((s) => s.project_id === p.id && revealedRounds.has(s.round_id))
      .map((s) => {
        const c = s.category_id == null ? undefined : category.get(s.category_id)
        return { id: s.id, hours: Number(s.hours), colour: c?.colour ?? OTHER_WORK, order: c?.sort_order ?? 999 }
      })
      .sort((a, b) => a.order - b.order || a.id - b.id)

    type MemberRow = { user_id: number; joined_at: string; users: { name: string | null } | null }
    const members = ((p.members ?? []) as unknown as MemberRow[])
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map((m) => ({ id: m.user_id, name: m.users?.name ?? '?' }))

    return {
      id: p.id,
      name: p.name,
      teamSize: p.team_size,
      members,
      hoursWorked: pile.reduce((sum, s) => sum + s.hours, 0),
      pile,
      collecting: collecting.has(p.id),
    }
  })
}
