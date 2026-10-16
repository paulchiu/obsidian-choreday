import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MenuEntry } from '../../../src/ui/model/row-menu'
import { fillMenu, type MenuItemLike, type MenuLike } from '../../../src/ui/obsidian/menus'
import { d } from '../../domain/helpers'

/** Matches any function, for entries whose action is checked separately. */
const fn: unknown = expect.any(Function)

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
