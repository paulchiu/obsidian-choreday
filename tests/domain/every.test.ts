import { describe, expect, it } from 'vitest'
import { formatEvery, intervalDays, parseEvery, step } from '../../src/domain/every'
import { toIso } from '../../src/domain/day'
import { d } from './helpers'

describe('parseEvery', () => {
  it.each([
    ['4w', { n: 4, unit: 'w' }],
    ['2 m', { n: 2, unit: 'm' }],
    ['1Y', { n: 1, unit: 'y' }],
    [' 10d ', { n: 10, unit: 'd' }],
  ])('reads %s', (value, expected) => {
    expect(parseEvery(value)).toEqual(expected)
  })

  it.each(['0w', 'w', '2 weeks', '1.5m', 4, null, undefined])('rejects %s', (value) => {
    expect(parseEvery(value)).toBeNull()
  })

  it('formats back to the compact form', () => {
    expect(formatEvery({ n: 3, unit: 'm' })).toBe('3m')
  })
})

describe('step', () => {
  it('moves by days, weeks, months and years', () => {
    const start = d('2026-01-31')
    expect(toIso(step(start, { n: 3, unit: 'd' }, 1))).toBe('2026-02-03')
    expect(toIso(step(start, { n: 2, unit: 'w' }, 1))).toBe('2026-02-14')
    expect(toIso(step(start, { n: 1, unit: 'm' }, 1))).toBe('2026-02-28')
    expect(toIso(step(start, { n: 1, unit: 'y' }, -1))).toBe('2025-01-31')
  })
})

describe('intervalDays', () => {
  it('approximates months and years', () => {
    expect(intervalDays({ n: 2, unit: 'w' })).toBe(14)
    expect(intervalDays({ n: 3, unit: 'm' })).toBeCloseTo(91.32)
  })
})
