import { describe, expect, it } from 'vitest'
import {
  addMonths,
  dayOf,
  parseIso,
  parseWeekday,
  shortDate,
  toIso,
  weekday,
} from '../../src/domain/day'
import { d } from './helpers'

describe('parseIso', () => {
  it('round-trips a valid date', () => {
    expect(toIso(d('2026-10-10'))).toBe('2026-10-10')
  })

  it.each(['2026-02-30', '2026-13-01', '26-10-10', '2026-10-10T00:00', '', 'soon'])(
    'rejects %s',
    (value) => {
      expect(parseIso(value)).toBeNull()
    },
  )

  it('trims surrounding whitespace', () => {
    expect(parseIso(' 2026-10-10 ')).toBe(d('2026-10-10'))
  })
})

describe('dayOf', () => {
  it('uses the local calendar date', () => {
    expect(dayOf(new Date(2026, 9, 10, 23, 59))).toBe(d('2026-10-10'))
  })
})

describe('addMonths', () => {
  it('clamps to the end of a shorter month', () => {
    expect(toIso(addMonths(d('2026-01-31'), 1))).toBe('2026-02-28')
  })

  it('crosses year boundaries in both directions', () => {
    expect(toIso(addMonths(d('2026-11-15'), 3))).toBe('2027-02-15')
    expect(toIso(addMonths(d('2026-02-15'), -3))).toBe('2025-11-15')
  })
})

describe('shortDate and weekday', () => {
  it('formats as weekday, day, month', () => {
    expect(shortDate(d('2026-09-02'))).toBe('Wed 2 Sep')
    expect(weekday(d('2026-10-10'))).toBe(6)
  })
})

describe('parseWeekday', () => {
  it.each([
    ['tuesday', 2],
    ['Tue', 2],
    ['SUNDAY', 0],
    ['sat', 6],
  ])('reads %s', (value, expected) => {
    expect(parseWeekday(value)).toBe(expected)
  })

  it.each(['tu', 'tues', 'someday', 'on'])('rejects %s', (value) => {
    expect(parseWeekday(value)).toBeNull()
  })
})
