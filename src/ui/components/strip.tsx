import type { JSX } from 'preact'
import { useContext, useRef } from 'preact/hooks'
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
import { derive, type Derived } from '../../domain/schedule'
import { useDomEffect } from './dom-effect'
import { HostContext, type Host } from './host'

const H = 44
const PAD = 14

export type DotHandler = (ev: MouseEvent, kind: 'done' | 'skip', d: Day) => void

/**
 * Draws about six intervals back and one ahead, so every chore reads at the same density; chores on
 * several days a week look back three of their weeks instead, or the ticks crowd a phone-width
 * strip. The SVG is drawn at the host's measured width rather than stretched, so circles stay round.
 */
export function drawStrip(
  host: HTMLElement,
  c: Chore,
  x: Derived,
  today: Day,
  port: Host,
  onDot?: DotHandler,
): void {
  const W = Math.max(200, Math.round(host.clientWidth || 600))
  const calendar = c.schedule.anchor === 'calendar'
  const slotsPerInterval = calendar ? scheduleDays(c.schedule).length : 1
  const start = slotsPerInterval > 1 ? today - 21 * c.every.n - 2 : step(today, c.every, -6) - 4
  const end =
    Math.max(today, x.due) + ((step(today, c.every, 1) - today) / slotsPerInterval) * 0.6 + 1
  const span = end - start
  const px = (d: Day): number => PAD + ((W - 2 * PAD) * (d - start)) / span

  host.replaceChildren()
  const svg = host.createSvg('svg', {
    cls: 'cd-strip',
    attr: {
      viewBox: `0 0 ${W} ${H}`,
      width: W,
      height: H,
      role: 'img',
      'aria-label': `${c.name} history`,
    },
  })
  const el = (
    tag: keyof SVGElementTagNameMap,
    cls: string | string[],
    attr: Record<string, number | string>,
  ): SVGElement => svg.createSvg(tag, { cls, attr })

  if (x.due < today)
    el('rect', 'cd-late', { x: px(x.due), y: 9, width: px(today) - px(x.due), height: 18, rx: 3 })
  el('line', 'cd-base', { x1: PAD, y1: 18, x2: W - PAD, y2: 18 })

  const tick = (t: Day): void => {
    if (t >= start && t <= end) el('line', 'cd-tick', { x1: px(t), y1: 11, x2: px(t), y2: 25 })
  }
  if (calendar) x.slots.forEach((s) => tick(s.slot))
  else for (let n = 1; step(x.due, c.every, -n) >= start; n++) tick(step(x.due, c.every, -n))
  tick(x.following ?? step(x.due, c.every, 1))

  const months: Day[] = []
  for (let m = firstOfMonth(start); m <= end; m = addMonths(m, 1))
    if (m >= start && px(m) < W - 30) months.push(m)
  const every = Math.ceil(months.length / (W > 400 ? 7 : 4))
  months
    .filter((_, i) => i % every === 0)
    .forEach((m) => {
      const label = MONTHS[monthOf(m)]!.slice(0, 3) + (monthOf(m) === 0 ? ` ${yearOf(m)}` : '')
      el('text', 'cd-mlabel', { x: px(m), y: 40 }).textContent = label
    })

  el('line', 'cd-today', { x1: px(today), y1: 4, x2: px(today), y2: 30 })

  /** Obsidian tooltips only attach to HTML elements, so each mark gets an HTML hit target over the SVG. */
  const hit = (cx: number, tip: string, onClick?: (ev: MouseEvent) => void): void => {
    const t = host.createDiv({ cls: 'cd-hit' })
    t.setCssProps({ '--cd-x': `${cx}px` })
    port.tooltip(t, tip, { placement: 'top' })
    if (onClick) t.addEventListener('click', onClick)
    else t.addClass('is-passive')
  }
  const dot = (kind: 'done' | 'skip', d: Day): void => {
    if (d < start) return
    el('circle', kind === 'done' ? 'cd-dot' : 'cd-skip', { cx: px(d), cy: 18, r: 5 })
    const tip = `${kind === 'done' ? 'Done' : 'Skipped'} ${shortDate(d)}`
    hit(px(d), tip, onDot && ((ev) => onDot(ev, kind, d)))
  }
  x.slots
    .filter((s) => s.outcome === 'missed' && s.slot >= start)
    .forEach((s) => {
      el('circle', 'cd-miss', { cx: px(s.slot), cy: 18, r: 4 })
      hit(px(s.slot), `Missed ${shortDate(s.slot)}`)
    })
  c.skipped.forEach((d) => dot('skip', d))
  c.done.forEach((d) => dot('done', d))

  el('circle', x.due < today ? ['cd-ring', 'is-late'] : 'cd-ring', { cx: px(x.due), cy: 18, r: 7 })
  hit(px(x.due), `Due ${shortDate(x.due)}`)
}

/**
 * The history strip in its host, redrawn by a `ResizeObserver` at the host's width. The observer is
 * replaced when the chore, day or early ticks change and disconnected on unmount; a dot click calls
 * the latest `onDot`.
 */
export function Strip({
  c,
  today,
  early,
  onDot,
}: {
  c: Chore
  today: Day
  early: boolean
  onDot: DotHandler
}): JSX.Element {
  const port = useContext(HostContext)
  const dot = useRef(onDot)
  dot.current = onDot
  const ref = useDomEffect<HTMLDivElement>(
    (host) => {
      const x = derive(c, today, early)
      const observer = new ResizeObserver(() =>
        drawStrip(host, c, x, today, port, (ev, kind, d) => dot.current(ev, kind, d)),
      )
      observer.observe(host)
      return () => observer.disconnect()
    },
    [c, today, early, port],
  )
  return <div class="cd-strip-host" ref={ref} />
}
