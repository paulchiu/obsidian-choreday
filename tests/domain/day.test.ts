import { describe, expect, it } from 'vitest'
import {
  addMonths,
  dayOf,
  parseIso,
  parseWeekday,
  shortDate,
  toIso,
  weekday,
  weekOf,
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

describe('shortDate', () => {
  it('formats as weekday, day, month', () => {
    expect(shortDate(d('2026-09-02'))).toBe('Wed 2 Sep')
  })
})

describe('weekday', () => {
  it('reads a Saturday as 6', () => {
    expect(weekday(d('2026-10-10'))).toBe(6)
  })

  it.each([
    [0, 4],
    [3, 0],
    [-1, 3],
    [-4, 0],
    [-11, 0],
  ])('reads day number %i as %i', (day, expected) => {
    expect(weekday(day)).toBe(expected)
  })

  it.each([
    ['1900-01-01', 1],
    ['1969-07-20', 0],
    ['1970-01-01', 4],
    ['2000-01-01', 6],
    ['2000-02-29', 2],
    ['2024-02-29', 4],
    ['2026-10-16', 5],
  ])('reads %s as %i', (iso, expected) => {
    expect(weekday(d(iso))).toBe(expected)
  })

  it.each([
    ['2026-10-12', '2026-10-18'],
    ['1969-12-29', '1970-01-04'],
  ])('walks Monday %s to Sunday %s in order', (from, to) => {
    const days = Array.from({ length: d(to) - d(from) + 1 }, (_, i) => weekday(d(from) + i))
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 0])
  })
})

describe('weekOf', () => {
  it.each([
    ['1969-12-28', -1],
    ['1969-12-29', 0],
    ['1970-01-01', 0],
    ['1970-01-04', 0],
    ['1970-01-05', 1],
  ])('numbers the Monday-start week of %s as %i', (iso, expected) => {
    expect(weekOf(d(iso))).toBe(expected)
  })

  it('keeps Monday to Sunday in one week and starts the next on Monday', () => {
    const week = weekOf(d('2026-10-12'))
    const days = Array.from({ length: 7 }, (_, i) => weekOf(d('2026-10-12') + i))
    expect(days).toEqual(Array(7).fill(week))
    expect(weekOf(d('2026-10-19'))).toBe(week + 1)
    expect(weekOf(d('2026-10-11'))).toBe(week - 1)
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
