import type { Chore } from './chore'
import { WEEKDAYS, toIso } from './day'
import { formatEvery } from './every'
import type { FieldValue } from './frontmatter-edit'

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
  if (before.day !== after.day)
    edits.day = after.day === undefined ? null : WEEKDAYS[after.day]!.toLowerCase()
  if (before.keep !== after.keep) edits.keep = after.keep ?? null
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
      day: WEEKDAYS[c.day ?? 0]!.toLowerCase(),
    }),
    done: c.done.map(toIso),
  }
}
