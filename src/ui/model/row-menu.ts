import type { Chore } from '../../domain/chore'
import { shortDate, type Day } from '../../domain/day'
import { manyText } from '../../domain/friendly'
import { snoozeOptions } from '../../domain/schedule'
import type { RowSelect } from './row-model'

/** A title drawn with its resulting date right-aligned, as in the snooze presets. */
export interface DatedTitle {
  text: string
  date: Day
}

/** One menu item as plain data, so a menu's contents can be built and tested without Obsidian. */
export type MenuEntry =
  | 'separator'
  | { title: string; label: true }
  | { title: string | DatedTitle; icon?: string; warning?: boolean; run: () => void }
  | { title: string; icon: string; submenu: readonly MenuEntry[] }

/** What the snooze presets can do, already bound to the chores they snooze. */
export interface SnoozeCaps {
  snoozeTo: (d: Day) => void
  pickDate: (title: string, initial: Day, chosen: (d: Day) => void) => void
}

/** What the row menu can do, already bound to its chore; `tick` with no date means today. */
export interface RowMenuCaps extends SnoozeCaps {
  tick: (on?: Day) => void
  skip: () => void
  edit: () => void
  open: () => void
}

/**
 * A row's right-click menu; Select shows only while the Chores view is not picking. The Done items
 * read `today` when clicked, the snooze presets when the menu opens.
 */
export function rowMenuEntries(
  c: Chore,
  today: () => Day,
  caps: RowMenuCaps,
  select: RowSelect | undefined,
): MenuEntry[] {
  return [
    { title: 'Done today', icon: 'check', run: () => caps.tick() },
    { title: 'Done yesterday', icon: 'check', run: () => caps.tick(today() - 1) },
    {
      title: 'Done on…',
      icon: 'calendar',
      run: () => caps.pickDate(`${c.name}: done on`, today(), (d) => caps.tick(d)),
    },
    'separator',
    { title: 'Snooze', icon: 'alarm-clock', submenu: snoozeEntries([c], today(), caps) },
    { title: 'Skip this time', icon: 'skip-forward', run: caps.skip },
    'separator',
    ...(select?.mode === 'off'
      ? [{ title: 'Select', icon: 'square-check', run: select.start }]
      : []),
    { title: 'Edit…', icon: 'pencil', run: caps.edit },
    { title: 'Open note', icon: 'file-text', run: caps.open },
  ]
}

/** The snooze presets for `chores`, each with its resulting date, then Pick date. */
export function snoozeEntries(chores: readonly Chore[], today: Day, caps: SnoozeCaps): MenuEntry[] {
  return [
    ...snoozeOptions(
      chores.map((c) => c.every),
      today,
    ).map(({ label, day }) => ({
      title: { text: label, date: day },
      run: () => caps.snoozeTo(day),
    })),
    {
      title: 'Pick date…',
      run: () => caps.pickDate(`Snooze ${whoText(chores, 'until')}`, today + 7, caps.snoozeTo),
    },
  ]
}

/** The menu for a done or skip dot in the history strip. */
export function dotMenuEntries(kind: 'done' | 'skip', d: Day, remove: () => void): MenuEntry[] {
  return [
    { title: `${kind === 'done' ? 'Done' : 'Skipped'} ${shortDate(d)}`, label: true },
    { title: 'Remove', icon: 'trash', warning: true, run: remove },
  ]
}

/** A chore's name, or a count when there are several, before what happened to them. */
function whoText(chores: readonly Chore[], what: string): string {
  const [only] = chores
  return only && chores.length === 1 ? `${only.name} ${what}` : manyText(chores.length, what)
}
