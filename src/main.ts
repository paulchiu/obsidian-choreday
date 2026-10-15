import { addIcon, MarkdownRenderChild, Notice, Plugin, WorkspaceLeaf } from 'obsidian'
import { dayOf } from './domain/day'
import { choreBasename, unresolvedText } from './domain/names'
import { latestChange, recordChange, withoutChange, type UndoHistory } from './domain/undo-history'
import { DEFAULT_SETTINGS, ChoredaySettingTab, type ChoredaySettings } from './settings'
import { ChoresView, VIEW_TYPE } from './ui/chores-view'
import { keepFocus } from './ui/keys'
import { drawArt, MASCOT_ICON } from './ui/mascot'
import { ICON, PUZZLED } from './ui/mascot-art'
import { ChoreModal } from './ui/modals'
import { RowKit, undoLast, type RowContext } from './ui/rows'
import { ChoreIndex } from './vault/chore-index'

/** How often to check whether the date has rolled over, so due labels stay current. */
const DAY_CHECK_MS = 60_000

export default class ChoredayPlugin extends Plugin {
  settings: ChoredaySettings = DEFAULT_SETTINGS
  index!: ChoreIndex
  private today = dayOf(new Date())
  /** This session's writes, for Undo last change. */
  private changes: UndoHistory = []

  async onload(): Promise<void> {
    await this.loadSettings()
    this.index = new ChoreIndex(this.app, () => this.settings.folder)
    const ctx = this.rowContext()

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
      callback: () =>
        new ChoreModal(
          this.app,
          undefined,
          this.today,
          this.settings.earlyTicks,
          (c) => void ctx.createChore(c),
        ).open(),
    })
    this.addCommand({
      id: 'undo',
      name: 'Undo last change',
      checkCallback: (checking) => {
        if (!ctx.lastChange()) return false
        if (!checking) void undoLast(ctx)
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
      child.register(() => kit.reset())
      mdCtx.addChild(child)
      render()
    })

    this.app.workspace.onLayoutReady(() => {
      this.index.rescan()
      this.registerEvent(this.app.metadataCache.on('changed', (f) => this.index.onChanged(f)))
      this.registerEvent(this.app.vault.on('delete', (f) => this.index.onDeleted(f)))
      this.registerEvent(this.app.vault.on('rename', (f, old) => this.index.onRenamed(f, old)))
    })

    this.registerInterval(
      window.setInterval(() => {
        const now = dayOf(new Date())
        if (now !== this.today) {
          this.today = now
          this.index.rescan()
        }
      }, DAY_CHECK_MS),
    )
  }

  private rowContext(): RowContext {
    return {
      app: this.app,
      index: this.index,
      today: () => this.today,
      historyLimit: () => this.settings.historyLimit,
      earlyTicks: () => this.settings.earlyTicks,
      editChore: async (before, next) => {
        const name = choreBasename(next.name)
        let path = before.path
        if (name && name !== before.name) {
          const renamed = await this.index.rename(before.path, name)
          if (!renamed) {
            new Notice(`A note named ${name} already exists.`)
            return
          }
          path = renamed
        }
        await this.index.update(path, (now) => ({
          ...now,
          every: next.every,
          anchor: next.anchor,
          days: next.days,
        }))
      },
      remember: (change) => {
        this.changes = recordChange(this.changes, change)
      },
      lastChange: () => latestChange(this.changes),
      undo: async (change) => {
        const rest = withoutChange(this.changes, change)
        if (!rest) return
        this.changes = rest
        await Promise.all(change.prevs.map((p) => this.index.restore(p)))
      },
      createChore: async (draft) => {
        const name = choreBasename(draft.name)
        if (!name) return
        const file = await this.index.create({ ...draft, name })
        if (!file) new Notice(`A note named ${name} already exists.`)
        else new Notice(`Created ${file.path}`)
      },
    }
  }

  async openView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
    const leaf = existing ?? this.app.workspace.getLeaf('tab')
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true })
    await this.app.workspace.revealLeaf(leaf)
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as Partial<ChoredaySettings>),
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
    this.index.rescan()
  }
}
