import { addIcon, debounce, MarkdownRenderChild, Plugin, WorkspaceLeaf, type App } from 'obsidian'
import { dayOf, type Day } from './domain/day'
import {
  DEFAULT_SETTINGS,
  parseSettings,
  withSetting,
  type ChoredaySettings,
  type SettingEffect,
} from './domain/settings'
import { ChoredaySettingTab } from './settings'
import { mountChoreBlock } from './ui/obsidian/chore-block'
import { ChoresView, VIEW_TYPE, type PickStore } from './ui/obsidian/chores-view'
import { parseTodayPicks, type TodayPicks } from './domain/picks'
import { ICON, MASCOT_ICON } from './ui/model/mascot-art'
import { openChoreForm, undoChange, type RowContext } from './ui/obsidian/row-kit'
import { createChoreActions } from './vault/chore-actions'
import { ChoreIndex } from './vault/chore-index'

/** How often to check whether the date has rolled over, so due labels stay current. */
const DAY_CHECK_MS = 60_000

/** Where today's focus is kept in the vault's local storage, so it stays on this device. */
export const TODAY_PICKS_KEY = 'choreday-today-picks'

/** Today's focus saved on this device, or null when there is none or the storage fails. */
function loadTodayPicks(app: App): TodayPicks | null {
  try {
    return parseTodayPicks(app.loadLocalStorage(TODAY_PICKS_KEY))
  } catch {
    return null
  }
}

/** Saves today's focus on this device; when the storage fails, the focus lasts until a reload. */
function saveTodayPicks(app: App, picks: TodayPicks): void {
  try {
    app.saveLocalStorage(TODAY_PICKS_KEY, picks)
  } catch {
    return
  }
}

/** How long the folder setting must sit still before the index rescans it. */
const FOLDER_SETTLE_MS = 400

const today = (): Day => dayOf(new Date())

export default class ChoredayPlugin extends Plugin {
  settings: ChoredaySettings = { ...DEFAULT_SETTINGS }
  index!: ChoreIndex
  /** Today's picks, also saved on this device so they outlive a closed view and a reload. */
  private todayPicks: TodayPicks | null = null
  /** The date the chores were last drawn for, to redraw when it rolls over. */
  private shownDay = today()
  /** Rescans once typing pauses, rather than for each keystroke of a folder name. */
  private rescanSoon = debounce(
    () => this.index.rescan(this.settings.folder),
    FOLDER_SETTLE_MS,
    true,
  )

  async onload(): Promise<void> {
    await this.loadSettings()
    this.todayPicks = loadTodayPicks(this.app)
    this.index = new ChoreIndex(this.app, this.settings.folder)
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
    const picks: PickStore = {
      get: () => this.todayPicks,
      set: (p) => {
        this.todayPicks = p
        saveTodayPicks(this.app, p)
      },
      morning: () => this.settings.morningPicks,
      setMorning: (rule) => {
        this.settings = withSetting(this.settings, 'morningPicks', rule)
        void this.saveSettings('save')
      },
      noPressure: () => this.settings.noPressure,
      setNoPressure: (on) => {
        this.settings = withSetting(this.settings, 'noPressure', on)
        void this.saveSettings('save')
      },
    }
    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new ChoresView(leaf, ctx, picks))
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
      const child = new MarkdownRenderChild(el)
      mountChoreBlock(ctx, source, el, mdCtx.sourcePath, child)
      mdCtx.addChild(child)
    })

    this.app.workspace.onLayoutReady(() => {
      this.index.rescan(this.settings.folder)
      this.registerEvent(this.app.metadataCache.on('changed', (f) => this.index.onChanged(f)))
      this.registerEvent(
        this.app.vault.on('delete', (f) => {
          this.index.onDeleted(f)
          actions.deleted(f.path)
        }),
      )
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
