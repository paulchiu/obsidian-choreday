import type { Chore } from '../domain/chore'
import { shortDate, type Day } from '../domain/day'
import { dueText, everyText, lastDoneText, type DueText } from '../domain/friendly'
import type { Derived } from '../domain/schedule'

/** How a Chores view row takes part in picking several chores; the code block leaves it out. */
export type RowSelect =
  { mode: 'off'; start: () => void } | { mode: 'on'; selected: boolean; toggle: () => void }

/** A row's place in the view apart from its chore, and how its caller lets it behave. */
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
  pill: DueText & { tooltip?: string }
  bar: { tone: 'bad' | 'warn' | 'ok'; fillPct: number; faded: boolean }
  /** Whether a click on the row expands it; while picking, a click selects instead. */
  expandable: boolean
  /** Whether right-click or the menu key opens the row menu. */
  menu: boolean
}

export function rowModel(c: Chore, x: Derived, today: Day, state: RowState): RowModel {
  const picking = state.select?.mode === 'on' ? state.select : undefined
  const open = state.alwaysOpen || state.expanded
  const tooltip = pillTooltip(c, x, today)
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
    pill: { ...dueText(c, x, today), ...(tooltip !== undefined && { tooltip }) },
    bar: {
      tone: barTone(x, today),
      fillPct: Math.max(0, Math.min(1, x.ratio)) * 100,
      faded: x.snoozed,
    },
    expandable: !picking && state.expandable !== false,
    menu: !picking,
  }
}

/**
 * Unlike the pill's tone (`dueText`), the bar reads a never-done chore as overdue even when its due
 * date is ahead, and ignores snooze.
 */
function barTone(x: Derived, today: Day): RowModel['bar']['tone'] {
  return x.due < today || x.neverDone ? 'bad' : x.due === today ? 'warn' : 'ok'
}

/** The pill's due date on hover; a never-done chore that is due has none, even while snoozed. */
function pillTooltip(c: Chore, x: Derived, today: Day): string | undefined {
  if (x.neverDone && x.due <= today) return undefined
  return x.snoozed && c.snoozedUntil !== undefined
    ? `Due ${shortDate(x.due)}, hidden until ${shortDate(c.snoozedUntil)}`
    : `Due ${shortDate(x.due)}`
}
