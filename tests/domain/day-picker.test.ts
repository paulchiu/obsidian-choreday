import { describe, expect, it } from 'vitest'
import { MONDAY_FIRST } from '../../src/domain/day'
import { DAY_PRESETS, toggleDay } from '../../src/domain/day-picker'

describe('toggleDay', () => {
  it('adds a day in week order and removes a picked one', () => {
    expect(toggleDay([1, 5], 3)).toEqual([1, 3, 5])
    expect(toggleDay([1, 3, 5], 3)).toEqual([1, 5])
  })

  it('never turns off the last picked day', () => {
    expect(toggleDay([4], 4)).toEqual([4])
  })
})

describe('day picker layout', () => {
  it('shows one chip per weekday, running through the week from Monday', () => {
    expect([...MONDAY_FIRST].sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(MONDAY_FIRST[0]).toBe(1)
    MONDAY_FIRST.slice(1).forEach((day, i) => expect(day).toBe((MONDAY_FIRST[i]! + 1) % 7))
  })

  it('offers presets in the shape toggleDay keeps: non-empty, ascending, distinct weekdays', () => {
    for (const { days } of DAY_PRESETS) {
      expect(days.length).toBeGreaterThan(0)
      expect(days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)).toBe(true)
      expect(days.every((d, i) => i === 0 || d > days[i - 1]!)).toBe(true)
    }
  })
})
