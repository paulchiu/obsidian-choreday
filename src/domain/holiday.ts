import { parseIso, type Day } from './day'

/** Days away, start and end included, that don't count towards any chore's cycle. */
export interface Holiday {
  start: Day
  end: Day
}

/** How many holiday days fall after `after`, up to and including `upTo`. */
export function holidayDays(holidays: readonly Holiday[], after: Day, upTo: Day): number {
  return holidays.reduce(
    (n, h) => n + Math.max(0, Math.min(h.end, upTo) - Math.max(h.start, after + 1) + 1),
    0,
  )
}

export const onHoliday = (holidays: readonly Holiday[], d: Day): boolean =>
  holidayDays(holidays, d - 1, d) > 0

const byStart = (hs: readonly Holiday[]): Holiday[] => [...hs].sort((a, b) => a.start - b.start)

/**
 * `due` for a cycle that began on `from`, pushed out by the holiday days before it, and once late
 * by those since, so the clock stands still while away.
 */
export function pausedDue(holidays: readonly Holiday[], from: Day, due: Day, today: Day): Day {
  let paused = due
  for (const h of byStart(holidays)) {
    const start = Math.max(h.start, from + 1)
    if (h.end >= start && start <= paused) paused += h.end - start + 1
  }
  return paused < today ? paused + holidayDays(holidays, paused, today) : paused
}

/** Whether `h` has ended before `today`; a holiday over stays, since it still pauses old cycles. */
const isOver = (h: Holiday, today: Day): boolean => h.end < today

export const isUnderway = (h: Holiday, today: Day): boolean => h.start <= today && !isOver(h, today)

/** The holiday under way on `today`, or failing that the next one planned. */
export function currentHoliday(holidays: readonly Holiday[], today: Day): Holiday | undefined {
  return byStart(holidays).find((h) => !isOver(h, today))
}

/**
 * `holidays` with `h` in place of any under way or planned and of any past one it overlaps, so no
 * day counts twice.
 */
export function planHoliday(holidays: readonly Holiday[], h: Holiday, today: Day): Holiday[] {
  const overlaps = (o: Holiday): boolean => o.start <= h.end && h.start <= o.end
  return byStart([...holidays.filter((o) => isOver(o, today) && !overlaps(o)), h])
}

/** `holidays` with the current one ending yesterday, or gone when it hasn't started. */
export function endHoliday(holidays: readonly Holiday[], today: Day): Holiday[] {
  return holidays.flatMap((h) =>
    isOver(h, today) ? [h] : h.start < today ? [{ start: h.start, end: today - 1 }] : [],
  )
}

export type HolidayResult = { ok: true; holiday: Holiday } | { ok: false; problem: string }

/** The holiday the typed first and last days away make, or why they don't make one. */
export function holidayFrom(start: string, end: string): HolidayResult {
  const [s, e] = [parseIso(start), parseIso(end)]
  if (s === null || e === null) return { ok: false, problem: 'Pick the first and last days away.' }
  return e < s
    ? { ok: false, problem: 'The last day away is before the first.' }
    : { ok: true, holiday: { start: s, end: e } }
}
