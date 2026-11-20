import { describe, expect, it } from 'vitest'
import { toIso } from '../../src/domain/day'
import { currentHoliday, endHoliday, planHoliday, type Holiday } from '../../src/domain/holiday'
import { derive } from '../../src/domain/schedule'
import { TODAY, chore, d } from './helpers'

const iso = (hs: readonly Holiday[]): string[][] => hs.map((h) => [toIso(h.start), toIso(h.end)])
const holiday = (start: string, end: string): Holiday => ({ start: d(start), end: d(end) })

describe('holidays', () => {
  const last = holiday('2026-07-01', '2026-07-14')
  const next = holiday('2026-10-27', '2026-11-05')

  it('finds the holiday under way or planned next, ignoring ones already over', () => {
    expect(currentHoliday([last, next], TODAY)).toEqual(next)
    expect(currentHoliday([last], TODAY)).toBeUndefined()
  })

  it('replaces the planned holiday when one is planned again, keeping past ones', () => {
    const later = holiday('2026-12-20', '2027-01-04')
    expect(iso(planHoliday([last, next], later, TODAY))).toEqual([
      ['2026-07-01', '2026-07-14'],
      ['2026-12-20', '2027-01-04'],
    ])
  })

  it('ends a holiday under way yesterday, so the pause stops from today', () => {
    expect(iso(endHoliday([last, next], d('2026-10-30')))).toEqual([
      ['2026-07-01', '2026-07-14'],
      ['2026-10-27', '2026-10-29'],
    ])
  })

  it('removes a holiday that has not started, putting every due date back', () => {
    const c = chore({ done: [d('2026-10-01')] })
    const ended = endHoliday([next], TODAY)
    expect([ended, toIso(derive(c, TODAY, true, ended).due)]).toEqual([[], '2026-10-29'])
  })
})
