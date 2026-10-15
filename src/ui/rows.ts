import { App, Menu, MenuItem, Notice, setIcon, setTooltip } from 'obsidian'
import type { Chore } from '../domain/chore'
import { shortDate, type Day } from '../domain/day'
import {
  datedTitleParts,
  dueText,
  everyText,
  lastDoneText,
  manyText,
  summaryText,
} from '../domain/friendly'
import { derive, snoozeOptions, type Derived } from '../domain/schedule'
import type { Change } from '../domain/undo-history'
import type { ChoreActions, Outcome } from '../vault/chore-actions'
import type { ChoreIndex } from '../vault/chore-index'
import { isMenuKey, pressable } from './keys'
import { ChoreModal, DateModal } from './modals'
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

/** Undoes `change`, the newest by default, and says what happened. */
export async function undoChange(actions: ChoreActions, change?: Change): Promise<void> {
  new Notice((await actions.undo(change)).message)
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

/** How a Chores view row takes part in picking several chores; the code block leaves it out. */
export type RowSelect =
  { mode: 'off'; start: () => void } | { mode: 'on'; selected: boolean; toggle: () => void }

/** A chore's name, or a count when there are several, before what happened to them. */
const whoText = (chores: readonly Chore[], what: string): string =>
  chores.length === 1 ? `${chores[0]!.name} ${what}` : manyText(chores.length, what)

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

  row(
    parent: HTMLElement,
    c: Chore,
    opts: { expandable?: boolean; alwaysOpen?: boolean; select?: RowSelect } = {},
  ): HTMLElement {
    const today = this.ctx.today()
    const x = derive(c, today, this.ctx.earlyTicks())
    const open = opts.alwaysOpen || this.expanded.has(c.path)
    const done = this.justDone.has(c.path)
    const picking = opts.select?.mode === 'on' ? opts.select : undefined
    const row = parent.createDiv({
      cls: [
        'cd-row',
        open ? 'is-open' : '',
        done ? 'is-done-now' : '',
        picking ? 'is-picking' : '',
        picking?.selected ? 'is-selected' : '',
      ].filter(Boolean),
    })

    const checked = picking ? picking.selected : done
    const check = row.createDiv({
      cls: 'cd-check',
      attr: { role: 'checkbox', 'aria-checked': String(checked) },
    })
    pressable(check, `check:${c.path}`)
    setTooltip(check, picking ? 'Select' : 'Done today')
    if (checked) setIcon(check, 'check')
    check.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (picking) picking.toggle()
      else if (!done) void this.tick(c)
    })

    const main = row.createDiv({ cls: 'cd-main' })
    main.createSpan({ cls: 'cd-name', text: c.name })
    if (c.warnings.length) {
      const warn = main.createSpan({ cls: 'cd-warn' })
      setIcon(warn, 'alert-triangle')
      setTooltip(warn, c.warnings.join('\n'))
    }
    const meta = main.createSpan({ cls: 'cd-meta' })
    meta.createSpan({ cls: 'cd-every', text: everyText(c) })
    meta.createSpan({ cls: 'cd-sep', text: ' · ' })
    const last = meta.createSpan({ cls: 'cd-last', text: lastDoneText(x.lastDone, today) })
    if (x.lastDone !== undefined) setTooltip(last, shortDate(x.lastDone), { placement: 'top' })

    const due = dueText(c, x, today)
    const pill = row.createSpan({ cls: ['cd-pill', `is-${due.tone}`] })
    pill.createSpan({ cls: 'cd-long', text: due.long })
    pill.createSpan({ cls: 'cd-short', text: due.short })
    if (!x.neverDone || x.due > today)
      setTooltip(
        pill,
        x.snoozed && c.snoozedUntil !== undefined
          ? `Due ${shortDate(x.due)}, hidden until ${shortDate(c.snoozedUntil)}`
          : `Due ${shortDate(x.due)}`,
      )

    const bar = row.createDiv({ cls: 'cd-bar' })
    const tone = x.due < today || x.neverDone ? 'bad' : x.due === today ? 'warn' : 'ok'
    const fill = bar.createEl('i', { cls: `is-${tone}` })
    fill.setCssProps({ '--cd-fill': `${Math.max(0, Math.min(1, x.ratio)) * 100}%` })
    if (x.snoozed) fill.addClass('is-faded')

    if (open) {
      const hist = row.createDiv({ cls: 'cd-hist' })
      const host = hist.createDiv({ cls: 'cd-strip-host' })
      hist.createEl('p', { cls: 'cd-summary', text: summaryText(c, x, today) })
      const draw = (): void =>
        drawStrip(host, c, x, today, (ev, kind, d) => this.dotMenu(ev, c, kind, d))
      const observer = new ResizeObserver(draw)
      observer.observe(host)
      this.observers.push(observer)
    }

    if (picking) row.addEventListener('click', () => picking.toggle())
    else if (opts.expandable !== false) {
      row.setAttrs({ role: 'button', 'aria-expanded': String(open) })
      pressable(row, `row:${c.path}`)
      row.addEventListener('click', () => {
        if (this.expanded.has(c.path)) this.expanded.delete(c.path)
        else this.expanded.add(c.path)
        this.rerender()
      })
    }
    row.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      if (!picking) this.rowMenu(c, opts.select).showAtMouseEvent(ev)
    })
    row.addEventListener('keydown', (ev) => {
      if (picking || !isMenuKey(ev)) return
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

  /**
   * Adds the snooze presets for `chores`, each with its resulting date, and Pick date. `chosen` runs
   * once a date is picked, before the notes are written.
   */
  addSnoozes(m: Menu, chores: readonly Chore[], chosen: () => void = () => {}): void {
    const today = this.ctx.today()
    const to = (d: Day): void => {
      chosen()
      void this.snooze(chores, d)
    }
    snoozeOptions(
      chores.map((c) => c.every),
      today,
    ).forEach(({ label, day }) =>
      m.addItem((i) => i.setTitle(withDate(label, day)).onClick(() => to(day))),
    )
    m.addItem((i) =>
      i
        .setTitle('Pick date…')
        .onClick(() =>
          new DateModal(this.ctx.app, `Snooze ${whoText(chores, 'until')}`, today + 7, to).open(),
        ),
    )
  }

  /** Says what happened, with an Undo link, or why nothing was written. */
  private show(outcome: Outcome): void {
    if (!outcome.ok) {
      new Notice(outcome.message)
      return
    }
    const frag = createFragment((f) => {
      f.createSpan({ text: `${outcome.label}  ` })
      const undo = f.createEl('a', { text: 'Undo', cls: 'cd-undo', href: '#' })
      undo.addEventListener('click', (ev) => {
        ev.preventDefault()
        notice.hide()
        void undoChange(this.ctx.actions, outcome.change)
      })
    })
    const notice = new Notice(frag, 4000)
  }

  private rowMenu(c: Chore, select: RowSelect | undefined): Menu {
    const { app } = this.ctx
    const menu = new Menu()
    menu.addItem((i) =>
      i
        .setTitle('Done today')
        .setIcon('check')
        .onClick(() => void this.tick(c)),
    )
    menu.addItem((i) =>
      i
        .setTitle('Done yesterday')
        .setIcon('check')
        .onClick(() => void this.tick(c, this.ctx.today() - 1)),
    )
    menu.addItem((i) =>
      i
        .setTitle('Done on…')
        .setIcon('calendar')
        .onClick(() =>
          new DateModal(
            app,
            `${c.name}: done on`,
            this.ctx.today(),
            (d) => void this.tick(c, d),
          ).open(),
        ),
    )
    menu.addSeparator()

    if (hasSubmenu())
      menu.addItem((i) =>
        this.addSnoozes(
          (i as MenuItem & { setSubmenu: () => Menu })
            .setTitle('Snooze')
            .setIcon('alarm-clock')
            .setSubmenu(),
          [c],
        ),
      )
    else {
      menu.addItem((i) => i.setTitle('Snooze').setIsLabel(true))
      this.addSnoozes(menu, [c])
    }
    menu.addItem((i) =>
      i
        .setTitle('Skip this time')
        .setIcon('skip-forward')
        .onClick(() => void this.skip([c])),
    )
    menu.addSeparator()
    if (select?.mode === 'off')
      menu.addItem((i) => i.setTitle('Select').setIcon('square-check').onClick(select.start))
    menu.addItem((i) =>
      i
        .setTitle('Edit…')
        .setIcon('pencil')
        .onClick(() => openChoreForm(this.ctx, c)),
    )
    menu.addItem((i) =>
      i
        .setTitle('Open note')
        .setIcon('file-text')
        .onClick(() => void app.workspace.openLinkText(c.path, '', 'tab')),
    )
    return menu
  }

  private dotMenu(ev: MouseEvent, c: Chore, kind: 'done' | 'skip', d: Day): void {
    ev.stopPropagation()
    const menu = new Menu()
    menu.addItem((i) =>
      i.setTitle(`${kind === 'done' ? 'Done' : 'Skipped'} ${shortDate(d)}`).setIsLabel(true),
    )
    menu.addItem((i) =>
      i
        .setTitle('Remove')
        .setIcon('trash')
        .setWarning(true)
        .onClick(async () => this.show(await this.ctx.actions.removeEntry(c, kind, d))),
    )
    menu.showAtMouseEvent(ev)
  }
}

/** Title with the resulting date right-aligned, as in the snooze submenu. */
function withDate(label: string, d: Day): DocumentFragment {
  const [option, sep, date] = datedTitleParts(label, d)
  return createFragment((f) => {
    f.createSpan({ text: option })
    f.createSpan({ cls: 'cd-menu-sep', text: sep })
    f.createSpan({ cls: 'cd-menu-date', text: date })
  })
}

/** `MenuItem.setSubmenu` is undocumented (present since 1.4), so feature-detect it. */
function hasSubmenu(): boolean {
  return (
    typeof (MenuItem.prototype as MenuItem & { setSubmenu?: unknown }).setSubmenu === 'function'
  )
}
