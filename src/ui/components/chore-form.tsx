import type { JSX } from 'preact'
import { isAnchor, scheduleDays, type Anchor, type Chore } from '../../domain/chore'
import type { ChoreDraft } from '../../domain/chore-form'
import { MONDAY_FIRST, WEEKDAYS, shortDate, type Day } from '../../domain/day'
import { DAY_PRESETS, toggleDay } from '../../domain/day-picker'
import { isUnit, type Unit } from '../../domain/every'
import { dueLabel } from '../../domain/friendly'
import { derive } from '../../domain/schedule'
import { FormButtons, SettingRow } from './setting-row'

const UNIT_LABELS: Record<Unit, string> = { d: 'days', w: 'weeks', m: 'months', y: 'years' }
const ANCHOR_LABELS: Record<Anchor, string> = { done: 'After last done', calendar: 'On set days' }

/** What each control of the chore form reports. */
export interface ChoreFormHandlers {
  name(v: string): void
  everyN(text: string): void
  unit(u: Unit): void
  anchor(a: Anchor): void
  days(days: readonly number[]): void
  cancel(): void
  save(): void
}

interface ChoreFormProps {
  draft: ChoreDraft
  /** The Every field's text, which can differ from the repeat count while it is being retyped. */
  everyText: string
  /** The chore being edited, or `undefined` for a new one. */
  original: Chore | undefined
  today: Day
  early: boolean
  on: ChoreFormHandlers
}

/** Add and Edit share one form; Edit previews what the change does to the next due date. */
export function ChoreForm({
  draft,
  everyText,
  original,
  today,
  early,
  on,
}: ChoreFormProps): JSX.Element {
  const c = draft.chore
  return (
    <>
      <SettingRow name="Name">
        <input
          type="text"
          placeholder="Descale kettle"
          value={c.name}
          onInput={(e) => on.name(e.currentTarget.value)}
        />
      </SettingRow>
      <SettingRow name="Every">
        <input
          type="number"
          min="1"
          class="cd-every-n"
          value={everyText}
          onInput={(e) => on.everyN(e.currentTarget.value)}
        />
        <Dropdown
          options={UNIT_LABELS}
          value={c.every.unit}
          pick={(v) => {
            if (isUnit(v)) on.unit(v)
          }}
        />
      </SettingRow>
      <SettingRow name="Schedule">
        <Dropdown
          options={ANCHOR_LABELS}
          value={c.schedule.anchor}
          pick={(v) => {
            if (isAnchor(v)) on.anchor(v)
          }}
        />
      </SettingRow>
      {c.schedule.anchor === 'calendar' && (
        <DayPicker days={scheduleDays(c.schedule)} pick={(days) => on.days(days)} />
      )}
      <Preview c={c} original={original} today={today} early={early} />
      <FormButtons on={on} />
    </>
  )
}

/** A select over `options`, keyed by value, in the markup of Obsidian's dropdown. */
function Dropdown({
  options,
  value,
  pick,
}: {
  options: Record<string, string>
  value: string
  pick: (v: string) => void
}): JSX.Element {
  return (
    <select class="dropdown" value={value} onChange={(e) => pick(e.currentTarget.value)}>
      {Object.entries(options).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  )
}

/** The On row: a chip per weekday, Monday first, and the presets. */
function DayPicker({
  days,
  pick,
}: {
  days: readonly number[]
  pick: (days: readonly number[]) => void
}): JSX.Element {
  return (
    <SettingRow name="On" cls="cd-day-setting">
      <div class="cd-chips">
        {MONDAY_FIRST.map((day) => {
          const on = days.includes(day)
          const name = WEEKDAYS[day]!
          return (
            <button
              key={day}
              type="button"
              class={on ? 'cd-chip is-on' : 'cd-chip'}
              aria-label={name}
              aria-pressed={on}
              onClick={() => pick(toggleDay(days, day))}
            >
              {name.slice(0, 2)}
            </button>
          )
        })}
      </div>
      <div class="cd-presets">
        {DAY_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            class="cd-preset"
            onClick={() => pick(preset.days)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </SettingRow>
  )
}

/** When a new chore first falls due, or how an edit moves the next due date. */
function Preview({
  c,
  original,
  today,
  early,
}: {
  c: Chore
  original: Chore | undefined
  today: Day
  early: boolean
}): JSX.Element {
  if (!original) {
    const due = derive(c, today, early).due
    return (
      <div class="cd-preview">
        {due === today
          ? 'Due today, since it has never been done.'
          : `First due ${shortDate(due)}.`}
      </div>
    )
  }
  const label = (chore: Chore): string => dueLabel(chore, derive(chore, today, early), today)
  const before = label(original)
  const now = label(c)
  if (before === now) return <div class="cd-preview">{`Next due stays ${now}.`}</div>
  return (
    <div class="cd-preview">
      Next due moves from <b>{before}</b> to <b>{now}</b>. History is unchanged.
    </div>
  )
}
