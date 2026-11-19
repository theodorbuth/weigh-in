import { CalendarClock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { browserTimezone, describeSchedule, parseSchedule, WEEKDAYS } from '../lib/schedule'
import { supabase } from '../lib/supabase'
import Button from './Button'
import styles from './ScheduleControl.module.css'

interface ScheduleControlProps {
  projectId: number
  schedule: string | null
  onSaved: () => void
}

/** "Weekly check-in: Fridays at 5:00 PM EST" + an editor (one weekday + time, or off). */
export default function ScheduleControl({ projectId, schedule, onSaved }: ScheduleControlProps) {
  const current = parseSchedule(schedule)
  const [open, setOpen] = useState(false)
  const [weekday, setWeekday] = useState(current?.weekday ?? 5)
  const [time, setTime] = useState(current?.time ?? '17:00')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  async function save(off: boolean) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('set_checkin_schedule', {
      p_project_id: projectId,
      p_weekday: off ? null : weekday,
      p_time: off ? null : time,
      p_timezone: off ? null : browserTimezone(),
    })
    setBusy(false)
    if (error) return setError(error.message)
    setOpen(false)
    onSaved()
  }

  return (
    <div className={styles.wrap} ref={ref}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CalendarClock size={16} strokeWidth={1.7} aria-hidden />
        <span className={styles.muted}>Weekly check-in:</span>
        {current ? describeSchedule(current) : 'Off'}
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Weekly check-in schedule">
          <h3 className={styles.title}>Weekly check-in</h3>
          <p className={styles.hint}>
            A check-in opens automatically at this time every week, even if nobody has the app open. Times use your
            timezone ({browserTimezone()}).
          </p>
          <div className={styles.row}>
            <label className={styles.field}>
              Day
              <select className={styles.input} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Time
              <input className={styles.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button variant="text" onClick={() => save(true)} disabled={busy || !current}>
              Turn off
            </Button>
            <Button onClick={() => save(false)} disabled={busy || !time}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
