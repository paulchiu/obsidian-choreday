import { ItemView, Menu, Scope, WorkspaceLeaf, setIcon, setTooltip } from 'obsidian'
import { caughtUpLine, cheerStep, type CheerState } from '../domain/cheer'
import type { Chore } from '../domain/chore'
import { shortDate, type Day } from '../domain/day'
import { dueText } from '../domain/friendly'
import { derive, sortGroup, type Group } from '../domain/schedule'
import { allSelected, toggleGroup, toggleSelected, type ChoreSelection } from '../domain/selection'
import { drawArt, MASCOT_ICON } from './mascot'
import { CHEERING, CLIPBOARD, CONFETTI, PUZZLED, SLEEPING } from './mascot-art'
import { focusGroup, focusKey, focusLanding, keepFocus, pressable } from './keys'
import { RowKit, openChoreForm, undoChange, type RowContext, type RowSelect } from './rows'

export const VIEW_TYPE = 'choreday-view'

/** Select and Cancel share a focus key, so focus follows the button that toggles select mode. */
const MODE_KEY = 'mode'

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
      void undoChange(ctx.actions)
      return false
    })
    /** Menus and modals push their own scope, so Escape reaches here only when none is open. */
    this.scope.register([], 'Escape', () => {
      if (!this.selected) return true
      this.select(null)
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
    const change = this.ctx.actions.lastChange()
    if (change && source === 'more-options')
      menu.addItem((i) =>
        i
          .setTitle(`Undo: ${change.label}`)
          .setIcon('undo-2')
          .onClick(() => void undoChange(this.ctx.actions, change)),
      )
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass('cd-root')
    this.register(this.ctx.index.subscribe(() => this.render()))
    this.register(this.ctx.actions.onUndo((paths) => this.kit.settle(paths)))
    this.render()
  }

  async onClose(): Promise<void> {
    this.kit.reset()
  }

  /** Rebuilds the list, keeping focus and the scroll position: iOS resets it when the view is emptied. */
  render(): void {
    const top = this.contentEl.scrollTop
    keepFocus(this.contentEl, () => this.rebuildList())
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
    const actions = focusGroup(top, 'top')
    actions.addClass('cd-actions')
    if (selected) {
      const picked = chores.filter((c) => selected.has(c.path))
      title.createEl('h4', { text: `${picked.length} selected` })
      this.selectionActions(actions, picked)
    } else {
      title.createEl('h4', { text: 'Chores' })
      title.createSpan({ cls: 'cd-today-label', text: shortDate(today) })
      if (chores.length)
        button(actions, { key: MODE_KEY, icon: 'square-check', long: 'Select' }, () =>
          this.select(new Set()),
        )
      button(actions, { key: 'new', icon: 'plus', long: 'New chore', short: 'New' }, () =>
        openChoreForm(this.ctx),
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

    const showRows = (box: HTMLElement, list: typeof rows): void =>
      list.forEach(({ c }) => this.kit.row(box, c, { select: this.rowSelect(c) }))
    const section = (label: string, list: typeof rows): void => {
      if (!list.length) return
      const box = focusGroup(root, label)
      const heading = box.createDiv({ cls: 'cd-group' })
      focusLanding(heading, `group:${label}`)
      heading.createSpan({ text: `${label} · ${list.length}` })
      this.groupToggle(
        heading,
        label,
        list.map(({ c }) => c.path),
      )
      showRows(box, list)
    }
    this.stepCheer(needs.map(({ c }) => this.kit.justDone.has(c.path)))
    section('Needs doing', needs)
    if (!needs.length) this.caughtUp(root, today)
    section('Coming up', coming)

    if (later.length) {
      const box = focusGroup(root, 'Later')
      const toggle = box.createDiv({
        cls: 'cd-later',
        attr: { role: 'button', 'aria-expanded': String(this.showLater) },
      })
      pressable(toggle, 'later')
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
          'Later',
          later.map(({ c }) => c.path),
        )
        showRows(box, later)
      }
    }

    if (broken.length) {
      const box = focusGroup(root, 'Needs fixing')
      const heading = box.createDiv({ cls: 'cd-group cd-fixing' })
      drawArt(heading.createSpan({ cls: 'cd-art is-puzzled' }), PUZZLED)
      heading.createSpan({ text: `Needs fixing · ${broken.length}` })
      for (const b of broken) {
        const row = box.createDiv({ cls: 'cd-broken', attr: { role: 'button' } })
        pressable(row, `broken:${b.path}`)
        setIcon(row.createSpan({ cls: 'cd-warn' }), 'alert-triangle')
        row.createSpan({ cls: 'cd-name', text: b.name })
        row.createSpan({ cls: 'cd-meta', text: b.problems.join('; ') })
        row.addEventListener('click', () => void this.app.workspace.openLinkText(b.path, '', 'tab'))
      }
    }
  }

  private caughtUp(root: HTMLElement, today: Day): void {
    if (!this.cheering) {
      scene(root, SLEEPING, 'is-caught-up', caughtUpLine(today))
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
  private groupToggle(heading: HTMLElement, label: string, paths: string[]): void {
    const selected = this.selected
    if (!selected) return
    const link = heading.createEl('a', {
      cls: 'cd-group-select',
      text: allSelected(selected, paths) ? 'Clear' : 'Select all',
      href: '#',
    })
    pressable(link, `select:${label}`)
    link.addEventListener('click', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      this.select(toggleGroup(selected, paths))
    })
  }

  private selectionActions(bar: HTMLElement, picked: Chore[]): void {
    const snooze = button(bar, { key: 'snooze', icon: 'alarm-clock', long: 'Snooze' }, (ev) => {
      const menu = new Menu()
      this.kit.addSnoozes(menu, picked, () => this.select(null))
      menu.showAtMouseEvent(ev)
    })
    const skip = button(bar, { key: 'skip', icon: 'skip-forward', long: 'Skip' }, () => {
      this.select(null)
      void this.kit.skip(picked)
    })
    snooze.disabled = skip.disabled = !picked.length
    button(bar, { key: MODE_KEY, icon: 'x', long: 'Cancel', short: '' }, () => this.select(null))
  }
}

/** A top bar button's focus key, icon and labels; `short` defaults to `long`. */
interface ButtonSpec {
  key: string
  icon: string
  long: string
  short?: string
}

/** A top bar button; an empty `short` leaves just the icon on narrow screens. */
function button(
  parent: HTMLElement,
  { key, icon, long, short = long }: ButtonSpec,
  onClick: (ev: MouseEvent) => void,
): HTMLButtonElement {
  const b = parent.createEl('button', { cls: 'cd-button' })
  focusKey(b, key)
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
