import { App, Modal, Setting } from 'obsidian'
import type { Anchor, Chore } from '../domain/chore'
import { WEEKDAYS, parseIso, shortDate, toIso, type Day } from '../domain/day'
import type { Unit } from '../domain/every'
import { dueLabel } from '../domain/friendly'
import { derive } from '../domain/schedule'

/** One date input; used by "Done on…" and snooze "Pick date…". */
export class DateModal extends Modal {
  constructor(
    app: App,
    private heading: string,
    private initial: Day,
    private onPick: (d: Day) => void,
  ) {
    super(app)
  }

  onOpen(): void {
    this.setTitle(this.heading)
    let value = toIso(this.initial)
    new Setting(this.contentEl).setName('Date').addText((t) => {
      t.inputEl.type = 'date'
      t.setValue(value).onChange((v) => (value = v))
    })
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText('Save')
          .setCta()
          .onClick(() => {
            const d = parseIso(value)
            if (d !== null) this.onPick(d)
            this.close()
          }),
      )
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

const UNITS: Record<Unit, string> = { d: 'days', w: 'weeks', m: 'months', y: 'years' }

/** A blank chore for the New chore form; `path` is filled in when the note is created. */
export function blankChore(): Chore {
  return {
    path: '',
    name: '',
    every: { n: 2, unit: 'w' },
    anchor: 'done',
    done: [],
    skipped: [],
    unreadable: { done: [], skipped: [] },
    warnings: [],
  }
}

/** Add and Edit share one form; Edit previews what the change does to the next due date. */
export class ChoreModal extends Modal {
  private draft: Chore
  private previewEl!: HTMLElement
  private daySettingEl!: HTMLElement

  constructor(
    app: App,
    private original: Chore | undefined,
    private today: Day,
    private onSave: (c: Chore) => void,
  ) {
    super(app)
    this.draft = original ? structuredClone(original) : blankChore()
  }

  onOpen(): void {
    this.setTitle(this.original ? 'Edit chore' : 'New chore')
    this.modalEl.addClass('cd-modal')
    const { contentEl } = this

    new Setting(contentEl).setName('Name').addText((t) =>
      t
        .setPlaceholder('Descale kettle')
        .setValue(this.draft.name)
        .onChange((v) => (this.draft.name = v)),
    )

    new Setting(contentEl)
      .setName('Every')
      .addText((t) => {
        t.inputEl.type = 'number'
        t.inputEl.min = '1'
        t.inputEl.addClass('cd-every-n')
        t.setValue(String(this.draft.every.n)).onChange((v) => {
          this.draft.every = { ...this.draft.every, n: Math.max(1, Math.floor(Number(v)) || 1) }
          this.refresh()
        })
      })
      .addDropdown((d) =>
        d
          .addOptions(UNITS)
          .setValue(this.draft.every.unit)
          .onChange((v) => {
            this.draft.every = { ...this.draft.every, unit: v as Unit }
            if (v !== 'w' && this.draft.anchor === 'calendar') this.draft.anchor = 'done'
            this.refresh()
          }),
      )

    new Setting(contentEl).setName('Schedule').addDropdown((d) =>
      d
        .addOptions({ done: 'After last done', calendar: 'Fixed weekday' })
        .setValue(this.draft.anchor)
        .onChange((v) => {
          this.draft.anchor = v as Anchor
          if (v === 'calendar') {
            if (this.draft.every.unit !== 'w') this.draft.every = { n: 1, unit: 'w' }
            this.draft.day ??= 2
          } else delete this.draft.day
          this.refresh()
        }),
    )

    this.daySettingEl = new Setting(contentEl).setName('On').addDropdown((d) =>
      d
        .addOptions(Object.fromEntries(WEEKDAYS.map((w, i) => [String(i), w])))
        .setValue(String(this.draft.day ?? 2))
        .onChange((v) => {
          this.draft.day = Number(v)
          this.refresh()
        }),
    ).settingEl

    this.previewEl = contentEl.createDiv({ cls: 'cd-preview' })

    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText('Save')
          .setCta()
          .onClick(() => {
            if (!this.draft.name.trim()) return
            this.onSave(this.draft)
            this.close()
          }),
      )
    this.refresh()
  }

  private refresh(): void {
    this.daySettingEl.toggle(this.draft.anchor === 'calendar')
    const today = this.today
    const label = (c: Chore): string => dueLabel(c, derive(c, today), today)
    this.previewEl.empty()
    if (!this.original) {
      const due = derive(this.draft, today).due
      this.previewEl.setText(
        due === today ? 'Due today, since it has never been done.' : `First due ${shortDate(due)}.`,
      )
      return
    }
    const before = label(this.original)
    const now = label(this.draft)
    if (before === now) {
      this.previewEl.setText(`Next due stays ${now}.`)
      return
    }
    this.previewEl.appendText('Next due moves from ')
    this.previewEl.createEl('b', { text: before })
    this.previewEl.appendText(' to ')
    this.previewEl.createEl('b', { text: now })
    this.previewEl.appendText('. History is unchanged.')
  }

  onClose(): void {
    this.contentEl.empty()
  }
}
