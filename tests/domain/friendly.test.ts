import { describe, expect, it } from 'vitest'
import {
  datedTitleParts,
  dueLabel,
  dueText,
  everyText,
  lastDoneText,
  manyText,
  summaryText,
} from '../../src/domain/friendly'
import { derive } from '../../src/domain/schedule'
import type { Chore } from '../../src/domain/chore'
import { TODAY, chore, d } from './helpers'

const due = (c: Chore) => dueText(c, derive(c, TODAY), TODAY)

describe('lastDoneText', () => {
  it.each([
    [undefined, 'never done'],
    ['2026-10-10', 'today'],
    ['2026-10-09', 'yesterday'],
    ['2026-10-06', 'last Tuesday'],
    ['2026-10-03', 'a week ago'],
    ['2026-09-30', '10 days ago'],
    ['2026-09-02', '5 weeks ago'],
    ['2026-06-28', '3 months ago'],
    ['2025-09-01', 'September 2025'],
  ])('%s reads as %s', (iso, text) => {
    expect(lastDoneText(iso === undefined ? undefined : d(iso), TODAY)).toBe(text)
  })
})

describe('dueText', () => {
  it('flags never-done chores', () => {
    expect(due(chore())).toEqual({ long: 'never done', short: 'new', tone: 'bad' })
  })

  it('counts days late, then weeks late', () => {
    expect(due(chore({ done: [d('2026-09-02')] })).long).toBe('10 days late')
    expect(due(chore({ done: [d('2026-08-01')] })).long).toBe('6 weeks late')
  })

  it('reads near dates as words and far dates as counts', () => {
    expect(due(chore({ done: [d('2026-09-12')] })).long).toBe('today')
    expect(due(chore({ done: [d('2026-09-13')] })).long).toBe('tomorrow')
    expect(due(chore({ done: [d('2026-09-15')] })).long).toBe('Tuesday')
    expect(due(chore({ done: [d('2026-09-22')] })).long).toBe('in 10 days')
    expect(due(chore({ done: [d('2026-10-03')] })).long).toBe('in 3 weeks')
    expect(due(chore({ every: { n: 1, unit: 'y' }, done: [d('2025-12-15')] })).long).toBe(
      'in 2 months',
    )
  })

  it('shows the snooze end instead of the due date', () => {
    const c = chore({ done: [d('2026-09-02')], snoozedUntil: d('2026-10-16') })
    expect(due(c)).toEqual({ long: 'snoozed till Fri', short: 'zz Fri', tone: 'warn' })
    expect(due({ ...c, snoozedUntil: d('2026-11-07') }).long).toBe('snoozed till 7 Nov')
  })

  it('reads a snooze ending a week out as its date, not as today', () => {
    const c = chore({ done: [d('2026-09-02')], snoozedUntil: d('2026-10-17') })
    expect(due(c)).toEqual({ long: 'snoozed till 17 Oct', short: 'zz 17 Oct', tone: 'warn' })
  })
})

describe('dueLabel', () => {
  it('adds a relative hint to the date', () => {
    const c = chore({ done: [d('2026-09-15')] })
    expect(dueLabel(c, derive(c, TODAY), TODAY)).toBe('Tue 13 Oct (in 3 days)')
  })
})

describe('everyText', () => {
  it('reads the interval', () => {
    expect(everyText(chore())).toBe('every 4 weeks')
    expect(everyText(chore({ every: { n: 1, unit: 'm' } }))).toBe('every month')
    expect(everyText(chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [2] }))).toBe(
      'every Tuesday',
    )
    expect(everyText(chore({ every: { n: 2, unit: 'w' }, anchor: 'calendar', days: [2] }))).toBe(
      'every 2 weeks on Tuesday',
    )
  })
})

describe('everyText on set days', () => {
  const on = (days: number[], n = 1) =>
    everyText(chore({ every: { n, unit: 'w' }, anchor: 'calendar', days }))

  it.each([
    [[1, 2, 3, 4, 5], 1, 'every weekday'],
    [[0, 6], 1, 'every Sat and Sun'],
    [[0, 1, 2, 3, 4, 5, 6], 1, 'every day'],
    [[0, 1, 2, 3, 4], 1, 'every Sun to Thu'],
    [[0, 5, 6], 1, 'every Fri to Sun'],
    [[1, 3, 5], 1, 'every Mon, Wed and Fri'],
    [[1, 4], 2, 'every 2 weeks on Mon and Thu'],
    [[1, 2, 3, 4, 5], 2, 'every 2 weeks on weekdays'],
    [[0, 1, 2, 3, 4, 5, 6], 2, 'every day, every 2 weeks'],
  ])('reads %o every %i weeks as %s', (days, n, text) => {
    expect(on(days, n)).toBe(text)
  })
})

describe('summaryText', () => {
  const summary = (c: Chore) => summaryText(c, derive(c, TODAY), TODAY)

  it('compares the real rhythm with the set interval', () => {
    const c = chore({ done: [d('2026-09-02'), d('2026-08-01'), d('2026-07-06'), d('2026-06-03')] })
    expect(summary(c)).toBe('Done 4 times since June · usually every 30 days (set to 28)')
  })

  it('reads a monthly or yearly rhythm in months', () => {
    const done = [d('2026-10-09'), d('2026-09-10'), d('2026-08-10')]
    expect(summary(chore({ every: { n: 1, unit: 'm' }, done }))).toBe(
      'Done 3 times since August · usually every 1 month',
    )
    expect(summary(chore({ every: { n: 1, unit: 'y' }, done }))).toBe(
      'Done 3 times since August · usually every 1 month (set to 12)',
    )
  })

  it('reads a rhythm under a month in days for monthly and yearly chores', () => {
    const done = [d('2026-10-08'), d('2026-10-01')]
    expect(summary(chore({ every: { n: 1, unit: 'm' }, done }))).toBe(
      'Done 2 times since October · usually every 7 days (set to 1 month)',
    )
    expect(summary(chore({ every: { n: 1, unit: 'y' }, done }))).toBe(
      'Done 2 times since October · usually every 7 days (set to 1 year)',
    )
  })

  it('counts hits for calendar chores', () => {
    const bins = chore({
      every: { n: 1, unit: 'w' },
      anchor: 'calendar',
      days: [2],
      done: [d('2026-10-06'), d('2026-09-29'), d('2026-09-15')],
      skipped: [d('2026-09-22')],
    })
    expect(summary(bins)).toBe('3 of the last 4 Tuesdays · 1 skipped (22 Sep)')
  })

  it('counts kept days, including missed ones, for chores on set days', () => {
    const gym = chore({
      every: { n: 1, unit: 'w' },
      anchor: 'calendar',
      days: [1, 3, 5],
      done: [d('2026-10-09'), d('2026-10-05'), d('2026-09-30'), d('2026-09-28')],
    })
    expect(summary(gym)).toBe('4 of the last 6 scheduled days')
  })

  it('leads with a fresh skip', () => {
    const c = chore({ done: [d('2026-09-02')], skipped: [TODAY] })
    expect(summary(c)).toBe('Skipped today · next due Sat 7 Nov')
  })

  it('says when a chore has never been done', () => {
    expect(summary(chore())).toBe('Not done yet · due now')
  })

  it('gives the first due date of a never-done chore that is not due yet', () => {
    const bins = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [2] })
    expect(summary(bins)).toBe('Not done yet · first due Tue 13 Oct')
    const skippedOnly = chore({ skipped: [d('2026-10-01')] })
    expect(summary(skippedOnly)).toBe('Not done yet · first due Thu 29 Oct')
  })
})

describe('datedTitleParts', () => {
  it('reads as the option, a separator and the date when only its text is shown', () => {
    expect(datedTitleParts('Tomorrow', d('2026-10-11')).join('')).toBe('Tomorrow · Sun 11 Oct')
  })
})

describe('manyText', () => {
  it.each([
    [1, 'skipped', '1 chore skipped'],
    [3, 'snoozed till Sat 17 Oct', '3 chores snoozed till Sat 17 Oct'],
  ])('counts %i chore(s)', (n, what, text) => {
    expect(manyText(n, what)).toBe(text)
  })
})
