import { describe, expect, it } from 'vitest'
import { parseSettings, settingEffect, settingsData, withSetting } from '../../src/domain/settings'
import { d } from './helpers'

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
    expect(parseSettings(raw)).toEqual({
      folder: 'Chores',
      historyLimit: 12,
      earlyTicks: true,
      morningPicks: null,
      noPressure: false,
      holidays: [],
    })
  })

  it('keeps every valid value', () => {
    const raw = {
      folder: 'Home/Jobs',
      historyLimit: 2,
      earlyTicks: false,
      morningPicks: { strategy: 'surprise', count: 5 },
      noPressure: true,
      holidays: [],
    }
    expect(parseSettings(raw)).toEqual(raw)
  })

  it('returns settings that a change does not carry into the next load', () => {
    parseSettings(null).historyLimit = 5
    expect(parseSettings(null).historyLimit).toBe(12)
  })
})

describe('settingEffect', () => {
  const saved = {
    folder: 'Chores',
    historyLimit: 12,
    earlyTicks: true,
    morningPicks: null,
    noPressure: false,
    holidays: [],
  }

  it.each([
    ['folder', 'Home/Jobs', 'rescan'],
    ['earlyTicks', false, 'redraw'],
    ['historyLimit', 24, 'save'],
  ])('gives %s set to %o the effect %s', (key, value, effect) => {
    expect(settingEffect(saved, withSetting(saved, key, value))).toBe(effect)
  })

  it.each([
    ['folder', 'Chores'],
    ['historyLimit', 12],
    ['earlyTicks', true],
  ])('needs no work when %s is set to its saved value %o', (key, value) => {
    expect(settingEffect(saved, withSetting(saved, key, value))).toBe('none')
  })

  it.each([
    ['historyLimit', 1],
    ['historyLimit', '24'],
    ['earlyTicks', 'false'],
    ['folder', 42],
    ['unknown', 'x'],
  ])('needs no work when %s is set to the rejected value %o', (key, value) => {
    expect(settingEffect(saved, withSetting(saved, key, value))).toBe('none')
  })

  it.each([
    [{ ...saved, folder: 'Home/Jobs', historyLimit: 24, earlyTicks: false }, 'rescan'],
    [{ ...saved, folder: 'Home/Jobs', historyLimit: 24 }, 'rescan'],
    [{ ...saved, historyLimit: 24, earlyTicks: false }, 'redraw'],
  ])('gives the strongest effect when several settings differ in %o', (after, effect) => {
    expect(settingEffect(saved, after)).toBe(effect)
  })
})

describe('morningPicks', () => {
  it('is off by default', () => {
    expect(parseSettings({}).morningPicks).toBeNull()
  })

  it('keeps a saved rule and count', () => {
    expect(parseSettings({ morningPicks: { strategy: 'often', count: 3 } }).morningPicks).toEqual({
      strategy: 'often',
      count: 3,
    })
  })

  it.each([
    [{ strategy: 'cleanest', count: 3 }],
    [{ strategy: 'often', count: 0 }],
    [{ strategy: 'often', count: 6 }],
    [{ strategy: 'often', count: 2.5 }],
    ['often'],
  ])('stays off for %o', (value) => {
    expect(parseSettings({ morningPicks: value }).morningPicks).toBeNull()
  })

  it('can be turned off again', () => {
    const on = parseSettings({ morningPicks: { strategy: 'recent', count: 2 } })
    expect(withSetting(on, 'morningPicks', null).morningPicks).toBeNull()
  })
})

describe('noPressure', () => {
  it('is off by default', () => {
    expect(parseSettings({}).noPressure).toBe(false)
  })

  it('keeps a saved switch', () => {
    expect(parseSettings({ noPressure: true }).noPressure).toBe(true)
  })

  it.each(['true', 1, null])('stays off for %o', (value) => {
    expect(parseSettings({ noPressure: value }).noPressure).toBe(false)
  })
})

describe('holidays', () => {
  const away = { start: '2026-10-27', end: '2026-11-05' }

  it('reads holidays saved as ISO dates', () => {
    expect(parseSettings({ holidays: [away] }).holidays).toEqual([
      { start: d('2026-10-27'), end: d('2026-11-05') },
    ])
  })

  it.each([
    [{ start: '2026-11-05', end: '2026-10-27' }],
    [{ start: 'soon', end: '2026-11-05' }],
    [{ start: '2026-10-27' }],
    ['2026-10-27'],
  ])('drops a holiday that is not a start and end in order: %o', (bad) => {
    expect(parseSettings({ holidays: [bad, away] }).holidays).toHaveLength(1)
  })

  it('saves holidays as ISO dates that load back the same', () => {
    const settings = parseSettings({ holidays: [away] })
    const data = settingsData(settings)
    expect([data.holidays, parseSettings(data)]).toEqual([[away], settings])
  })

  it('redraws when they change', () => {
    const before = parseSettings(null)
    expect(settingEffect(before, withSetting(before, 'holidays', [away]))).toBe('redraw')
  })
})
