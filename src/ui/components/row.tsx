import type { JSX } from 'preact'
import type { Chore } from '../../domain/chore'
import type { Day } from '../../domain/day'
import { summaryText } from '../../domain/friendly'
import type { Derived } from '../../domain/schedule'
import { rowModel, type RowModel, type RowSelect } from '../model/row-model'
import { useIcon, useTooltip } from './host'
import { isMenuKey, pressableProps } from './keys'
import { memo } from './memo'
import { Strip } from './strip'

/** Where a menu opens: at the pointer of a mouse event, or at a point in the window. */
export type MenuAnchor = MouseEvent | { x: number; y: number }

/** What a row can do; the Obsidian row kit implements it, created once per mount. */
export interface RowActions {
  tick(c: Chore): Promise<void>
  toggleExpanded(path: string): void
  rowMenu(c: Chore, select: RowSelect | undefined, at: MenuAnchor): void
  dotMenu(c: Chore, kind: 'done' | 'skip', d: Day, at: MenuAnchor): void
}

/** Starts picking with a row, or picks and unpicks it; created once by the caller. */
export interface SelectHandlers {
  start(path: string): void
  toggle(path: string): void
}

export interface RowProps {
  c: Chore
  /** `derive(c, today, early)`. */
  x: Derived
  today: Day
  early: boolean
  expanded: boolean
  justDone: boolean
  expandable: boolean
  alwaysOpen: boolean
  /** Set while picking, with whether this row is picked. */
  picking?: { selected: boolean }
  /** Whether the row menu offers Select; needs `on`. */
  selectable: boolean
  kit: RowActions
  on?: SelectHandlers
  /** A label after the meta line, such as the group a search result is in. */
  tag?: string
  /** Leaves out how late the chore is and when it was last done. */
  noPressure?: boolean
}

/** A chore's row, drawn from `rowModel` with the DOM `styles.css` and `keepFocus` expect. */
export function RowBody(props: RowProps): JSX.Element {
  const { c, x, today, justDone, picking, selectable, kit, on } = props
  const select: RowSelect | undefined =
    picking && on
      ? { mode: 'on', selected: picking.selected, toggle: () => on.toggle(c.path) }
      : selectable && on
        ? { mode: 'off', start: () => on.start(c.path) }
        : undefined
  const m = rowModel(c, x, today, {
    expanded: props.expanded,
    justDone,
    expandable: props.expandable,
    alwaysOpen: props.alwaysOpen,
    select,
  })
  const button = m.expandable && !m.toggle
  const { onKeyDown: press, ...pressAttrs } = pressableProps(`row:${c.path}`)

  const check = useTooltip<HTMLDivElement>(m.check.tooltip)
  useIcon(m.check.checked ? 'check' : undefined, check)

  return (
    <div
      class={m.classes.join(' ')}
      {...(button && { role: 'button', 'aria-expanded': m.open, ...pressAttrs })}
      onClick={() => {
        if (m.toggle) m.toggle()
        else if (m.expandable) kit.toggleExpanded(c.path)
      }}
      onContextMenu={(ev) => {
        ev.preventDefault()
        if (m.menu) kit.rowMenu(c, select, ev)
      }}
      onKeyDown={(ev) => {
        if (m.menu && isMenuKey(ev)) {
          ev.preventDefault()
          const { left, bottom } = ev.currentTarget.getBoundingClientRect()
          kit.rowMenu(c, select, { x: left, y: bottom })
        } else if (button) press(ev)
      }}
    >
      <div
        class="cd-check"
        role="checkbox"
        aria-checked={m.check.checked}
        {...pressableProps(`check:${c.path}`)}
        ref={check}
        onClick={(ev) => {
          ev.stopPropagation()
          if (m.toggle) m.toggle()
          else if (!justDone) void kit.tick(c)
        }}
      />
      <div class="cd-main">
        <span class="cd-name">{c.name}</span>
        {m.warning !== undefined && <Warning text={m.warning} />}
        <span class="cd-meta">
          <span class="cd-every">{m.meta.every}</span>
          {/* Keyed on whether it has a tooltip, so losing one swaps in a plain span. */}
          {!props.noPressure && (
            <LastDone key={m.meta.lastTooltip === undefined ? 'plain' : 'dated'} meta={m.meta} />
          )}
        </span>
        {props.tag !== undefined && <span class="cd-tag">{props.tag}</span>}
      </div>
      {!props.noPressure && <Due pill={m.pill} bar={m.bar} />}
      {m.open && (
        <div class="cd-hist">
          <Strip
            c={c}
            x={x}
            today={today}
            onDot={(ev, kind, d) => {
              ev.stopPropagation()
              kit.dotMenu(c, kind, d, ev)
            }}
          />
          <p class="cd-summary">{summaryText(c, x, today)}</p>
        </div>
      )}
    </div>
  )
}

/**
 * The separator and when the chore was last done. Drawn as its own component so its tooltip is set
 * whenever it mounts, as it does when No pressure turns off.
 */
function LastDone({ meta }: { meta: RowModel['meta'] }): JSX.Element {
  const last = useTooltip<HTMLSpanElement>(meta.lastTooltip, { placement: 'top' })
  return (
    <>
      <span class="cd-sep">{' · '}</span>
      <span class="cd-last" ref={last}>
        {meta.last}
      </span>
    </>
  )
}

/** The due pill and the progress bar, drawn as their own component for the same reason as `LastDone`. */
function Due({ pill, bar }: Pick<RowModel, 'pill' | 'bar'>): JSX.Element {
  const tip = useTooltip<HTMLSpanElement>(pill.tooltip)
  return (
    <>
      <span class={`cd-pill is-${pill.tone}`} ref={tip}>
        <span class="cd-long">{pill.long}</span>
        <span class="cd-short">{pill.short}</span>
      </span>
      <div class="cd-bar">
        <i
          class={bar.faded ? `is-${bar.tone} is-faded` : `is-${bar.tone}`}
          style={{ '--cd-fill': `${bar.fillPct}%` }}
        />
      </div>
    </>
  )
}

function Warning({ text }: { text: string }): JSX.Element {
  const ref = useIcon<HTMLSpanElement>('alert-triangle')
  useTooltip(text, undefined, ref)
  return <span class="cd-warn" ref={ref} />
}

/**
 * Whether a row can skip its render. It leaves out `x`, which is `derive(c, today, early)` and so
 * fixed by the props it compares (the chore registry keeps an unchanged `Chore` the same object),
 * and `on`, whose handlers the caller creates once.
 */
export function sameRowProps(a: RowProps, b: RowProps): boolean {
  return (
    a.c === b.c &&
    a.today === b.today &&
    a.early === b.early &&
    a.expanded === b.expanded &&
    a.justDone === b.justDone &&
    a.expandable === b.expandable &&
    a.alwaysOpen === b.alwaysOpen &&
    a.selectable === b.selectable &&
    a.kit === b.kit &&
    a.picking?.selected === b.picking?.selected &&
    a.tag === b.tag &&
    a.noPressure === b.noPressure
  )
}

/** A chore's row that skips its render while `sameRowProps` holds; key it by `c.path`. */
export const Row = memo(RowBody, sameRowProps)
