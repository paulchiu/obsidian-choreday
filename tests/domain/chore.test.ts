import { describe, expect, it } from 'vitest'
import { isChoreFrontmatter, parseChore, readChoreNote } from '../../src/domain/chore'
import { d } from './helpers'

const parse = (fm: Record<string, unknown>) => parseChore('Chores/Bins out.md', 'Bins out', fm)

describe('isChoreFrontmatter', () => {
  it('needs type: chore', () => {
    expect(isChoreFrontmatter({ type: 'chore' })).toBe(true)
    expect(isChoreFrontmatter({ type: 'workout' })).toBe(false)
    expect(isChoreFrontmatter(undefined)).toBe(false)
  })
})

describe('parseChore', () => {
  it('reads the full shape', () => {
    const r = parse({
      type: 'chore',
      every: '1w',
      anchor: 'calendar',
      day: 'tuesday',
      keep: 6,
      snoozed_until: '2026-10-24',
      done: ['2026-09-29', '2026-10-06'],
      skipped: ['2026-09-22'],
    })
    expect(r).toEqual({
      ok: true,
      chore: {
        path: 'Chores/Bins out.md',
        name: 'Bins out',
        every: { n: 1, unit: 'w' },
        anchor: 'calendar',
        days: [2],
        keep: 6,
        snoozedUntil: d('2026-10-24'),
        done: [d('2026-10-06'), d('2026-09-29')],
        skipped: [d('2026-09-22')],
        unreadable: { done: [], skipped: [] },
        warnings: [],
      },
    })
  })

  it('needs only every, and defaults to counting from last done', () => {
    const r = parse({ type: 'chore', every: '2m' })
    expect(r.ok && r.chore.anchor).toBe('done')
    expect(r.ok && r.chore.done).toEqual([])
  })

  it('fails without a readable every', () => {
    expect(parse({ type: 'chore' })).toEqual({
      ok: false,
      problems: ['every is missing (e.g. every: 2w)'],
    })
    expect(parse({ type: 'chore', every: 'fortnightly' }).ok).toBe(false)
  })

  it('accepts a single date in place of a list and drops duplicates', () => {
    const r = parse({ every: '1w', done: '2026-10-01' })
    expect(r.ok && r.chore.done).toEqual([d('2026-10-01')])
    const dup = parse({ every: '1w', done: ['2026-10-01', '2026-10-01'] })
    expect(dup.ok && dup.chore.done).toEqual([d('2026-10-01')])
  })

  it('keeps unreadable history entries aside with a warning', () => {
    const r = parse({ every: '1w', done: ['2026-10-01', 'last tuesday'] })
    expect(r.ok && r.chore.done).toEqual([d('2026-10-01')])
    expect(r.ok && r.chore.unreadable.done).toEqual(['last tuesday'])
    expect(r.ok && r.chore.warnings).toEqual([
      "done has entries that aren't YYYY-MM-DD dates: last tuesday",
    ])
  })

  it('falls back to after-last-done when a calendar chore has no usable day', () => {
    const r = parse({ every: '1w', anchor: 'calendar' })
    expect(r.ok && r.chore.anchor).toBe('done')
    expect(r.ok && r.chore.warnings[0]).toMatch(/need a day/)
  })

  it('falls back to after-last-done when a calendar chore is not in weeks', () => {
    const r = parse({ every: '1m', anchor: 'calendar', day: 'monday' })
    expect(r.ok && r.chore.anchor).toBe('done')
    expect(r.ok && r.chore.warnings[0]).toMatch(/repeat in weeks/)
  })

  it('reads a per-chore early ticks rule', () => {
    const r = parse({ every: '1w', anchor: 'calendar', days: ['monday'], early: false })
    expect(r.ok && r.chore.early).toBe(false)
    const on = parse({ every: '1w', anchor: 'calendar', days: ['monday'], early: true })
    expect(on.ok && on.chore.early).toBe(true)
    const bad = parse({ every: '1w', early: 'yes' })
    expect(bad.ok && bad.chore).not.toHaveProperty('early')
    const unset = parse({ every: '1w' })
    expect(unset.ok && unset.chore).not.toHaveProperty('early')
  })

  it.each([
    [{ anchor: 'weekly' }, /anchor should be/],
    [{ early: 'sometimes' }, /early should be true or false/],
    [{ day: 'someday' }, /day should be a weekday/],
    [{ keep: 'six' }, /keep should be a whole number/],
    [{ keep: 0 }, /keep should be a whole number/],
    [{ snoozed_until: 'soon' }, /snoozed_until isn't/],
  ])('warns on %o', (extra, warning) => {
    const r = parse({ every: '1w', ...extra })
    expect(r.ok && r.chore.warnings[0]).toMatch(warning)
  })
})

describe('parseChore days', () => {
  const days = (fm: Record<string, unknown>) => {
    const r = parse({ every: '1w', anchor: 'calendar', ...fm })
    return r.ok ? { days: r.chore.days, anchor: r.chore.anchor, warnings: r.chore.warnings } : r
  }

  it('reads a list of weekdays, full or short, in week order', () => {
    expect(days({ days: ['friday', 'Mon', 'wednesday'] })).toEqual({
      days: [1, 3, 5],
      anchor: 'calendar',
      warnings: [],
    })
  })

  it('treats days without an anchor as a calendar chore', () => {
    const r = parse({ every: '1w', days: ['monday'] })
    expect(r.ok && r.chore.anchor).toBe('calendar')
  })

  it('counts from the last done date when the anchor is unreadable, even with days', () => {
    const r = parse({ every: '1w', anchor: 'weekly', days: ['monday'] })
    expect(r.ok && r.chore.anchor).toBe('done')
  })

  it('reads a single weekday string', () => {
    expect(days({ days: 'thu' })).toMatchObject({ days: [4], anchor: 'calendar' })
  })

  it('flags unreadable entries and schedules the rest', () => {
    expect(days({ days: ['monday', 'funday', 3] })).toEqual({
      days: [1],
      anchor: 'calendar',
      warnings: ["days has entries that aren't weekdays: funday, 3"],
    })
  })

  it('falls back to after-last-done when no day is readable', () => {
    expect(days({ days: ['funday'] })).toMatchObject({ days: undefined, anchor: 'done' })
  })
})

describe('parseChore with Date values', () => {
  it('runs where UTC midnight falls on the previous local day', () => {
    expect(new Date('2026-10-06T00:00:00Z').getDate()).toBe(5)
  })

  it('reads dates a YAML parser has already turned into Date objects', () => {
    const r = parse({
      every: '1w',
      done: [new Date('2026-10-06T00:00:00Z')],
      snoozed_until: new Date('2026-10-24T00:00:00Z'),
    })
    expect(r.ok && r.chore.done).toEqual([d('2026-10-06')])
    expect(r.ok && r.chore.snoozedUntil).toBe(d('2026-10-24'))
  })
})

describe('readChoreNote', () => {
  it('ignores a note that is not a chore', () => {
    expect(readChoreNote('Chores/Shopping.md', 'Shopping', { tags: ['list'] }, 'Chores')).toBe(null)
    expect(readChoreNote('Chores/Shopping.md', 'Shopping', undefined, 'Chores')).toBe(null)
  })

  it('ignores a chore note outside the chores folder', () => {
    expect(readChoreNote('Archive/Mop.md', 'Mop', { type: 'chore', every: '1w' }, 'Chores')).toBe(
      null,
    )
  })

  it('reads a chore note inside the chores folder', () => {
    const read = readChoreNote(
      'Chores/Floors/Mop.md',
      'Mop',
      { type: 'chore', every: '1w' },
      'Chores',
    )
    expect(read?.ok && read.chore.every).toEqual({ n: 1, unit: 'w' })
  })

  it('reads a chore note with a bad schedule so it can be listed for fixing', () => {
    const read = readChoreNote('Chores/Mop.md', 'Mop', { type: 'chore', every: 'often' }, 'Chores')
    expect(read?.ok).toBe(false)
  })
})
