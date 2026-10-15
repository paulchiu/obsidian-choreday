import { describe, expect, it } from 'vitest'
import type { Chore } from '../../src/domain/chore'
import { derive } from '../../src/domain/schedule'
import { rowModel, type RowSelect, type RowState } from '../../src/ui/row-model'
import { TODAY, chore, d } from '../domain/helpers'

const resting: RowState = { expanded: false, justDone: false }
const model = (c: Chore, state: Partial<RowState> = {}) =>
  rowModel(c, derive(c, TODAY), TODAY, { ...resting, ...state })

const picking = (selected: boolean): RowSelect => ({ mode: 'on', selected, toggle: () => {} })

/** Every four weeks, done two weeks before Saturday 10 Oct, so due Saturday 24 Oct. */
const halfway = chore({ done: [d('2026-09-26')] })
/** Every four weeks, last done 2 Sep, so due Wednesday 30 Sep. */
const overdue = chore({ done: [d('2026-09-02')] })
/** Never done, with a skip on Thursday 8 Oct, so due Thursday 5 Nov. */
const skippedNeverDone = chore({ skipped: [d('2026-10-08')] })

describe('rowModel', () => {
  it('shows a chore that is on track', () => {
    expect(model(halfway)).toEqual({
      classes: ['cd-row'],
      open: false,
      check: { checked: false, tooltip: 'Done today' },
      meta: { every: 'every 4 weeks', last: '2 weeks ago', lastTooltip: 'Sat 26 Sep' },
      pill: { long: 'in 2 weeks', short: '2w', tone: 'none', tooltip: 'Due Sat 24 Oct' },
      bar: { tone: 'ok', fillPct: 50, faded: false },
      expandable: true,
      menu: true,
    })
  })

  describe('tones', () => {
    it.each<[string, Chore, string, string]>([
      ['overdue', overdue, 'bad', 'bad'],
      ['due today', chore({ done: [d('2026-09-12')] }), 'warn', 'warn'],
      ['due tomorrow', chore({ done: [d('2026-09-13')] }), 'ok', 'none'],
      ['never done and due', chore(), 'bad', 'bad'],
      ['never done but not due yet', skippedNeverDone, 'bad', 'none'],
      ['snoozed while overdue', { ...overdue, snoozedUntil: d('2026-10-14') }, 'bad', 'warn'],
      ['snoozed while on track', { ...halfway, snoozedUntil: d('2026-10-12') }, 'ok', 'warn'],
      ['snoozed and never done', chore({ snoozedUntil: d('2026-10-14') }), 'bad', 'warn'],
    ])('%s: bar is %s, pill is %s', (_, c, bar, pill) => {
      const m = model(c)
      expect(m.bar.tone).toBe(bar)
      expect(m.pill.tone).toBe(pill)
    })

    it('fades the bar only while snoozed', () => {
      expect(model({ ...overdue, snoozedUntil: d('2026-10-14') }).bar.faded).toBe(true)
      expect(model(overdue).bar.faded).toBe(false)
      expect(model({ ...overdue, snoozedUntil: d('2026-10-09') }).bar.faded).toBe(false)
    })
  })

  describe('bar fill', () => {
    it.each<[string, Chore, number]>([
      ['never done', chore(), 100],
      ['overdue', overdue, 100],
      ['done today', chore({ done: [TODAY] }), 0],
      ['done on a future date', chore({ done: [d('2026-10-12')] }), 0],
      ['a quarter through', chore({ done: [d('2026-10-03')] }), 25],
    ])('%s fills %s%%', (_, c, pct) => {
      expect(model(c).bar.fillPct).toBe(pct)
    })
  })

  describe('pill tooltip', () => {
    it('gives the due date', () => {
      expect(model(overdue).pill.tooltip).toBe('Due Wed 30 Sep')
    })

    it('adds the snooze date while snoozed', () => {
      expect(model({ ...overdue, snoozedUntil: d('2026-10-14') }).pill).toEqual({
        long: 'snoozed till Wed',
        short: 'zz Wed',
        tone: 'warn',
        tooltip: 'Due Wed 30 Sep, hidden until Wed 14 Oct',
      })
    })

    it('drops the snooze date once the snooze has passed', () => {
      expect(model({ ...overdue, snoozedUntil: d('2026-10-09') }).pill.tooltip).toBe(
        'Due Wed 30 Sep',
      )
    })

    it('gives a never-done chore its due date once it is in the future', () => {
      expect(model(skippedNeverDone).pill.tooltip).toBe('Due Thu 5 Nov')
    })

    it('leaves out a never-done chore that is due', () => {
      expect(model(chore()).pill).not.toHaveProperty('tooltip')
    })

    it('leaves out a never-done chore that is due, even while snoozed', () => {
      expect(model(chore({ snoozedUntil: d('2026-10-14') })).pill).toEqual({
        long: 'snoozed till Wed',
        short: 'zz Wed',
        tone: 'warn',
      })
    })
  })

  describe('meta and warnings', () => {
    it('has no last-done tooltip for a never-done chore', () => {
      expect(model(chore()).meta).toEqual({ every: 'every 4 weeks', last: 'never done' })
    })

    it('joins warnings one per line', () => {
      expect(model(chore({ warnings: ['Bad keep', 'Bad early'] })).warning).toBe(
        'Bad keep\nBad early',
      )
    })

    it('has no warning when there are none', () => {
      expect(model(halfway)).not.toHaveProperty('warning')
    })
  })

  describe('state', () => {
    it('opens when expanded or always open', () => {
      expect(model(halfway, { expanded: true })).toMatchObject({
        classes: ['cd-row', 'is-open'],
        open: true,
      })
      expect(model(halfway, { alwaysOpen: true })).toMatchObject({
        classes: ['cd-row', 'is-open'],
        open: true,
      })
    })

    it('shows a row ticked a moment ago as checked', () => {
      expect(model(halfway, { justDone: true })).toMatchObject({
        classes: ['cd-row', 'is-done-now'],
        check: { checked: true, tooltip: 'Done today' },
      })
    })

    it('selects instead of expanding or opening the menu while picking', () => {
      expect(model(halfway, { select: picking(true) })).toMatchObject({
        classes: ['cd-row', 'is-picking', 'is-selected'],
        check: { checked: true, tooltip: 'Select' },
        expandable: false,
        menu: false,
      })
    })

    it("hands a picking row its selection's toggle", () => {
      const toggle = (): void => {}
      expect(model(halfway, { select: { mode: 'on', selected: false, toggle } }).toggle).toBe(
        toggle,
      )
    })

    it('has no toggle while not picking', () => {
      expect(model(halfway, { select: { mode: 'off', start: () => {} } })).not.toHaveProperty(
        'toggle',
      )
    })

    it('checks a picking row by its selection, not its tick', () => {
      expect(model(halfway, { select: picking(false), justDone: true })).toMatchObject({
        classes: ['cd-row', 'is-done-now', 'is-picking'],
        check: { checked: false, tooltip: 'Select' },
      })
    })

    it('expands and opens the menu while not picking', () => {
      expect(model(halfway, { select: { mode: 'off', start: () => {} } })).toMatchObject({
        expandable: true,
        menu: true,
      })
    })

    it('keeps the menu on a row that does not expand', () => {
      expect(model(halfway, { expandable: false })).toMatchObject({
        expandable: false,
        menu: true,
      })
    })
  })
})
