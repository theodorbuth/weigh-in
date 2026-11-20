import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CircleCheck, Plus } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import Avatar from '../components/Avatar'
import CategoryDialog, { type CategoryDraft } from '../components/CategoryDialog'
import TeamPile, { PILE_BASE, PILE_TAPER, type PileStone } from '../components/TeamPile'
import WorkChip, { WorkChipGhost } from '../components/WorkChip'
import WorkDialog, { type WorkDraft } from '../components/WorkDialog'
import { nextFreeColour } from '../lib/colours'
import { formatHours } from '../lib/format'
import { fitUnit } from '../lib/pitLayout'
import { hasSealed, revealedRoundIds, timeLeft, type OpenWork, type Round, type StoneRow } from '../lib/project'
import { useProjectContext } from '../lib/projectContext'
import { supabase } from '../lib/supabase'
import { useElementWidth } from '../lib/useElementWidth'
import stageStyles from './TeamView.module.css'
import styles from './RebalanceView.module.css'

const OTHER_COLOUR = '#DDD5C7'
const PILE_H = 300
const BAR = 'bar'
const memberDrop = (id: number) => `member-${id}`

function Droppable({ id, disabled, className, overClass, children }: { id: string; disabled?: boolean; className: string; overClass: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? overClass : ''}`}>
      {children}
    </div>
  )
}

/**
 * Rebalancing (requirement 12). Open work chips are dragged onto piles; every laptop sees the
 * drag preview live (Broadcast) and the drop within ~1 s (postgres_changes). Members who sealed
 * agree like they sealed; the last agreement locks the plan (server-side), and any change
 * clears agreements.
 */
export default function RebalanceView({ round }: { round: Round }) {
  const { data, reload, me, remoteDrags, sendDrag } = useProjectContext()
  const [stageRef, stageWidth] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const [activeFromPile, setActiveFromPile] = useState(false)
  const [over, setOver] = useState<number | null>(null)
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'edit'; work: OpenWork } | null>(null)
  const [newCategory, setNewCategory] = useState(false)
  const [createdCategoryId, setCreatedCategoryId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const category = new Map(data.categories.map((c) => [c.id, c]))
  const shared = data.categories.filter((c) => c.shared_at !== null)
  const colourOf = (w: OpenWork) => category.get(w.category_id)?.colour ?? OTHER_COLOUR
  const work = data.openWork.filter((w) => w.round_id === round.id)
  const unassigned = work.filter((w) => w.assigned_to == null)
  const sealedMembers = data.members.filter((m) => hasSealed(data, round.id, m.user_id))
  const nameOf = (id: number) => data.members.find((m) => m.user_id === id)?.name ?? 'Someone'
  const iSealed = hasSealed(data, round.id, me)
  const agreed = new Set(data.agreements.filter((a) => a.round_id === round.id).map((a) => a.user_id))

  // Running totals of everything revealed, per member.
  const revealed = revealedRoundIds(data)
  const toPile = (stones: StoneRow[]): PileStone[] =>
    stones
      .filter((s) => s.hours != null)
      .map((s) => {
        const c = s.category_id == null ? undefined : category.get(s.category_id)
        return {
          id: s.id,
          hours: s.hours!,
          colour: c?.colour ?? OTHER_COLOUR,
          other: !c,
          order: c?.sort_order ?? 999,
          detail: { category: c?.name ?? 'Other work', note: s.note?.trim() || null },
        }
      })
      .sort((a, b) => a.order - b.order || Number(a.id) - Number(b.id))
  const running = (userId: number) =>
    data.stones.filter((s) => s.user_id === userId && s.round_id != null && revealed.has(s.round_id)).reduce((t, s) => t + (s.hours ?? 0), 0)

  // Where each task appears right now, including my drag and teammates' live drags.
  // Where a task is being dragged right now (mine, or a teammate's via Broadcast). The task stays
  // on its own pile (faded while I hold it) and appears as a preview on the pile being hovered.
  const previewTarget = (w: OpenWork): number | null | undefined => {
    if (active === w.id) return over
    return remoteDrags.find((d) => d.workId === w.id)?.over
  }
  const movingAway = (w: OpenWork, userId: number) => {
    const t = previewTarget(w)
    return t !== undefined && t !== userId
  }

  const totalOpen = work.reduce((t, w) => t + w.hours, 0)
  const average = sealedMembers.length
    ? (sealedMembers.reduce((t, m) => t + running(m.user_id), 0) + totalOpen) / sealedMembers.length
    : 0

  const plannedStone = (w: OpenWork, preview: boolean): PileStone => ({
    id: preview ? `preview-${w.id}` : `w-${w.id}`,
    hours: w.hours,
    colour: colourOf(w),
    planned: true,
    detail: { category: `${category.get(w.category_id)?.name ?? 'Task'} · planned`, note: w.name },
    // Committed planned stones can be picked up again and dropped on another pile (or back in Open work).
    drag:
      preview || busy
        ? undefined
        : { id: `pile-work-${w.id}`, data: { workId: w.id, fromPile: true }, label: `Drag ${w.name} to another pile` },
  })

  const piles = data.members.map((m) => {
    const mine = work.filter((w) => w.assigned_to === m.user_id)
    const incoming = work.filter((w) => w.assigned_to !== m.user_id && previewTarget(w) === m.user_id)
    const stones: PileStone[] = [
      ...toPile(data.stones.filter((s) => s.user_id === m.user_id && s.round_id != null && revealed.has(s.round_id))),
      ...mine.map((w) => plannedStone(w, false)),
      ...incoming.map((w) => plannedStone(w, true)),
    ]
    const total =
      running(m.user_id) +
      mine.filter((w) => !movingAway(w, m.user_id)).reduce((t, w) => t + w.hours, 0) +
      incoming.reduce((t, w) => t + w.hours, 0)
    return { member: m, stones, total, sealed: hasSealed(data, round.id, m.user_id) }
  })

  const n = Math.max(1, piles.length)
  const cellWidth = Math.max(140, Math.min(300, (stageWidth - 48) / n - 8))
  const biggest = work.reduce((mx, w) => Math.max(mx, w.hours), 0)
  const unit = fitUnit(
    piles.map((p) => [...p.stones, ...(biggest ? [{ id: 'room', hours: biggest }] : [])]),
    { width: cellWidth * PILE_BASE, height: PILE_H - 9, max: 72, min: 8, taper: PILE_TAPER },
  )

  async function write(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await action()
    setBusy(false)
    if (error) setError(error.message)
    await reload()
    return !error
  }

  const assign = (w: OpenWork, userId: number | null) =>
    write(() => supabase.from('open_work').update({ assigned_to: userId }).eq('id', w.id))
  const setHours = (w: OpenWork, hours: number) => write(() => supabase.from('open_work').update({ hours }).eq('id', w.id))
  const remove = (w: OpenWork) => write(() => supabase.from('open_work').delete().eq('id', w.id))

  async function saveWork(d: WorkDraft) {
    if (!dialog) return
    const ok =
      dialog.mode === 'new'
        ? await write(() =>
            supabase.from('open_work').insert({ project_id: data.project.id, round_id: round.id, name: d.name, hours: d.hours, category_id: d.categoryId }),
          )
        : await write(() => supabase.from('open_work').update({ name: d.name, hours: d.hours, category_id: d.categoryId }).eq('id', dialog.work.id))
    if (ok) setDialog(null)
  }

  async function createCategory(d: CategoryDraft) {
    let id: number | null = null
    const ok = await write(async () => {
      const res = await supabase
        .from('categories')
        .insert({
          project_id: data.project.id,
          name: d.name,
          colour: d.colour,
          sort_order: Math.max(-1, ...data.categories.map((c) => c.sort_order)) + 1,
          created_by: me,
          shared_at: new Date().toISOString(), // shared right away while rebalancing
        })
        .select('id')
        .single()
      id = res.data?.id ?? null
      return res
    })
    if (ok) {
      setCreatedCategoryId(id)
      setNewCategory(false)
    }
  }

  const agree = () => write(() => supabase.rpc('agree', { p_round_id: round.id }))

  // Drag handlers: share the drag live, write on drop.
  const workIdOf = (e: DragStartEvent | DragOverEvent | DragEndEvent) => e.active.data.current?.workId as number
  const overMember = (id: string | number | undefined) =>
    typeof id === 'string' && id.startsWith('member-') ? Number(id.slice(7)) : null

  function onDragStart(e: DragStartEvent) {
    const id = workIdOf(e)
    setActive(id)
    setActiveFromPile(!!e.active.data.current?.fromPile)
    setOver(work.find((w) => w.id === id)?.assigned_to ?? null)
    sendDrag({ by: me, workId: id, over: null })
  }
  function onDragOver(e: DragOverEvent) {
    const target = overMember(e.over?.id)
    setOver(target)
    sendDrag({ by: me, workId: workIdOf(e), over: target })
  }
  async function onDragEnd(e: DragEndEvent) {
    const id = workIdOf(e)
    const w = work.find((x) => x.id === id)
    const target = e.over ? (e.over.id === BAR ? null : overMember(e.over.id)) : undefined
    sendDrag({ by: me, workId: id, over: null, done: true })
    if (w && target !== undefined && target !== w.assigned_to) await assign(w, target)
    setActive(null)
    setOver(null)
  }
  function onDragCancel() {
    if (active != null) sendDrag({ by: me, workId: active, over: null, done: true })
    setActive(null)
    setOver(null)
  }

  // Stones in the bar use the piles' scale (capped so the bar stays compact).
  const barUnit = Math.min(unit, 44)
  const chip = (w: OpenWork, compact = false) => (
    <WorkChip
      key={w.id}
      work={w}
      colour={colourOf(w)}
      assignable={sealedMembers}
      compact={compact}
      stoneUnit={compact ? undefined : barUnit}
      disabled={busy}
      onAssign={(u) => assign(w, u)}
      onHours={(h) => setHours(w, h)}
      onEdit={() => setDialog({ mode: 'edit', work: w })}
      onRemove={() => remove(w)}
    />
  )

  const activeWork = work.find((w) => w.id === active)
  const agreeDisabledReason = !iSealed
    ? 'Only members who sealed this check-in agree on the plan'
    : unassigned.length
      ? 'Assign all open work first'
      : agreed.has(me)
        ? 'You agreed'
        : null

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <Droppable id={BAR} className={styles.bar} overClass={styles.barOver}>
        <div className={styles.barTitle}>
          <strong>Open work</strong>
          <span>{formatHours(unassigned.reduce((t, w) => t + w.hours, 0))} unassigned</span>
        </div>
        <div className={styles.chips}>
          {unassigned.map((w) => chip(w))}
          {unassigned.length === 0 &&
            (work.length ? (
              <span className={styles.allAssigned}>
                <CircleCheck size={16} strokeWidth={1.7} aria-hidden /> All {formatHours(totalOpen)} assigned
              </span>
            ) : (
              <span className={styles.hint}>Add the work that’s left, then drag each task onto someone’s pile.</span>
            ))}
        </div>
        <button type="button" className={styles.addWork} onClick={() => setDialog({ mode: 'new' })} disabled={busy}>
          <Plus size={16} strokeWidth={1.7} aria-hidden />
          Add work
        </button>
      </Droppable>

      <div ref={stageRef} className={stageStyles.stage}>
        <span className={styles.average}>Group average · {formatHours(Math.round(average * 2) / 2)}</span>
        <div className={styles.piles} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {piles.map(({ member, stones, total, sealed }) => {
            const delta = Math.round((total - average) * 2) / 2
            const mover = remoteDrags.find((d) => d.over === member.user_id)
            return (
              <Droppable
                key={member.user_id}
                id={memberDrop(member.user_id)}
                disabled={!sealed}
                className={`${styles.cell} ${sealed ? '' : styles.cellOff}`}
                overClass={styles.cellOver}
              >
                <TeamPile stones={stones} unit={unit} width={cellWidth} height={PILE_H} />
                <p className={styles.name}>
                  {member.name}
                  {member.user_id === me && <span> · You</span>}
                  <span className={styles.total}>{formatHours(total)}</span>
                </p>
                <p className={styles.delta}>
                  {sealed ? `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${formatHours(Math.abs(delta))}` : 'Not submitted'}
                </p>
                {mover && <p className={styles.moving}>{nameOf(mover.by)} is moving a task here…</p>}
              </Droppable>
            )
          })}
        </div>
      </div>

      <div className={styles.assigned} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {piles.map(({ member }) => (
          <div key={member.user_id} className={styles.assignedCell}>
            {work.filter((w) => w.assigned_to === member.user_id).map((w) => chip(w, true))}
          </div>
        ))}
      </div>

      <div className={styles.agreeRow}>
        <p className={styles.agreeText}>
          {error ? (
            <span className={styles.error}>{error}</span>
          ) : (
            <>
              {agreed.size} of {sealedMembers.length} agreed · the plan locks when everyone who sealed agrees
              {round.rebalance_closes_at && ` (or automatically in ${timeLeft(round.rebalance_closes_at, now).replace(' left', '')})`}.
              Any change clears the agreements.
            </>
          )}
        </p>
        <div className={styles.avatars} aria-label="Who agreed">
          {sealedMembers.map((m) => (
            <Avatar key={m.user_id} name={m.name} confirmed={agreed.has(m.user_id)} />
          ))}
        </div>
        <button type="button" className={styles.agree} onClick={agree} disabled={busy || !!agreeDisabledReason} title={agreeDisabledReason ?? undefined}>
          {agreed.has(me) ? (
            <>
              You agreed <CircleCheck size={18} strokeWidth={1.7} aria-hidden />
            </>
          ) : (
            'I agree with this plan'
          )}
        </button>
      </div>

      <DragOverlay>
        {activeWork && (
          <WorkChipGhost
            work={activeWork}
            colour={colourOf(activeWork)}
            stoneUnit={activeFromPile ? unit : activeWork.assigned_to == null ? barUnit : undefined}
          />
        )}
      </DragOverlay>

      {dialog && (
        <WorkDialog
          mode={dialog.mode}
          initial={
            dialog.mode === 'new'
              ? { name: '', hours: 2, categoryId: shared[0]?.id ?? -1 }
              : { name: dialog.work.name, hours: dialog.work.hours, categoryId: dialog.work.category_id }
          }
          categories={shared}
          busy={busy}
          error={error}
          onSave={saveWork}
          onNewCategory={() => setNewCategory(true)}
          createdCategoryId={createdCategoryId}
          onClose={() => setDialog(null)}
        />
      )}
      {newCategory && (
        <CategoryDialog
          mode="new"
          initial={{ name: '', colour: nextFreeColour(data.categories.map((c) => c.colour)) }}
          takenNames={shared.map((c) => c.name)}
          onSave={createCategory}
          onClose={() => setNewCategory(false)}
        />
      )}
    </DndContext>
  )
}
