import { App, Modal, Setting } from 'obsidian'
import { isAnchor, scheduleDays, type Chore } from '../domain/chore'
import { everyN, withAnchor, withEdit, withUnit, type ChoreDraft } from '../domain/chore-form'
import { MONDAY_FIRST, WEEKDAYS, parseIso, shortDate, toIso, type Day } from '../domain/day'
import { isUnit, type Unit } from '../domain/every'
import { DAY_PRESETS, toggleDay } from '../domain/day-picker'
import { dueLabel } from '../domain/friendly'
import { derive } from '../domain/schedule'
import { showChore, type ScheduleControls } from './chore-form-controls'

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
  private draft: ChoreDraft
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
    this.draft = { chore: original ? structuredClone(original) : blankChore() }
  }

  onOpen(): void {
    this.setTitle(this.original ? 'Edit chore' : 'New chore')
    this.modalEl.addClass('cd-modal')
    const { contentEl } = this

    new Setting(contentEl).setName('Name').addText((t) =>
      t
        .setPlaceholder('Descale kettle')
        .setValue(this.draft.chore.name)
        .onChange((v) => (this.draft = withEdit(this.draft, { name: v }))),
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
        t.setValue(String(this.draft.chore.every.n)).onChange((v) => {
          const every = { ...this.draft.chore.every, n: everyN(v) }
          this.draft = withEdit(this.draft, { every })
          this.refresh()
        })
      })
      .addDropdown((d) => {
        unitEl = d.selectEl
        d.addOptions(UNIT_LABELS)
          .setValue(this.draft.chore.every.unit)
          .onChange((v) => {
            if (!isUnit(v)) return
            this.draft = withUnit(this.draft, v)
            this.refresh()
          })
      })

    new Setting(contentEl).setName('Schedule').addDropdown((d) => {
      anchorEl = d.selectEl
      d.addOptions({ done: 'After last done', calendar: 'On set days' })
        .setValue(this.draft.chore.schedule.anchor)
        .onChange((v) => {
          if (!isAnchor(v)) return
          this.draft = withAnchor(this.draft, v)
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
        this.setDays(toggleDay(scheduleDays(this.draft.chore.schedule), day)),
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
    const c = this.draft.chore
    if (!c.name.trim()) return
    if (await this.onSave(c)) this.close()
  }

  private setDays(days: readonly number[]): void {
    this.draft = withEdit(this.draft, { schedule: { anchor: 'calendar', days } })
    this.refresh()
  }

  private refresh(): void {
    const chore = this.draft.chore
    showChore(this.controls, chore)
    const today = this.today
    const label = (c: Chore): string => dueLabel(c, derive(c, today, this.early), today)
    this.previewEl.empty()
    if (!this.original) {
      const due = derive(chore, today, this.early).due
      this.previewEl.setText(
        due === today ? 'Due today, since it has never been done.' : `First due ${shortDate(due)}.`,
      )
      return
    }
    const before = label(this.original)
    const now = label(chore)
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
