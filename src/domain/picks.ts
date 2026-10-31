import type { Chore } from './chore'
import type { Day } from './day'
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
  [...rows].sort((a, b) => {
    const [ka, kb] = [key(a), key(b)]
    if (ka === undefined || kb === undefined) return ka === kb ? 0 : ka === undefined ? 1 : -1
    return ka - kb
  })

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

/** A day's picks: the rule, its reshuffle seed and the paths it chose, or Show all for that day. */
export type TodayPicks = { day: Day } & (
  { kind: 'picked'; rule: PickRule; seed: number; paths: readonly string[] } | { kind: 'all' }
)

export const STRATEGY_LABELS: Record<Strategy, string> = {
  overdue: 'Most overdue',
  recent: 'Most recently done',
  often: 'Done most often',
  surprise: 'Surprise me',
}

/** The paths of the first `rule.count` of `needs` ranked by `rule`. */
export function pickPaths<R extends { c: Chore; x: Derived }>(
  rule: PickRule,
  needs: readonly R[],
  seed: number,
): string[] {
  return rankNeeds(rule.strategy, needs, seed)
    .slice(0, rule.count)
    .map(({ c }) => c.path)
}

/** The first seed for a day's picks, spaced so a day's reshuffles never reach the next day's seed. */
export const daySeed = (day: Day): number => day * 1000

/** Picks for `day` made from `needs` by `rule` with `seed`. */
export function pickToday<R extends { c: Chore; x: Derived }>(
  day: Day,
  rule: PickRule,
  seed: number,
  needs: readonly R[],
): TodayPicks {
  return { day, kind: 'picked', rule, seed, paths: pickPaths(rule, needs, seed) }
}

/**
 * The picks in force on `today`: those stored for today, else a fresh pick from `needs` by the
 * `morning` rule, else none. Nothing is picked from an empty `needs`, so picks made before the
 * chores load are not kept all day.
 */
export function picksFor<R extends { c: Chore; x: Derived }>(
  stored: TodayPicks | null,
  today: Day,
  morning: PickRule | null,
  needs: readonly R[],
): TodayPicks | null {
  if (stored?.day === today) return stored
  if (!morning || !needs.length) return null
  return pickToday(today, morning, daySeed(today), needs)
}
