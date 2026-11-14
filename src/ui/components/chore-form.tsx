import type { JSX, RefObject } from 'preact'
import { isAnchor, scheduleDays, type Anchor, type Chore } from '../../domain/chore'
import type { ChoreDraft } from '../../domain/chore-form'
import { MONDAY_FIRST, WEEKDAYS, shortDate, type Day } from '../../domain/day'
import { DAY_PRESETS, toggleDay } from '../../domain/day-picker'
import { isUnit, type Unit } from '../../domain/every'
import { dueLabel } from '../../domain/friendly'
import { turnItems, type Rotation } from '../../domain/rotation'
import { derive } from '../../domain/schedule'
import { useDomEffect } from './dom-effect'
import { useIcon } from './host'
import { pressableProps } from './keys'
import { Dropdown, FormButtons, SettingRow, Switch } from './setting-row'

const UNIT_LABELS: Record<Unit, string> = { d: 'days', w: 'weeks', m: 'months', y: 'years' }
const ANCHOR_LABELS: Record<Anchor, string> = { done: 'After last done', calendar: 'On set days' }

/** What each control of the chore form reports. */
export interface ChoreFormHandlers {
  name(v: string): void
  everyN(text: string): void
  rotating(on: boolean): void
  itemText(text: string): void
  addItems(text: string): void
  moveItem(index: number, by: -1 | 1): void
  removeItem(index: number): void
  startAt(index: number): void
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
  /** The Add field and Per turn as typed. */
  itemText: string
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
  itemText,
  perTurnText,
  original,
  today,
  early,
  saving = false,
  on,
}: ChoreFormProps): JSX.Element {
  const c = draft.chore
  const rotating = c.rotation !== undefined
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
        on={rotating}
        disabled={saving}
        flip={() => on.rotating(!rotating)}
      />
      {!rotating && original?.rotation && <RemovalWarning count={original.rotation.items.length} />}
      {c.rotation && (
        <div class="cd-rotate-group">
          <SettingRow name="Per turn" desc="How many items to do each time.">
            <InViewInput
              type="number"
              spellcheck={false}
              min="1"
              class="cd-per-turn"
              value={perTurnText}
              disabled={saving}
              onInput={(e) => on.perTurn(e.currentTarget.value)}
            />
          </SettingRow>
          <SettingRow
            name="Items"
            desc="Tap an item to start this turn there."
            cls="cd-rotate-setting"
          >
            <ItemList
              items={c.rotation.items}
              turn={turnItems(c.rotation)[0]}
              disabled={saving}
              on={on}
            />
            <AddItem text={itemText} disabled={saving} on={on} />
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

/** The rotation's items, one row each; a name starts this turn there, its buttons move or remove it. */
function ItemList({
  items,
  turn,
  disabled,
  on,
}: {
  items: readonly string[]
  /** The item this turn starts at, marked in its row. */
  turn: string | undefined
  disabled: boolean
  on: Pick<ChoreFormHandlers, 'moveItem' | 'removeItem' | 'startAt'>
}): JSX.Element {
  return (
    <ul class="cd-rotate-items">
      {items.map((item, i) => (
        <li key={item} class="cd-rotate-item">
          <span
            class="cd-item-name"
            role="button"
            aria-label={`Start this turn at ${item}`}
            aria-disabled={disabled}
            {...pressableProps(`item:${item}`)}
            onClick={() => {
              if (!disabled) on.startAt(i)
            }}
          >
            {item}
          </span>
          {item === turn && <span class="cd-this-turn">This turn</span>}
          <IconButton
            icon="arrow-up"
            label={`Move ${item} up`}
            disabled={disabled || i === 0}
            press={() => on.moveItem(i, -1)}
          />
          <IconButton
            icon="arrow-down"
            label={`Move ${item} down`}
            disabled={disabled || i === items.length - 1}
            press={() => on.moveItem(i, 1)}
          />
          <IconButton
            icon="x"
            label={`Remove ${item}`}
            cls="cd-item-remove"
            disabled={disabled}
            press={() => on.removeItem(i)}
          />
        </li>
      ))}
    </ul>
  )
}

/** The field under the list that adds what is typed in it as the last item. */
function AddItem({
  text,
  disabled,
  on,
}: {
  text: string
  disabled: boolean
  on: Pick<ChoreFormHandlers, 'itemText' | 'addItems'>
}): JSX.Element {
  const field = useKeptInView<HTMLInputElement>()
  return (
    <div class="cd-add-row">
      <input
        ref={field}
        type="text"
        class="cd-add-item"
        spellcheck={false}
        placeholder="Add an item"
        value={text}
        disabled={disabled}
        onInput={(e) => on.itemText(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          on.addItems(text)
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData?.getData('text/plain') ?? ''
          if (!pasted.includes('\n')) return
          e.preventDefault()
          const { value, selectionStart, selectionEnd } = e.currentTarget
          on.addItems(
            value.slice(0, selectionStart ?? value.length) +
              pasted +
              value.slice(selectionEnd ?? value.length),
          )
        }}
      />
      <IconButton
        icon="plus"
        label="Add item"
        cls="cd-add-button"
        disabled={disabled}
        press={() => {
          on.addItems(text)
          field.current?.focus()
        }}
      />
    </div>
  )
}

/**
 * Obsidian mobile's window event as the on-screen keyboard opens, sent once `--keyboard-height` is
 * set; iOS may not resize the visual viewport for it.
 */
const KEYBOARD_SHOW = 'keyboardWillShow'

/**
 * Scrolls the ref's element into view on focus, and again while it has focus as a phone's on-screen
 * keyboard opens: on `KEYBOARD_SHOW` or a visual viewport resize.
 */
function useKeptInView<T extends HTMLElement>(): RefObject<T | null> {
  return useDomEffect<T>((el) => {
    const win = el.ownerDocument.defaultView
    const viewport = win?.visualViewport
    const reveal = (): void => {
      if (el.ownerDocument.activeElement === el) el.scrollIntoView({ block: 'center' })
    }
    el.addEventListener('focus', reveal)
    viewport?.addEventListener('resize', reveal)
    win?.addEventListener(KEYBOARD_SHOW, reveal)
    return () => {
      el.removeEventListener('focus', reveal)
      viewport?.removeEventListener('resize', reveal)
      win?.removeEventListener(KEYBOARD_SHOW, reveal)
    }
  }, [])
}

/** An input kept in view above a phone's on-screen keyboard while it has focus. */
function InViewInput(props: JSX.IntrinsicElements['input']): JSX.Element {
  return <input ref={useKeptInView<HTMLInputElement>()} {...props} />
}

function IconButton({
  icon,
  label,
  cls,
  disabled,
  press,
}: {
  icon: string
  label: string
  cls?: string
  disabled: boolean
  press: () => void
}): JSX.Element {
  const ref = useIcon<HTMLButtonElement>(icon)
  return (
    <button
      ref={ref}
      type="button"
      class={cls ? `clickable-icon ${cls}` : 'clickable-icon'}
      aria-label={label}
      disabled={disabled}
      onClick={press}
    />
  )
}

/** Says that saving with rotation off drops the list the note has. */
function RemovalWarning({ count }: { count: number }): JSX.Element {
  return (
    <div class="cd-rotate-warning">{`Saving removes this chore's ${count} item${count === 1 ? '' : 's'}.`}</div>
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
