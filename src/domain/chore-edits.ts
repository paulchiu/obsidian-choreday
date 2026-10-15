import { scheduleDays, type Chore } from './chore'
import { WEEKDAYS, toIso } from './day'
import { formatEvery } from './every'
import { applyFrontmatterEdits, type FieldValue } from './frontmatter-edit'

/** Frontmatter key order for keys a write adds; `days` sits where a replaced `day` was. */
const KEY_ORDER = [
  'type',
  'every',
  'anchor',
  'days',
  'day',
  'keep',
  'early',
  'snoozed_until',
  'done',
  'skipped',
] as const

type ChoreKey = (typeof KEY_ORDER)[number]

/** Edits keyed by the chore note's own frontmatter keys, so a camelCase slip fails to compile. */
export type ChoreFieldEdits = Partial<Record<ChoreKey, FieldValue>>

const dayNames = (days: readonly number[]): string[] => days.map((d) => WEEKDAYS[d]!.toLowerCase())

const sameList = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Frontmatter edits that turn `before` into `after`, touching only the keys whose stored value
 * changed. Unreadable history entries ride along at the end of their list so a write never
 * drops something the user typed.
 */
export function choreEdits(before: Chore, after: Chore): ChoreFieldEdits {
  const edits: ChoreFieldEdits = {}
  if (formatEvery(before.every) !== formatEvery(after.every)) edits.every = formatEvery(after.every)
  if (before.schedule.anchor !== after.schedule.anchor) edits.anchor = after.schedule.anchor
  if (!sameList(scheduleDays(before.schedule), scheduleDays(after.schedule))) {
    edits.days =
      after.schedule.anchor === 'calendar' ? { inline: dayNames(after.schedule.days) } : null
    edits.day = null
  }
  if (before.keep !== after.keep) edits.keep = after.keep ?? null
  if (before.early !== after.early) edits.early = after.early ?? null
  if (before.snoozedUntil !== after.snoozedUntil)
    edits.snoozed_until = after.snoozedUntil === undefined ? null : toIso(after.snoozedUntil)
  if (!sameList(before.done, after.done))
    edits.done = [...after.done.map(toIso), ...after.unreadable.done]
  if (!sameList(before.skipped, after.skipped)) {
    const skipped = [...after.skipped.map(toIso), ...after.unreadable.skipped]
    edits.skipped = skipped.length ? skipped : null
  }
  return edits
}

/** Frontmatter for a new chore note. */
export function newChoreEdits(c: Chore): ChoreFieldEdits {
  return {
    type: 'chore',
    every: formatEvery(c.every),
    ...(c.schedule.anchor === 'calendar' && {
      anchor: 'calendar',
      days: { inline: dayNames(c.schedule.days) },
    }),
    done: c.done.map(toIso),
  }
}

/** Rewrites a chore note's text from `before` to `after`, touching only the keys that changed. */
export function applyChoreEdits(text: string, before: Chore, after: Chore): string {
  return applyFrontmatterEdits(text, choreEdits(before, after), KEY_ORDER)
}

/** The stored facts on a chore; the rest is read from the note's path or derived. */
const FACTS = ['every', 'schedule', 'keep', 'early', 'snoozedUntil', 'done', 'skipped'] as const

type Fact = (typeof FACTS)[number]

function sameFact(a: Chore, b: Chore, k: Fact): boolean {
  switch (k) {
    case 'every':
      return formatEvery(a.every) === formatEvery(b.every)
    case 'schedule':
      return (
        a.schedule.anchor === b.schedule.anchor &&
        sameList(scheduleDays(a.schedule), scheduleDays(b.schedule))
      )
    case 'done':
    case 'skipped':
      return sameList(a[k], b[k])
    default:
      return a[k] === b[k]
  }
}

function putFact<K extends Fact>(to: Chore, from: Chore, k: K): void {
  to[k] = from[k]
}

/**
 * `now` with only the facts a write changed from `before` to `after` put back, for Undo. Null when
 * one of them has changed since, as putting it back would throw away that later change.
 */
export function revertWrite(now: Chore, before: Chore, after: Chore): Chore | null {
  const touched = FACTS.filter((k) => !sameFact(before, after, k))
  if (touched.some((k) => !sameFact(now, after, k))) return null
  const back = { ...now }
  for (const k of touched) putFact(back, before, k)
  return back
}
