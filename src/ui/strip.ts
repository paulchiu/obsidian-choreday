import { setTooltip } from 'obsidian'
import type { Chore } from '../domain/chore'
import {
  MONTHS,
  addMonths,
  firstOfMonth,
  monthOf,
  shortDate,
  yearOf,
  type Day,
} from '../domain/day'
import { step } from '../domain/every'
import type { Derived } from '../domain/schedule'

const H = 44
const PAD = 14

export type DotHandler = (ev: MouseEvent, kind: 'done' | 'skip', d: Day) => void

/**
 * Draws about six intervals back and one ahead, so every chore reads at the same density.
 * The SVG is drawn at the host's measured width rather than stretched, so circles stay round.
 */
export function drawStrip(
  host: HTMLElement,
  c: Chore,
  x: Derived,
  today: Day,
  onDot?: DotHandler,
): void {
  const W = Math.max(200, Math.round(host.clientWidth || 600))
  const start = step(today, c.every, -6) - 4
  const end = Math.max(today, x.due) + (step(today, c.every, 1) - today) * 0.6
  const span = end - start
  const px = (d: Day): number => PAD + ((W - 2 * PAD) * (d - start)) / span

  host.empty()
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

  for (let n = 1; ; n++) {
    const t = step(x.due, c.every, -n)
    if (t < start) break
    el('line', 'cd-tick', { x1: px(t), y1: 11, x2: px(t), y2: 25 })
  }
  const nxt = step(x.due, c.every, 1)
  if (nxt <= end) el('line', 'cd-tick', { x1: px(nxt), y1: 11, x2: px(nxt), y2: 25 })

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
    setTooltip(t, tip, { placement: 'top' })
    if (onClick) t.addEventListener('click', onClick)
    else t.addClass('is-passive')
  }
  const dot = (kind: 'done' | 'skip', d: Day): void => {
    if (d < start) return
    el('circle', kind === 'done' ? 'cd-dot' : 'cd-skip', { cx: px(d), cy: 18, r: 5 })
    const tip = `${kind === 'done' ? 'Done' : 'Skipped'} ${shortDate(d)}`
    hit(px(d), tip, onDot && ((ev) => onDot(ev, kind, d)))
  }
  c.skipped.forEach((d) => dot('skip', d))
  c.done.forEach((d) => dot('done', d))

  el('circle', x.due < today ? ['cd-ring', 'is-late'] : 'cd-ring', { cx: px(x.due), cy: 18, r: 7 })
  hit(px(x.due), `Due ${shortDate(x.due)}`)
}
