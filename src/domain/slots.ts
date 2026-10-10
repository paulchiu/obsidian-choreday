import { weekday, type Day } from './day'

/**
 * The days a calendar chore falls on: its weekdays, in every `n`th Monday-start week counted
 * from `week`.
 */
export interface SlotPattern {
  days: readonly number[]
  n: number
  week: number
}

/** Monday-start week number; day 0 (1 Jan 1970) is a Thursday. */
const weekOf = (d: Day): number => Math.floor((d + 3) / 7)

const mod = (a: number, n: number): number => ((a % n) + n) % n

export const isSlot = (p: SlotPattern, d: Day): boolean =>
  p.days.includes(weekday(d)) && mod(weekOf(d) - p.week, p.n) === 0

/** The first slot strictly after `d`. */
export function slotAfter(p: SlotPattern, d: Day): Day {
  let s = d + 1
  while (!isSlot(p, s)) s++
  return s
}

/**
 * The pattern anchored on the week of the first chosen weekday on or after `from`, so an early
 * tick in an off week still lands its pattern on the week it was for.
 */
export function patternFrom(days: readonly number[], n: number, from: Day): SlotPattern {
  let first = from
  while (!days.includes(weekday(first))) first++
  return { days, n, week: weekOf(first) }
}
