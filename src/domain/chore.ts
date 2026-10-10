import { dayOf, parseIso, parseWeekday, type Day } from './day'
import { parseEvery, type Every } from './every'

export type Anchor = 'done' | 'calendar'

export interface Chore {
  /** Vault path of the chore note; the identity of a chore. */
  path: string
  /** The note's basename. */
  name: string
  every: Every
  anchor: Anchor
  /** Weekdays for calendar chores, ascending, 0 = Sunday. */
  days?: number[]
  /** Per-chore history limit, overriding the global setting. */
  keep?: number
  /** Newest first. */
  done: Day[]
  /** Newest first. */
  skipped: Day[]
  snoozedUntil?: Day
  /** Hand-typed history entries that are not dates. Kept verbatim on write, never shown. */
  unreadable: { done: string[]; skipped: string[] }
  /** Problems worth showing on the row; the chore still schedules. */
  warnings: string[]
}

export type ParseResult = { ok: true; chore: Chore } | { ok: false; problems: string[] }

export const isChoreFrontmatter = (fm: Record<string, unknown> | undefined): boolean =>
  fm?.type === 'chore'

/** Hand-typed values echoed back in warnings; objects show as JSON rather than [object Object]. */
const show = (value: unknown): string =>
  typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)

const desc = (ds: Day[]): Day[] => [...new Set(ds)].sort((a, b) => b - a)

/** YAML parsers that follow the timestamp type hand back bare dates as `Date` at UTC midnight. */
function toDay(value: unknown): Day | null {
  if (typeof value === 'string') return parseIso(value)
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return dayOf(new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  return null
}

function parseDates(
  key: string,
  value: unknown,
  warnings: string[],
): { days: Day[]; unreadable: string[] } {
  if (value === undefined || value === null) return { days: [], unreadable: [] }
  const items = Array.isArray(value) ? (value as unknown[]) : [value]
  const days: Day[] = []
  const unreadable: string[] = []
  for (const item of items) {
    const d = toDay(item)
    if (d === null) unreadable.push(show(item))
    else days.push(d)
  }
  if (unreadable.length)
    warnings.push(`${key} has entries that aren't YYYY-MM-DD dates: ${unreadable.join(', ')}`)
  return { days: desc(days), unreadable }
}

function parseDay(value: unknown, warnings: string[]): number[] | undefined {
  if (value === undefined) return undefined
  const parsed = typeof value === 'string' ? parseWeekday(value) : null
  if (parsed === null) warnings.push(`day should be a weekday such as tuesday, not ${show(value)}`)
  return parsed === null ? undefined : [parsed]
}

function parseDays(value: unknown, warnings: string[]): number[] | undefined {
  const items = Array.isArray(value) ? (value as unknown[]) : [value]
  const days: number[] = []
  const unreadable: string[] = []
  for (const item of items) {
    const parsed = typeof item === 'string' ? parseWeekday(item) : null
    if (parsed === null) unreadable.push(show(item))
    else days.push(parsed)
  }
  if (unreadable.length)
    warnings.push(`days has entries that aren't weekdays: ${unreadable.join(', ')}`)
  return days.length ? [...new Set(days)].sort((a, b) => a - b) : undefined
}

/**
 * Reads a chore from parsed frontmatter. Only `every` is fatal; anything else that is malformed
 * becomes a warning and is left in the note untouched.
 */
export function parseChore(path: string, name: string, fm: Record<string, unknown>): ParseResult {
  const every = parseEvery(fm.every)
  if (!every)
    return {
      ok: false,
      problems: [
        fm.every === undefined
          ? 'every is missing (e.g. every: 2w)'
          : `every should look like 2w, 3m or 1y, not ${show(fm.every)}`,
      ],
    }

  const warnings: string[] = []
  let anchor: Anchor = 'done'
  if (fm.anchor === 'calendar') anchor = 'calendar'
  else if (fm.anchor !== undefined && fm.anchor !== 'done')
    warnings.push(`anchor should be done or calendar, not ${show(fm.anchor)}`)

  const days =
    fm.days !== undefined ? parseDays(fm.days, warnings) : parseDay(fm.day, warnings)
  if (anchor === 'calendar' && days === undefined) {
    anchor = 'done'
    warnings.push('calendar chores need a day, so this one counts from the last done date')
  }
  if (anchor === 'calendar' && every.unit !== 'w') {
    anchor = 'done'
    warnings.push('calendar chores repeat in weeks, so this one counts from the last done date')
  }

  let keep: number | undefined
  if (fm.keep !== undefined) {
    if (typeof fm.keep === 'number' && Number.isInteger(fm.keep) && fm.keep > 0) keep = fm.keep
    else warnings.push(`keep should be a whole number, not ${show(fm.keep)}`)
  }

  let snoozedUntil: Day | undefined
  if (fm.snoozed_until !== undefined && fm.snoozed_until !== null) {
    const d = toDay(fm.snoozed_until)
    if (d === null)
      warnings.push(`snoozed_until isn't a YYYY-MM-DD date: ${show(fm.snoozed_until)}`)
    else snoozedUntil = d
  }

  const done = parseDates('done', fm.done, warnings)
  const skipped = parseDates('skipped', fm.skipped, warnings)

  return {
    ok: true,
    chore: {
      path,
      name,
      every,
      anchor,
      ...(days !== undefined && { days }),
      ...(keep !== undefined && { keep }),
      done: done.days,
      skipped: skipped.days,
      ...(snoozedUntil !== undefined && { snoozedUntil }),
      unreadable: { done: done.unreadable, skipped: skipped.unreadable },
      warnings,
    },
  }
}
