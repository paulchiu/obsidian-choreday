import { ItemView, Menu, Scope, WorkspaceLeaf, setIcon, setTooltip } from 'obsidian'
import { cheerStep, type CheerState } from '../domain/cheer'
import type { Chore } from '../domain/chore'
import { shortDate } from '../domain/day'
import { dueText } from '../domain/friendly'
import { derive, sortGroup, type Group } from '../domain/schedule'
import { allSelected, toggleGroup, toggleSelected, type ChoreSelection } from '../domain/selection'
import { drawArt, MASCOT_ICON } from './mascot'
import { CHEERING, CLIPBOARD, CONFETTI, PUZZLED, SLEEPING } from './mascot-art'
import { ChoreModal } from './modals'
import { RowKit, undoLast, type RowContext, type RowSelect } from './rows'

export const VIEW_TYPE = 'choreday-view'

/** How long the cheering cat shows before it settles down to sleep. */
const CHEER_MS = 1500

/** The due list: Needs doing by urgency, Coming up by date, Later collapsed. */
export class ChoresView extends ItemView {
  private kit: RowKit
  private showLater = false
  /** Chores picked to snooze or skip together; null when not selecting. */
  private selected: ChoreSelection | null = null
  private cheer: CheerState = { armed: false, play: false }
  private cheering = false

  constructor(
    leaf: WorkspaceLeaf,
    private ctx: RowContext,
  ) {
    super(leaf)
    this.kit = new RowKit(ctx, () => this.render())
    this.scope = new Scope(this.app.scope)
    this.scope.register(['Mod'], 'z', () => {
      void undoLast(ctx)
      return false
    })
  }

  getViewType(): string {
    return VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Chores'
  }

  getIcon(): string {
    return MASCOT_ICON
  }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source)
    const change = this.ctx.lastChange()
    if (change && source === 'more-options')
      menu.addItem((i) =>
        i
          .setTitle(`Undo: ${change.label}`)
          .setIcon('undo-2')
          .onClick(() => void undoLast(this.ctx)),
      )
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass('cd-root')
    this.register(this.ctx.index.subscribe(() => this.render()))
    this.render()
  }

  async onClose(): Promise<void> {
    this.kit.reset()
  }

  /** Rebuilds the list, keeping the scroll position: iOS resets it when the view is emptied. */
  render(): void {
    const top = this.contentEl.scrollTop
    this.rebuildList()
    this.contentEl.scrollTop = top
  }

  private rebuildList(): void {
    const today = this.ctx.today()
    const root = this.contentEl
    this.kit.reset()
    root.empty()

    const chores = this.ctx.index.all()
    const broken = this.ctx.index.problems()
    const selected = this.selected

    const top = root.createDiv({ cls: 'cd-top' })
    const title = top.createDiv({ cls: 'cd-title' })
    const actions = top.createDiv({ cls: 'cd-actions' })
    if (selected) {
      const picked = chores.filter((c) => selected.has(c.path))
      title.createEl('h4', { text: `${picked.length} selected` })
      this.selectionActions(actions, picked)
    } else {
      title.createEl('h4', { text: 'Chores' })
      title.createSpan({ cls: 'cd-today-label', text: shortDate(today) })
      if (chores.length)
        button(actions, 'square-check', 'Select', 'Select', () => this.select(new Set()))
      button(actions, 'plus', 'New chore', 'New', () =>
        new ChoreModal(
          this.app,
          undefined,
          today,
          this.ctx.earlyTicks(),
          (c) => void this.ctx.createChore(c),
        ).open(),
      )
    }

    if (!chores.length && !broken.length) {
      scene(
        root,
        CLIPBOARD,
        'is-first-run',
        'No chores yet. Add one with New chore, or give a note in your chores folder type: chore and every: 2w.',
      )
      return
    }

    /** Rows ticked a moment ago keep their old place until the strike-through settles. */
    const rows = chores.map((c) => ({
      c,
      x: this.kit.justDone.get(c.path) ?? derive(c, today, this.ctx.earlyTicks()),
    }))
    const group = (g: Group): typeof rows =>
      sortGroup(
        g,
        rows.filter((r) => r.x.group === g),
      )
    const needs = group('needs')
    const coming = group('coming')
    const later = group('later')

    const showRows = (list: typeof rows): void =>
      list.forEach(({ c }) => this.kit.row(root, c, { select: this.rowSelect(c) }))
    const section = (label: string, list: typeof rows): void => {
      if (!list.length) return
      const heading = root.createDiv({ cls: 'cd-group' })
      heading.createSpan({ text: `${label} · ${list.length}` })
      this.groupToggle(
        heading,
        list.map(({ c }) => c.path),
      )
      showRows(list)
    }
    this.stepCheer(needs.map(({ c }) => this.kit.justDone.has(c.path)))
    section('Needs doing', needs)
    if (!needs.length) this.caughtUp(root)
    section('Coming up', coming)

    if (later.length) {
      const toggle = root.createDiv({ cls: 'cd-later' })
      setIcon(
        toggle.createSpan({ cls: 'cd-later-icon' }),
        this.showLater ? 'chevron-down' : 'chevron-right',
      )
      const names = later.map(({ c, x }) => `${c.name}, ${dueText(c, x, today).long}`).join('; ')
      toggle.createSpan({ text: `Later · ${later.length}` })
      if (!this.showLater) toggle.createSpan({ cls: 'cd-later-names', text: ` (${names})` })
      toggle.addEventListener('click', () => {
        this.showLater = !this.showLater
        this.render()
      })
      if (this.showLater) {
        this.groupToggle(
          toggle,
          later.map(({ c }) => c.path),
        )
        showRows(later)
      }
    }

    if (broken.length) {
      const heading = root.createDiv({ cls: 'cd-group cd-fixing' })
      drawArt(heading.createSpan({ cls: 'cd-art is-puzzled' }), PUZZLED)
      heading.createSpan({ text: `Needs fixing · ${broken.length}` })
      for (const b of broken) {
        const row = root.createDiv({ cls: 'cd-broken' })
        setIcon(row.createSpan({ cls: 'cd-warn' }), 'alert-triangle')
        row.createSpan({ cls: 'cd-name', text: b.name })
        row.createSpan({ cls: 'cd-meta', text: b.problems.join('; ') })
        row.addEventListener('click', () => void this.app.workspace.openLinkText(b.path, '', 'tab'))
      }
    }
  }

  private caughtUp(root: HTMLElement): void {
    if (!this.cheering) {
      scene(root, SLEEPING, 'is-caught-up', 'Nothing needs doing.')
      return
    }
    drawArt(scene(root, CHEERING, 'is-cheering', 'All done for today.'), CONFETTI)
  }

  /** Starts the cheer when the tick that empties Needs doing settles, unless motion is reduced. */
  private stepCheer(needs: readonly boolean[]): void {
    this.cheer = cheerStep(this.cheer.armed, needs)
    if (!this.cheer.play || activeWindow.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return
    this.cheering = true
    window.setTimeout(() => {
      this.cheering = false
      this.render()
    }, CHEER_MS)
  }

  private select(next: ChoreSelection | null): void {
    this.selected = next
    this.render()
  }

  private rowSelect(c: Chore): RowSelect {
    const selected = this.selected
    return selected
      ? {
          mode: 'on',
          selected: selected.has(c.path),
          toggle: () => this.select(toggleSelected(selected, c.path)),
        }
      : { mode: 'off', start: () => this.select(new Set([c.path])) }
  }

  /** Select all or Clear at the end of a group heading, while selecting. */
  private groupToggle(heading: HTMLElement, paths: string[]): void {
    const selected = this.selected
    if (!selected) return
    const link = heading.createEl('a', {
      cls: 'cd-group-select',
      text: allSelected(selected, paths) ? 'Clear' : 'Select all',
      href: '#',
    })
    link.addEventListener('click', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      this.select(toggleGroup(selected, paths))
    })
  }

  private selectionActions(bar: HTMLElement, picked: Chore[]): void {
    const snooze = button(bar, 'alarm-clock', 'Snooze', 'Snooze', (ev) => {
      const menu = new Menu()
      this.kit.addSnoozes(menu, picked, () => this.select(null))
      menu.showAtMouseEvent(ev)
    })
    const skip = button(bar, 'skip-forward', 'Skip', 'Skip', () => {
      this.select(null)
      void this.kit.skip(picked)
    })
    snooze.disabled = skip.disabled = !picked.length
    button(bar, 'x', 'Cancel', '', () => this.select(null))
  }
}

/** A top bar button; an empty `short` leaves just the icon on narrow screens. */
function button(
  parent: HTMLElement,
  icon: string,
  long: string,
  short: string,
  onClick: (ev: MouseEvent) => void,
): HTMLButtonElement {
  const b = parent.createEl('button', { cls: 'cd-button' })
  setIcon(b.createSpan(), icon)
  b.createSpan({ cls: 'cd-long', text: long })
  b.createSpan({ cls: 'cd-short', text: short })
  if (!short) setTooltip(b, long)
  b.addEventListener('click', onClick)
  return b
}

/** An illustration with a line of text under it, for when a list has nothing to show. */
function scene(parent: HTMLElement, svg: string, cls: string, text: string): HTMLElement {
  const box = parent.createDiv({ cls: ['cd-empty', 'cd-scene'] })
  const art = box.createDiv({ cls: ['cd-art', cls] })
  drawArt(art, svg)
  box.createDiv({ text })
  return art
}
