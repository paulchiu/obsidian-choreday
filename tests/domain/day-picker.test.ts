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
  it('lists the chips Monday first', () => {
    expect(MONDAY_FIRST).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('offers weekdays, weekends and every day', () => {
    expect(DAY_PRESETS).toEqual([
      { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
      { label: 'Weekends', days: [0, 6] },
      { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
    ])
  })
})
