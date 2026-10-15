import { describe, expect, it } from 'vitest'
import {
  applyChoreEdits,
  choreEdits,
  newChoreEdits,
  restoreFacts,
} from '../../src/domain/chore-edits'
import { parseChore } from '../../src/domain/chore'
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
    const after = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [2], keep: 6 })
    expect(choreEdits(before, after)).toEqual({
      every: '1w',
      anchor: 'calendar',
      days: { inline: ['tuesday'] },
      day: null,
      keep: 6,
    })
    expect(choreEdits(after, before)).toEqual({
      every: '4w',
      anchor: 'done',
      days: null,
      day: null,
      keep: null,
    })
  })
})

describe('newChoreEdits', () => {
  it('writes only what a new chore needs', () => {
    expect(newChoreEdits(chore())).toEqual({ type: 'chore', every: '4w', done: [] })
    expect(
      newChoreEdits(chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [2] })),
    ).toEqual({
      type: 'chore',
      every: '1w',
      anchor: 'calendar',
      days: { inline: ['tuesday'] },
      done: [],
    })
  })
})

describe('applyChoreEdits on days', () => {
  const bins = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [4] })
  const note = (...lines: string[]) => ['---', ...lines, '---', ''].join('\n')

  it('writes days inline in place of day', () => {
    const text = note('type: chore', 'every: 1w', 'anchor: calendar', 'day: thursday', 'done: []')
    expect(applyChoreEdits(text, bins, { ...bins, days: [1, 3, 5] })).toBe(
      note(
        'type: chore',
        'every: 1w',
        'anchor: calendar',
        'days: [monday, wednesday, friday]',
        'done: []',
      ),
    )
  })

  it('keeps a block-style days list as a block', () => {
    const text = note('type: chore', 'days:', '  - thursday', 'done: []')
    expect(applyChoreEdits(text, bins, { ...bins, days: [0, 4] })).toBe(
      note('type: chore', 'days:', '  - sunday', '  - thursday', 'done: []'),
    )
  })

  it('places the schedule before the history when switching to set days', () => {
    const before = chore({ every: { n: 1, unit: 'w' } })
    const text = note('type: chore', 'every: 1w', 'done:', '  - 2026-10-01')
    const after = { ...before, anchor: 'calendar' as const, days: [2] }
    expect(applyChoreEdits(text, before, after)).toBe(
      note(
        'type: chore',
        'every: 1w',
        'anchor: calendar',
        'days: [tuesday]',
        'done:',
        '  - 2026-10-01',
      ),
    )
  })

  it('drops day and days when switching back to after last done', () => {
    const text = note('type: chore', 'anchor: calendar', 'day: thursday', 'done: []')
    const after = { ...bins, anchor: 'done' as const, days: undefined }
    expect(applyChoreEdits(text, bins, after)).toBe(note('type: chore', 'anchor: done', 'done: []'))
  })
})

describe('applyChoreEdits on early', () => {
  const note = (...lines: string[]) => ['---', ...lines, '---', ''].join('\n')
  const bike = chore({ every: { n: 1, unit: 'w' }, anchor: 'calendar', days: [1], early: false })

  it('keeps early through a tick', () => {
    const text = note('type: chore', 'early: false', 'done:', '  - 2026-10-01')
    const before = { ...bike, done: [d('2026-10-01')] }
    expect(applyChoreEdits(text, before, markDone(before, TODAY, 12))).toBe(
      note('type: chore', 'early: false', 'done:', '  - 2026-10-10', '  - 2026-10-01'),
    )
  })

  it('writes and removes early so Undo can restore it', () => {
    const { early: _, ...unset } = bike
    const text = note('type: chore', 'keep: 6', 'done: []')
    expect(applyChoreEdits(text, unset, bike)).toBe(
      note('type: chore', 'keep: 6', 'early: false', 'done: []'),
    )
    expect(applyChoreEdits(note('type: chore', 'early: false', 'done: []'), bike, unset)).toBe(
      note('type: chore', 'done: []'),
    )
  })
})

describe('applyChoreEdits with unreadable history', () => {
  const note = (...lines: string[]) => ['---', ...lines, '---', ''].join('\n')
  const tickToday = (fm: Record<string, unknown>, text: string): string => {
    const r = parseChore('Chores/Descale kettle.md', 'Descale kettle', fm)
    if (!r.ok) throw new Error('bad test chore')
    return applyChoreEdits(text, r.chore, markDone(r.chore, TODAY, 12))
  }

  it('quotes entries that would not read back as the same string', () => {
    const text = note('every: 1w', 'done:', '  - "*"', '  - "# moved in"', "  - 'true'")
    expect(tickToday({ every: '1w', done: ['*', '# moved in', 'true'] }, text)).toBe(
      note('every: 1w', 'done:', '  - 2026-10-10', '  - "*"', '  - "# moved in"', '  - "true"'),
    )
  })

  it('quotes an entry with a comma so a flow list keeps it as one item', () => {
    const text = note('every: 1w', 'done: ["a, b"]')
    expect(tickToday({ every: '1w', done: ['a, b'] }, text)).toBe(
      note('every: 1w', 'done: [2026-10-10, "a, b"]'),
    )
  })

  it('writes plain words and numbers back as they were', () => {
    const text = note('every: 1w', 'done: [last tuesday, 5]')
    expect(tickToday({ every: '1w', done: ['last tuesday', 5] }, text)).toBe(
      note('every: 1w', 'done: [2026-10-10, last tuesday, 5]'),
    )
  })
})

describe('restoreFacts', () => {
  it('brings back the stored facts and drops optional keys the earlier chore lacked', () => {
    const prev = chore({ done: [d('2026-10-01')] })
    const now = chore({
      done: [TODAY, d('2026-10-01')],
      early: false,
      keep: 3,
      snoozedUntil: TODAY,
    })
    const restored = restoreFacts(now, prev)
    expect(restored.done).toEqual([d('2026-10-01')])
    expect(restored.early).toBeUndefined()
    expect(restored.keep).toBeUndefined()
    expect(restored.snoozedUntil).toBeUndefined()
  })
})
