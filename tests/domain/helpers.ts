import type { Chore } from '../../src/domain/chore'
import { parseIso, type Day } from '../../src/domain/day'

export const d = (iso: string): Day => {
  const day = parseIso(iso)
  if (day === null) throw new Error(`bad test date ${iso}`)
  return day
}

export const chore = (overrides: Partial<Chore> = {}): Chore => ({
  path: 'Chores/Descale kettle.md',
  name: 'Descale kettle',
  every: { n: 4, unit: 'w' },
  anchor: 'done',
  done: [],
  skipped: [],
  unreadable: { done: [], skipped: [] },
  warnings: [],
  ...overrides,
})

/** Saturday, matching the UX mocks. */
export const TODAY = d('2026-10-10')
