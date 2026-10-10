import { describe, expect, it } from 'vitest'
import { choreEdits, newChoreEdits } from '../../src/domain/chore-edits'
import { markDone, markSkipped } from '../../src/domain/schedule'
import { TODAY, chore, d } from './helpers'

describe('choreEdits', () => {
  it('is empty when nothing changed', () => {
    expect(choreEdits(chore(), chore())).toEqual({})
  })

  it('writes the new done list and removes the snooze on done', () => {
    const before = chore({ done: [d('2026-09-02')], snoozedUntil: d('2026-10-17') })
    expect(choreEdits(before, markDone(before, TODAY, 12))).toEqual({
      done: ['2026-10-10', '2026-09-02'],
      snoozed_until: null,
    })
  })

  it('keeps unreadable entries at the end of the list', () => {
    const before = chore({ unreadable: { done: ['last tuesday'], skipped: [] } })
    expect(choreEdits(before, markDone(before, TODAY, 12)).done).toEqual([
      '2026-10-10',
      'last tuesday',
    ])
  })

  it('drops the skipped key once it is empty', () => {
    const before = markSkipped(chore(), TODAY, 12)
    expect(choreEdits(before, { ...before, skipped: [] })).toEqual({ skipped: null })
  })

  it('writes schedule changes as stored keys', () => {
    const before = chore()
    const after = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', day: 2, keep: 6 })
    expect(choreEdits(before, after)).toEqual({
      every: '1w',
      anchor: 'calendar',
      day: 'tuesday',
      keep: 6,
    })
    expect(choreEdits(after, before)).toEqual({
      every: '4w',
      anchor: 'done',
      day: null,
      keep: null,
    })
  })
})

describe('newChoreEdits', () => {
  it('writes only what a new chore needs', () => {
    expect(newChoreEdits(chore())).toEqual({ type: 'chore', every: '4w', done: [] })
    expect(
      newChoreEdits(chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', day: 2 })),
    ).toEqual({ type: 'chore', every: '1w', anchor: 'calendar', day: 'tuesday', done: [] })
  })
})
