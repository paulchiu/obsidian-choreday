import { App, Menu, Notice, setIcon, setTooltip } from 'obsidian'
import type { Chore } from '../domain/chore'
import type { Day } from '../domain/day'
import { summaryText } from '../domain/friendly'
import { derive, type Derived } from '../domain/schedule'
import type { Change } from '../domain/undo-history'
import type { ChoreActions, Outcome } from '../vault/chore-actions'
import type { ChoreIndex } from '../vault/chore-index'
import { isMenuKey, pressable } from './keys'
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
import { rowModel, type RowSelect } from './row-model'
import { drawStrip } from './strip'

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

/** Row rendering and actions shared by the Chores view and the `choreday` code block. */
export class RowKit {
  /** Rows ticked a moment ago, with the state they had before, so they keep their place. */
  justDone = new Map<string, Derived>()
  expanded = new Set<string>()
  private observers: ResizeObserver[] = []

  constructor(
    private ctx: RowContext,
    private rerender: () => void,
  ) {}

  /** Lets rows that were undone while settling go back to normal at once. */
  settle(paths: readonly string[]): void {
    if (paths.filter((p) => this.justDone.delete(p)).length) this.rerender()
  }

  /** Disconnects strip resize observers from the previous render. */
  reset(): void {
    this.observers.forEach((o) => o.disconnect())
    this.observers = []
  }

  /** Draws a chore's row from `x`, its fresh derived state for `ctx.today()`. */
  row(
    parent: HTMLElement,
    c: Chore,
    x: Derived,
    opts: { expandable?: boolean; alwaysOpen?: boolean; select?: RowSelect } = {},
  ): HTMLElement {
    const today = this.ctx.today()
    const done = this.justDone.has(c.path)
    const m = rowModel(c, x, today, {
      ...opts,
      expanded: this.expanded.has(c.path),
      justDone: done,
    })
    const { toggle } = m
    const row = parent.createDiv({ cls: m.classes })

    const check = row.createDiv({
      cls: 'cd-check',
      attr: { role: 'checkbox', 'aria-checked': String(m.check.checked) },
    })
    pressable(check, `check:${c.path}`)
    setTooltip(check, m.check.tooltip)
    if (m.check.checked) setIcon(check, 'check')
    check.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (toggle) toggle()
      else if (!done) void this.tick(c)
    })

    const main = row.createDiv({ cls: 'cd-main' })
    main.createSpan({ cls: 'cd-name', text: c.name })
    if (m.warning !== undefined) {
      const warn = main.createSpan({ cls: 'cd-warn' })
      setIcon(warn, 'alert-triangle')
      setTooltip(warn, m.warning)
    }
    const meta = main.createSpan({ cls: 'cd-meta' })
    meta.createSpan({ cls: 'cd-every', text: m.meta.every })
    meta.createSpan({ cls: 'cd-sep', text: ' · ' })
    const last = meta.createSpan({ cls: 'cd-last', text: m.meta.last })
    if (m.meta.lastTooltip !== undefined) setTooltip(last, m.meta.lastTooltip, { placement: 'top' })

    const pill = row.createSpan({ cls: ['cd-pill', `is-${m.pill.tone}`] })
    pill.createSpan({ cls: 'cd-long', text: m.pill.long })
    pill.createSpan({ cls: 'cd-short', text: m.pill.short })
    setTooltip(pill, m.pill.tooltip)

    const fill = row.createDiv({ cls: 'cd-bar' }).createEl('i', { cls: `is-${m.bar.tone}` })
    fill.setCssProps({ '--cd-fill': `${m.bar.fillPct}%` })
    if (m.bar.faded) fill.addClass('is-faded')

    if (m.open) {
      const hist = row.createDiv({ cls: 'cd-hist' })
      const host = hist.createDiv({ cls: 'cd-strip-host' })
      hist.createEl('p', { cls: 'cd-summary', text: summaryText(c, x, today) })
      const draw = (): void =>
        drawStrip(host, c, x, today, (ev, kind, d) => this.dotMenu(ev, c, kind, d))
      const observer = new ResizeObserver(draw)
      observer.observe(host)
      this.observers.push(observer)
    }

    if (toggle) row.addEventListener('click', () => toggle())
    else if (m.expandable) {
      row.setAttrs({ role: 'button', 'aria-expanded': String(m.open) })
      pressable(row, `row:${c.path}`)
      row.addEventListener('click', () => {
        if (this.expanded.has(c.path)) this.expanded.delete(c.path)
        else this.expanded.add(c.path)
        this.rerender()
      })
    }
    row.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      if (m.menu) this.rowMenu(c, opts.select).showAtMouseEvent(ev)
    })
    row.addEventListener('keydown', (ev) => {
      if (!m.menu || !isMenuKey(ev)) return
      ev.preventDefault()
      const { left, bottom } = row.getBoundingClientRect()
      this.rowMenu(c, opts.select).showAtPosition({ x: left, y: bottom })
    })
    return row
  }

  /** Ticks `c` done on `on`, today by default; a tick today stays in place while it settles. */
  private async tick(c: Chore, on?: Day): Promise<void> {
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
    if (!outcome.ok) {
      new Notice(outcome.message)
      return
    }
    const { change } = outcome
    if (!change) {
      new Notice(outcome.label)
      return
    }
    const frag = createFragment((f) => {
      f.createSpan({ text: `${outcome.label}  ` })
      const undo = f.createEl('a', { text: 'Undo', cls: 'cd-undo', href: '#' })
      undo.addEventListener('click', (ev) => {
        ev.preventDefault()
        notice.hide()
        void undoChange(this.ctx.actions, change)
      })
    })
    const notice = new Notice(frag, 4000)
  }

  private rowMenu(c: Chore, select: RowSelect | undefined): Menu {
    const caps: RowMenuCaps = {
      ...this.snoozeCaps([c]),
      tick: (on?: Day) => void this.tick(c, on),
      skip: () => void this.skip([c]),
      edit: () => openChoreForm(this.ctx, c),
      open: () => void this.ctx.app.workspace.openLinkText(c.path, '', 'tab'),
    }
    return this.menu(rowMenuEntries(c, () => this.ctx.today(), caps, select))
  }

  private dotMenu(ev: MouseEvent, c: Chore, kind: 'done' | 'skip', d: Day): void {
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
