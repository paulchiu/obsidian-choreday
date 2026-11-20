import type { Day } from './day'

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
