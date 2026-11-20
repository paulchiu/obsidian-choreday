import { describe, expect, it } from 'vitest'
import { toIso } from '../../src/domain/day'
import {
  currentHoliday,
  endHoliday,
  holidayFrom,
  planHoliday,
  type Holiday,
} from '../../src/domain/holiday'
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

  it('still finds a holiday on its last day', () => {
    expect(currentHoliday([next], d('2026-11-05'))).toEqual(next)
  })

  it('replaces a past holiday the new one overlaps, so no day counts twice', () => {
    const c = chore({ done: [d('2026-06-20')], every: { n: 8, unit: 'w' } })
    const longer = holiday('2026-07-01', '2026-07-21')
    const holidays = planHoliday([last], longer, TODAY)
    expect([iso(holidays), toIso(derive(c, TODAY, true, holidays).due)]).toEqual([
      [['2026-07-01', '2026-07-21']],
      '2026-09-05',
    ])
  })

  it('replaces the planned holiday when one is planned again, keeping past ones', () => {
    const later = holiday('2026-12-20', '2027-01-04')
    expect(iso(planHoliday([last, next], later, TODAY))).toEqual([
      ['2026-07-01', '2026-07-14'],
      ['2026-12-20', '2027-01-04'],
    ])
  })

  it('ends a holiday under way yesterday, so the pause stops from today', () => {
    const ended = endHoliday([last, next], d('2026-10-30'))
    const c = chore({ done: [d('2026-10-01')] })
    expect([iso(ended), toIso(derive(c, d('2026-10-30'), true, ended).due)]).toEqual([
      [
        ['2026-07-01', '2026-07-14'],
        ['2026-10-27', '2026-10-29'],
      ],
      '2026-11-01',
    ])
  })

  it('removes a holiday that has not started, putting every due date back', () => {
    const c = chore({ done: [d('2026-10-01')] })
    const ended = endHoliday([next], TODAY)
    expect([ended, toIso(derive(c, TODAY, true, ended).due)]).toEqual([[], '2026-10-29'])
  })

  it.each([
    ['', '2026-11-05', 'Pick the first and last days away.'],
    ['2026-10-27', '', 'Pick the first and last days away.'],
    ['2026-11-05', '2026-10-27', 'The last day away is before the first.'],
  ])('refuses %o to %o: %s', (start, end, why) => {
    expect(holidayFrom(start, end)).toEqual({ ok: false, problem: why })
  })

  it('makes a one-day holiday when the first and last days are the same', () => {
    expect(holidayFrom('2026-10-27', '2026-10-27')).toEqual({
      ok: true,
      holiday: holiday('2026-10-27', '2026-10-27'),
    })
  })
})
