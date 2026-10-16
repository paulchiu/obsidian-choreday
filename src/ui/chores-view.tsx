import { ItemView, Menu, Scope, WorkspaceLeaf } from 'obsidian'
import { render as draw } from 'preact'
import { cheerStep, type CheerState } from '../domain/cheer'
import type { Chore } from '../domain/chore'
import { toggleGroup, toggleSelected, type ChoreSelection } from '../domain/selection'
import { ChoresRoot, type ViewHandlers } from './chores-root'
import { keepFocus } from './keys'
import { groupRows } from './list-model'
import { MASCOT_ICON } from './mascot'
import { RowKit, openChoreForm, undoChange, type RowContext } from './rows'

export const VIEW_TYPE = 'choreday-view'

/** How long the cheering cat shows before it settles down to sleep. */
const CHEER_MS = 1500

/**
 * The due list. It holds the list's state and mounts one `ChoresRoot` while open, updating it in
 * place on every change.
 */
export class ChoresView extends ItemView {
  private kit: RowKit
  private showLater = false
  /** Chores picked to snooze or skip together; null when not selecting. */
  private selected: ChoreSelection | null = null
  private cheer: CheerState = { armed: false, play: false }
  private cheering = false
  /** Whether the root is mounted, so a settle or cheer timer that fires after close draws nothing. */
  private mounted = false
  private handlers: ViewHandlers

  constructor(
    leaf: WorkspaceLeaf,
    private ctx: RowContext,
  ) {
    super(leaf)
    this.kit = new RowKit(ctx, () => this.render())
    this.handlers = this.makeHandlers()
    this.scope = new Scope(this.app.scope)
    this.scope.register(['Mod'], 'z', () => {
      void undoChange(ctx.actions, 'latest')
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
    this.register(this.ctx.actions.onUndo((paths) => this.kit.settleUndone(paths)))
    this.mounted = true
    this.render()
  }

  async onClose(): Promise<void> {
    this.mounted = false
    draw(null, this.contentEl)
  }

  /** Updates the list in place, keeping focus and the scroll position, which iOS has reset. */
  render(): void {
    if (!this.mounted) return
    this.kit.releaseUndone()
    const today = this.ctx.today()
    const early = this.ctx.earlyTicks()
    const chores = this.ctx.index.all()
    const broken = this.ctx.index.problems()
    const groups = groupRows(chores, today, early, (path) => this.kit.justDone.get(path))
    if (chores.length || broken.length)
      this.stepCheer(groups.needs.map(({ c }) => this.kit.justDone.has(c.path)))
    const root = this.contentEl
    const top = root.scrollTop
    keepFocus(root, () =>
      draw(
        <ChoresRoot
          today={today}
          early={early}
          groups={groups}
          broken={broken}
          selected={this.selected}
          showLater={this.showLater}
          cheering={this.cheering}
          kit={this.kit}
          on={this.handlers}
        />,
        root,
      ),
    )
    root.scrollTop = top
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

  /** The chores picked now, read from the index when an action runs. */
  private picked(): Chore[] {
    const selected = this.selected
    return selected ? this.ctx.index.all().filter((c) => selected.has(c.path)) : []
  }

  /** The handlers `ChoresRoot` and its rows call, created once; each reads the view's state when run. */
  private makeHandlers(): ViewHandlers {
    const startSelect = (path?: string): void =>
      this.select(new Set(path === undefined ? [] : [path]))
    const toggle = (path: string): void => {
      if (this.selected) this.select(toggleSelected(this.selected, path))
    }
    return {
      newChore: () => openChoreForm(this.ctx),
      startSelect,
      cancelSelect: () => this.select(null),
      toggleSelected: toggle,
      toggleGroup: (paths) => {
        if (this.selected) this.select(toggleGroup(this.selected, paths))
      },
      snoozePicked: (ev) =>
        this.kit.snoozeMenu(this.picked(), () => this.select(null)).showAtMouseEvent(ev),
      skipPicked: () => {
        const picked = this.picked()
        this.select(null)
        void this.kit.skip(picked)
      },
      toggleLater: () => {
        this.showLater = !this.showLater
        this.render()
      },
      openNote: (path) => void this.app.workspace.openLinkText(path, '', 'tab'),
      row: { start: startSelect, toggle },
    }
  }
}
