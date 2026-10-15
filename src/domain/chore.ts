import { dayOf, parseIso, parseWeekday, type Day } from './day'
import { parseEvery, type Every } from './every'
import { yamlString } from './frontmatter-edit'
import { isInFolder } from './names'

const ANCHORS = ['done', 'calendar'] as const
export type Anchor = (typeof ANCHORS)[number]

export const isAnchor = (v: unknown): v is Anchor => ANCHORS.some((a) => a === v)

/** Weekdays are 0 = Sunday, ascending; only a calendar chore has them. */
export type Schedule = { anchor: 'done' } | { anchor: 'calendar'; days: readonly number[] }

/** The weekdays a chore is set for, none when it counts from the last done date. */
export const scheduleDays = (s: Schedule): readonly number[] =>
  s.anchor === 'calendar' ? s.days : []

export interface Chore {
  /** Vault path of the chore note; the identity of a chore. */
  path: string
  /** The note's basename. */
  name: string
  every: Every
  schedule: Schedule
  /** Per-chore history limit, overriding the global setting. */
  keep?: number
  /** Per-chore early ticks rule, overriding the global setting. */
  early?: boolean
  /** Newest first. */
  done: Day[]
  /** Newest first. */
  skipped: Day[]
  snoozedUntil?: Day
  /** Hand-typed history entries that are not dates, as YAML text a write puts back unchanged. */
  unreadable: { done: string[]; skipped: string[] }
  /** Problems worth showing on the row; the chore still schedules. */
  warnings: string[]
}

export type ParseResult = { ok: true; chore: Chore } | { ok: false; problems: string[] }

export const isChoreFrontmatter = (
  fm: Record<string, unknown> | undefined,
): fm is Record<string, unknown> => fm?.type === 'chore'

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
  const unreadable: unknown[] = []
  for (const item of items) {
    const d = toDay(item)
    if (d === null) unreadable.push(item)
    else days.push(d)
  }
  if (unreadable.length)
    warnings.push(
      `${key} has entries that aren't YYYY-MM-DD dates: ${unreadable.map(show).join(', ')}`,
    )
  return {
    days: desc(days),
    unreadable: unreadable.map((u) => (typeof u === 'string' ? yamlString(u) : show(u))),
  }
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
  const anchor: Anchor = isAnchor(fm.anchor)
    ? fm.anchor
    : fm.anchor === undefined && (fm.days ?? fm.day) !== undefined
      ? 'calendar'
      : 'done'
  if (fm.anchor !== undefined && !isAnchor(fm.anchor))
    warnings.push(`anchor should be done or calendar, not ${show(fm.anchor)}`)

  const days = fm.days !== undefined ? parseDays(fm.days, warnings) : parseDay(fm.day, warnings)
  let schedule: Schedule = { anchor: 'done' }
  if (anchor === 'calendar') {
    if (days === undefined)
      warnings.push('calendar chores need a day, so this one counts from the last done date')
    else if (every.unit !== 'w')
      warnings.push('calendar chores repeat in weeks, so this one counts from the last done date')
    else schedule = { anchor, days }
  }

  let keep: number | undefined
  if (fm.keep !== undefined) {
    if (typeof fm.keep === 'number' && Number.isInteger(fm.keep) && fm.keep > 0) keep = fm.keep
    else warnings.push(`keep should be a whole number, not ${show(fm.keep)}`)
  }

  let early: boolean | undefined
  if (fm.early !== undefined) {
    if (typeof fm.early === 'boolean') early = fm.early
    else warnings.push(`early should be true or false, not ${show(fm.early)}`)
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
      schedule,
      ...(keep !== undefined && { keep }),
      ...(early !== undefined && { early }),
      done: done.days,
      skipped: skipped.days,
      ...(snoozedUntil !== undefined && { snoozedUntil }),
      unreadable: { done: done.unreadable, skipped: skipped.unreadable },
      warnings,
    },
  }
}

/** What the index keeps for a note: null unless it is a `type: chore` note inside `folder`. */
export function readChoreNote(
  path: string,
  name: string,
  fm: Record<string, unknown> | undefined,
  folder: string,
): ParseResult | null {
  if (!isInFolder(path, folder) || !isChoreFrontmatter(fm)) return null
  return parseChore(path, name, fm)
}
