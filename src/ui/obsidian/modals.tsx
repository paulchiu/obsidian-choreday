import { App, Modal } from 'obsidian'
import { render } from 'preact'
import type { Chore } from '../../domain/chore'
import {
  blankChore,
  everyN,
  withAnchor,
  withEdit,
  withUnit,
  type ChoreDraft,
} from '../../domain/chore-form'
import { parseIso, toIso, type Day } from '../../domain/day'
import { ChoreForm, type ChoreFormHandlers } from '../components/chore-form'
import { DateForm } from '../components/date-form'
import { PicksForm, type PicksFormHandlers } from '../components/picks-form'
import type { PickRule } from '../../domain/picks'

/** The date form's shell: it holds the entered date and calls `onPick` on Save when it parses. */
export class DateModal extends Modal {
  private value: string
  private readonly on = {
    change: (v: string): void => {
      this.value = v
      this.draw()
    },
    cancel: (): void => this.close(),
    save: (): void => {
      const d = parseIso(this.value)
      if (d !== null) this.onPick(d)
      this.close()
    },
  }

  constructor(
    app: App,
    private heading: string,
    initial: Day,
    private onPick: (d: Day) => void,
  ) {
    super(app)
    this.value = toIso(initial)
  }

  onOpen(): void {
    this.setTitle(this.heading)
    this.draw()
  }

  onClose(): void {
    render(null, this.contentEl)
  }

  private draw(): void {
    render(<DateForm value={this.value} on={this.on} />, this.contentEl)
  }
}

/** The chore form's shell: it holds the draft and redraws `ChoreForm` on every change. */
export class ChoreModal extends Modal {
  private draft: ChoreDraft
  /**
   * The Every field's text, replaced only when something other than typing moves `n`, so a field
   * cleared to retype is not clobbered.
   */
  private everyText: string
  private saving = false
  private isOpen = false
  private readonly on: ChoreFormHandlers = {
    name: (name) => this.setDraft(withEdit(this.draft, { name })),
    everyN: (text) => {
      this.everyText = text
      const every = { ...this.draft.chore.every, n: everyN(text) }
      this.setDraft(withEdit(this.draft, { every }))
    },
    unit: (u) => this.setDraft(withUnit(this.draft, u)),
    anchor: (a) => this.setDraft(withAnchor(this.draft, a)),
    days: (days) => this.setDraft(withEdit(this.draft, { schedule: { anchor: 'calendar', days } })),
    cancel: () => this.close(),
    save: () => void this.save(),
  }

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
    this.everyText = String(this.draft.chore.every.n)
  }

  onOpen(): void {
    this.isOpen = true
    this.setTitle(this.original ? 'Edit chore' : 'New chore')
    this.modalEl.addClass('cd-modal')
    this.draw()
  }

  onClose(): void {
    this.isOpen = false
    render(null, this.contentEl)
  }

  private async save(): Promise<void> {
    if (this.saving) return
    const c = this.draft.chore
    if (!c.name.trim()) return
    this.saving = true
    this.draw()
    try {
      if (await this.onSave(c)) this.close()
    } finally {
      this.saving = false
      if (this.isOpen) this.draw()
    }
  }

  private setDraft(next: ChoreDraft): void {
    this.draft = next
    if (everyN(this.everyText) !== next.chore.every.n) this.everyText = String(next.chore.every.n)
    this.draw()
  }

  private draw(): void {
    render(
      <ChoreForm
        draft={this.draft}
        everyText={this.everyText}
        original={this.original}
        today={this.today}
        early={this.early}
        saving={this.saving}
        on={this.on}
      />,
      this.contentEl,
    )
  }
}

/** What the pick form settles on: the rule, its reshuffle seed and the form's two switches. */
export interface PickChoice {
  rule: PickRule
  seed: number
  morning: boolean
  noPressure: boolean
}

/** The pick form's shell: it holds the choice and calls `onPick` with it on Pick. */
export class PicksModal extends Modal {
  private readonly on: PicksFormHandlers = {
    strategy: (strategy) => this.setChoice({ rule: { ...this.choice.rule, strategy } }),
    count: (count) => this.setChoice({ rule: { ...this.choice.rule, count } }),
    again: () => this.setChoice({ seed: this.choice.seed + 1 }),
    morning: (morning) => this.setChoice({ morning }),
    noPressure: (noPressure) => this.setChoice({ noPressure }),
    cancel: () => this.close(),
    save: () => {
      this.onPick(this.choice)
      this.close()
    },
  }

  constructor(
    app: App,
    private choice: PickChoice,
    /** The names `rule` picks with `seed`, in order. */
    private preview: (rule: PickRule, seed: number) => string[],
    private onPick: (choice: PickChoice) => void,
  ) {
    super(app)
  }

  onOpen(): void {
    this.setTitle('Focus mode')
    this.modalEl.addClass('cd-modal')
    this.draw()
  }

  onClose(): void {
    render(null, this.contentEl)
  }

  private setChoice(change: Partial<PickChoice>): void {
    this.choice = { ...this.choice, ...change }
    this.draw()
  }

  private draw(): void {
    const { rule, seed, morning, noPressure } = this.choice
    render(
      <PicksForm
        rule={rule}
        morning={morning}
        noPressure={noPressure}
        preview={this.preview(rule, seed)}
        on={this.on}
      />,
      this.contentEl,
    )
  }
}
