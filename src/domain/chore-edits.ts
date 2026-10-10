import type { Chore } from './chore'
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

const dayNames = (days: number[]): string[] => days.map((d) => WEEKDAYS[d]!.toLowerCase())

const sameList = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Frontmatter edits that turn `before` into `after`, touching only the keys whose stored value
 * changed. Unreadable history entries ride along at the end of their list so a write never
 * drops something the user typed.
 */
export function choreEdits(before: Chore, after: Chore): Record<string, FieldValue> {
  const edits: Record<string, FieldValue> = {}
  if (formatEvery(before.every) !== formatEvery(after.every)) edits.every = formatEvery(after.every)
  if (before.anchor !== after.anchor) edits.anchor = after.anchor
  if (!sameList(before.days ?? [], after.days ?? [])) {
    edits.days = after.days ? { inline: dayNames(after.days) } : null
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
export function newChoreEdits(c: Chore): Record<string, FieldValue> {
  return {
    type: 'chore',
    every: formatEvery(c.every),
    ...(c.anchor === 'calendar' && {
      anchor: 'calendar',
      days: { inline: dayNames(c.days ?? [0]) },
    }),
    done: c.done.map(toIso),
  }
}

/** Rewrites a chore note's text from `before` to `after`, touching only the keys that changed. */
export function applyChoreEdits(text: string, before: Chore, after: Chore): string {
  return applyFrontmatterEdits(text, choreEdits(before, after), KEY_ORDER)
}
