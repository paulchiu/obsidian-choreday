/** Day numbers (UTC days since epoch) keep date maths free of time zones. */
export type Day = number

const DAY_MS = 86_400_000

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/** Weekdays in display order, Monday first; values are 0 = Sunday. */
export const MONDAY_FIRST: readonly number[] = [1, 2, 3, 4, 5, 6, 0]

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const asDate = (d: Day): Date => new Date(d * DAY_MS)

/** Today in the user's local calendar, as a day number. */
export function dayOf(date: Date): Day {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

/** Strict `YYYY-MM-DD`; rejects impossible dates such as `2026-02-30`. */
export function parseIso(value: string): Day | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = Date.UTC(y, mo - 1, d)
  const back = new Date(t)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d)
    return null
  return t / DAY_MS
}

export const toIso = (d: Day): string => asDate(d).toISOString().slice(0, 10)
/** Remainder that stays in `[0, n)` for negative `a`, unlike `%`. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n

/** 0 = Sunday; day 0 (1 Jan 1970) is a Thursday. */
export const weekday = (d: Day): number => mod(d + 4, 7)
export const monthOf = (d: Day): number => asDate(d).getUTCMonth()
export const yearOf = (d: Day): number => asDate(d).getUTCFullYear()
export const firstOfMonth = (d: Day): Day => Date.UTC(yearOf(d), monthOf(d), 1) / DAY_MS

/** `Wed 2 Sep` */
export function shortDate(d: Day): string {
  return `${WEEKDAYS[weekday(d)]!.slice(0, 3)} ${asDate(d).getUTCDate()} ${MONTHS[monthOf(d)]!.slice(0, 3)}`
}

/** Adds calendar months, clamping to the last day of a shorter month (31 Jan + 1 month = 28 Feb). */
export function addMonths(d: Day, n: number): Day {
  const dt = asDate(d)
  const m = dt.getUTCMonth() + n
  const y = dt.getUTCFullYear() + Math.floor(m / 12)
  const month = ((m % 12) + 12) % 12
  const last = new Date(Date.UTC(y, month + 1, 0)).getUTCDate()
  return Date.UTC(y, month, Math.min(dt.getUTCDate(), last)) / DAY_MS
}

/** Accepts full or three-letter weekday names in any case; 0 = Sunday. */
export function parseWeekday(value: string): number | null {
  const v = value.trim().toLowerCase()
  const i = WEEKDAYS.findIndex((w) => w.toLowerCase() === v || w.toLowerCase().slice(0, 3) === v)
  return i === -1 ? null : i
}
