import type { Chore } from './chore'
import { weekday, type Day } from './day'
import { patternFrom, slotAfter } from './slots'
import { intervalDays, step, type Every } from './every'

export type Group = 'needs' | 'coming' | 'later'

export interface Derived {
  lastDone?: Day
  lastSkip?: Day
  due: Day
  /** Calendar slots passed over since the last tick, oldest first. */
  missed: Day[]
  neverDone: boolean
  /**
   * How far through its cycle a chore is, 1 at the due date; Infinity when nothing is recorded.
   * Calendar chores measure from the due date in units of the average gap between slots.
   */
  ratio: number
  snoozed: boolean
  group: Group
}

/** Chores due within this many days sit in Coming up; further out they go to Later. */
export const COMING_UP_DAYS = 14

const newest = (ds: Day[]): Day | undefined => (ds.length ? Math.max(...ds) : undefined)

/**
 * Replays the ticks oldest first: each one covers the slots up to it, and with `early` a tick
 * before the next open slot covers that slot ahead of time. The open slot is then moved on to the
 * latest slot on or before today, and the slots it passes are missed. On-weeks are anchored on
 * the oldest tick, so a late tick in an off week doesn't move them.
 */
function calendarDue(c: Chore, today: Day, early: boolean): { due: Day; missed: Day[] } {
  const ticks = [...new Set([...c.done, ...c.skipped])].sort((a, b) => a - b)
  const pattern = patternFrom(c.days ?? [0], c.every.n, ticks[0] ?? today)
  let due = slotAfter(pattern, (ticks[0] ?? today) - 1)
  for (const t of ticks) {
    if (t >= due) due = slotAfter(pattern, t)
    else if (early) due = slotAfter(pattern, due)
  }
  const missed: Day[] = []
  for (let s = slotAfter(pattern, due); s <= today; s = slotAfter(pattern, s)) {
    missed.push(due)
    due = s
  }
  return { due, missed }
}

/** Average days between a calendar chore's slots. */
const slotGap = (c: Chore): number => intervalDays(c.every) / (c.days?.length ?? 1)

/** Everything the views show about a chore, computed from its stored facts. */
/** `early` sets whether a tick before a calendar chore's next slot counts for that slot. */
export function derive(c: Chore, today: Day, early = true): Derived {
  const lastDone = newest(c.done)
  const lastSkip = newest(c.skipped)
  const base = newest([lastDone, lastSkip].filter((d): d is Day => d !== undefined))
  const neverDone = lastDone === undefined
  const { due, missed } =
    c.anchor === 'calendar'
      ? calendarDue(c, today, early)
      : { due: base === undefined ? today : step(base, c.every, 1), missed: [] }
  const ratio =
    base === undefined
      ? Infinity
      : c.anchor === 'calendar'
        ? 1 + (today - due) / slotGap(c)
        : (today - base) / intervalDays(c.every)
  const snoozed = c.snoozedUntil !== undefined && c.snoozedUntil > today
  const group: Group = snoozed
    ? 'coming'
    : due <= today
      ? 'needs'
      : due - today <= COMING_UP_DAYS
        ? 'coming'
        : 'later'
  return { lastDone, lastSkip, due, missed, neverDone, ratio, snoozed, group }
}

/** About a quarter of the interval, rounded to a friendly unit and capped at a month. */
export function scaledSnooze(e: Every): { label: string; days: number } {
  const q = intervalDays(e) / 4
  if (q <= 2) return { label: '2 days', days: 2 }
  if (q <= 3.5) return { label: '3 days', days: 3 }
  if (q <= 10) return { label: '1 week', days: 7 }
  if (q <= 17) return { label: '2 weeks', days: 14 }
  if (q <= 24) return { label: '3 weeks', days: 21 }
  return { label: '1 month', days: 30 }
}

/** The next Saturday strictly after today. */
export function nextWeekend(today: Day): Day {
  let d = today + 1
  while (weekday(d) !== 6) d++
  return d
}

/** Mean gap between completions, ignoring gaps that span a skip. */
export function averageGap(c: Chore): number | undefined {
  const ds = [...c.done].sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < ds.length; i++) {
    const [a, b] = [ds[i - 1]!, ds[i]!]
    if (!c.skipped.some((s) => s > a && s < b)) gaps.push(b - a)
  }
  return gaps.length ? gaps.reduce((x, y) => x + y, 0) / gaps.length : undefined
}

const insertDesc = (ds: Day[], d: Day): Day[] =>
  [...ds.filter((x) => x !== d), d].sort((a, b) => b - a)

/**
 * Keeps the newest `limit` completions, and only the skips that still fall inside that window
 * (or the newest `limit` skips when there are no completions).
 */
export function trimHistory(c: Chore, globalLimit: number): Chore {
  const limit = c.keep ?? globalLimit
  const done = c.done.slice(0, limit)
  const oldest = done[done.length - 1]
  const skipped =
    oldest === undefined ? c.skipped.slice(0, limit) : c.skipped.filter((s) => s >= oldest)
  return { ...c, done, skipped }
}

/** Records a completion and clears any snooze. */
export function markDone(c: Chore, on: Day, limit: number): Chore {
  const { snoozedUntil: _, ...rest } = c
  return trimHistory({ ...rest, done: insertDesc(c.done, on) }, limit)
}

/**
 * Skips today (after-last-done chores) or the due slot (calendar chores), and clears any snooze.
 * A late calendar chore's due slot is the latest one passed, so one skip clears every missed day.
 */
export function markSkipped(c: Chore, today: Day, limit: number, early = true): Chore {
  const on = c.anchor === 'calendar' ? derive(c, today, early).due : today
  const { snoozedUntil: _, ...rest } = c
  return trimHistory({ ...rest, skipped: insertDesc(c.skipped, on) }, limit)
}

export function snooze(c: Chore, until: Day): Chore {
  return { ...c, snoozedUntil: until }
}

export function removeEntry(c: Chore, kind: 'done' | 'skip', d: Day): Chore {
  return kind === 'done'
    ? { ...c, done: c.done.filter((x) => x !== d) }
    : { ...c, skipped: c.skipped.filter((x) => x !== d) }
}

/** Orders a group: Needs doing by urgency, Coming up by when it resurfaces, Later by due date. */
export function sortGroup(
  group: Group,
  rows: { c: Chore; x: Derived }[],
): { c: Chore; x: Derived }[] {
  const at = (r: { c: Chore; x: Derived }): Day =>
    r.x.snoozed && r.c.snoozedUntil !== undefined ? r.c.snoozedUntil : r.x.due
  const sorted = [...rows]
  if (group === 'needs')
    sorted.sort((a, b) => b.x.ratio - a.x.ratio || a.c.name.localeCompare(b.c.name))
  else sorted.sort((a, b) => at(a) - at(b) || a.c.name.localeCompare(b.c.name))
  return sorted
}
