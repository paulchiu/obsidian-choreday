import type { Chore } from './chore'
import { averageGap, type Derived } from './schedule'

export type Strategy = 'overdue' | 'recent' | 'often' | 'surprise'

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
