import type { JSX } from 'preact'
import { isAnchor, scheduleDays, type Anchor, type Chore } from '../../domain/chore'
import type { ChoreDraft } from '../../domain/chore-form'
import { MONDAY_FIRST, WEEKDAYS, shortDate, type Day } from '../../domain/day'
import { DAY_PRESETS, toggleDay } from '../../domain/day-picker'
import { isUnit, type Unit } from '../../domain/every'
import { dueLabel } from '../../domain/friendly'
import { turnItems, type Rotation } from '../../domain/rotation'
import { derive } from '../../domain/schedule'
import { Dropdown, FormButtons, SettingRow, Switch } from './setting-row'

const UNIT_LABELS: Record<Unit, string> = { d: 'days', w: 'weeks', m: 'months', y: 'years' }
const ANCHOR_LABELS: Record<Anchor, string> = { done: 'After last done', calendar: 'On set days' }
/** Items grows with its lines between these; past the most it scrolls. */
const ITEMS_ROWS = { least: 2, most: 8 }

const itemsRows = (text: string): number =>
  Math.min(ITEMS_ROWS.most, Math.max(ITEMS_ROWS.least, text.split('\n').length))

/** What each control of the chore form reports. */
export interface ChoreFormHandlers {
  name(v: string): void
  everyN(text: string): void
  rotating(on: boolean): void
  rotate(text: string): void
  perTurn(text: string): void
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
  /** Rotate through and Per turn as typed. */
  rotateText: string
  perTurnText: string
  /** The chore being edited, or `undefined` for a new one. */
  original: Chore | undefined
  today: Day
  early: boolean
  saving?: boolean
  on: ChoreFormHandlers
}

/** Add and Edit share one form; Edit previews what the change does to the next due date. */
export function ChoreForm({
  draft,
  everyText,
  rotateText,
  perTurnText,
  original,
  today,
  early,
  saving = false,
  on,
}: ChoreFormProps): JSX.Element {
  const c = draft.chore
  return (
    <>
      <SettingRow name="Name">
        <input
          type="text"
          spellcheck={false}
          placeholder="Descale kettle"
          value={c.name}
          disabled={saving}
          onInput={(e) => on.name(e.currentTarget.value)}
        />
      </SettingRow>
      <SettingRow name="Every">
        <input
          type="number"
          spellcheck={false}
          min="1"
          class="cd-every-n"
          value={everyText}
          disabled={saving}
          onInput={(e) => on.everyN(e.currentTarget.value)}
        />
        <Dropdown
          options={UNIT_LABELS}
          value={c.every.unit}
          disabled={saving}
          pick={(v) => {
            if (isUnit(v)) on.unit(v)
          }}
        />
      </SettingRow>
      <SettingRow name="Schedule">
        <Dropdown
          options={ANCHOR_LABELS}
          value={c.schedule.anchor}
          disabled={saving}
          pick={(v) => {
            if (isAnchor(v)) on.anchor(v)
          }}
        />
      </SettingRow>
      {c.schedule.anchor === 'calendar' && (
        <DayPicker
          days={scheduleDays(c.schedule)}
          disabled={saving}
          pick={(days) => on.days(days)}
        />
      )}
      <Switch
        name="Rotate through a list"
        desc="Take turns at a few items each time."
        on={c.rotation !== undefined}
        disabled={saving}
        flip={() => on.rotating(c.rotation === undefined)}
      />
      {c.rotation && (
        <div class="cd-rotate-group">
          <SettingRow name="Per turn" desc="How many items to do each time.">
            <input
              type="number"
              spellcheck={false}
              min="1"
              class="cd-per-turn"
              value={perTurnText}
              disabled={saving}
              onInput={(e) => on.perTurn(e.currentTarget.value)}
            />
          </SettingRow>
          <SettingRow name="Items" desc="One per line." cls="cd-rotate-setting">
            <textarea
              rows={itemsRows(rotateText)}
              spellcheck={false}
              value={rotateText}
              disabled={saving}
              onInput={(e) => on.rotate(e.currentTarget.value)}
            />
          </SettingRow>
          {c.rotation.items.length ? <TurnPreview r={c.rotation} /> : null}
        </div>
      )}
      <Preview c={c} original={original} today={today} early={early} />
      <FormButtons on={on} saving={saving} />
    </>
  )
}

/** The On row: a chip per weekday, Monday first, and the presets. */
function DayPicker({
  days,
  pick,
  disabled = false,
}: {
  days: readonly number[]
  pick: (days: readonly number[]) => void
  disabled?: boolean
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
              disabled={disabled}
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
            disabled={disabled}
            onClick={() => pick(preset.days)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </SettingRow>
  )
}

/** This turn's items and the next two turns'. */
function TurnPreview({ r }: { r: Rotation }): JSX.Element {
  return (
    <ul class="cd-turns">
      {['This turn:', 'Then:', 'Then:'].map((label, ahead) => (
        <li key={ahead}>
          <b>{label}</b> {turnItems(r, ahead).join(', ')}
        </li>
      ))}
    </ul>
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
