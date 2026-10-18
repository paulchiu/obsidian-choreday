import { match, P } from 'ts-pattern'
import { datedTitleParts } from '../../domain/friendly'
import type { DatedTitle, MenuEntry } from '../model/row-menu'

/** The slice of Obsidian's `MenuItem` that `fillMenu` uses. */
export interface MenuItemLike {
  setTitle(title: string | DocumentFragment): this
  setIcon(icon: string): this
  setIsLabel(label: boolean): this
  setWarning(warning: boolean): this
  onClick(run: () => unknown): this
  /** Undocumented (present since 1.4), so `fillMenu` checks for it on each item. */
  setSubmenu?(): MenuLike
}

/** The slice of Obsidian's `Menu` that `fillMenu` uses. */
export interface MenuLike {
  addItem(cb: (item: MenuItemLike) => unknown): unknown
  addSeparator(): unknown
}

/**
 * Adds `entries` to `menu`. Where an item has no `setSubmenu`, a submenu becomes a label, without
 * its icon, followed by its items inline. Relies on `addItem` calling back at once, as Obsidian's does.
 */
export function fillMenu(menu: MenuLike, entries: readonly MenuEntry[]): void {
  for (const e of entries) {
    match(e)
      .with('separator', () => menu.addSeparator())
      .with({ label: true }, (e) => menu.addItem((i) => i.setTitle(e.title).setIsLabel(true)))
      .with({ submenu: P.array() }, (e) => {
        let nested = false
        menu.addItem((i) => {
          i.setTitle(e.title)
          if (i.setSubmenu) {
            i.setIcon(e.icon)
            fillMenu(i.setSubmenu(), e.submenu)
            nested = true
          } else i.setIsLabel(true)
        })
        if (!nested) fillMenu(menu, e.submenu)
      })
      .with({ run: P.any }, (e) =>
        menu.addItem((i) => {
          i.setTitle(typeof e.title === 'string' ? e.title : withDate(e.title)).onClick(e.run)
          if (e.icon !== undefined) i.setIcon(e.icon)
          if (e.warning) i.setWarning(true)
        }),
      )
      .exhaustive()
  }
}

function withDate({ text, date }: DatedTitle): DocumentFragment {
  const [option, sep, day] = datedTitleParts(text, date)
  return createFragment((f) => {
    const row = f.createSpan({ cls: 'cd-menu-dated' })
    row.createSpan({ text: option })
    row.createSpan({ cls: 'cd-menu-sep', text: sep })
    row.createSpan({ cls: 'cd-menu-date', text: day })
  })
}
