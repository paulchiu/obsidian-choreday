import { App, Menu, MenuItem, Notice, setIcon, setTooltip } from 'obsidian'
import type { Chore } from '../domain/chore'
import { shortDate, type Day } from '../domain/day'
import { dueText, everyText, lastDoneText, summaryText } from '../domain/friendly'
import {
  derive,
  markDone,
  markSkipped,
  nextWeekend,
  removeEntry,
  scaledSnooze,
  snooze,
  type Derived,
} from '../domain/schedule'
import type { ChoreIndex } from '../vault/chore-index'
import { ChoreModal, DateModal } from './modals'
import { drawStrip } from './strip'

/** How long a ticked row stays in place, struck through, before it re-sorts. */
const SETTLE_MS = 1400

export interface RowContext {
  app: App
  index: ChoreIndex
  today: () => Day
  historyLimit: () => number
  editChore: (c: Chore, next: Chore) => Promise<void>
  createChore: (draft: Chore) => Promise<void>
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

  /** Disconnects strip resize observers from the previous render. */
  reset(): void {
    this.observers.forEach((o) => o.disconnect())
    this.observers = []
  }

  row(
    parent: HTMLElement,
    c: Chore,
    opts: { expandable?: boolean; alwaysOpen?: boolean } = {},
  ): HTMLElement {
    const today = this.ctx.today()
    const x = derive(c, today)
    const open = opts.alwaysOpen || this.expanded.has(c.path)
    const done = this.justDone.has(c.path)
    const row = parent.createDiv({
      cls: ['cd-row', open ? 'is-open' : '', done ? 'is-done-now' : ''].filter(Boolean),
    })

    const check = row.createDiv({
      cls: 'cd-check',
      attr: { role: 'checkbox', 'aria-checked': String(done), tabindex: '0' },
    })
    setTooltip(check, 'Done today')
    if (done) setIcon(check, 'check')
    check.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (!done) void this.done(c, today)
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

    if (opts.expandable !== false)
      row.addEventListener('click', () => {
        if (this.expanded.has(c.path)) this.expanded.delete(c.path)
        else this.expanded.add(c.path)
        this.rerender()
      })
    row.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      this.rowMenu(c).showAtMouseEvent(ev)
    })
    return row
  }

  private async done(c: Chore, on: Day): Promise<void> {
    const today = this.ctx.today()
    const before = derive(c, today)
    if (on === today) {
      this.justDone.set(c.path, before)
      this.rerender()
      window.setTimeout(() => {
        this.justDone.delete(c.path)
        this.rerender()
      }, SETTLE_MS)
    }
    const prev = await this.ctx.index.update(c.path, (ch) =>
      markDone(ch, on, this.ctx.historyLimit()),
    )
    this.toast(`${c.name} done ${on === today ? 'today' : shortDate(on)}`, prev)
  }

  private toast(msg: string, prev: Chore | undefined): void {
    const frag = createFragment((f) => {
      f.createSpan({ text: `${msg}  ` })
      if (!prev) return
      const undo = f.createEl('a', { text: 'Undo', cls: 'cd-undo', href: '#' })
      undo.addEventListener('click', (ev) => {
        ev.preventDefault()
        this.justDone.delete(prev.path)
        void this.ctx.index.restore(prev)
        notice.hide()
      })
    })
    const notice = new Notice(frag, 4000)
  }

  private rowMenu(c: Chore): Menu {
    const { app, index } = this.ctx
    const today = this.ctx.today()
    const limit = this.ctx.historyLimit()
    const menu = new Menu()
    menu.addItem((i) =>
      i
        .setTitle('Done today')
        .setIcon('check')
        .onClick(() => void this.done(c, today)),
    )
    menu.addItem((i) =>
      i
        .setTitle('Done yesterday')
        .setIcon('check')
        .onClick(() => void this.done(c, today - 1)),
    )
    menu.addItem((i) =>
      i
        .setTitle('Done on…')
        .setIcon('calendar')
        .onClick(() =>
          new DateModal(app, `${c.name}: done on`, today, (d) => void this.done(c, d)).open(),
        ),
    )
    menu.addSeparator()

    const scaled = scaledSnooze(c.every)
    const snoozes: [string, Day | undefined][] = [
      ['Tomorrow', today + 1],
      [scaled.label, today + scaled.days],
      ['Next weekend', nextWeekend(today)],
      ['Pick date…', undefined],
    ]
    const snoozeTo = async (d: Day): Promise<void> => {
      const prev = await index.update(c.path, (ch) => snooze(ch, d))
      this.toast(`${c.name} snoozed till ${shortDate(d)}`, prev)
    }
    const addSnoozes = (m: Menu): void =>
      snoozes.forEach(([label, d]) =>
        m.addItem((i) =>
          i
            .setTitle(d === undefined ? label : withDate(label, d))
            .onClick(() =>
              d === undefined
                ? new DateModal(
                    app,
                    `Snooze ${c.name} until`,
                    today + 7,
                    (p) => void snoozeTo(p),
                  ).open()
                : void snoozeTo(d),
            ),
        ),
      )

    if (hasSubmenu())
      menu.addItem((i) =>
        addSnoozes(
          (i as MenuItem & { setSubmenu: () => Menu })
            .setTitle('Snooze')
            .setIcon('alarm-clock')
            .setSubmenu(),
        ),
      )
    else {
      menu.addItem((i) => i.setTitle('Snooze').setIsLabel(true))
      addSnoozes(menu)
    }
    menu.addItem((i) =>
      i
        .setTitle('Skip this time')
        .setIcon('skip-forward')
        .onClick(async () => {
          const after = markSkipped(c, today, limit)
          const prev = await index.update(c.path, (ch) => markSkipped(ch, today, limit))
          this.toast(`${c.name} skipped · next due ${shortDate(derive(after, today).due)}`, prev)
        }),
    )
    menu.addSeparator()
    menu.addItem((i) =>
      i
        .setTitle('Edit…')
        .setIcon('pencil')
        .onClick(() =>
          new ChoreModal(app, c, today, (next) => void this.ctx.editChore(c, next)).open(),
        ),
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
        .onClick(async () => {
          const prev = await this.ctx.index.update(c.path, (ch) => removeEntry(ch, kind, d))
          this.toast(`Removed ${shortDate(d)} from ${c.name}`, prev)
        }),
    )
    menu.showAtMouseEvent(ev)
  }
}

/** Title with the resulting date right-aligned, as in the snooze submenu. */
function withDate(label: string, d: Day): DocumentFragment {
  return createFragment((f) => {
    f.createSpan({ text: label })
    f.createSpan({ cls: 'cd-menu-date', text: shortDate(d) })
  })
}

/** `MenuItem.setSubmenu` is undocumented (present since 1.4), so feature-detect it. */
function hasSubmenu(): boolean {
  return (
    typeof (MenuItem.prototype as MenuItem & { setSubmenu?: unknown }).setSubmenu === 'function'
  )
}
