import { afterEach, describe, expect, it, vi } from 'vitest'
import { shortDate, type Day } from '../../src/domain/day'
import {
  dotMenuEntries,
  fillMenu,
  rowMenuEntries,
  snoozeEntries,
  type MenuEntry,
  type MenuItemLike,
  type MenuLike,
} from '../../src/ui/row-menu'
import type { RowSelect } from '../../src/ui/row-model'
import { TODAY, chore, d } from '../domain/helpers'

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

/** A span `fillMenu` put in a fragment title. */
interface Span {
  cls?: string
  text: string
}

/** Stands in for Obsidian's global `createFragment`, keeping the spans it is given. */
const fakeFragment = (build: (f: { createSpan: (span: Span) => void }) => void): Span[] => {
  const spans: Span[] = []
  build({ createSpan: (span) => void spans.push(span) })
  return spans
}

/** What `fillMenu` set on an item, recorded so the tests run without Obsidian. */
interface Recorded {
  title?: string | Span[]
  icon?: string
  label?: boolean
  warning?: boolean
  click?: () => void
  submenu?: FakeMenu
}

/** An item from an Obsidian without `setSubmenu`. */
class FakeItem implements MenuItemLike {
  readonly seen: Recorded = {}
  setTitle(title: string | DocumentFragment): this {
    this.seen.title = typeof title === 'string' ? title : (title as unknown as Span[])
    return this
  }
  setIcon(icon: string): this {
    this.seen.icon = icon
    return this
  }
  setIsLabel(label: boolean): this {
    this.seen.label = label
    return this
  }
  setWarning(warning: boolean): this {
    this.seen.warning = warning
    return this
  }
  onClick(run: () => unknown): this {
    this.seen.click = () => void run()
    return this
  }
}

class NestingItem extends FakeItem {
  setSubmenu(): FakeMenu {
    this.seen.submenu = new FakeMenu(true)
    return this.seen.submenu
  }
}

class FakeMenu implements MenuLike {
  readonly items: (Recorded | '---')[] = []
  readonly #nesting: boolean
  constructor(nesting: boolean) {
    this.#nesting = nesting
  }
  addItem(cb: (item: MenuItemLike) => unknown): this {
    const item = this.#nesting ? new NestingItem() : new FakeItem()
    cb(item)
    this.items.push(item.seen)
    return this
  }
  addSeparator(): this {
    this.items.push('---')
    return this
  }
}

describe('fillMenu', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const run = vi.fn()
  const entries: MenuEntry[] = [
    { title: 'Heading', label: true },
    { title: 'Go', icon: 'check', run },
    'separator',
    {
      title: 'More',
      icon: 'alarm-clock',
      submenu: [
        { title: 'Inner one', run },
        { title: 'Inner two', run },
      ],
    },
    { title: 'Delete', icon: 'trash', warning: true, run },
  ]

  it('nests a submenu under an item with its icon when items have setSubmenu', () => {
    const menu = new FakeMenu(true)
    fillMenu(menu, entries)
    expect(menu.items).toEqual([
      { title: 'Heading', label: true },
      { title: 'Go', icon: 'check', click: fn },
      '---',
      {
        title: 'More',
        icon: 'alarm-clock',
        submenu: {
          items: [
            { title: 'Inner one', click: fn },
            { title: 'Inner two', click: fn },
          ],
        },
      },
      { title: 'Delete', icon: 'trash', warning: true, click: fn },
    ])
  })

  it('falls back to a label, without the icon, and the items inline', () => {
    const menu = new FakeMenu(false)
    fillMenu(menu, entries)
    expect(menu.items).toEqual([
      { title: 'Heading', label: true },
      { title: 'Go', icon: 'check', click: fn },
      '---',
      { title: 'More', label: true },
      { title: 'Inner one', click: fn },
      { title: 'Inner two', click: fn },
      { title: 'Delete', icon: 'trash', warning: true, click: fn },
    ])
  })

  it('draws a dated title as the option, a separator and the short date', () => {
    vi.stubGlobal('createFragment', fakeFragment)
    const menu = new FakeMenu(false)
    fillMenu(menu, [{ title: { text: 'Next weekend', date: d('2026-10-17') }, run }])
    expect(menu.items).toEqual([
      {
        title: [
          { text: 'Next weekend' },
          { cls: 'cd-menu-sep', text: ' · ' },
          { cls: 'cd-menu-date', text: 'Sat 17 Oct' },
        ],
        click: fn,
      },
    ])
  })

  it('runs the entry when its item is clicked', () => {
    const menu = new FakeMenu(false)
    const go = vi.fn()
    fillMenu(menu, [{ title: 'Go', run: go }])
    const [item] = menu.items
    if (item === '---' || !item?.click) throw new Error('expected an item')
    item.click()
    expect(go).toHaveBeenCalledOnce()
  })
})
