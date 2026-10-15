import { describe, expect, it } from 'vitest'
import { parseSettings } from '../../src/domain/settings'

describe('parseSettings', () => {
  it('keeps the default history limit when data.json holds 0', () => {
    expect(parseSettings({ historyLimit: 0 }).historyLimit).toBe(12)
  })

  it.each([
    [{ historyLimit: '24' }, { historyLimit: 12 }],
    [{ historyLimit: 2.5 }, { historyLimit: 12 }],
    [{ earlyTicks: 'false' }, { earlyTicks: true }],
    [{ folder: 42 }, { folder: 'Chores' }],
    [{ folder: null }, { folder: 'Chores' }],
  ])('keeps the default for %o', (raw, expected) => {
    expect(parseSettings(raw)).toMatchObject(expected)
  })

  it.each([null, undefined, 'Chores', 12, [12]])('gives the defaults for %o', (raw) => {
    expect(parseSettings(raw)).toEqual({ folder: 'Chores', historyLimit: 12, earlyTicks: true })
  })

  it('keeps every valid value', () => {
    const raw = { folder: 'Home/Jobs', historyLimit: 2, earlyTicks: false }
    expect(parseSettings(raw)).toEqual(raw)
  })

  it('returns settings that a change does not carry into the next load', () => {
    parseSettings(null).historyLimit = 5
    expect(parseSettings(null).historyLimit).toBe(12)
  })
})
