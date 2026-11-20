import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export interface ProjectRow {
  id: number
  name: string
  invite_code: string
  password: string | null
  team_size: number
  /** '<weekday 0-6> <HH:MM> <IANA timezone>' or null when off */
  checkin_schedule: string | null
}

export interface Seal {
  round_id: number
  user_id: number
  sealed_at: string
}

export interface LinkRow {
  id: number
  label: string
  url: string
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
  rebalance_closes_at: string | null
}

export interface OpenWork {
  id: number
  project_id: number
  round_id: number
  name: string
  category_id: number
  hours: number
  assigned_to: number | null
}

export interface Agreement {
  round_id: number
  user_id: number
}

/** Someone else is dragging an open-work chip right now (Realtime Broadcast, not stored). */
export interface RemoteDrag {
  by: number
  workId: number
  over: number | null
}

export interface ProjectData {
  project: ProjectRow
  members: Member[]
  categories: Category[]
  rounds: Round[]
  seals: Seal[]
  links: LinkRow[]
  openWork: OpenWork[]
  agreements: Agreement[]
  /** Every stone the viewer may see: their own (drafts + sealed) and teammates' revealed ones. */
  stones: StoneRow[]
}

const STONE_COLUMNS = 'id, project_id, user_id, round_id, category_id, hours, note, link, placed_on'

async function fetchProject(projectId: number): Promise<ProjectData | null> {
  const [project, members, categories, rounds, stones, links, openWork] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, invite_code, password, team_size, checkin_schedule')
      .eq('id', projectId)
      .maybeSingle(),
    supabase.from('members').select('user_id, joined_at, users(name)').eq('project_id', projectId).order('joined_at'),
    supabase
      .from('categories')
      .select('id, project_id, name, colour, sort_order, created_by, shared_at')
      .eq('project_id', projectId)
      .order('sort_order')
      .order('id'),
    supabase
      .from('rounds')
      .select('id, project_id, number, phase, opens_at, closes_at, rebalance_closes_at')
      .eq('project_id', projectId)
      .order('number'),
    supabase.from('stones').select(STONE_COLUMNS).eq('project_id', projectId).order('id'),
    supabase.from('links').select('id, label, url').eq('project_id', projectId).order('id'),
    supabase
      .from('open_work')
      .select('id, project_id, round_id, name, category_id, hours, assigned_to')
      .eq('project_id', projectId)
      .order('id'),
  ])
  for (const r of [project, members, categories, rounds, stones, links, openWork]) if (r.error) throw r.error
  if (!project.data) return null // doesn't exist, or the viewer isn't a member (RLS)

  const roundIds = (rounds.data as Round[]).map((r) => r.id)
  const [seals, agreements] = roundIds.length
    ? await Promise.all([
        supabase.from('seals').select('round_id, user_id, sealed_at').in('round_id', roundIds),
        supabase.from('agreements').select('round_id, user_id').in('round_id', roundIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ]
  if (seals.error) throw seals.error
  if (agreements.error) throw agreements.error

  type MemberRow = { user_id: number; users: { name: string | null } | null }
  return {
    project: project.data,
    members: (members.data as unknown as MemberRow[]).map((m) => ({ user_id: m.user_id, name: m.users?.name ?? '?' })),
    categories: categories.data as Category[],
    rounds: rounds.data as Round[],
    seals: seals.data as Seal[],
    links: links.data as LinkRow[],
    openWork: (openWork.data as OpenWork[]).map((w) => ({ ...w, hours: Number(w.hours) })),
    agreements: agreements.data as Agreement[],
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
  const [remoteDrags, setRemoteDrags] = useState<RemoteDrag[]>([])
  const inflight = useRef<Promise<void> | null>(null)
  const queued = useRef(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // One fetch at a time. A reload asked for mid-fetch runs once more afterwards, and every
  // caller's promise resolves only after data that includes their change has arrived.
  const reload = useCallback((): Promise<void> => {
    if (inflight.current) {
      queued.current = true
      return inflight.current
    }
    const run = async () => {
      do {
        queued.current = false
        try {
          setData(await fetchProject(projectId))
          setError(null)
        } catch (e) {
          setError((e as Error).message)
        }
      } while (queued.current)
    }
    inflight.current = run().finally(() => {
      inflight.current = null
    })
    return inflight.current
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
    const tables = ['stones', 'categories', 'rounds', 'members', 'seals', 'links', 'projects', 'open_work', 'agreements']
    for (const table of tables) {
      const filter =
        table === 'seals' || table === 'agreements'
          ? undefined
          : table === 'projects'
            ? `id=eq.${projectId}`
            : `project_id=eq.${projectId}`
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, soon)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, soon)
      // Supabase can't filter DELETE events (they only carry the primary key), so listen to all
      // deletes on the table and re-fetch; RLS still decides what the re-fetch returns.
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, soon)
    }
    // Live drag previews while rebalancing: ephemeral, never stored (requirement 12).
    const seen = new Map<number, number>()
    channel.on('broadcast', { event: 'drag' }, ({ payload }) => {
      const d = payload as RemoteDrag & { done?: boolean }
      seen.set(d.by, Date.now())
      setRemoteDrags((all) => [...all.filter((x) => x.by !== d.by), ...(d.done ? [] : [{ by: d.by, workId: d.workId, over: d.over }])])
    })
    // Forget a remote drag if its sender goes quiet (closed tab, lost connection).
    const sweep = setInterval(() => {
      const stale = [...seen].filter(([, t]) => Date.now() - t > 4000).map(([by]) => by)
      if (stale.length) setRemoteDrags((all) => all.filter((x) => !stale.includes(x.by)))
    }, 1000)
    channelRef.current = channel
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
      clearInterval(sweep)
      channelRef.current = null
      window.removeEventListener('focus', onFocus)
      void supabase.removeChannel(channel)
    }
  }, [projectId, reload])

  const sendDrag = useCallback((d: RemoteDrag & { done?: boolean }) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'drag', payload: d })
  }, [])

  return { data, error, reload, remoteDrags, sendDrag }
}

/** The round that isn't locked yet (at most one per project), if any. */
export function activeRound(data: ProjectData): Round | undefined {
  return data.rounds.find((r) => r.phase !== 'locked')
}

export function hasSealed(data: ProjectData, roundId: number, userId: number): boolean {
  return data.seals.some((s) => s.round_id === roundId && s.user_id === userId)
}

/** Round ids whose stones are revealed (anything past placing). */
export function revealedRoundIds(data: ProjectData): Set<number> {
  return new Set(data.rounds.filter((r) => r.phase !== 'placing').map((r) => r.id))
}

/** "23 h left", "45 min left", or "closing…" */
export function timeLeft(closesAt: string, now = Date.now()): string {
  const ms = new Date(closesAt).getTime() - now
  if (ms <= 0) return 'closing…'
  const h = Math.floor(ms / 3_600_000)
  return h >= 1 ? `${h} h left` : `${Math.max(1, Math.round(ms / 60_000))} min left`
}
