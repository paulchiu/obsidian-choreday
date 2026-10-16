import { App, Menu, Notice } from 'obsidian'
import { match, P } from 'ts-pattern'
import type { Chore } from '../../domain/chore'
import type { Day } from '../../domain/day'
import { derive } from '../../domain/schedule'
import type { Change } from '../../domain/undo-history'
import type { ChoreActions, Outcome } from '../../vault/chore-actions'
import type { ChoreIndex } from '../../vault/chore-index'
import type { MenuAnchor, RowActions } from '../components/row'
import {
  dotMenuEntries,
  rowMenuEntries,
  snoozeEntries,
  type MenuEntry,
  type RowMenuCaps,
  type SnoozeCaps,
} from '../model/row-menu'
import type { RowSelect } from '../model/row-model'
import * as rules from '../model/settle'
import { fillMenu } from './menus'
import { ChoreModal, DateModal } from './modals'

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
 * Shows `menu` at `at`, telling an event by shape, since one from a popout is not an instance of
 * this window's `MouseEvent`.
 */
function showAt(menu: Menu, at: MenuAnchor): void {
  if ('clientX' in at) menu.showAtMouseEvent(at)
  else menu.showAtPosition(at)
}

/** Says what happened, with an Undo link, or why nothing was written. */
function show(actions: ChoreActions, outcome: Outcome): void {
  match(outcome)
    .with({ ok: false }, (o) => new Notice(o.message))
    .with({ ok: true, change: P.nonNullable }, (o) => undoToast(actions, o.label, o.change))
    .with({ ok: true }, (o) => new Notice(o.label))
    .exhaustive()
}

/** Shows `label` with an Undo link that hides the toast and undoes `change`. */
function undoToast(actions: ChoreActions, label: string, change: Change): void {
  const frag = createFragment((f) => {
    f.createSpan({ text: `${label}  ` })
    const undo = f.createEl('a', { text: 'Undo', cls: 'cd-undo', href: '#' })
    undo.addEventListener('click', (ev) => {
      ev.preventDefault()
      notice.hide()
      void undoChange(actions, change)
    })
  })
  const notice = new Notice(frag, 4000)
}

function menu(entries: readonly MenuEntry[]): Menu {
  const m = new Menu()
  fillMenu(m, entries)
  return m
}

export type RowKit = ReturnType<typeof createRowKit>

/**
 * A row's actions and settle state, shared by the Chores view and the `choreday` code block:
 * ticking, skipping, snoozing, the row and dot menus, and which rows are open or settling. Created
 * once per mount; `rerender` runs whenever the settle state changes.
 */
export function createRowKit(ctx: RowContext, rerender: () => void) {
  let state = rules.EMPTY_SETTLING
  const update = (next: rules.Settling): void => {
    if (next === state) return
    state = next
    rerender()
  }
  const report = (outcome: Outcome): void => show(ctx.actions, outcome)

  const snoozeCaps = (chores: readonly Chore[], chosen: () => void = () => {}): SnoozeCaps => ({
    snoozeTo: (d) => {
      chosen()
      void kit.snooze(chores, d)
    },
    pickDate: (title, initial, picked) => new DateModal(ctx.app, title, initial, picked).open(),
  })

  const kit = {
    /** The settle state as it stands. */
    state: (): rules.Settling => state,

    /** The paths of the rows ticked a moment ago and still settling. */
    settling: (): ReadonlySet<string> => new Set(state.justDone.keys()),

    /** Lets settling rows go back to normal at once. */
    settle(paths: readonly string[]): void {
      update(rules.settle(state, paths))
    },

    /**
     * Holds settling rows whose tick was undone until the index drops the tick, so they keep their
     * node and focus.
     */
    settleUndone(paths: readonly string[]): void {
      update(rules.holdUndone(state, paths))
    },

    /** Releases undone rows whose tick has left the index; call before each draw, so it never redraws. */
    releaseUndone(): void {
      const today = ctx.today()
      state = rules.releaseUndone(state, (p) => ctx.index.get(p)?.done.includes(today) ?? false)
    },

    /** Opens or closes the history of the row for `path`. */
    toggleExpanded(path: string): void {
      update(rules.toggleExpanded(state, path))
    },

    /** Ticks `c` done on `on`, today by default; a tick today stays in place while it settles. */
    async tick(c: Chore, on?: Day): Promise<void> {
      const today = ctx.today()
      if (on === undefined || on === today) {
        update(rules.startSettle(state, c.path, derive(c, today, ctx.earlyTicks())))
        window.setTimeout(() => kit.settle([c.path]), SETTLE_MS)
      }
      const outcome = await ctx.actions.tick(c, on)
      if (!outcome.ok) kit.settle([c.path])
      report(outcome)
    },

    /** Snoozes each chore until `d`, with one toast to undo them all. */
    async snooze(chores: readonly Chore[], d: Day): Promise<void> {
      report(await ctx.actions.snooze(chores, d))
    },

    /** Skips each chore this time, with one toast to undo them all. */
    async skip(chores: readonly Chore[]): Promise<void> {
      report(await ctx.actions.skip(chores))
    },

    /** A menu of the snooze presets for `chores`; `chosen` runs once a date is picked, before writing. */
    snoozeMenu(chores: readonly Chore[], chosen: () => void): Menu {
      return menu(snoozeEntries(chores, ctx.today(), snoozeCaps(chores, chosen)))
    },

    /** Opens the row's context menu for `c` at `at`, with Select when `select` offers it. */
    rowMenu(c: Chore, select: RowSelect | undefined, at: MenuAnchor): void {
      const caps: RowMenuCaps = {
        ...snoozeCaps([c]),
        tick: (on?: Day) => void kit.tick(c, on),
        skip: () => void kit.skip([c]),
        edit: () => openChoreForm(ctx, c),
        open: () => void ctx.app.workspace.openLinkText(c.path, '', 'tab'),
      }
      showAt(menu(rowMenuEntries(c, () => ctx.today(), caps, select)), at)
    },

    /** Opens the menu of the history dot for `d` at `at`, which removes that entry. */
    dotMenu(c: Chore, kind: 'done' | 'skip', d: Day, at: MenuAnchor): void {
      const remove = (): void => void ctx.actions.removeEntry(c, kind, d).then(report)
      showAt(menu(dotMenuEntries(kind, d, remove)), at)
    },
  }
  return kit satisfies RowActions
}
