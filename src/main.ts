import { addIcon, debounce, MarkdownRenderChild, Plugin, WorkspaceLeaf } from 'obsidian'
import { dayOf, type Day } from './domain/day'
import { unresolvedText } from './domain/names'
import {
  DEFAULT_SETTINGS,
  parseSettings,
  type ChoredaySettings,
  type SettingEffect,
} from './domain/settings'
import { ChoredaySettingTab } from './settings'
import { ChoresView, VIEW_TYPE } from './ui/chores-view'
import { keepFocus } from './ui/keys'
import { drawArt, MASCOT_ICON } from './ui/mascot'
import { ICON, PUZZLED } from './ui/mascot-art'
import { RowKit, openChoreForm, undoChange, type RowContext } from './ui/rows'
import { createChoreActions } from './vault/chore-actions'
import { ChoreIndex } from './vault/chore-index'

/** How often to check whether the date has rolled over, so due labels stay current. */
const DAY_CHECK_MS = 60_000

/** How long the folder setting must sit still before the index rescans it. */
const FOLDER_SETTLE_MS = 400

const today = (): Day => dayOf(new Date())

export default class ChoredayPlugin extends Plugin {
  settings: ChoredaySettings = { ...DEFAULT_SETTINGS }
  index!: ChoreIndex
  /** The date the chores were last drawn for, to redraw when it rolls over. */
  private shownDay = today()
  /** Waits for typing to pause, so a half-typed folder name never empties the index. */
  private rescanSoon = debounce(() => this.index.rescan(), FOLDER_SETTLE_MS, true)

  async onload(): Promise<void> {
    await this.loadSettings()
    this.index = new ChoreIndex(this.app, () => this.settings.folder)
    this.register(() => this.rescanSoon.cancel())
    const actions = createChoreActions(this.index, {
      today,
      historyLimit: () => this.settings.historyLimit,
      earlyTicks: () => this.settings.earlyTicks,
    })
    const ctx: RowContext = {
      app: this.app,
      index: this.index,
      actions,
      today,
      earlyTicks: () => this.settings.earlyTicks,
    }

    addIcon(MASCOT_ICON, ICON)
    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new ChoresView(leaf, ctx))
    this.addRibbonIcon(MASCOT_ICON, 'Open chores', () => void this.openView())
    this.addCommand({
      id: 'open-chores',
      name: 'Open chores',
      callback: () => void this.openView(),
    })
    this.addCommand({
      id: 'new-chore',
      name: 'New chore',
      callback: () => openChoreForm(ctx),
    })
    this.addCommand({
      id: 'undo',
      name: 'Undo last change',
      checkCallback: (checking) => {
        if (!actions.lastChange()) return false
        if (!checking) void undoChange(actions, 'latest')
        return true
      },
    })
    this.addSettingTab(new ChoredaySettingTab(this.app, this))

    this.registerMarkdownCodeBlockProcessor('choreday', (source, el, mdCtx) => {
      const named = /chore:\s*(.+)/.exec(source)?.[1]?.trim()
      const child = new MarkdownRenderChild(el)
      const kit = new RowKit(ctx, () => render())
      const render = (): void =>
        keepFocus(el, () => {
          kit.reset()
          el.empty()
          el.addClass('cd-root', 'cd-block')
          const match = named ? this.index.find(named) : null
          const c = match
            ? match.kind === 'found'
              ? match.chore
              : undefined
            : this.index.get(mdCtx.sourcePath)
          if (!c) {
            const missing = el.createDiv({ cls: 'cd-empty cd-missing' })
            drawArt(missing.createSpan({ cls: 'cd-art is-puzzled' }), PUZZLED)
            missing.createSpan({ text: unresolvedText(named, match) })
            return
          }
          kit.row(el, c, { expandable: false, alwaysOpen: true })
        })
      child.register(this.index.subscribe(render))
      child.register(actions.onUndo((paths) => kit.settle(paths)))
      child.register(() => kit.reset())
      mdCtx.addChild(child)
      render()
    })

    this.app.workspace.onLayoutReady(() => {
      this.index.rescan()
      this.registerEvent(this.app.metadataCache.on('changed', (f) => this.index.onChanged(f)))
      this.registerEvent(this.app.vault.on('delete', (f) => this.index.onDeleted(f)))
      this.registerEvent(
        this.app.vault.on('rename', (f, old) => {
          this.index.onRenamed(f, old)
          actions.renamed(old, f.path)
        }),
      )
    })

    /** Timers stall while the device sleeps, so also check when the app comes back. */
    const checkDay = (): void => {
      if (today() === this.shownDay) return
      this.shownDay = today()
      this.index.notify()
    }
    this.registerInterval(window.setInterval(checkDay, DAY_CHECK_MS))
    this.registerDomEvent(activeDocument, 'visibilitychange', checkDay)
    this.registerDomEvent(activeWindow, 'focus', checkDay)
  }

  async openView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
    const leaf = existing ?? this.app.workspace.getLeaf('tab')
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true })
    await this.app.workspace.revealLeaf(leaf)
  }

  async loadSettings(): Promise<void> {
    this.settings = parseSettings(await this.loadData())
  }

  /** Saves the settings, then does the index work `effect` asks for. */
  async saveSettings(effect: Exclude<SettingEffect, 'none'>): Promise<void> {
    await this.saveData(this.settings)
    if (effect === 'rescan') this.rescanSoon()
    if (effect === 'redraw') this.index.notify()
  }
}
