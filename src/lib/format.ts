/** 1 → "1 h", 0.5 → "0.5 h", 2.25 → "2.25 h" */
export function formatHours(hours: number): string {
  return `${Number(hours.toFixed(2))} h`
}
