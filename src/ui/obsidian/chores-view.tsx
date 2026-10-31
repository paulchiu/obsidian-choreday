import { ItemView, Menu, Scope, WorkspaceLeaf } from 'obsidian'
import { render as draw } from 'preact'
import { cheerStep, type CheerState } from '../../domain/cheer'
import type { Chore } from '../../domain/chore'
import {
  daySeed,
  pickPaths,
  picksFor,
  pickToday,
  type PickRule,
  type TodayPicks,
} from '../../domain/picks'
import { toggleGroup, toggleSelected, type ChoreSelection } from '../../domain/selection'
import { ChoresRoot, type ViewHandlers } from '../components/chores-root'
import { HostContext } from '../components/host'
import { keepFocus } from '../components/keys'
import { groupRows, type Groups } from '../model/list-model'
import { MASCOT_ICON } from '../model/mascot-art'
import { obsidianHost } from './host'
import { PicksModal, type PickChoice } from './modals'
import { createRowKit, openChoreForm, undoChange, type RowContext, type RowKit } from './row-kit'

export const VIEW_TYPE = 'choreday-view'

/** Where the day's picks outlive the view, and the saved rule each morning's picks are made by. */
export interface PickStore {
  get(): TodayPicks | null
  set(picks: TodayPicks): void
  morning(): PickRule | null
  setMorning(rule: PickRule | null): void
}

/** The rule the pick form starts on when nothing has been picked before. */
const DEFAULT_RULE: PickRule = { strategy: 'overdue', count: 3 }

/** How long the cheering cat shows before it settles down to sleep. */
const CHEER_MS = 1500

/**
 * The due list. It holds the list's state and mounts one `ChoresRoot` while open, updating it in
 * place on every change.
 */
export class ChoresView extends ItemView {
  private kit: RowKit
  private showLater = false
  private search: string | null = null
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
    private picks: PickStore,
  ) {
    super(leaf)
    this.kit = createRowKit(ctx, () => this.render())
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
    const { justDone, expanded } = this.kit.state()
    const groups = this.groups()
    const picks = picksFor(this.picks.get(), today, this.picks.morning(), groups.needs)
    if (picks && picks !== this.picks.get()) this.picks.set(picks)
    if (chores.length || broken.length)
      this.stepCheer(groups.needs.map(({ c }) => justDone.has(c.path)))
    const root = this.contentEl
    const top = root.scrollTop
    keepFocus(root, () =>
      draw(
        <HostContext.Provider value={obsidianHost}>
          <ChoresRoot
            today={today}
            early={early}
            groups={groups}
            broken={broken}
            selected={this.selected}
            showLater={this.showLater}
            search={this.search}
            picks={picks?.kind === 'picked' ? picks : null}
            cheering={this.cheering}
            kit={this.kit}
            expanded={expanded}
            settling={this.kit.settling()}
            on={this.handlers}
          />
        </HostContext.Provider>,
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

  /** The view's groups today, with each settling chore kept where it was before its tick. */
  private groups(): Groups {
    const { justDone } = this.kit.state()
    return groupRows(this.ctx.index.all(), this.ctx.today(), this.ctx.earlyTicks(), (path) =>
      justDone.get(path),
    )
  }

  /** Opens the pick form on today's picks, or the morning rule, previewing what each choice picks. */
  private openPicks(): void {
    const today = this.ctx.today()
    const needs = this.groups().needs
    const names = new Map(needs.map(({ c }) => [c.path, c.name]))
    const stored = this.picks.get()
    const morning = this.picks.morning()
    const initial: PickChoice =
      stored?.day === today && stored.kind === 'picked'
        ? { rule: stored.rule, seed: stored.seed, morning: morning !== null }
        : { rule: morning ?? DEFAULT_RULE, seed: daySeed(today), morning: morning !== null }
    new PicksModal(
      this.app,
      initial,
      (rule, seed) => pickPaths(rule, needs, seed).map((path) => names.get(path) ?? path),
      ({ rule, seed, morning: everyMorning }) => {
        this.picks.set(pickToday(today, rule, seed, needs))
        this.picks.setMorning(everyMorning ? rule : null)
        this.render()
      },
    ).open()
  }

  /** Focuses the control at `selector` without scrolling, which on iOS jumps the list away. */
  private focusOn(selector: string): void {
    this.contentEl.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
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
      toggleSearch: () => {
        this.search = this.search === null ? '' : null
        this.render()
        if (this.search === null) this.focusOn('[data-cd-focus="search"]')
        else {
          this.focusOn('input.cd-search')
          this.contentEl.scrollTop = 0
        }
      },
      clearSearch: () => {
        this.search = ''
        this.render()
        this.focusOn('input.cd-search')
      },
      searchFor: (text) => {
        this.search = text
        this.render()
      },
      showAll: () => {
        this.picks.set({ day: this.ctx.today(), kind: 'all' })
        this.render()
      },
      changePicks: () => this.openPicks(),
      openNote: (path) => void this.app.workspace.openLinkText(path, '', 'tab'),
      row: { start: startSelect, toggle },
    }
  }
}
