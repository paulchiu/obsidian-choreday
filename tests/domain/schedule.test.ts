import { describe, expect, it } from 'vitest'
import { toIso } from '../../src/domain/day'
import {
  averageGap,
  derive,
  markDone,
  markSkipped,
  nextWeekend,
  removeEntry,
  scaledSnooze,
  snooze,
  sortGroup,
  trimHistory,
  type Derived,
} from '../../src/domain/schedule'
import type { Chore } from '../../src/domain/chore'
import { TODAY, chore, d } from './helpers'

describe('derive', () => {
  it('puts a never-done chore in Needs doing, due today', () => {
    const x = derive(chore(), TODAY)
    expect(x).toMatchObject({ neverDone: true, due: TODAY, group: 'needs', ratio: Infinity })
  })

  it('counts from the last done date', () => {
    const x = derive(chore({ done: [d('2026-09-02'), d('2026-08-01')] }), TODAY)
    expect(toIso(x.due)).toBe('2026-09-30')
    expect(x.group).toBe('needs')
    expect(x.ratio).toBeCloseTo(38 / 28)
  })

  it('treats a later skip as the start of the next cycle', () => {
    const x = derive(chore({ done: [d('2026-09-02')], skipped: [d('2026-10-10')] }), TODAY)
    expect(toIso(x.due)).toBe('2026-11-07')
    expect(x.group).toBe('later')
  })

  it('groups by how soon a chore is due', () => {
    const coming = derive(chore({ done: [d('2026-09-20')] }), TODAY)
    expect(toIso(coming.due)).toBe('2026-10-18')
    expect(coming.group).toBe('coming')
  })

  it('moves a snoozed chore to Coming up until the snooze ends', () => {
    const c = chore({ done: [d('2026-09-02')], snoozedUntil: d('2026-10-17') })
    expect(derive(c, TODAY)).toMatchObject({ snoozed: true, group: 'coming' })
    expect(derive(c, d('2026-10-17'))).toMatchObject({ snoozed: false, group: 'needs' })
  })

  it('finds the next slot for a calendar chore', () => {
    const bins = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [2] })
    expect(toIso(derive(bins, TODAY).due)).toBe('2026-10-13')
    const doneTuesday = { ...bins, done: [d('2026-10-06')] }
    expect(toIso(derive(doneTuesday, TODAY).due)).toBe('2026-10-13')
    const late = { ...bins, done: [d('2026-09-29')] }
    expect(toIso(derive(late, TODAY).due)).toBe('2026-10-06')
  })

  it('spaces calendar slots by the week count', () => {
    const fortnightly = chore({
      every: { n: 2, unit: 'w' },
      anchor: 'calendar',
      days: [2],
      done: [d('2026-10-06')],
    })
    expect(toIso(derive(fortnightly, TODAY).due)).toBe('2026-10-20')
  })
})

const missedDays = (x: Derived) =>
  x.slots.filter((s) => s.outcome === 'missed').map((s) => toIso(s.slot))

describe('derive on set days', () => {
  const gym = (overrides: Partial<Chore> = {}) =>
    chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [1, 3, 5], ...overrides })
  const due = (c: Chore, today = TODAY) => toIso(derive(c, today).due)

  it('is due on the next chosen weekday after the last tick', () => {
    expect(due(gym({ done: [d('2026-10-05')] }), d('2026-10-06'))).toBe('2026-10-07')
    expect(due(gym({ done: [d('2026-10-09')] }))).toBe('2026-10-12')
  })

  it('repeats the chosen days only in every nth Monday-start week', () => {
    const fortnightly = gym({ every: { n: 2, unit: 'w' }, days: [1, 4] })
    expect(due({ ...fortnightly, done: [d('2026-09-28')] }, d('2026-09-29'))).toBe('2026-10-01')
    expect(due({ ...fortnightly, done: [d('2026-10-01'), d('2026-09-28')] })).toBe('2026-10-12')
  })

  it('makes the latest missed day due and lists the earlier ones as missed', () => {
    const x = derive(gym({ done: [d('2026-10-05')] }), TODAY)
    expect(toIso(x.due)).toBe('2026-10-09')
    expect(missedDays(x)).toEqual(['2026-10-07'])
    expect(x.group).toBe('needs')
  })

  it('measures urgency against the average gap between chosen days', () => {
    expect(derive(gym({ done: [d('2026-10-05')] }), TODAY).ratio).toBeCloseTo(1 + 3 / 7)
    expect(derive(gym({ done: [d('2026-10-09')] }), TODAY).ratio).toBeCloseTo(1 - 6 / 7)
  })

  it('applies the same rule to one weekday', () => {
    const bins = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [2] })
    const x = derive({ ...bins, done: [d('2026-09-22')] }, TODAY)
    expect(toIso(x.due)).toBe('2026-10-06')
    expect(missedDays(x)).toEqual(['2026-09-29'])
  })

  it('counts an early tick for the next open day when early ticks count', () => {
    const early = gym({ done: [d('2026-10-06'), d('2026-10-05')] })
    expect(due(early, d('2026-10-06'))).toBe('2026-10-09')
    const twoEarly = gym({ done: [d('2026-10-07'), d('2026-10-06'), d('2026-10-05')] })
    expect(due(twoEarly, d('2026-10-07'))).toBe('2026-10-12')
  })

  it('counts only days after a tick when early ticks do not count', () => {
    const early = gym({ done: [d('2026-10-06'), d('2026-10-05')] })
    expect(toIso(derive(early, d('2026-10-06'), false).due)).toBe('2026-10-07')
  })

  it('lets a chore override the early ticks setting', () => {
    const tickedTuesday = gym({ done: [d('2026-10-06'), d('2026-10-05')] })
    const today = d('2026-10-06')
    expect(toIso(derive({ ...tickedTuesday, early: false }, today, true).due)).toBe('2026-10-07')
    expect(toIso(derive({ ...tickedTuesday, early: true }, today, false).due)).toBe('2026-10-09')
    const skipped = markSkipped({ ...tickedTuesday, early: false }, today, 12, true)
    expect(skipped.skipped.map(toIso)).toEqual(['2026-10-07'])
  })

  it('lets the bins go out the night before', () => {
    const bins = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [4] })
    const wednesdayNight = { ...bins, done: [d('2026-10-07'), d('2026-10-01')] }
    expect(due(wednesdayNight, d('2026-10-07'))).toBe('2026-10-15')
  })

  it('keeps the on-weeks once trimming drops the oldest ticks', () => {
    const fortnightly = gym({ every: { n: 2, unit: 'w' }, days: [1, 4] })
    const ticks = ['2026-10-01', '2026-09-28', '2026-09-22', '2026-09-17', '2026-09-14'].map(d)
    const today = d('2026-10-03')
    expect(toIso(derive({ ...fortnightly, done: ticks }, today, false).due)).toBe('2026-10-12')
    const trimmed = { ...fortnightly, done: ticks.slice(0, 3) }
    expect(toIso(derive(trimmed, today, false).due)).toBe('2026-10-12')
  })

  it('knows the scheduled day after the due one', () => {
    expect(toIso(derive(gym({ done: [d('2026-10-09')] }), TODAY).following!)).toBe('2026-10-14')
  })

  it('starts weeks on Monday, so Sunday ends the on-week', () => {
    const fortnightly = gym({ every: { n: 2, unit: 'w' }, days: [0, 1] })
    expect(due({ ...fortnightly, done: [d('2026-09-28')] }, d('2026-09-29'))).toBe('2026-10-04')
  })

  it('keeps the on-weeks when a tick lands in an off week', () => {
    const fortnightly = gym({ every: { n: 2, unit: 'w' }, days: [1, 4] })
    const lateTuesday = { ...fortnightly, done: [d('2026-09-22'), d('2026-09-14')] }
    expect(due(lateTuesday, d('2026-09-23'))).toBe('2026-09-28')
  })
})

describe('scaledSnooze', () => {
  it.each([
    [{ n: 1, unit: 'w' } as const, '2 days'],
    [{ n: 2, unit: 'w' } as const, '3 days'],
    [{ n: 4, unit: 'w' } as const, '1 week'],
    [{ n: 2, unit: 'm' } as const, '2 weeks'],
    [{ n: 3, unit: 'm' } as const, '3 weeks'],
    [{ n: 1, unit: 'y' } as const, '1 month'],
  ])('scales %o to %s', (every, label) => {
    expect(scaledSnooze(every).label).toBe(label)
  })
})

describe('nextWeekend', () => {
  it('is the next Saturday, never today', () => {
    expect(toIso(nextWeekend(TODAY))).toBe('2026-10-17')
    expect(toIso(nextWeekend(d('2026-10-08')))).toBe('2026-10-10')
  })
})

describe('averageGap', () => {
  it('ignores gaps that span a skip', () => {
    const c = chore({
      done: [d('2026-10-06'), d('2026-09-29'), d('2026-09-15')],
      skipped: [d('2026-09-22')],
    })
    expect(averageGap(c)).toBe(7)
  })

  it('is undefined with fewer than two completions', () => {
    expect(averageGap(chore({ done: [TODAY] }))).toBeUndefined()
  })
})

describe('history writes', () => {
  it('records a completion newest first and clears the snooze', () => {
    const c = chore({ done: [d('2026-09-02')], snoozedUntil: d('2026-10-17') })
    const next = markDone(c, d('2026-10-09'), 12)
    expect(next.done.map(toIso)).toEqual(['2026-10-09', '2026-09-02'])
    expect(next).not.toHaveProperty('snoozedUntil')
  })

  it('does not record the same day twice', () => {
    expect(markDone(chore({ done: [TODAY] }), TODAY, 12).done).toEqual([TODAY])
  })

  it('skips today for after-last-done chores and the next slot for calendar chores', () => {
    expect(markSkipped(chore(), TODAY, 12).skipped).toEqual([TODAY])
    const bins = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [2] })
    expect(markSkipped(bins, TODAY, 12).skipped.map(toIso)).toEqual(['2026-10-13'])
  })

  it('clears every missed day with one skip when late', () => {
    const bike = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [1, 2, 3, 4, 5] })
    const skipped = markSkipped({ ...bike, done: [d('2026-10-05')] }, TODAY, 12)
    expect(toIso(derive(skipped, TODAY).due)).toBe('2026-10-12')
  })

  it('skips the day the early ticks setting makes due', () => {
    const gym = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [1, 3, 5] })
    const early = { ...gym, done: [d('2026-10-06'), d('2026-10-05')] }
    expect(markSkipped(early, d('2026-10-06'), 12, false).skipped.map(toIso)).toEqual([
      '2026-10-07',
    ])
  })

  it('trims to the per-chore limit, then the global one, and drops skips outside the window', () => {
    const c = chore({
      done: [d('2026-10-01'), d('2026-09-01'), d('2026-08-01')],
      skipped: [d('2026-09-15'), d('2026-07-15')],
    })
    expect(trimHistory(c, 2)).toMatchObject({
      done: [d('2026-10-01'), d('2026-09-01')],
      skipped: [d('2026-09-15')],
    })
    expect(trimHistory({ ...c, keep: 1 }, 12).done).toEqual([d('2026-10-01')])
  })

  it('snoozes and removes single entries', () => {
    expect(snooze(chore(), TODAY).snoozedUntil).toBe(TODAY)
    const c = chore({ done: [TODAY, d('2026-09-01')], skipped: [d('2026-09-15')] })
    expect(removeEntry(c, 'done', TODAY).done).toEqual([d('2026-09-01')])
    expect(removeEntry(c, 'skip', d('2026-09-15')).skipped).toEqual([])
  })
})

describe('sortGroup', () => {
  it('orders Needs doing by urgency and other groups by date', () => {
    const late = chore({ name: 'Late', done: [d('2026-08-01')] })
    const fresh = chore({ name: 'Fresh', done: [d('2026-09-10')] })
    const rows = [fresh, late].map((c) => ({ c, x: derive(c, TODAY) }))
    expect(sortGroup('needs', rows).map((r) => r.c.name)).toEqual(['Late', 'Fresh'])
    expect(sortGroup('later', rows).map((r) => r.c.name)).toEqual(['Late', 'Fresh'])
  })
})
