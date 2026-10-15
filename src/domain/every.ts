import { addMonths, type Day } from './day'

const UNITS = ['d', 'w', 'm', 'y'] as const
export type Unit = (typeof UNITS)[number]

export const isUnit = (v: unknown): v is Unit => UNITS.some((u) => u === v)

export interface Every {
  n: number
  unit: Unit
}

/** `4w`, `2 m`, `1y`. Case-insensitive; the count must be a positive whole number. */
export function parseEvery(value: unknown): Every | null {
  if (typeof value !== 'string') return null
  const m = /^(\d+)\s*([dwmy])$/i.exec(value.trim())
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]?.toLowerCase()
  return n > 0 && isUnit(unit) ? { n, unit } : null
}

export const formatEvery = (e: Every): string => `${e.n}${e.unit}`

/** Moves `d` by `k` intervals (negative `k` goes back). */
export function step(d: Day, every: Every, k: number): Day {
  switch (every.unit) {
    case 'd':
      return d + every.n * k
    case 'w':
      return d + every.n * 7 * k
    case 'm':
      return addMonths(d, every.n * k)
    case 'y':
      return addMonths(d, every.n * 12 * k)
  }
}

const UNIT_DAYS: Record<Unit, number> = { d: 1, w: 7, m: 30.44, y: 365.25 }

/** Average length of one interval in days, for ratios and scaling. */
export const intervalDays = (e: Every): number => UNIT_DAYS[e.unit] * e.n
