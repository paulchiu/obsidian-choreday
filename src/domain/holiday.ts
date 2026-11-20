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

/**
 * `due` for a cycle that began on `from`, with the clock stood still on holiday days: pushed out by
 * each holiday day before it falls due, and once it is late, by each holiday day since, so a late
 * chore gets no later while away.
 */
export function pausedDue(holidays: readonly Holiday[], from: Day, due: Day, today: Day): Day {
  let paused = due
  for (const h of [...holidays].sort((a, b) => a.start - b.start)) {
    const start = Math.max(h.start, from + 1)
    if (h.end >= start && start <= paused) paused += h.end - start + 1
  }
  return paused < today ? paused + holidayDays(holidays, paused, today) : paused
}

const byStart = (hs: readonly Holiday[]): Holiday[] => [...hs].sort((a, b) => a.start - b.start)

/** Whether `h` has ended before `today`; a holiday over stays, since it still pauses old cycles. */
const isOver = (h: Holiday, today: Day): boolean => h.end < today

/** The holiday under way on `today`, or failing that the next one planned. */
export function currentHoliday(holidays: readonly Holiday[], today: Day): Holiday | undefined {
  return byStart(holidays).find((h) => !isOver(h, today))
}

/** `holidays` with `h` in place of the one under way or planned, and of any it overlaps. */
export function planHoliday(holidays: readonly Holiday[], h: Holiday, today: Day): Holiday[] {
  const overlaps = (o: Holiday): boolean => o.start <= h.end && h.start <= o.end
  return byStart([...holidays.filter((o) => isOver(o, today) && !overlaps(o)), h])
}

/**
 * `holidays` with the current one ending yesterday, so the clock runs again from today, or gone
 * when it hasn't started.
 */
export function endHoliday(holidays: readonly Holiday[], today: Day): Holiday[] {
  return holidays.flatMap((h) =>
    isOver(h, today) ? [h] : h.start < today ? [{ start: h.start, end: today - 1 }] : [],
  )
}

/** The holiday the typed first and last days away make, or why they don't make one. */
export function holidayFrom(start: string, end: string): Holiday | string {
  const [s, e] = [parseIso(start), parseIso(end)]
  if (s === null || e === null) return 'Pick the first and last days away.'
  return e < s ? 'The last day away is before the first.' : { start: s, end: e }
}
