import { App, Menu, Notice } from 'obsidian'
import { match, P } from 'ts-pattern'
import type { Chore } from '../domain/chore'
import type { Day } from '../domain/day'
import { derive, type Derived } from '../domain/schedule'
import type { Change } from '../domain/undo-history'
import type { ChoreActions, Outcome } from '../vault/chore-actions'
import type { ChoreIndex } from '../vault/chore-index'
import { ChoreModal, DateModal } from './modals'
import {
  dotMenuEntries,
  fillMenu,
  rowMenuEntries,
  snoozeEntries,
  type MenuEntry,
  type RowMenuCaps,
  type SnoozeCaps,
} from './row-menu'
import type { RowSelect } from './row-model'

/** How long a ticked row stays in place, struck through, before it re-sorts. */
const SETTLE_MS = 1400

export interface RowContext {
  app: App
  index: ChoreIndex
  actions: ChoreActions
  today: () => Day
  earlyTicks: () => boolean
}

/** Undoes `change`, or the newest one, and says what happened. */
export async function undoChange(actions: ChoreActions, change: Change | 'latest'): Promise<void> {
  new Notice((await actions.undo(change === 'latest' ? undefined : change)).message)
}

/** Opens the chore form to edit `original`, or to create a chore; it stays open when a save fails. */
export function openChoreForm(ctx: RowContext, original?: Chore): void {
  new ChoreModal(ctx.app, original, ctx.today(), ctx.earlyTicks(), async (draft) => {
    const saved = original
      ? await ctx.actions.edit(original, draft)
      : await ctx.actions.create(draft)
    if (saved.message) new Notice(saved.message)
    return saved.ok
  }).open()
}

/**
 * A row's actions and settle state, shared by the Chores view and the `choreday` code block:
 * ticking, skipping, snoozing, the row and dot menus, and which rows are open or settling.
 */
export class RowKit {
  /** Rows ticked a moment ago, with the state they had before, so they keep their place. */
  justDone = new Map<string, Derived>()
  expanded = new Set<string>()

  constructor(
    private ctx: RowContext,
    private rerender: () => void,
  ) {}

  /** Lets rows that were undone while settling go back to normal at once. */
  settle(paths: readonly string[]): void {
    if (paths.filter((p) => this.justDone.delete(p)).length) this.rerender()
  }

  /** Opens or closes the history of the row for `path`. */
  toggleExpanded(path: string): void {
    if (this.expanded.has(path)) this.expanded.delete(path)
    else this.expanded.add(path)
    this.rerender()
  }

  /** Ticks `c` done on `on`, today by default; a tick today stays in place while it settles. */
  async tick(c: Chore, on?: Day): Promise<void> {
    const today = this.ctx.today()
    if (on === undefined || on === today) {
      this.justDone.set(c.path, derive(c, today, this.ctx.earlyTicks()))
      this.rerender()
      window.setTimeout(() => this.settle([c.path]), SETTLE_MS)
    }
    const outcome = await this.ctx.actions.tick(c, on)
    if (!outcome.ok) this.settle([c.path])
    this.show(outcome)
  }

  /** Snoozes each chore until `d`, with one toast to undo them all. */
  async snooze(chores: readonly Chore[], d: Day): Promise<void> {
    this.show(await this.ctx.actions.snooze(chores, d))
  }

  /** Skips each chore this time, with one toast to undo them all. */
  async skip(chores: readonly Chore[]): Promise<void> {
    this.show(await this.ctx.actions.skip(chores))
  }

  /** A menu of the snooze presets for `chores`; `chosen` runs once a date is picked, before writing. */
  snoozeMenu(chores: readonly Chore[], chosen: () => void): Menu {
    return this.menu(snoozeEntries(chores, this.ctx.today(), this.snoozeCaps(chores, chosen)))
  }

  /** Says what happened, with an Undo link, or why nothing was written. */
  private show(outcome: Outcome): void {
    match(outcome)
      .with({ ok: false }, (o) => new Notice(o.message))
      .with({ ok: true, change: P.nonNullable }, (o) => this.undoToast(o.label, o.change))
      .with({ ok: true }, (o) => new Notice(o.label))
      .exhaustive()
  }

  /** Shows `label` with an Undo link that hides the toast and undoes `change`. */
  private undoToast(label: string, change: Change): void {
    const frag = createFragment((f) => {
      f.createSpan({ text: `${label}  ` })
      const undo = f.createEl('a', { text: 'Undo', cls: 'cd-undo', href: '#' })
      undo.addEventListener('click', (ev) => {
        ev.preventDefault()
        notice.hide()
        void undoChange(this.ctx.actions, change)
      })
    })
    const notice = new Notice(frag, 4000)
  }

  /** The row's context menu for `c`, with Select when `select` offers it. */
  rowMenu(c: Chore, select: RowSelect | undefined): Menu {
    const caps: RowMenuCaps = {
      ...this.snoozeCaps([c]),
      tick: (on?: Day) => void this.tick(c, on),
      skip: () => void this.skip([c]),
      edit: () => openChoreForm(this.ctx, c),
      open: () => void this.ctx.app.workspace.openLinkText(c.path, '', 'tab'),
    }
    return this.menu(rowMenuEntries(c, () => this.ctx.today(), caps, select))
  }

  /** Opens the menu of a history dot, which removes that entry. */
  dotMenu(ev: MouseEvent, c: Chore, kind: 'done' | 'skip', d: Day): void {
    ev.stopPropagation()
    const remove = (): void =>
      void this.ctx.actions.removeEntry(c, kind, d).then((outcome) => this.show(outcome))
    this.menu(dotMenuEntries(kind, d, remove)).showAtMouseEvent(ev)
  }

  private snoozeCaps(chores: readonly Chore[], chosen: () => void = () => {}): SnoozeCaps {
    return {
      snoozeTo: (d) => {
        chosen()
        void this.snooze(chores, d)
      },
      pickDate: (title, initial, picked) =>
        new DateModal(this.ctx.app, title, initial, picked).open(),
    }
  }

  private menu(entries: readonly MenuEntry[]): Menu {
    const menu = new Menu()
    fillMenu(menu, entries)
    return menu
  }
}
