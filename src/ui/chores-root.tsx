import { setIcon, setTooltip } from 'obsidian'
import type { JSX } from 'preact'
import { caughtUpLine } from '../domain/cheer'
import type { BrokenChore } from '../domain/chore-registry'
import { shortDate, type Day } from '../domain/day'
import { allSelected, type ChoreSelection } from '../domain/selection'
import { Art } from './art'
import { useDomEffect } from './dom-effect'
import { focusKeyProps, groupProps, landingProps, pressableProps } from './keys'
import { laterNames, type Groups, type RowData } from './model/list-model'
import { drawArt } from './mascot'
import { CHEERING, CLIPBOARD, CONFETTI, PUZZLED, SLEEPING } from './model/mascot-art'
import { Row, type SelectHandlers } from './row'
import type { RowKit } from './rows'

/**
 * What the Chores view's controls do. The view creates these once and each reads the view's state
 * when called, so a row that skipped its render never acts on an old selection.
 */
export interface ViewHandlers {
  newChore(): void
  startSelect(path?: string): void
  cancelSelect(): void
  toggleSelected(path: string): void
  toggleGroup(paths: readonly string[]): void
  snoozePicked(ev: MouseEvent): void
  skipPicked(): void
  toggleLater(): void
  openNote(path: string): void
  /** `startSelect` and `toggleSelected` in the shape a row takes. */
  row: SelectHandlers
}

export interface ChoresRootProps {
  today: Day
  early: boolean
  groups: Groups
  broken: readonly BrokenChore[]
  /** Chores picked to snooze or skip together; null when not selecting. */
  selected: ChoreSelection | null
  showLater: boolean
  cheering: boolean
  kit: RowKit
  on: ViewHandlers
}

/** Select and Cancel share a focus key, so focus follows the button that toggles select mode. */
const MODE_KEY = 'mode'

/** The Chores view's body: Needs doing by urgency, Coming up by date, Later collapsed. */
export function ChoresRoot(p: ChoresRootProps): JSX.Element {
  const { needs, coming, later } = p.groups
  const all = [...needs, ...coming, ...later]
  const picked = p.selected && all.filter(({ c }) => p.selected?.has(c.path)).length
  return (
    <>
      <TopBar today={p.today} picked={picked} any={all.length > 0} on={p.on} />
      {all.length || p.broken.length ? (
        <List {...p} />
      ) : (
        <Scene
          svg={CLIPBOARD}
          cls="is-first-run"
          text="No chores yet. Add one with New chore, or give a note in your chores folder type: chore and every: 2w."
        />
      )}
    </>
  )
}

function List(p: ChoresRootProps): JSX.Element {
  const { needs, coming, later } = p.groups
  return (
    <>
      {needs.length > 0 && <Section key="Needs doing" label="Needs doing" rows={needs} view={p} />}
      {needs.length === 0 &&
        (p.cheering ? (
          <Scene svg={CHEERING} cls="is-cheering" text="All done for today." confetti={CONFETTI} />
        ) : (
          <Scene svg={SLEEPING} cls="is-caught-up" text={caughtUpLine(p.today)} />
        ))}
      {coming.length > 0 && <Section key="Coming up" label="Coming up" rows={coming} view={p} />}
      {later.length > 0 && <LaterToggle rows={later} view={p} />}
      {p.broken.length > 0 && <BrokenList broken={p.broken} on={p.on} />}
    </>
  )
}

/** A top bar button's focus key, icon, labels and action; `short` defaults to `long`. */
interface ButtonSpec {
  focus: string
  icon: string
  long: string
  short?: string
  disabled?: boolean
  onClick: (ev: MouseEvent) => void
}

function TopBar({
  today,
  picked,
  any,
  on,
}: {
  today: Day
  /** How many chores are picked, or null when not selecting. */
  picked: number | null
  any: boolean
  on: ViewHandlers
}): JSX.Element {
  const buttons: ButtonSpec[] =
    picked === null
      ? [
          ...(any
            ? [
                {
                  focus: MODE_KEY,
                  icon: 'square-check',
                  long: 'Select',
                  onClick: () => on.startSelect(),
                },
              ]
            : []),
          {
            focus: 'new',
            icon: 'plus',
            long: 'New chore',
            short: 'New',
            onClick: () => on.newChore(),
          },
        ]
      : [
          {
            focus: 'snooze',
            icon: 'alarm-clock',
            long: 'Snooze',
            disabled: !picked,
            onClick: (ev) => on.snoozePicked(ev),
          },
          {
            focus: 'skip',
            icon: 'skip-forward',
            long: 'Skip',
            disabled: !picked,
            onClick: () => on.skipPicked(),
          },
          {
            focus: MODE_KEY,
            icon: 'x',
            long: 'Cancel',
            short: '',
            onClick: () => on.cancelSelect(),
          },
        ]
  return (
    <div class="cd-top">
      <div class="cd-title">
        <h4>{picked === null ? 'Chores' : `${picked} selected`}</h4>
        {picked === null && <span class="cd-today-label">{shortDate(today)}</span>}
      </div>
      <div class="cd-actions" {...groupProps('top')}>
        {/* Keyed on whether it has a tooltip, so Select never inherits Cancel's. */}
        {buttons.map((b) => (
          <Button key={b.short === '' ? `${b.focus}:icon` : b.focus} {...b} />
        ))}
      </div>
    </div>
  )
}

/** A top bar button; an empty `short` leaves just the icon on narrow screens, with a tooltip. */
function Button({ focus, icon, long, short = long, disabled, onClick }: ButtonSpec): JSX.Element {
  const button = useDomEffect<HTMLButtonElement>(
    (el) => {
      if (short === '') setTooltip(el, long)
    },
    [long, short],
  )
  const glyph = useDomEffect<HTMLSpanElement>((el) => setIcon(el, icon), [icon])
  return (
    <button
      class="cd-button"
      {...focusKeyProps(focus)}
      disabled={disabled}
      ref={button}
      onClick={onClick}
    >
      <span ref={glyph} />
      <span class="cd-long">{long}</span>
      <span class="cd-short">{short}</span>
    </button>
  )
}

/** A group heading with its count, Select all or Clear while selecting, then its rows. */
function Section({
  label,
  rows,
  view,
}: {
  label: string
  rows: readonly RowData[]
  view: ChoresRootProps
}): JSX.Element {
  return (
    <div {...groupProps(label)}>
      <div class="cd-group" {...landingProps(`group:${label}`)}>
        <span>{`${label} · ${rows.length}`}</span>
        <GroupSelect label={label} rows={rows} view={view} />
      </div>
      <Rows rows={rows} view={view} />
    </div>
  )
}

/** The chores' rows, keyed by path so each keeps its node, and focus with it, across renders. */
function Rows({ rows, view }: { rows: readonly RowData[]; view: ChoresRootProps }): JSX.Element {
  const { today, early, selected, kit, on } = view
  return (
    <>
      {rows.map(({ c, now }) => (
        <Row
          key={c.path}
          c={c}
          x={now}
          today={today}
          early={early}
          expanded={kit.expanded.has(c.path)}
          justDone={kit.justDone.has(c.path)}
          expandable
          alwaysOpen={false}
          picking={selected ? { selected: selected.has(c.path) } : undefined}
          selectable
          kit={kit}
          on={on.row}
        />
      ))}
    </>
  )
}

/** Select all or Clear at the end of a group heading, while selecting. */
function GroupSelect({
  label,
  rows,
  view: { selected, on },
}: {
  label: string
  rows: readonly RowData[]
  view: ChoresRootProps
}): JSX.Element | null {
  if (!selected) return null
  const paths = rows.map(({ c }) => c.path)
  return (
    <a
      class="cd-group-select"
      href="#"
      {...pressableProps(`select:${label}`)}
      onClick={(ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        on.toggleGroup(paths)
      }}
    >
      {allSelected(selected, paths) ? 'Clear' : 'Select all'}
    </a>
  )
}

/** Later, collapsed to a list of names until its toggle opens it. */
function LaterToggle({
  rows,
  view,
}: {
  rows: readonly RowData[]
  view: ChoresRootProps
}): JSX.Element {
  const { showLater, today, on } = view
  const chevron = useDomEffect<HTMLSpanElement>(
    (el) => setIcon(el, showLater ? 'chevron-down' : 'chevron-right'),
    [showLater],
  )
  return (
    <div {...groupProps('Later')}>
      <div
        class="cd-later"
        role="button"
        aria-expanded={showLater}
        {...pressableProps('later')}
        onClick={() => on.toggleLater()}
      >
        <span class="cd-later-icon" ref={chevron} />
        <span>{`Later · ${rows.length}`}</span>
        {!showLater && <span class="cd-later-names">{` (${laterNames(rows, today)})`}</span>}
        {showLater && <GroupSelect label="Later" rows={rows} view={view} />}
      </div>
      {showLater && <Rows rows={rows} view={view} />}
    </div>
  )
}

/** Notes in the chores folder that could not be read as chores, each opening its note. */
function BrokenList({
  broken,
  on,
}: {
  broken: readonly BrokenChore[]
  on: ViewHandlers
}): JSX.Element {
  return (
    <div {...groupProps('Needs fixing')}>
      <div class="cd-group cd-fixing">
        <Art as="span" svg={PUZZLED} cls="is-puzzled" />
        <span>{`Needs fixing · ${broken.length}`}</span>
      </div>
      {broken.map((b) => (
        <Broken key={b.path} b={b} on={on} />
      ))}
    </div>
  )
}

function Broken({ b, on }: { b: BrokenChore; on: ViewHandlers }): JSX.Element {
  const warn = useDomEffect<HTMLSpanElement>((el) => setIcon(el, 'alert-triangle'), [])
  return (
    <div
      class="cd-broken"
      role="button"
      {...pressableProps(`broken:${b.path}`)}
      onClick={() => on.openNote(b.path)}
    >
      <span class="cd-warn" ref={warn} />
      <span class="cd-name">{b.name}</span>
      <span class="cd-meta">{b.problems.join('; ')}</span>
    </div>
  )
}

/** An illustration with a line of text under it; `confetti` is drawn over the art when given. */
function Scene({
  svg,
  cls,
  text,
  confetti,
}: {
  svg: string
  cls: string
  text: string
  confetti?: string
}): JSX.Element {
  const art = useDomEffect<HTMLDivElement>(
    (el) => {
      el.empty()
      drawArt(el, svg)
      if (confetti !== undefined) drawArt(el, confetti)
    },
    [svg, confetti],
  )
  return (
    <div class="cd-empty cd-scene">
      <div class={`cd-art ${cls}`} ref={art} />
      <div>{text}</div>
    </div>
  )
}
