import type { Chore } from '../domain/chore'
import { shortDate, type Day } from '../domain/day'
import { dueText, everyText, lastDoneText, type DueText } from '../domain/friendly'
import type { Derived } from '../domain/schedule'

/** How a Chores view row takes part in picking several chores; the code block leaves it out. */
export type RowSelect =
  { mode: 'off'; start: () => void } | { mode: 'on'; selected: boolean; toggle: () => void }

/** The view's state for a row (expanded, just ticked) plus the options its caller passes. */
export interface RowState {
  expanded: boolean
  /** Ticked a moment ago and still settling. */
  justDone: boolean
  expandable?: boolean
  alwaysOpen?: boolean
  select?: RowSelect
}

/** What a chore's row shows and allows, for `RowKit.row` to paint. */
export interface RowModel {
  classes: string[]
  open: boolean
  check: { checked: boolean; tooltip: string }
  warning?: string
  meta: { every: string; last: string; lastTooltip?: string }
  pill: DueText & { tooltip: string }
  bar: { tone: 'bad' | 'warn' | 'ok'; fillPct: number; faded: boolean }
  /** Whether a click on the row expands it; never while picking. */
  expandable: boolean
  /** Picks or unpicks the row while picking; a click on the row or its check calls it. */
  toggle?: () => void
  /** Whether right-click or the menu key opens the row menu. */
  menu: boolean
}

export function rowModel(c: Chore, x: Derived, today: Day, state: RowState): RowModel {
  const picking = state.select?.mode === 'on' ? state.select : undefined
  const open = state.alwaysOpen || state.expanded
  return {
    classes: [
      'cd-row',
      open ? 'is-open' : '',
      state.justDone ? 'is-done-now' : '',
      picking ? 'is-picking' : '',
      picking?.selected ? 'is-selected' : '',
    ].filter(Boolean),
    open,
    check: {
      checked: picking ? picking.selected : state.justDone,
      tooltip: picking ? 'Select' : 'Done today',
    },
    ...(c.warnings.length > 0 && { warning: c.warnings.join('\n') }),
    meta: {
      every: everyText(c),
      last: lastDoneText(x.lastDone, today),
      ...(x.lastDone !== undefined && { lastTooltip: shortDate(x.lastDone) }),
    },
    pill: { ...dueText(c, x, today), tooltip: pillTooltip(c, x) },
    bar: {
      tone: barTone(x, today),
      fillPct: Math.max(0, Math.min(1, x.ratio)) * 100,
      faded: x.snoozed,
    },
    expandable: !picking && state.expandable !== false,
    ...(picking && { toggle: picking.toggle }),
    menu: !picking,
  }
}

/** Matches the pill's tone (`dueText`), except that the bar ignores snooze. */
function barTone(x: Derived, today: Day): RowModel['bar']['tone'] {
  if (x.due > today) return 'ok'
  return x.due < today || x.neverDone ? 'bad' : 'warn'
}

/** The pill's due date on hover, with the snooze date while snoozed. */
function pillTooltip(c: Chore, x: Derived): string {
  return x.snoozed && c.snoozedUntil !== undefined
    ? `Due ${shortDate(x.due)}, hidden until ${shortDate(c.snoozedUntil)}`
    : `Due ${shortDate(x.due)}`
}
