import { setIcon, setTooltip } from 'obsidian'
import type { JSX } from 'preact'
import type { Chore } from '../../domain/chore'
import type { Day } from '../../domain/day'
import { summaryText } from '../../domain/friendly'
import type { Derived } from '../../domain/schedule'
import { useDomEffect } from './dom-effect'
import { isMenuKey, pressableProps } from './keys'
import { memo } from './memo'
import { rowModel, type RowSelect } from '../model/row-model'
import type { RowKit } from '../obsidian/row-kit'
import { Strip } from './strip'

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
  kit: RowKit
  on?: SelectHandlers
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

  const check = useDomEffect<HTMLDivElement>(
    (el) => setTooltip(el, m.check.tooltip),
    [m.check.tooltip],
  )
  useDomEffect(
    (el) => (m.check.checked ? setIcon(el, 'check') : el.empty()),
    [m.check.checked],
    check,
  )
  const last = useDomEffect<HTMLSpanElement>(
    (el) => {
      if (m.meta.lastTooltip !== undefined) setTooltip(el, m.meta.lastTooltip, { placement: 'top' })
    },
    [m.meta.lastTooltip],
  )
  const pill = useDomEffect<HTMLSpanElement>(
    (el) => setTooltip(el, m.pill.tooltip),
    [m.pill.tooltip],
  )

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
        if (m.menu) kit.rowMenu(c, select).showAtMouseEvent(ev)
      }}
      onKeyDown={(ev) => {
        if (m.menu && isMenuKey(ev)) {
          ev.preventDefault()
          const { left, bottom } = ev.currentTarget.getBoundingClientRect()
          kit.rowMenu(c, select).showAtPosition({ x: left, y: bottom })
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
          <span class="cd-sep">{' · '}</span>
          {/* Keyed on whether it has a tooltip, so losing one swaps in a plain span. */}
          <span
            class="cd-last"
            key={m.meta.lastTooltip === undefined ? 'plain' : 'dated'}
            ref={last}
          >
            {m.meta.last}
          </span>
        </span>
      </div>
      <span class={`cd-pill is-${m.pill.tone}`} ref={pill}>
        <span class="cd-long">{m.pill.long}</span>
        <span class="cd-short">{m.pill.short}</span>
      </span>
      <div class="cd-bar">
        <i
          class={m.bar.faded ? `is-${m.bar.tone} is-faded` : `is-${m.bar.tone}`}
          style={{ '--cd-fill': `${m.bar.fillPct}%` }}
        />
      </div>
      {m.open && (
        <div class="cd-hist">
          <Strip
            c={c}
            today={today}
            early={props.early}
            onDot={(ev, kind, d) => kit.dotMenu(ev, c, kind, d)}
          />
          <p class="cd-summary">{summaryText(c, x, today)}</p>
        </div>
      )}
    </div>
  )
}

function Warning({ text }: { text: string }): JSX.Element {
  const ref = useDomEffect<HTMLSpanElement>((el) => setIcon(el, 'alert-triangle'), [])
  useDomEffect((el) => setTooltip(el, text), [text], ref)
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
    a.picking?.selected === b.picking?.selected
  )
}

/** A chore's row that skips its render while `sameRowProps` holds; key it by `c.path`. */
export const Row = memo(RowBody, sameRowProps)
