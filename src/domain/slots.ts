import { mod, weekday, weekOf, type Day } from './day'

/**
 * The days a calendar chore falls on: its weekdays, in every `n`th Monday-start week counted
 * from `week`.
 */
export interface SlotPattern {
  days: readonly number[]
  n: number
  week: number
}

export const isSlot = (p: SlotPattern, d: Day): boolean =>
  p.days.includes(weekday(d)) && mod(weekOf(d) - p.week, p.n) === 0

/** The first slot strictly after `d`. */
export function slotAfter(p: SlotPattern, d: Day): Day {
  let s = d + 1
  while (!isSlot(p, s)) s++
  return s
}

/** The latest slot on or before `d`. */
export function slotOnOrBefore(p: SlotPattern, d: Day): Day {
  let s = d
  while (!isSlot(p, s)) s--
  return s
}

/**
 * Anchors the on-weeks on the week phase most ticks on chosen weekdays share (the newest one breaks
 * a tie), so neither a late tick in an off week nor trimming the oldest ticks moves them. With no
 * such tick, the week of the first chosen weekday on or after the oldest tick (or `today`) is on.
 */
export function patternFor(
  days: readonly number[],
  n: number,
  ticks: readonly Day[],
  today: Day,
): SlotPattern {
  const counts = new Map<number, number>()
  let best: number | undefined
  let bestCount = 0
  for (const t of [...ticks].sort((a, b) => a - b)) {
    if (!days.includes(weekday(t))) continue
    const phase = mod(weekOf(t), n)
    const count = (counts.get(phase) ?? 0) + 1
    counts.set(phase, count)
    if (count >= bestCount) {
      best = phase
      bestCount = count
    }
  }
  if (best !== undefined) return { days, n, week: best }
  let first = ticks.length ? Math.min(...ticks) : today
  while (!days.includes(weekday(first))) first++
  return { days, n, week: weekOf(first) }
}
