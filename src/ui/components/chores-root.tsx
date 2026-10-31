import type { JSX } from 'preact'
import { caughtUpLine } from '../../domain/cheer'
import type { BrokenChore } from '../../domain/chore-registry'
import { STRATEGY_LABELS, type TodayPicks } from '../../domain/picks'
import { longDate, shortDate, type Day } from '../../domain/day'
import { allSelected, type ChoreSelection } from '../../domain/selection'
import { laterNames, type Groups, type RowData } from '../model/list-model'
import { CHEERING, CLIPBOARD, CONFETTI, PUZZLED, SLEEPING } from '../model/mascot-art'
import { Art } from './art'
import { useIcon, useTooltip } from './host'
import { focusKeyProps, groupProps, landingProps, pressableProps } from './keys'
import { Row, type RowActions, type SelectHandlers } from './row'

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
  showAll(): void
  /** Opens the pick form. */
  changePicks(): void
  toggleSearch(): void
  searchFor(text: string): void
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
  /** The search text, or null when search is closed. */
  search: string | null
  /** Today's picks, or null to list everything. */
  picks: Picks | null
  cheering: boolean
  kit: RowActions
  /** Paths of the rows showing their history. */
  expanded: ReadonlySet<string>
  /** Paths of the rows ticked a moment ago and still settling. */
  settling: ReadonlySet<string>
  on: ViewHandlers
}

/** Select and Cancel share a focus key, so focus follows the button that toggles select mode. */
const MODE_KEY = 'mode'

/** The Chores view's body: Needs doing by urgency, Coming up by date, Later collapsed. */
export function ChoresRoot(p: ChoresRootProps): JSX.Element {
  const { needs, coming, later } = p.groups
  const all = [...needs, ...coming, ...later]
  const picked = p.selected && all.filter(({ c }) => p.selected?.has(c.path)).length
  const query = p.search?.trim() ?? ''
  return (
    <>
      <TopBar today={p.today} picked={picked} any={all.length > 0} on={p.on} />
      {p.picks && picked === null && <PicksLine picks={p.picks} on={p.on} />}
      {p.search !== null && <SearchField text={p.search} on={p.on} />}
      {query ? (
        <SearchResults query={query} view={p} />
      ) : p.picks ? (
        <Picked picks={p.picks} view={p} />
      ) : all.length || p.broken.length ? (
        <List {...p} />
      ) : (
        <Scene
          svg={CLIPBOARD}
          cls="is-first-run"
          text="Nothing here yet. Press + to add one, or give a note in your folder type: chore and every: 2w."
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
      {needs.length === 0 && <CaughtUp view={p} />}
      {coming.length > 0 && <Section key="Coming up" label="Coming up" rows={coming} view={p} />}
      {later.length > 0 && <LaterToggle rows={later} view={p} />}
      {p.broken.length > 0 && <BrokenList broken={p.broken} on={p.on} />}
    </>
  )
}

/** The cheering cat right after the last tick, then the sleeping one. */
function CaughtUp({ view }: { view: ChoresRootProps }): JSX.Element {
  return view.cheering ? (
    <Scene svg={CHEERING} cls="is-cheering" text="All done for today." confetti={CONFETTI} />
  ) : (
    <Scene svg={SLEEPING} cls="is-caught-up" text={caughtUpLine(view.today)} />
  )
}

type Picks = Extract<TodayPicks, { kind: 'picked' }>

/** Today's picks still needing doing, then how many others are hidden till tomorrow. */
function Picked({ picks, view }: { picks: Picks; view: ChoresRootProps }): JSX.Element {
  const chosen = new Set(picks.paths)
  const rows = view.groups.needs.filter(({ c }) => chosen.has(c.path))
  const hidden = view.groups.needs.length - rows.length
  return (
    <>
      {rows.length > 0 ? (
        <Section key="Today" label="Today" rows={rows} view={view} />
      ) : (
        <CaughtUp view={view} />
      )}
      {hidden > 0 && (
        <div class="cd-hidden">
          {`${hidden} more ${hidden === 1 ? 'needs' : 'need'} doing, hidden till tomorrow`}
        </div>
      )}
      {view.broken.length > 0 && <BrokenList broken={view.broken} on={view.on} />}
    </>
  )
}

/** The rule today's picks were made by, with Change and Show all. */
function PicksLine({ picks, on }: { picks: Picks; on: ViewHandlers }): JSX.Element {
  const link = (focus: string, text: string, act: () => void): JSX.Element => (
    <a
      href="#"
      {...pressableProps(focus)}
      onClick={(ev) => {
        ev.preventDefault()
        act()
      }}
    >
      {text}
    </a>
  )
  return (
    <div class="cd-picks-line">
      {`Today's picks: ${STRATEGY_LABELS[picks.rule.strategy]} · `}
      {link('change-picks', 'Change', () => on.changePicks())}
      {' · '}
      {link('show-all', 'Show all', () => on.showAll())}
    </div>
  )
}

/**
 * A top bar button's focus key, icon, labels and action; `short` defaults to `long`. An `iconOnly`
 * button shows just its icon, with `long` as its tooltip.
 */
interface ButtonSpec {
  focus: string
  icon: string
  long: string
  short?: string
  iconOnly?: boolean
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
          {
            focus: 'search',
            icon: 'search',
            long: 'Search',
            iconOnly: true,
            onClick: () => on.toggleSearch(),
          },
          ...(any
            ? [
                {
                  focus: 'picks',
                  icon: 'clipboard-list',
                  long: 'Pick for today',
                  iconOnly: true,
                  onClick: () => on.changePicks(),
                },
                {
                  focus: MODE_KEY,
                  icon: 'square-check',
                  long: 'Select',
                  iconOnly: true,
                  onClick: () => on.startSelect(),
                },
              ]
            : []),
          {
            focus: 'new',
            icon: 'plus',
            long: 'New',
            iconOnly: true,
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
        <h4>
          {picked === null ? (
            <>
              <span class="cd-long">{longDate(today)}</span>
              <span class="cd-short">{shortDate(today)}</span>
            </>
          ) : (
            `${picked} selected`
          )}
        </h4>
      </div>
      <div class="cd-actions" {...groupProps('top')}>
        {/* Keyed on whether it has a tooltip, so Select never inherits Cancel's. */}
        {buttons.map((b) => (
          <Button key={b.short === '' || b.iconOnly ? `${b.focus}:icon` : b.focus} {...b} />
        ))}
      </div>
    </div>
  )
}

/** A top bar button; an empty `short` leaves just the icon on narrow screens, with a tooltip. */
function Button({
  focus,
  icon,
  long,
  short = long,
  iconOnly = false,
  disabled,
  onClick,
}: ButtonSpec): JSX.Element {
  const button = useTooltip<HTMLButtonElement>(short === '' || iconOnly ? long : undefined)
  const glyph = useIcon<HTMLSpanElement>(icon)
  return (
    <button
      class="cd-button"
      {...focusKeyProps(focus)}
      aria-label={iconOnly ? long : undefined}
      disabled={disabled}
      ref={button}
      onClick={onClick}
    >
      <span ref={glyph} />
      {!iconOnly && <span class="cd-long">{long}</span>}
      {!iconOnly && <span class="cd-short">{short}</span>}
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

/**
 * The chores' rows, keyed by path so each keeps its node, and focus with it, across renders. `tag`
 * labels each row, as search does with its group.
 */
function Rows({
  rows,
  view,
  tag,
}: {
  rows: readonly RowData[]
  view: ChoresRootProps
  tag?: (r: RowData) => string
}): JSX.Element {
  const { today, early, selected, kit, expanded, settling, on } = view
  return (
    <>
      {rows.map((r) => (
        <Row
          key={r.c.path}
          c={r.c}
          tag={tag?.(r)}
          x={r.now}
          today={today}
          early={early}
          expanded={expanded.has(r.c.path)}
          justDone={settling.has(r.c.path)}
          expandable
          alwaysOpen={false}
          picking={selected ? { selected: selected.has(r.c.path) } : undefined}
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
  const chevron = useIcon<HTMLSpanElement>(showLater ? 'chevron-down' : 'chevron-right')
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

/** The search box under the top bar; Escape closes search. */
function SearchField({ text, on }: { text: string; on: ViewHandlers }): JSX.Element {
  return (
    <input
      type="search"
      class="cd-search"
      placeholder="Search"
      spellcheck={false}
      value={text}
      {...focusKeyProps('search-field')}
      onInput={(e) => on.searchFor(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        on.toggleSearch()
      }}
    />
  )
}

const GROUP_LABELS = { needs: 'Needs doing', coming: 'Coming up', later: 'Later' } as const

/** Every chore whose name contains `query`, in group order, each tagged with its group. */
function SearchResults({ query, view }: { query: string; view: ChoresRootProps }): JSX.Element {
  const q = query.toLowerCase()
  const hits = (['needs', 'coming', 'later'] as const).flatMap((g) =>
    view.groups[g].filter(({ c }) => c.name.toLowerCase().includes(q)).map((r) => ({ r, g })),
  )
  if (!hits.length)
    return <Scene svg={PUZZLED} cls="is-puzzled" text={`Nothing matches "${query}".`} />
  const groupOf = new Map(hits.map(({ r, g }) => [r.c.path, GROUP_LABELS[g]]))
  return (
    <div {...groupProps('Search')}>
      <Rows rows={hits.map(({ r }) => r)} view={view} tag={(r) => groupOf.get(r.c.path) ?? ''} />
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
  const warn = useIcon<HTMLSpanElement>('alert-triangle')
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
  return (
    <div class="cd-empty cd-scene">
      <Art svg={svg} cls={cls} over={confetti} />
      <div>{text}</div>
    </div>
  )
}
