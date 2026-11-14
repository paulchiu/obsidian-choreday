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
  const size = turnSize(r)
  const start = Math.max(0, items.indexOf(r.turn ?? '')) + ahead * size
  return Array.from({ length: size }, (_, i) => items[(start + i) % items.length]!)
}

/** How many different turns the rotation takes before this one comes round again. */
export function turnCount(r: Rotation): number {
  const n = r.items.length
  return n / gcd(n, turnSize(r))
}

function turnSize(r: Rotation): number {
  return Math.min(r.perTurn ?? 1, r.items.length)
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** The rotation with its turn moved on to the item after the last one in this turn. */
export function nextTurn(r: Rotation): Rotation {
  return { ...r, turn: turnItems(r, 1)[0]! }
}
