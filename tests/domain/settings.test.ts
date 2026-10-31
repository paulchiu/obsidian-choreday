import { describe, expect, it } from 'vitest'
import { parseSettings, settingEffect, withSetting } from '../../src/domain/settings'

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
    })
  })

  it('keeps every valid value', () => {
    const raw = {
      folder: 'Home/Jobs',
      historyLimit: 2,
      earlyTicks: false,
      morningPicks: { strategy: 'surprise', count: 5 },
    }
    expect(parseSettings(raw)).toEqual(raw)
  })

  it('returns settings that a change does not carry into the next load', () => {
    parseSettings(null).historyLimit = 5
    expect(parseSettings(null).historyLimit).toBe(12)
  })
})

describe('settingEffect', () => {
  const saved = { folder: 'Chores', historyLimit: 12, earlyTicks: true, morningPicks: null }

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
