/** Weekday chips in display order, Monday first; values are 0 = Sunday. */
export const MONDAY_FIRST: readonly number[] = [1, 2, 3, 4, 5, 6, 0]

export const DAY_PRESETS: readonly { label: string; days: number[] }[] = [
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
]

/** Flips one day; the last picked day stays on, since a calendar chore needs one. */
export function toggleDay(days: readonly number[], day: number): number[] {
  if (!days.includes(day)) return [...days, day].sort((a, b) => a - b)
  return days.length === 1 ? [...days] : days.filter((d) => d !== day)
}
