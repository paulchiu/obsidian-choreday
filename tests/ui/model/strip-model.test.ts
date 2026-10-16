import { describe, expect, it } from 'vitest'
import type { Chore } from '../../../src/domain/chore'
import { derive } from '../../../src/domain/schedule'
import { STRIP_PAD, stripModel, stripScale } from '../../../src/ui/model/strip-model'
import { TODAY, chore, d } from '../../domain/helpers'

/** Every four weeks, done Saturday 26 Sep, so due Saturday 24 Oct. */
const kettle = chore({ done: [d('2026-09-26')] })
/** Every four weeks, last done 2 Sep, so due Wednesday 30 Sep. */
const oven = chore({ name: 'Clean oven', done: [d('2026-09-02')] })
/** Mondays and Thursdays, with Monday 5 Oct missed and Thursday 1 Oct skipped. */
const bins = chore({
  name: 'Bins',
  every: { n: 1, unit: 'w' },
  schedule: { anchor: 'calendar', days: [1, 4] },
  done: [d('2026-10-08'), d('2026-09-28')],
  skipped: [d('2026-10-01')],
})
/** Every two months, so the strip spans about fourteen months. */
const filter = chore({ name: 'Change filter', every: { n: 2, unit: 'm' }, done: [d('2026-09-26')] })

const model = (c: Chore, width = 600) => stripModel(c, derive(c, TODAY), TODAY, width)
const scale = (c: Chore, width = 600) => stripScale(c, derive(c, TODAY), TODAY, width)

describe('stripScale', () => {
  it('looks six intervals back and a little past the due date', () => {
    const { start, end } = scale(kettle)
    expect(start).toBe(TODAY - 6 * 28 - 4)
    expect(end).toBeCloseTo(d('2026-10-24') + 28 * 0.6 + 1)
  })

  it('looks three weeks back for a chore on several days a week', () => {
    const three = chore({
      every: { n: 1, unit: 'w' },
      schedule: { anchor: 'calendar', days: [1, 3, 5] },
      done: [d('2026-10-09')],
    })
    const x = derive(three, TODAY)
    const { start, end } = stripScale(three, x, TODAY, 600)
    expect(start).toBe(TODAY - 21 - 2)
    expect(end).toBeCloseTo(Math.max(TODAY, x.due) + (7 / 3) * 0.6 + 1)
  })

  it('maps the window onto the width inside the padding', () => {
    const { start, end, px } = scale(kettle, 320)
    expect(px(start)).toBe(STRIP_PAD)
    expect(px(end)).toBeCloseTo(320 - STRIP_PAD)
  })
})

describe('stripModel', () => {
  it('names the strip after the chore', () => {
    expect(model(kettle)).toMatchObject({ width: 600, label: 'Descale kettle history' })
  })

  it('shades the late span and rings the due date as late only when overdue', () => {
    const { px } = scale(oven)
    expect(model(oven).late).toEqual({
      x: px(d('2026-09-30')),
      width: px(TODAY) - px(d('2026-09-30')),
    })
    expect(model(oven).marks.at(-1)).toEqual({ kind: 'due', x: px(d('2026-09-30')), late: true })
    expect(model(kettle).late).toBeUndefined()
    expect(model(kettle).marks.at(-1)).toMatchObject({ kind: 'due', late: false })
  })

  it('puts the today line at today', () => {
    expect(model(kettle).today).toBe(scale(kettle).px(TODAY))
  })

  it('ticks each interval back from the due date, leaving out the next one past the end', () => {
    const { px } = scale(kettle)
    expect(model(kettle).ticks).toEqual([1, 2, 3, 4, 5, 6].map((n) => px(d('2026-10-24') - 28 * n)))
  })

  it('ticks each calendar slot and the one following the due slot', () => {
    const x = derive(bins, TODAY)
    const { px } = stripScale(bins, x, TODAY, 600)
    const { ticks } = stripModel(bins, x, TODAY, 600)
    expect(x.following).toBeDefined()
    expect(ticks.at(-1)).toBe(px(x.following!))
    expect(ticks.slice(0, -1)).toEqual(x.slots.map((s) => px(s.slot)))
  })

  it('thins the month labels to seven on a wide strip, adding the year to January', () => {
    expect(model(filter).months.map((m) => m.label)).toEqual([
      'Nov',
      'Jan 2026',
      'Mar',
      'May',
      'Jul',
      'Sep',
      'Nov',
    ])
  })

  it('thins the month labels to four on a narrow strip', () => {
    expect(model(filter, 300).months.map((m) => m.label)).toEqual(['Nov', 'Mar', 'Jul', 'Nov'])
  })

  it('labels no month within 30px of the right edge', () => {
    for (const width of [300, 450, 600])
      for (const { x } of model(filter, width).months) expect(x).toBeLessThan(width - 30)
  })

  it('marks misses, then skips, then dones, then the due ring', () => {
    expect(model(bins).marks.map((m) => m.kind)).toEqual(['miss', 'skip', 'done', 'done', 'due'])
  })

  it('makes a miss a passive hit and a dot a clickable one', () => {
    const { px } = scale(bins)
    expect(model(bins).hits).toEqual([
      { x: px(d('2026-10-05')), tip: 'Missed Mon 5 Oct' },
      {
        x: px(d('2026-10-01')),
        tip: 'Skipped Thu 1 Oct',
        dot: { kind: 'skip', d: d('2026-10-01') },
      },
      { x: px(d('2026-10-08')), tip: 'Done Thu 8 Oct', dot: { kind: 'done', d: d('2026-10-08') } },
      {
        x: px(d('2026-09-28')),
        tip: 'Done Mon 28 Sep',
        dot: { kind: 'done', d: d('2026-09-28') },
      },
      { x: px(d('2026-10-12')), tip: 'Due Mon 12 Oct' },
    ])
  })

  it('drops dots from before the window', () => {
    const old = chore({ done: [d('2026-09-26'), d('2026-01-03')], skipped: [d('2026-02-07')] })
    expect(model(old).marks.map((m) => m.kind)).toEqual(['done', 'due'])
    expect(model(old).hits.map((h) => h.tip)).toEqual(['Done Sat 26 Sep', 'Due Sat 24 Oct'])
  })

  it('drops misses from before the window', () => {
    const lapsed = chore({ ...bins, done: [d('2026-09-03')], skipped: [] })
    const { start } = scale(lapsed)
    expect(derive(lapsed, TODAY).slots.some((s) => s.outcome === 'missed' && s.slot < start)).toBe(
      true,
    )
    expect(model(lapsed).hits.map((h) => h.tip)).toEqual([
      'Missed Thu 17 Sep',
      'Missed Mon 21 Sep',
      'Missed Thu 24 Sep',
      'Missed Mon 28 Sep',
      'Missed Thu 1 Oct',
      'Missed Mon 5 Oct',
      'Due Thu 8 Oct',
    ])
  })
})
