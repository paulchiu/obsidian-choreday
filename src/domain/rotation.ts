/** A chore done a few items at a time, taking turns through a list. */
export interface Rotation {
  /** The items in order; never empty on a parsed chore. */
  items: readonly string[]
  /** As written; absent means one item per turn. */
  perTurn?: number
  /** The first item of this turn as written; absent, or not in `items`, means the top of the list. */
  turn?: string
}

/** The items of the turn `ahead` turns from this one, so 0 is this turn. */
export function turnItems(r: Rotation, ahead = 0): string[] {
  const { items } = r
  const size = Math.min(r.perTurn ?? 1, items.length)
  const start = Math.max(0, items.indexOf(r.turn ?? '')) + ahead * size
  return Array.from({ length: size }, (_, i) => items[(start + i) % items.length]!)
}
