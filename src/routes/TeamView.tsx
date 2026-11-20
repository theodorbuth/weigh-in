import { CircleCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import Avatar from '../components/Avatar'
import LinksBar from '../components/LinksBar'
import ScheduleControl from '../components/ScheduleControl'
import TeamPile, { PILE_BASE, PILE_TAPER, type PileStone } from '../components/TeamPile'
import { formatHours } from '../lib/format'
import { fitUnit } from '../lib/pitLayout'
import { activeRound, hasSealed, revealedRoundIds, timeLeft, type StoneRow } from '../lib/project'
import { useProjectContext } from '../lib/projectContext'
import { useElementWidth } from '../lib/useElementWidth'
import RebalanceView from './RebalanceView'
import styles from './TeamView.module.css'

const OTHER_COLOUR = '#DDD5C7'
const PILE_H = 300

/**
 * Team view. Light stage with one mound per person (running totals of every revealed round,
 * shared scale). While I've sealed and others haven't: dark stage, my own stones in grey,
 * and everyone's status. Realtime flips every open laptop to the reveal (requirement 10).
 */
export default function TeamView() {
  const { data, reload, me } = useProjectContext()
  const [stageRef, stageWidth] = useElementWidth<HTMLDivElement>()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const round = activeRound(data)
  const placing = round?.phase === 'placing'
  const iSealed = !!round && hasSealed(data, round.id, me)
  const waiting = placing && iSealed
  const rebalancing = round?.phase === 'revealed' || round?.phase === 'rebalancing'

  // Reveal animation: once per laptop per round — live when the round flips from placing while I watch,
  // or the first time I open the Team view after a reveal I haven't seen animate here.
  const seenKey = (id: number) => `weighin-reveal-seen-${id}`
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const unseen = (id: number) => {
    try {
      return localStorage.getItem(seenKey(id)) !== '1'
    } catch {
      return false // storage blocked: don't replay on every visit
    }
  }
  const [revealing, setRevealing] = useState<number | null>(() =>
    round && rebalancing && unseen(round.id) && !reducedMotion() ? round.id : null,
  )
  const [revealRun, setRevealRun] = useState(0) // bumps when a live reveal starts → fresh animation
  const lastSeen = useRef<{ id: number; phase: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!round) return
    const prev = lastSeen.current
    lastSeen.current = { id: round.id, phase: round.phase }
    if (!rebalancing) return
    try {
      localStorage.setItem(seenKey(round.id), '1')
    } catch {
      // ignore
    }
    const flippedNow = prev?.id === round.id && prev.phase === 'placing'
    if (flippedNow && !reducedMotion()) {
      // oxlint-disable-next-line react/set-state-in-effect -- reacting to a server-pushed phase change
      setRevealing(round.id)
      setRevealRun((n) => n + 1)
    }
  }, [round?.id, round?.phase, rebalancing]) // eslint-disable-line react-hooks/exhaustive-deps

  // End the animation after it has played (kept separate so later data changes don't cancel it).
  useEffect(() => {
    if (revealing == null) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setRevealing(null), 4400)
  }, [revealing, revealRun])
  useEffect(() => () => clearTimeout(timer.current), [])
  const lastLocked = !round && data.rounds.some((r) => r.phase === 'locked')

  const category = new Map(data.categories.map((c) => [c.id, c]))
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
          detail: { category: c?.name ?? 'Other work', note: s.note?.trim() || null, link: s.link?.trim() || null },
        }
      })
      .sort((a, b) => a.order - b.order || Number(a.id) - Number(b.id))

  const revealed = revealedRoundIds(data)

  // The latest locked plan stays visible (pale stones) until the next round is revealed.
  const lockedPlan = [...data.rounds].filter((r) => r.phase === 'locked').sort((a, b) => b.number - a.number)[0]
  const planStillCurrent =
    !!lockedPlan && !data.rounds.some((r) => r.number > lockedPlan.number && r.phase !== 'placing')
  const planWork = planStillCurrent ? data.openWork.filter((w) => w.round_id === lockedPlan.id && w.assigned_to != null) : []

  const piles = data.members.map((m) => ({
    member: m,
    stones: [
      ...toPile(data.stones.filter((s) => s.user_id === m.user_id && s.round_id != null && revealed.has(s.round_id))),
      ...planWork
        .filter((w) => w.assigned_to === m.user_id)
        .map((w) => {
          const c = category.get(w.category_id)
          return {
            id: `plan-${w.id}`,
            hours: w.hours,
            colour: c?.colour ?? OTHER_COLOUR,
            planned: true,
            detail: { category: `Plan · ${c?.name ?? 'Task'}`, note: w.name },
          }
        }),
    ] as PileStone[],
  }))
  const latestRevealed = [...data.rounds].filter((r) => r.phase !== 'placing').sort((a, b) => b.number - a.number)[0]
  const notSubmitted = (userId: number) => !!latestRevealed && !hasSealed(data, latestRevealed.id, userId)

  const n = Math.max(1, piles.length)
  const cellWidth = Math.max(140, Math.min(300, (stageWidth - 48) / n - 8))
  const unit = fitUnit(piles.map((p) => p.stones), { width: cellWidth * PILE_BASE, height: PILE_H - 9, max: 72, min: 8, taper: PILE_TAPER })

  const mySealed = waiting ? toPile(data.stones.filter((s) => s.user_id === me && s.round_id === round!.id)) : []
  const sealedUnit = fitUnit([mySealed], { width: 420 * PILE_BASE, height: 240, max: 90, min: 10, taper: PILE_TAPER })
  const sealedCount = round ? data.seals.filter((s) => s.round_id === round.id).length : 0

  const statusRow = (light: boolean) => (
    <div className={`${styles.statusRow} ${light ? styles.statusLight : ''}`} aria-label="Who has sealed">
      {data.members.map((m) => {
        const done = hasSealed(data, round!.id, m.user_id)
        return (
          <div key={m.user_id} className={styles.status}>
            <Avatar name={m.name} confirmed={done} />
            <span>
              {m.name}
              {m.user_id === me && ' (you)'}
              <em className={done ? styles.ok : ''}>{done ? 'Sealed' : 'Placing…'}</em>
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.chips} aria-label="Categories">
          {data.categories
            .filter((c) => c.shared_at !== null)
            .map((c) => (
              <span key={c.id} className={styles.chip}>
                <span className={styles.dot} style={{ background: c.colour }} />
                {c.name}
              </span>
            ))}
          <span className={styles.chip}>
            <span className={styles.dashedDot} />
            Other work
          </span>
        </div>
        <ScheduleControl projectId={data.project.id} schedule={data.project.checkin_schedule} onSaved={reload} />
      </div>

      {rebalancing ? (
        <RebalanceView key={`${round!.id}-${revealRun}`} round={round!} revealing={revealing === round!.id} />
      ) : (
        <>
        <div ref={stageRef} className={`${styles.stage} ${waiting ? styles.dark : ''}`}>
          {waiting ? (
            <>
              <h2 className={styles.sealedTitle}>Your stones are sealed.</h2>
              <div className={styles.sealedPile}>
                <TeamPile stones={mySealed} unit={sealedUnit} width={420} height={250} grey emptyText="You sealed 0 h this time." />
              </div>
              {statusRow(false)}
            </>
          ) : (
            <>
              {placing && (
                <div className={styles.openPanel}>
                  <p className={styles.banner}>
                    Check-in open · {sealedCount} of {data.members.length} sealed · {timeLeft(round!.closes_at, now)}
                    <Link to="..">Seal your stones →</Link>
                  </p>
                  {statusRow(true)}
                </div>
              )}
              {planWork.length > 0 && !placing && (
                <p className={styles.banner}>
                  Plan locked · pale stones are this week’s agreed tasks. They show up in each person’s My stones.
                </p>
              )}
              {revealed.size === 0 ? (
                <p className={styles.empty}>
                  {placing
                    ? 'Piles appear here at the reveal, once everyone has sealed.'
                    : 'No reveals yet. Start a check-in from My stones when the team is ready.'}
                </p>
              ) : (
                <div className={styles.piles} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                  {piles.map(({ member, stones }) => {
                    const total = stones.filter((s) => !s.planned).reduce((sum, s) => sum + s.hours, 0)
                    const planned = stones.filter((s) => s.planned).reduce((sum, s) => sum + s.hours, 0)
                    return (
                      <div key={member.user_id} className={styles.pileCell}>
                        <TeamPile stones={stones} unit={unit} width={cellWidth} height={PILE_H} />
                        <p className={styles.pileName}>
                          {member.name}
                          {member.user_id === me && <span> · You</span>}
                          <span className={styles.pileHours}>{formatHours(total)}</span>
                        </p>
                        {planned > 0 && <p className={styles.planNote}>+{formatHours(planned)} planned</p>}
                        {notSubmitted(member.user_id) && <p className={styles.notSubmitted}>Not submitted</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.bottom}>
          <LinksBar projectId={data.project.id} links={data.links} onChange={reload} />
          {lastLocked && (
            <span className={styles.locked}>
              Plan locked <CircleCheck size={18} strokeWidth={1.7} aria-hidden />
            </span>
          )}
        </div>
        </>
      )}
    </>
  )
}
