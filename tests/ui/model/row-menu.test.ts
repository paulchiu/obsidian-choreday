import { describe, expect, it, vi } from 'vitest'
import { shortDate, type Day } from '../../../src/domain/day'
import {
  dotMenuEntries,
  rowMenuEntries,
  snoozeEntries,
  type MenuEntry,
} from '../../../src/ui/model/row-menu'
import type { RowSelect } from '../../../src/ui/model/row-model'
import { TODAY, chore, d } from '../../domain/helpers'

/** Every four weeks, so the scaled snooze is one week. */
const kettle = chore()
/** Every two days, so the scaled snooze is two days. */
const plants = chore({
  path: 'Chores/Water plants.md',
  name: 'Water plants',
  every: { n: 2, unit: 'd' },
})

const caps = () => ({
  tick: vi.fn(),
  skip: vi.fn(),
  snoozeTo: vi.fn(),
  pickDate: vi.fn(),
  edit: vi.fn(),
  open: vi.fn(),
})

/** Matches any function, for entries whose action is checked separately. */
const fn: unknown = expect.any(Function)

const off = () => ({ mode: 'off' as const, start: vi.fn() })

/** An entry as one line, so a menu's order reads as a list. */
const line = (e: MenuEntry): string => {
  if (e === 'separator') return '---'
  if ('label' in e) return `[${e.title}]`
  if ('submenu' in e) return `${e.title} >`
  return typeof e.title === 'string' ? e.title : `${e.title.text} · ${shortDate(e.title.date)}`
}

/** Runs the action titled `title`, looking inside submenus too. */
const click = (entries: readonly MenuEntry[], title: string): void => {
  const flat = entries.flatMap((e) => (typeof e === 'object' && 'submenu' in e ? e.submenu : [e]))
  const found = flat.find(
    (e) =>
      typeof e === 'object' &&
      'run' in e &&
      (typeof e.title === 'string' ? e.title : e.title.text) === title,
  )
  if (typeof found !== 'object' || !('run' in found)) throw new Error(`no entry ${title}`)
  found.run()
}

describe('rowMenuEntries', () => {
  it('lists the row actions in menu order, with Select while not picking', () => {
    const entries = rowMenuEntries(kettle, () => TODAY, caps(), off())
    expect(entries.map(line)).toEqual([
      'Done today',
      'Done yesterday',
      'Done on…',
      '---',
      'Snooze >',
      'Skip this time',
      '---',
      'Select',
      'Edit…',
      'Open note',
    ])
  })

  it('leaves Select out while picking and in the code block', () => {
    const picking: RowSelect = { mode: 'on', selected: false, toggle: () => {} }
    const without = [
      'Done today',
      'Done yesterday',
      'Done on…',
      '---',
      'Snooze >',
      'Skip this time',
      '---',
      'Edit…',
      'Open note',
    ]
    expect(rowMenuEntries(kettle, () => TODAY, caps(), picking).map(line)).toEqual(without)
    expect(rowMenuEntries(kettle, () => TODAY, caps(), undefined).map(line)).toEqual(without)
  })

  it('gives each item its icon, and Snooze the presets for the one chore', () => {
    const entries = rowMenuEntries(kettle, () => TODAY, caps(), off())
    expect(entries).toEqual([
      { title: 'Done today', icon: 'check', run: fn },
      { title: 'Done yesterday', icon: 'check', run: fn },
      { title: 'Done on…', icon: 'calendar', run: fn },
      'separator',
      {
        title: 'Snooze',
        icon: 'alarm-clock',
        submenu: [
          { title: { text: 'Tomorrow', date: d('2026-10-11') }, run: fn },
          { title: { text: '1 week', date: d('2026-10-17') }, run: fn },
          { title: { text: 'Next weekend', date: d('2026-10-17') }, run: fn },
          { title: 'Pick date…', run: fn },
        ],
      },
      { title: 'Skip this time', icon: 'skip-forward', run: fn },
      'separator',
      { title: 'Select', icon: 'square-check', run: fn },
      { title: 'Edit…', icon: 'pencil', run: fn },
      { title: 'Open note', icon: 'file-text', run: fn },
    ])
  })

  it('wires each item to its capability', () => {
    const c = caps()
    const select = off()
    const entries = rowMenuEntries(kettle, () => TODAY, c, select)

    click(entries, 'Done today')
    expect(c.tick).toHaveBeenLastCalledWith()
    click(entries, 'Done yesterday')
    expect(c.tick).toHaveBeenLastCalledWith(d('2026-10-09'))
    click(entries, 'Skip this time')
    expect(c.skip).toHaveBeenCalledOnce()
    click(entries, 'Select')
    expect(select.start).toHaveBeenCalledOnce()
    click(entries, 'Edit…')
    expect(c.edit).toHaveBeenCalledOnce()
    click(entries, 'Open note')
    expect(c.open).toHaveBeenCalledOnce()
    click(entries, 'Next weekend')
    expect(c.snoozeTo).toHaveBeenLastCalledWith(d('2026-10-17'))
  })

  it('asks for a done date starting today, then ticks the chore on it', () => {
    const c = caps()
    click(
      rowMenuEntries(kettle, () => TODAY, c, off()),
      'Done on…',
    )
    expect(c.pickDate).toHaveBeenCalledWith('Descale kettle: done on', TODAY, fn)
    const chosen = c.pickDate.mock.calls[0]![2] as (day: Day) => void
    chosen(d('2026-10-05'))
    expect(c.tick).toHaveBeenLastCalledWith(d('2026-10-05'))
  })

  it('reads today when Done yesterday or Done on… is clicked, but dates the presets on opening', () => {
    let now = TODAY
    const c = caps()
    const entries = rowMenuEntries(kettle, () => now, c, off())
    now = d('2026-10-11')

    click(entries, 'Done yesterday')
    expect(c.tick).toHaveBeenLastCalledWith(d('2026-10-10'))
    click(entries, 'Done on…')
    expect(c.pickDate).toHaveBeenLastCalledWith('Descale kettle: done on', d('2026-10-11'), fn)
    click(entries, 'Tomorrow')
    expect(c.snoozeTo).toHaveBeenLastCalledWith(d('2026-10-11'))
  })
})

describe('snoozeEntries', () => {
  it('offers Pick date a week out, snoozing to the date picked', () => {
    const c = { snoozeTo: vi.fn(), pickDate: vi.fn() }
    click(snoozeEntries([kettle], TODAY, c), 'Pick date…')
    expect(c.pickDate).toHaveBeenCalledWith(
      'Snooze Descale kettle until',
      d('2026-10-17'),
      c.snoozeTo,
    )
  })

  it('drops the scaled preset and counts the chores when several do not share one', () => {
    const c = { snoozeTo: vi.fn(), pickDate: vi.fn() }
    const entries = snoozeEntries([kettle, plants], TODAY, c)
    expect(entries.map(line)).toEqual([
      'Tomorrow · Sun 11 Oct',
      'Next weekend · Sat 17 Oct',
      'Pick date…',
    ])
    click(entries, 'Pick date…')
    expect(c.pickDate).toHaveBeenCalledWith('Snooze 2 chores until', d('2026-10-17'), c.snoozeTo)
  })

  it('keeps the scaled preset when every chore shares it', () => {
    const twin = chore({ path: 'Chores/Clean oven.md', name: 'Clean oven' })
    expect(snoozeEntries([kettle, twin], TODAY, caps()).map(line)).toEqual([
      'Tomorrow · Sun 11 Oct',
      '1 week · Sat 17 Oct',
      'Next weekend · Sat 17 Oct',
      'Pick date…',
    ])
  })
})

describe('dotMenuEntries', () => {
  it('heads a done dot with its date, then offers Remove as a warning', () => {
    const remove = vi.fn()
    const entries = dotMenuEntries('done', d('2026-10-03'), remove)
    expect(entries).toEqual([
      { title: 'Done Sat 3 Oct', label: true },
      { title: 'Remove', icon: 'trash', warning: true, run: remove },
    ])
  })

  it('heads a skip dot as Skipped', () => {
    expect(dotMenuEntries('skip', d('2026-10-08'), () => {}).map(line)).toEqual([
      '[Skipped Thu 8 Oct]',
      'Remove',
    ])
  })
})
