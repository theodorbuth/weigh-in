export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface Schedule {
  weekday: number
  time: string // HH:MM
  timezone: string
}

export function parseSchedule(text: string | null): Schedule | null {
  if (!text) return null
  const [d, time, timezone] = text.split(' ')
  const weekday = Number(d)
  return Number.isInteger(weekday) && time && timezone ? { weekday, time, timezone } : null
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** "Fridays at 5:00 PM EST" */
export function describeSchedule(s: Schedule): string {
  const [h, m] = s.time.split(':').map(Number)
  const time = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  let zone = s.timezone
  try {
    zone =
      new Intl.DateTimeFormat('en-US', { timeZone: s.timezone, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? s.timezone
  } catch {
    // unknown timezone name: show it as stored
  }
  return `${WEEKDAYS[s.weekday]}s at ${time} ${zone}`
}
