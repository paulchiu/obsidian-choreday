import { App, PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian'
import type ChoredayPlugin from './main'

export interface ChoredaySettings {
  /** Where chore notes live; subfolders are included. */
  folder: string
  /** Completions kept per chore unless the note sets `keep`. */
  historyLimit: number
  /** Whether a tick before a calendar chore's next scheduled day counts for that day. */
  earlyTicks: boolean
}

export const DEFAULT_SETTINGS: ChoredaySettings = {
  folder: 'Chores',
  historyLimit: 12,
  earlyTicks: true,
}

const FOLDER_DESC = 'Notes with type: chore in this folder and its subfolders are chores.'
const HISTORY_DESC =
  'Completions kept per chore. Older ones are trimmed on the next write. A chore note can override this with keep.'
const EARLY_DESC =
  'For chores on set days, a tick before the next scheduled day counts for that day. Turn off to count only ticks on or after it.'
const MIN_HISTORY = 2

const historyProblem = (n: number): string | void =>
  Number.isInteger(n) && n >= MIN_HISTORY ? undefined : `Keep at least ${MIN_HISTORY}.`

export class ChoredaySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: ChoredayPlugin,
  ) {
    super(app, plugin)
  }

  /** Obsidian 1.13 and later render this, and include it in settings search. */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: 'Chores folder',
        desc: FOLDER_DESC,
        control: { type: 'folder', key: 'folder', placeholder: 'Chores', includeRoot: true },
      },
      {
        name: 'History to keep',
        desc: HISTORY_DESC,
        control: {
          type: 'number',
          key: 'historyLimit',
          min: MIN_HISTORY,
          validate: historyProblem,
        },
      },
      {
        name: 'Early ticks count',
        desc: EARLY_DESC,
        control: { type: 'toggle', key: 'earlyTicks' },
      },
    ]
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'folder' && typeof value === 'string') this.plugin.settings.folder = value
    if (key === 'historyLimit' && typeof value === 'number' && !historyProblem(value))
      this.plugin.settings.historyLimit = value
    if (key === 'earlyTicks' && typeof value === 'boolean') this.plugin.settings.earlyTicks = value
    await this.plugin.saveSettings()
  }

  /** Older Obsidian versions render this instead. */
  display(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Chores folder')
      .setDesc(FOLDER_DESC)
      .addText((t) =>
        t
          .setPlaceholder('Chores')
          .setValue(this.plugin.settings.folder)
          .onChange((v) => this.setControlValue('folder', v)),
      )

    new Setting(containerEl)
      .setName('History to keep')
      .setDesc(HISTORY_DESC)
      .addText((t) => {
        t.inputEl.type = 'number'
        t.inputEl.min = String(MIN_HISTORY)
        t.setValue(String(this.plugin.settings.historyLimit)).onChange((v) =>
          this.setControlValue('historyLimit', Number(v)),
        )
      })

    new Setting(containerEl)
      .setName('Early ticks count')
      .setDesc(EARLY_DESC)
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.earlyTicks)
          .onChange((v) => this.setControlValue('earlyTicks', v)),
      )
  }
}
