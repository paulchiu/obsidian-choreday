import { scheduleDays, type Chore } from '../../domain/chore'
import {
  MONTHS,
  addMonths,
  firstOfMonth,
  monthOf,
  shortDate,
  yearOf,
  type Day,
} from '../../domain/day'
import { step } from '../../domain/every'
import type { Derived } from '../../domain/schedule'

export const STRIP_HEIGHT = 44
export const STRIP_PAD = 14

/** A circle on the strip's base line. */
export type Mark =
  { kind: 'miss' | 'skip' | 'done'; x: number } | { kind: 'due'; x: number; late: boolean }

/** A hover target over a mark; one with a `dot` is clickable, one without is passive. */
export interface Hit {
  x: number
  tip: string
  dot?: { kind: 'done' | 'skip'; d: Day }
}

/** The history strip as shapes, with every coordinate in px across `width`, in drawing order. */
export interface StripModel {
  width: number
  label: string
  /** The span from the due date to today, when overdue. */
  late?: { x: number; width: number }
  ticks: number[]
  months: { x: number; label: string }[]
  today: number
  marks: Mark[]
  hits: Hit[]
}

/** The days the strip spans and where a day falls across `width`. */
export interface StripScale {
  start: Day
  end: Day
  px: (d: Day) => number
}

/**
 * Spans about six intervals back and one ahead, so every chore reads at the same density; chores on
 * several days a week look back three of their weeks instead, or the ticks crowd a phone-width
 * strip.
 */
export function stripScale(c: Chore, x: Derived, today: Day, width: number): StripScale {
  const slotsPerInterval = c.schedule.anchor === 'calendar' ? scheduleDays(c.schedule).length : 1
  const start = slotsPerInterval > 1 ? today - 21 * c.every.n - 2 : step(today, c.every, -6) - 4
  const end =
    Math.max(today, x.due) + ((step(today, c.every, 1) - today) / slotsPerInterval) * 0.6 + 1
  const span = end - start
  return {
    start,
    end,
    px: (d) => STRIP_PAD + ((width - 2 * STRIP_PAD) * (d - start)) / span,
  }
}

/** The month starts inside the window, thinned to about seven labels (four on a narrow strip). */
function monthLabels({ start, end, px }: StripScale, width: number): StripModel['months'] {
  const months: Day[] = []
  for (let m = firstOfMonth(start); m <= end; m = addMonths(m, 1))
    if (m >= start && px(m) < width - 30) months.push(m)
  const every = Math.ceil(months.length / (width > 400 ? 7 : 4))
  return months
    .filter((_, i) => i % every === 0)
    .map((m) => ({
      x: px(m),
      label: MONTHS[monthOf(m)]!.slice(0, 3) + (monthOf(m) === 0 ? ` ${yearOf(m)}` : ''),
    }))
}

/** The interval ticks back from the due date (or the calendar slots) and the one after it. */
function tickDays(c: Chore, x: Derived, start: Day): Day[] {
  const back: Day[] = []
  if (c.schedule.anchor === 'calendar') back.push(...x.slots.map((s) => s.slot))
  else for (let n = 1; step(x.due, c.every, -n) >= start; n++) back.push(step(x.due, c.every, -n))
  return [...back, x.following ?? step(x.due, c.every, 1)]
}

/** The strip for `c` on `today` at `width` px, drawn by `Strip`. */
export function stripModel(c: Chore, x: Derived, today: Day, width: number): StripModel {
  const scale = stripScale(c, x, today, width)
  const { start, end, px } = scale
  const late = x.due < today
  const misses = x.slots.filter((s) => s.outcome === 'missed' && s.slot >= start).map((s) => s.slot)
  const dots = [
    ...c.skipped.map((d) => ({ kind: 'skip' as const, d })),
    ...c.done.map((d) => ({ kind: 'done' as const, d })),
  ].filter(({ d }) => d >= start)
  return {
    width,
    label: `${c.name} history`,
    ...(late && { late: { x: px(x.due), width: px(today) - px(x.due) } }),
    ticks: tickDays(c, x, start)
      .filter((t) => t >= start && t <= end)
      .map(px),
    months: monthLabels(scale, width),
    today: px(today),
    marks: [
      ...misses.map((d): Mark => ({ kind: 'miss', x: px(d) })),
      ...dots.map((dot): Mark => ({ kind: dot.kind, x: px(dot.d) })),
      { kind: 'due', x: px(x.due), late },
    ],
    hits: [
      ...misses.map((d): Hit => ({ x: px(d), tip: `Missed ${shortDate(d)}` })),
      ...dots.map((dot): Hit => ({
        x: px(dot.d),
        tip: `${dot.kind === 'done' ? 'Done' : 'Skipped'} ${shortDate(dot.d)}`,
        dot,
      })),
      { x: px(x.due), tip: `Due ${shortDate(x.due)}` },
    ],
  }
}
