import { describe, expect, it } from 'vitest'
import { parseTodayPicks, rankNeeds } from '../../src/domain/picks'
import { derive } from '../../src/domain/schedule'
import type { Chore } from '../../src/domain/chore'
import { TODAY, chore, d } from './helpers'

const row = (c: Chore) => ({ c, x: derive(c, TODAY) })
const names = (rows: readonly { c: Chore }[]): string[] => rows.map(({ c }) => c.name)

/** Needs doing on TODAY (10 Oct), in the view's urgency order. */
const kettle = row(
  chore({ name: 'Descale kettle', path: 'k', done: [d('2026-08-01'), d('2026-07-01')] }),
)
const sheets = row(
  chore({
    name: 'Change sheets',
    path: 's',
    every: { n: 1, unit: 'w' },
    done: [d('2026-09-30'), d('2026-09-28'), d('2026-09-26')],
  }),
)
const oven = row(chore({ name: 'Clean oven', path: 'o', every: { n: 1, unit: 'w' } }))
const plants = row(
  chore({ name: 'Water plants', path: 'p', every: { n: 3, unit: 'd' }, done: [d('2026-10-07')] }),
)
const needs = [oven, kettle, sheets, plants]

describe('rankNeeds', () => {
  it('keeps the Needs doing order for Most overdue', () => {
    expect(names(rankNeeds('overdue', needs, 0))).toEqual([
      'Clean oven',
      'Descale kettle',
      'Change sheets',
      'Water plants',
    ])
  })

  it('puts the newest last done first for Most recently done, never done last', () => {
    expect(names(rankNeeds('recent', needs, 0))).toEqual([
      'Water plants',
      'Change sheets',
      'Descale kettle',
      'Clean oven',
    ])
  })

  it('puts the shortest average gap first for Done most often, done under twice last', () => {
    expect(names(rankNeeds('often', needs, 0))).toEqual([
      'Change sheets',
      'Descale kettle',
      'Clean oven',
      'Water plants',
    ])
  })

  it('holds the same Surprise me order for the same seed', () => {
    expect(names(rankNeeds('surprise', needs, 20371))).toEqual(
      names(rankNeeds('surprise', needs, 20371)),
    )
  })

  it('reshuffles Surprise me when the seed changes, keeping every chore', () => {
    const orders = new Set(
      [1, 2, 3, 4, 5].map((seed) => names(rankNeeds('surprise', needs, seed)).join()),
    )
    expect(orders.size).toBeGreaterThan(1)
    for (const order of orders) expect(order.split(',').sort()).toEqual(names(needs).sort())
  })
})

describe('parseTodayPicks', () => {
  const picked = {
    day: 20758,
    kind: 'picked',
    rule: { strategy: 'surprise', count: 2 },
    seed: 20758003,
    paths: ['Chores/Clean oven.md', 'Chores/Change sheets.md'],
  }

  it('reads back saved picks', () => {
    expect(parseTodayPicks(JSON.parse(JSON.stringify(picked)))).toEqual(picked)
  })

  it('reads back Show all for a day', () => {
    expect(parseTodayPicks({ day: 20758, kind: 'all' })).toEqual({ day: 20758, kind: 'all' })
  })

  it.each([
    ['nothing saved', null],
    ['text', 'picked'],
    ['no day', { kind: 'all' }],
    ['a fractional day', { day: 20758.5, kind: 'all' }],
    ['an unknown kind', { day: 20758, kind: 'some' }],
    ['a bad rule', { ...picked, rule: { strategy: 'cleanest', count: 2 } }],
    ['no seed', { ...picked, seed: undefined }],
    ['paths that are not text', { ...picked, paths: ['Chores/Clean oven.md', 3] }],
    ['no paths', { ...picked, paths: undefined }],
  ])('ignores %s', (_, raw) => {
    expect(parseTodayPicks(raw)).toBeNull()
  })
})
