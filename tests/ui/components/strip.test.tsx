// @vitest-environment happy-dom
import { render, type VNode } from 'preact'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Chore } from '../../../src/domain/chore'
import type { Day } from '../../../src/domain/day'
import { Strip } from '../../../src/ui/components/strip'
import { TODAY, chore, d } from '../../domain/helpers'
import { observers, resetDom, resizeObserved } from '../../stubs/obsidian-dom'
import { outline } from '../../stubs/outline'
import { withHost } from '../fakes'
import { flush } from '../renders'

const kettle = chore({ done: [d('2026-09-26')] })
const bins = chore({
  path: 'Chores/Bins.md',
  name: 'Bins',
  every: { n: 1, unit: 'w' },
  schedule: { anchor: 'calendar', days: [1, 4] },
  done: [d('2026-10-08'), d('2026-09-28'), d('2026-08-31')],
  skipped: [d('2026-10-01')],
})
const oven = chore({ path: 'Chores/Clean oven.md', name: 'Clean oven', done: [d('2026-09-02')] })
const snoozed = chore({ done: [d('2026-09-02')], snoozedUntil: d('2026-10-20') })

let onDot: Mock<(ev: MouseEvent, kind: 'done' | 'skip', d: Day) => void>

beforeEach(() => {
  resetDom()
  onDot = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Renders `vnode` under the fake host into `box`, mounting or updating it. */
const draw = (vnode: VNode, box: HTMLElement): void => render(withHost(vnode), box)

/** Mounts `c`'s strip on `TODAY` in a fresh box in the document and waits for it to draw. */
async function mount(c: Chore, today = TODAY): Promise<HTMLElement> {
  const box = document.createElement('div')
  document.body.append(box)
  draw(<Strip c={c} today={today} early onDot={onDot} />, box)
  await flush()
  return box
}

/** The strip host's outline followed by each SVG child's, since `outline` folds an `<svg>`. */
const drawing = (box: HTMLElement): string => {
  const svg = box.querySelector('svg.cd-strip')
  return [outline(box), ...Array.from(svg?.children ?? [], (el) => outline(el))].join('\n')
}

/** Makes every element report `width` as its client width. */
const paneWidth = (width: number): void => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
}

describe('Strip', () => {
  it('draws a done-anchored chore with its done dot and due ring', async () => {
    expect(drawing(await mount(kettle))).toMatchSnapshot()
  })

  it('draws a calendar chore with its misses, skips and slot ticks', async () => {
    expect(drawing(await mount(bins))).toMatchSnapshot()
  })

  it('draws an overdue chore with the late span and a late ring', async () => {
    expect(drawing(await mount(oven))).toMatchSnapshot()
  })

  it('draws a snoozed chore out to the snooze date', async () => {
    expect(drawing(await mount(snoozed))).toMatchSnapshot()
  })

  it('thins the month labels on a narrow pane', async () => {
    paneWidth(300)
    expect(drawing(await mount(kettle))).toMatchSnapshot()
  })

  it('adds the year to January', async () => {
    const winter = chore({ done: [d('2027-01-20')] })
    expect(drawing(await mount(winter, d('2027-02-10')))).toMatchSnapshot()
  })

  it('draws nothing narrower than 200px', async () => {
    paneWidth(120)
    const svg = (await mount(kettle)).querySelector('svg.cd-strip')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 200 44')
  })

  it('redraws at the new width when the pane is resized', async () => {
    const box = await mount(kettle)
    paneWidth(320)
    resizeObserved()
    await flush()
    expect(box.querySelector('svg.cd-strip')?.getAttribute('width')).toBe('320')
  })

  it('calls onDot with the dot a click lands on, and nothing for a passive mark', async () => {
    const box = await mount(bins)
    const hits = Array.from(box.querySelectorAll<HTMLElement>('.cd-hit'))
    hits.filter((h) => h.classList.contains('is-passive')).forEach((h) => h.click())
    expect(onDot).not.toHaveBeenCalled()
    hits.find((h) => h.getAttribute('data-tooltip') === 'Skipped Thu 1 Oct')?.click()
    expect(onDot.mock.calls).toEqual([[expect.any(MouseEvent), 'skip', d('2026-10-01')]])
  })

  it('calls the latest onDot after a re-render', async () => {
    const box = await mount(kettle)
    const latest = vi.fn()
    draw(<Strip c={kettle} today={TODAY} early onDot={latest} />, box)
    box.querySelector<HTMLElement>('.cd-hit:not(.is-passive)')?.click()
    expect(onDot).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith(expect.any(MouseEvent), 'done', d('2026-09-26'))
  })

  it('redraws when the chore changes', async () => {
    const box = await mount(kettle)
    draw(<Strip c={oven} today={TODAY} early onDot={onDot} />, box)
    await flush()
    expect(drawing(box)).toBe(drawing(await mount(oven)))
  })

  it('lets go of its observer when unmounted', async () => {
    const box = await mount(kettle)
    render(null, box)
    expect(observers.disconnected).toBe(observers.observed)
  })
})
