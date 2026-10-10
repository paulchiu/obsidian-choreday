import type { Chore } from './chore'
import { MONTHS, WEEKDAYS, monthOf, shortDate, weekday, yearOf, type Day } from './day'
import type { Derived } from './schedule'
import { averageGap } from './schedule'

const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'}`
const shortWeekday = (d: Day): string => WEEKDAYS[weekday(d)]!.slice(0, 3)

/** Coarser units the further back: days, then weeks, then months, then month and year. */
export function lastDoneText(d: Day | undefined, today: Day): string {
  if (d === undefined) return 'never done'
  const n = today - d
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n < 7) return `last ${WEEKDAYS[weekday(d)]}`
  if (n === 7) return 'a week ago'
  if (n < 14) return `${n} days ago`
  if (n < 60) return `${plural(Math.round(n / 7), 'week')} ago`
  if (n < 365) return `${plural(Math.round(n / 30.44), 'month')} ago`
  return `${MONTHS[monthOf(d)]} ${yearOf(d)}`
}

export interface DueText {
  long: string
  short: string
  tone: 'bad' | 'warn' | 'none'
}

export function dueText(c: Chore, x: Derived, today: Day): DueText {
  if (x.snoozed && c.snoozedUntil !== undefined) {
    const s = c.snoozedUntil
    const when = s - today <= 7 ? shortWeekday(s) : shortDate(s).slice(4)
    return { long: `snoozed till ${when}`, short: `zz ${when}`, tone: 'warn' }
  }
  if (x.neverDone && x.due <= today) return { long: 'never done', short: 'new', tone: 'bad' }
  const n = x.due - today
  if (n < 0) {
    const late = -n
    return late < 14
      ? { long: `${plural(late, 'day')} late`, short: `${late}d late`, tone: 'bad' }
      : {
          long: `${plural(Math.floor(late / 7), 'week')} late`,
          short: `${Math.floor(late / 7)}w late`,
          tone: 'bad',
        }
  }
  if (n === 0) return { long: 'today', short: 'today', tone: 'warn' }
  if (n === 1) return { long: 'tomorrow', short: 'tmrw', tone: 'none' }
  if (n < 7) return { long: WEEKDAYS[weekday(x.due)]!, short: shortWeekday(x.due), tone: 'none' }
  if (n < 14) return { long: `in ${n} days`, short: `${n}d`, tone: 'none' }
  if (n < 60)
    return {
      long: `in ${plural(Math.round(n / 7), 'week')}`,
      short: `${Math.round(n / 7)}w`,
      tone: 'none',
    }
  return {
    long: `in ${plural(Math.round(n / 30.44), 'month')}`,
    short: `${Math.round(n / 30.44)}mo`,
    tone: 'none',
  }
}

/** Due date with a relative hint, as the edit preview shows it: `Tue 13 Oct (in 3 days)`. */
export function dueLabel(c: Chore, x: Derived, today: Day): string {
  const n = x.due - today
  const rel = n >= 2 && n < 7 ? `in ${n} days` : dueText(c, { ...x, snoozed: false }, today).long
  return `${shortDate(x.due)} (${rel})`
}

const UNIT_WORDS = { d: 'day', w: 'week', m: 'month', y: 'year' } as const

const shortDay = (d: number): string => WEEKDAYS[d]!.slice(0, 3)

const andList = (xs: string[]): string =>
  xs.length === 1 ? xs[0]! : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]!}`

/**
 * A set of weekdays as words, read Monday first. A run of three or more reads as a range, and
 * wraps past Sunday so Sunday to Thursday is one range. `weekly` picks the singular forms
 * ("every weekday") over the plural ones ("on weekdays").
 */
function daysText(days: number[], weekly: boolean): string {
  if (days.length === 1) return WEEKDAYS[days[0]!]!
  if (days.length === 7) return weekly ? 'day' : 'every day'
  if (days.join() === '1,2,3,4,5') return weekly ? 'weekday' : 'weekdays'
  const start = days.find((d) => !days.includes((d + 6) % 7))
  const run = start === undefined ? 0 : days.filter((_, i) => days.includes((start + i) % 7)).length
  if (start !== undefined && run === days.length && run >= 3)
    return `${shortDay(start)} to ${shortDay((start + run - 1) % 7)}`
  const mondayFirst = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  return andList(mondayFirst.map(shortDay))
}

export function everyText(c: Chore): string {
  const { n, unit } = c.every
  if (c.anchor === 'calendar') {
    const days = c.days ?? [0]
    return n === 1
      ? `every ${daysText(days, true)}`
      : `every ${n} weeks on ${daysText(days, false)}`
  }
  return n === 1 ? `every ${UNIT_WORDS[unit]}` : `every ${n} ${UNIT_WORDS[unit]}s`
}

/** The fact line under the history strip: count, real rhythm against the set interval, skips. */
export function summaryText(c: Chore, x: Derived, today: Day): string {
  if (
    x.lastSkip !== undefined &&
    (x.lastDone === undefined || x.lastSkip > x.lastDone) &&
    x.lastSkip >= today - 1
  )
    return `Skipped ${x.lastSkip > today ? shortDate(x.lastSkip) : lastDoneText(x.lastSkip, today)} · next due ${shortDate(x.due)}`
  if (!c.done.length) return 'Not done yet · due now'

  const parts: string[] = []
  if (c.anchor === 'calendar') {
    const days = c.days ?? [0]
    const recent = x.slots.slice(-(days.length === 1 ? 7 : 12))
    const hits = recent.filter((s) => s.outcome === 'done').length
    const of = days.length === 1 ? `${WEEKDAYS[days[0]!]!}s` : 'scheduled days'
    parts.push(`${hits} of the last ${recent.length} ${of}`)
  } else {
    const oldest = Math.min(...c.done)
    const since = MONTHS[monthOf(oldest)]! + (today - oldest > 330 ? ` ${yearOf(oldest)}` : '')
    parts.push(`Done ${plural(c.done.length, 'time')} since ${since}`)
    const gap = averageGap(c)
    if (gap !== undefined) {
      if (c.every.unit === 'm' || c.every.unit === 'y') {
        const months = Math.round(gap / 30.44)
        const set = c.every.unit === 'm' ? c.every.n : c.every.n * 12
        parts.push(
          `usually every ${plural(months, 'month')}${months === set ? '' : ` (set to ${set})`}`,
        )
      } else {
        const days = Math.round(gap)
        const set = c.every.n * (c.every.unit === 'w' ? 7 : 1)
        parts.push(`usually every ${plural(days, 'day')}${days === set ? '' : ` (set to ${set})`}`)
      }
    }
  }
  if (c.skipped.length) {
    const s = Math.max(...c.skipped)
    parts.push(`${c.skipped.length} skipped (${shortDate(s).slice(4)})`)
  }
  return parts.join(' · ')
}
