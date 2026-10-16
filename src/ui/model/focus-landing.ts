/** The attribute naming a focusable control, so `keepFocus` can find it again after a render. */
export const FOCUS_ATTR = 'data-cd-focus'
/** The attribute naming a list group's box. */
export const GROUP_ATTR = 'data-cd-group'

/** A focusable control as `keepFocus` sees it: its key, and the list group it sits in. */
export interface Slot {
  key: string
  group: string
}

const kindOf = (key: string): string => key.split(':')[0] ?? key

/**
 * The index in `after` that takes focus from `before[at]`: the same control, else a neighbour of the
 * same kind and then any control above it in its group, else the first control of a group that now sits
 * where its group was, else the nearest control below or above.
 */
export function landing(before: readonly Slot[], at: number, after: readonly Slot[]): number {
  const here = before[at]
  if (!here) return -1
  const find = (want: Slot): number =>
    after.findIndex((s) => s.key === want.key && s.group === want.group)
  const first = (list: readonly Slot[]): number => list.map(find).find((i) => i >= 0) ?? -1
  const sameGroup = (s: Slot): boolean => s.group === here.group
  const sameKind = (s: Slot): boolean => sameGroup(s) && kindOf(s.key) === kindOf(here.key)
  const otherGroup = (s: Slot): boolean => !sameGroup(s)
  const below = before.slice(at + 1)
  const above = before.slice(0, at).reverse()
  const kept = first([
    here,
    ...below.filter(sameKind),
    ...above.filter(sameKind),
    ...above.filter(sameGroup),
  ])
  if (kept >= 0) return kept
  const up = first(above.filter(otherGroup))
  const down = first(below.filter(otherGroup))
  const upGroup = after[up]?.group
  const arrived = after.findIndex((s, i) => i > up && (down < 0 || i < down) && s.group !== upGroup)
  if (arrived >= 0) return arrived
  return down >= 0 ? down : up
}
