import { App, Modal, Setting } from 'obsidian'
import { isAnchor, scheduleDays, type Chore } from '../domain/chore'
import { showChore, type ScheduleControls } from './chore-form-controls'
import { everyN, withAnchor, withUnit, type ChoreDraft } from '../domain/chore-form'
import { MONDAY_FIRST, WEEKDAYS, parseIso, shortDate, toIso, type Day } from '../domain/day'
import { isUnit, type Unit } from '../domain/every'
import { DAY_PRESETS, toggleDay } from '../domain/day-picker'
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

const UNIT_LABELS: Record<Unit, string> = { d: 'days', w: 'weeks', m: 'months', y: 'years' }

/** A blank chore for the New chore form; `path` is filled in when the note is created. */
export function blankChore(): Chore {
  return {
    path: '',
    name: '',
    every: { n: 2, unit: 'w' },
    schedule: { anchor: 'done' },
    done: [],
    skipped: [],
    unreadable: { done: [], skipped: [] },
    warnings: [],
  }
}

/** Add and Edit share one form; Edit previews what the change does to the next due date. */
export class ChoreModal extends Modal {
  private form: ChoreDraft
  private previewEl!: HTMLElement
  private controls!: ScheduleControls

  constructor(
    app: App,
    private original: Chore | undefined,
    private today: Day,
    private early: boolean,
    /** Resolves true when the save went through and the form can close. */
    private onSave: (c: Chore) => Promise<boolean>,
  ) {
    super(app)
    this.form = { chore: original ? structuredClone(original) : blankChore() }
  }

  private get draft(): Chore {
    return this.form.chore
  }

  private set draft(c: Chore) {
    this.form = { ...this.form, chore: c }
  }

  onOpen(): void {
    this.setTitle(this.original ? 'Edit chore' : 'New chore')
    this.modalEl.addClass('cd-modal')
    const { contentEl } = this

    new Setting(contentEl).setName('Name').addText((t) =>
      t
        .setPlaceholder('Descale kettle')
        .setValue(this.draft.name)
        .onChange((v) => (this.draft = { ...this.draft, name: v })),
    )

    let nEl!: HTMLInputElement
    let unitEl!: HTMLSelectElement
    let anchorEl!: HTMLSelectElement
    new Setting(contentEl)
      .setName('Every')
      .addText((t) => {
        nEl = t.inputEl
        t.inputEl.type = 'number'
        t.inputEl.min = '1'
        t.inputEl.addClass('cd-every-n')
        t.setValue(String(this.draft.every.n)).onChange((v) => {
          this.draft = { ...this.draft, every: { ...this.draft.every, n: everyN(v) } }
          this.refresh()
        })
      })
      .addDropdown((d) => {
        unitEl = d.selectEl
        d.addOptions(UNIT_LABELS)
          .setValue(this.draft.every.unit)
          .onChange((v) => {
            if (!isUnit(v)) return
            this.form = withUnit(this.form, v)
            this.refresh()
          })
      })

    new Setting(contentEl).setName('Schedule').addDropdown((d) => {
      anchorEl = d.selectEl
      d.addOptions({ done: 'After last done', calendar: 'On set days' })
        .setValue(this.draft.schedule.anchor)
        .onChange((v) => {
          if (!isAnchor(v)) return
          this.form = withAnchor(this.form, v)
          this.refresh()
        })
    })

    const daySetting = new Setting(contentEl).setName('On')
    daySetting.settingEl.addClass('cd-day-setting')
    const chips = daySetting.controlEl.createDiv({ cls: 'cd-chips' })
    const chipEls = MONDAY_FIRST.map((day) => {
      const chip = chips.createEl('button', {
        cls: 'cd-chip',
        text: WEEKDAYS[day]!.slice(0, 2),
        attr: { 'aria-label': WEEKDAYS[day]!, type: 'button' },
      })
      chip.addEventListener('click', () =>
        this.setDays(toggleDay(scheduleDays(this.draft.schedule), day)),
      )
      return { day, el: chip }
    })
    this.controls = {
      n: nEl,
      unit: unitEl,
      anchor: anchorEl,
      daySetting: daySetting.settingEl,
      chips: chipEls,
    }
    const presets = daySetting.controlEl.createDiv({ cls: 'cd-presets' })
    for (const preset of DAY_PRESETS)
      presets
        .createEl('button', { cls: 'cd-preset', text: preset.label, attr: { type: 'button' } })
        .addEventListener('click', () => this.setDays(preset.days))

    this.previewEl = contentEl.createDiv({ cls: 'cd-preview' })

    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText('Save')
          .setCta()
          .onClick(() => void this.save()),
      )
    this.refresh()
  }

  private async save(): Promise<void> {
    if (!this.draft.name.trim()) return
    if (await this.onSave(this.draft)) this.close()
  }

  private setDays(days: readonly number[]): void {
    this.draft = { ...this.draft, schedule: { anchor: 'calendar', days } }
    this.refresh()
  }

  private refresh(): void {
    showChore(this.controls, this.draft)
    const today = this.today
    const label = (c: Chore): string => dueLabel(c, derive(c, today, this.early), today)
    this.previewEl.empty()
    if (!this.original) {
      const due = derive(this.draft, today, this.early).due
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
