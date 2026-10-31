import type { Chore } from './chore'
import { averageGap, type Derived } from './schedule'

const STRATEGIES = ['overdue', 'recent', 'often', 'surprise'] as const
export type Strategy = (typeof STRATEGIES)[number]

export const isStrategy = (v: unknown): v is Strategy => STRATEGIES.some((s) => s === v)

/** The most chores one pick shows. */
export const MAX_PICKS = 5

/** How to pick: the strategy and how many. */
export interface PickRule {
  strategy: Strategy
  count: number
}

/** `value` as a pick rule, or null when it is not a valid one. */
export function parsePickRule(value: unknown): PickRule | null {
  if (typeof value !== 'object' || value === null) return null
  const { strategy, count } = value as Record<string, unknown>
  return isStrategy(strategy) &&
    typeof count === 'number' &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= MAX_PICKS
    ? { strategy, count }
    : null
}

/** Sorts by `key` ascending, putting rows without one last; `Array.sort` is stable, so ties keep their order. */
const sortBy = <R>(rows: readonly R[], key: (r: R) => number | undefined): R[] =>
  [...rows].sort((a, b) => (key(a) ?? Infinity) - (key(b) ?? Infinity))

/** A Fisher-Yates shuffle driven by mulberry32, so the same seed always gives the same order. */
function shuffle<R>(rows: readonly R[], seed: number): R[] {
  let t = seed >>> 0
  const next = (): number => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const out = [...rows]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** `needs`, in Needs doing order, ordered for `strategy`. */
export function rankNeeds<R extends { c: Chore; x: Derived }>(
  strategy: Strategy,
  needs: readonly R[],
  seed: number,
): R[] {
  switch (strategy) {
    case 'recent':
      return sortBy(needs, ({ x }) => (x.lastDone === undefined ? undefined : -x.lastDone))
    case 'often':
      return sortBy(needs, ({ c }) => averageGap(c))
    case 'surprise':
      return shuffle(needs, seed)
    case 'overdue':
      return [...needs]
  }
}
