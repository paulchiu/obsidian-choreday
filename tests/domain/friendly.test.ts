import { describe, expect, it } from 'vitest'
import { dueLabel, dueText, everyText, lastDoneText, summaryText } from '../../src/domain/friendly'
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
    const c = chore({ done: [d('2026-09-02')], snoozedUntil: d('2026-10-17') })
    expect(due(c)).toEqual({ long: 'snoozed till Sat', short: 'zz Sat', tone: 'warn' })
    expect(due({ ...c, snoozedUntil: d('2026-11-07') }).long).toBe('snoozed till 7 Nov')
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
    expect(everyText(chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', day: 2 }))).toBe(
      'every Tuesday',
    )
    expect(everyText(chore({ every: { n: 2, unit: 'w' }, anchor: 'calendar', day: 2 }))).toBe(
      'every 2 weeks on Tuesday',
    )
  })
})

describe('summaryText', () => {
  const summary = (c: Chore) => summaryText(c, derive(c, TODAY), TODAY)

  it('compares the real rhythm with the set interval', () => {
    const c = chore({ done: [d('2026-09-02'), d('2026-08-01'), d('2026-07-06'), d('2026-06-03')] })
    expect(summary(c)).toBe('Done 4 times since June · usually every 30 days (set to 28)')
  })

  it('counts hits for calendar chores', () => {
    const bins = chore({
      every: { n: 1, unit: 'w' },
      anchor: 'calendar',
      day: 2,
      done: [d('2026-10-06'), d('2026-09-29'), d('2026-09-15')],
      skipped: [d('2026-09-22')],
    })
    expect(summary(bins)).toBe('3 of the last 7 Tuesdays · 1 skipped (22 Sep)')
  })

  it('leads with a fresh skip', () => {
    const c = chore({ done: [d('2026-09-02')], skipped: [TODAY] })
    expect(summary(c)).toBe('Skipped today · next due Sat 7 Nov')
  })

  it('says when a chore has never been done', () => {
    expect(summary(chore())).toBe('Not done yet · due now')
  })
})
