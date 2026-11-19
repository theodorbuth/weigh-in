import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export interface ProjectRow {
  id: number
  name: string
  invite_code: string
  password: string | null
  team_size: number
}

export interface Member {
  user_id: number
  name: string
}

export interface Category {
  id: number
  project_id: number
  name: string
  colour: string
  sort_order: number
  created_by: number | null
  shared_at: string | null
}

export interface StoneRow {
  id: number
  project_id: number
  user_id: number
  round_id: number | null
  category_id: number | null
  hours: number | null
  note: string | null
  link: string | null
  placed_on: string
}

export type Phase = 'placing' | 'revealed' | 'rebalancing' | 'locked'

export interface Round {
  id: number
  project_id: number
  number: number
  phase: Phase
  opens_at: string
  closes_at: string
}

export interface ProjectData {
  project: ProjectRow
  members: Member[]
  categories: Category[]
  rounds: Round[]
  /** Every stone the viewer may see: their own (drafts + sealed) and teammates' revealed ones. */
  stones: StoneRow[]
}

const STONE_COLUMNS = 'id, project_id, user_id, round_id, category_id, hours, note, link, placed_on'

async function fetchProject(projectId: number): Promise<ProjectData | null> {
  const [project, members, categories, rounds, stones] = await Promise.all([
    supabase.from('projects').select('id, name, invite_code, password, team_size').eq('id', projectId).maybeSingle(),
    supabase.from('members').select('user_id, joined_at, users(name)').eq('project_id', projectId).order('joined_at'),
    supabase
      .from('categories')
      .select('id, project_id, name, colour, sort_order, created_by, shared_at')
      .eq('project_id', projectId)
      .order('sort_order')
      .order('id'),
    supabase.from('rounds').select('id, project_id, number, phase, opens_at, closes_at').eq('project_id', projectId).order('number'),
    supabase.from('stones').select(STONE_COLUMNS).eq('project_id', projectId).order('id'),
  ])
  for (const r of [project, members, categories, rounds, stones]) if (r.error) throw r.error
  if (!project.data) return null // doesn't exist, or the viewer isn't a member (RLS)

  type MemberRow = { user_id: number; users: { name: string | null } | null }
  return {
    project: project.data,
    members: (members.data as unknown as MemberRow[]).map((m) => ({ user_id: m.user_id, name: m.users?.name ?? '?' })),
    categories: categories.data as Category[],
    rounds: rounds.data as Round[],
    stones: (stones.data as StoneRow[]).map((s) => ({ ...s, hours: s.hours == null ? null : Number(s.hours) })),
  }
}

/**
 * Loads a project and keeps it fresh: Supabase Realtime pushes changes (row-level
 * security still decides which rows reach this browser), and if the live
 * connection isn't up, it falls back to re-fetching every 5 s.
 */
export function useProject(projectId: number) {
  const [data, setData] = useState<ProjectData | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)

  const reload = useCallback(async () => {
    if (pending.current) return
    pending.current = true
    try {
      setData(await fetchProject(projectId))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      pending.current = false
    }
  }, [projectId])

  useEffect(() => {
    // Fetching on mount is syncing with an external system (the database).
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
    let live = false
    let timer: ReturnType<typeof setTimeout> | undefined
    // Coalesce bursts of change events into one re-fetch.
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void reload(), 60)
    }

    const channel = supabase.channel(`project-${projectId}`)
    for (const table of ['stones', 'categories', 'rounds', 'members', 'seals']) {
      const filter = table === 'seals' ? undefined : `project_id=eq.${projectId}`
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, soon)
    }
    channel.subscribe((status) => {
      live = status === 'SUBSCRIBED'
      if (live) soon() // catch anything missed while connecting
    })

    const poll = setInterval(() => !live && void reload(), 5000)
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
      void supabase.removeChannel(channel)
    }
  }, [projectId, reload])

  return { data, error, reload }
}
