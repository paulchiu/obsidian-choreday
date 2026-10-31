// @vitest-environment happy-dom
import { render, type VNode } from 'preact'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Chore } from '../../../src/domain/chore'
import { derive } from '../../../src/domain/schedule'
import {
  Row,
  RowBody,
  sameRowProps,
  type RowActions,
  type RowProps,
} from '../../../src/ui/components/row'
import { TODAY, chore, d } from '../../domain/helpers'
import { resetDom } from '../../stubs/obsidian-dom'
import { outline } from '../../stubs/outline'
import { withHost } from '../fakes'
import { countRenders, flush } from '../renders'

const kettle = chore({ done: [d('2026-09-26')] })
const warned = chore({ warnings: ['keep should be a number, like 10'], done: [d('2026-09-26')] })
const snoozed = chore({ done: [d('2026-09-02')], snoozedUntil: d('2026-10-20') })

/** A `RowActions` that records each call. */
const fakeActions = (): { [K in keyof RowActions]: Mock<RowActions[K]> } => ({
  tick: vi.fn<RowActions['tick']>(() => Promise.resolve()),
  toggleExpanded: vi.fn<RowActions['toggleExpanded']>(),
  rowMenu: vi.fn<RowActions['rowMenu']>(),
  dotMenu: vi.fn<RowActions['dotMenu']>(),
})

let kit: ReturnType<typeof fakeActions>
const on = { start: vi.fn(), toggle: vi.fn() }
/** Matches any function, for handlers built per render. */
const fn: unknown = expect.any(Function)

beforeEach(() => {
  resetDom()
  on.start.mockReset()
  on.toggle.mockReset()
  kit = fakeActions()
})

/** A row's props for `c` on `TODAY` as the Chores view passes them, with `over` applied. */
const props = (c: Chore, over: Partial<RowProps> = {}): RowProps => ({
  c,
  x: derive(c, TODAY, true),
  today: TODAY,
  early: true,
  expanded: false,
  justDone: false,
  expandable: true,
  alwaysOpen: false,
  selectable: true,
  kit,
  on,
  ...over,
})

/** Mounts `vnode` in a fresh box in the document and returns the box. */
function mount(vnode: VNode): HTMLElement {
  const box = document.createElement('div')
  document.body.append(box)
  render(withHost(vnode), box)
  return box
}

/** Mounts one `<Row>` with `props` and returns its row element. */
function drawRow(p: RowProps): HTMLElement {
  return mount(<Row {...p} />).firstElementChild as HTMLElement
}

/** Mounts one open `<Row>` with `props` and returns its row element once its strip has drawn. */
async function drawOpenRow(p: RowProps): Promise<HTMLElement> {
  const row = drawRow(p)
  await flush()
  return row
}

/** The block's row: always open, never expandable, no picking. */
const BLOCK: Partial<RowProps> = {
  expandable: false,
  alwaysOpen: true,
  selectable: false,
  on: undefined,
}

describe('Row', () => {
  it('draws a resting row as a button that expands', () => {
    expect(outline(drawRow(props(kettle)))).toMatchInlineSnapshot(`
      "div.cd-row[aria-expanded=false][data-cd-focus=row:Chores/Descale kettle.md][role=button][tabindex=0]
        div.cd-check[aria-checked=false][data-cd-focus=check:Chores/Descale kettle.md][data-tooltip=Done today][role=checkbox][tabindex=0]
        div.cd-main
          span.cd-name
            "Descale kettle"
          span.cd-meta
            span.cd-every
              "every 4 weeks"
            span.cd-sep
              "·"
            span.cd-last[data-tooltip=Sat 26 Sep][data-tooltip-placement=top]
              "2 weeks ago"
        span.cd-pill.is-none[data-tooltip=Due Sat 24 Oct]
          span.cd-long
            "in 2 weeks"
          span.cd-short
            "2w"
        div.cd-bar
          i.is-ok[style=--cd-fill: 50%;]"
    `)
  })

  it('draws an expanded row with its history', async () => {
    expect(outline(await drawOpenRow(props(kettle, { expanded: true })))).toMatchInlineSnapshot(`
      "div.cd-row.is-open[aria-expanded=true][data-cd-focus=row:Chores/Descale kettle.md][role=button][tabindex=0]
        div.cd-check[aria-checked=false][data-cd-focus=check:Chores/Descale kettle.md][data-tooltip=Done today][role=checkbox][tabindex=0]
        div.cd-main
          span.cd-name
            "Descale kettle"
          span.cd-meta
            span.cd-every
              "every 4 weeks"
            span.cd-sep
              "·"
            span.cd-last[data-tooltip=Sat 26 Sep][data-tooltip-placement=top]
              "2 weeks ago"
        span.cd-pill.is-none[data-tooltip=Due Sat 24 Oct]
          span.cd-long
            "in 2 weeks"
          span.cd-short
            "2w"
        div.cd-bar
          i.is-ok[style=--cd-fill: 50%;]
        div.cd-hist
          div.cd-strip-host
            svg.cd-strip[aria-label=Descale kettle history][height=44][role=img][viewBox=0 0 600 44][width=600] {17 children}
            div.cd-hit[data-tooltip=Done Sat 26 Sep][data-tooltip-placement=top][style=--cd-x: 457.4543670264982px;]
            div.cd-hit.is-passive[data-tooltip=Due Sat 24 Oct][data-tooltip-placement=top][style=--cd-x: 536.0412168792952px;]
          p.cd-summary
            "Done 1 time since September""
    `)
  })

  it('draws a just-ticked row checked and struck through', () => {
    expect(outline(drawRow(props(kettle, { justDone: true })))).toMatchInlineSnapshot(`
      "div.cd-row.is-done-now[aria-expanded=false][data-cd-focus=row:Chores/Descale kettle.md][role=button][tabindex=0]
        div.cd-check[aria-checked=true][data-cd-focus=check:Chores/Descale kettle.md][data-icon=check][data-tooltip=Done today][role=checkbox][tabindex=0]
        div.cd-main
          span.cd-name
            "Descale kettle"
          span.cd-meta
            span.cd-every
              "every 4 weeks"
            span.cd-sep
              "·"
            span.cd-last[data-tooltip=Sat 26 Sep][data-tooltip-placement=top]
              "2 weeks ago"
        span.cd-pill.is-none[data-tooltip=Due Sat 24 Oct]
          span.cd-long
            "in 2 weeks"
          span.cd-short
            "2w"
        div.cd-bar
          i.is-ok[style=--cd-fill: 50%;]"
    `)
  })

  it('draws a row while picking as a plain row with a Select check', () => {
    expect(outline(drawRow(props(kettle, { picking: { selected: false } }))))
      .toMatchInlineSnapshot(`
      "div.cd-row.is-picking
        div.cd-check[aria-checked=false][data-cd-focus=check:Chores/Descale kettle.md][data-tooltip=Select][role=checkbox][tabindex=0]
        div.cd-main
          span.cd-name
            "Descale kettle"
          span.cd-meta
            span.cd-every
              "every 4 weeks"
            span.cd-sep
              "·"
            span.cd-last[data-tooltip=Sat 26 Sep][data-tooltip-placement=top]
              "2 weeks ago"
        span.cd-pill.is-none[data-tooltip=Due Sat 24 Oct]
          span.cd-long
            "in 2 weeks"
          span.cd-short
            "2w"
        div.cd-bar
          i.is-ok[style=--cd-fill: 50%;]"
    `)
  })

  it('draws a picked row checked and selected', () => {
    expect(outline(drawRow(props(kettle, { picking: { selected: true } })))).toMatchInlineSnapshot(`
      "div.cd-row.is-picking.is-selected
        div.cd-check[aria-checked=true][data-cd-focus=check:Chores/Descale kettle.md][data-icon=check][data-tooltip=Select][role=checkbox][tabindex=0]
        div.cd-main
          span.cd-name
            "Descale kettle"
          span.cd-meta
            span.cd-every
              "every 4 weeks"
            span.cd-sep
              "·"
            span.cd-last[data-tooltip=Sat 26 Sep][data-tooltip-placement=top]
              "2 weeks ago"
        span.cd-pill.is-none[data-tooltip=Due Sat 24 Oct]
          span.cd-long
            "in 2 weeks"
          span.cd-short
            "2w"
        div.cd-bar
          i.is-ok[style=--cd-fill: 50%;]"
    `)
  })

  it('draws a warning after the name', () => {
    expect(outline(drawRow(props(warned)))).toMatchInlineSnapshot(`
      "div.cd-row[aria-expanded=false][data-cd-focus=row:Chores/Descale kettle.md][role=button][tabindex=0]
        div.cd-check[aria-checked=false][data-cd-focus=check:Chores/Descale kettle.md][data-tooltip=Done today][role=checkbox][tabindex=0]
        div.cd-main
          span.cd-name
            "Descale kettle"
          span.cd-warn[data-icon=alert-triangle][data-tooltip=keep should be a number, like 10]
          span.cd-meta
            span.cd-every
              "every 4 weeks"
            span.cd-sep
              "·"
            span.cd-last[data-tooltip=Sat 26 Sep][data-tooltip-placement=top]
              "2 weeks ago"
        span.cd-pill.is-none[data-tooltip=Due Sat 24 Oct]
          span.cd-long
            "in 2 weeks"
          span.cd-short
            "2w"
        div.cd-bar
          i.is-ok[style=--cd-fill: 50%;]"
    `)
  })

  it('fades the bar of a snoozed chore', () => {
    expect(outline(drawRow(props(snoozed)))).toMatchInlineSnapshot(`
      "div.cd-row[aria-expanded=false][data-cd-focus=row:Chores/Descale kettle.md][role=button][tabindex=0]
        div.cd-check[aria-checked=false][data-cd-focus=check:Chores/Descale kettle.md][data-tooltip=Done today][role=checkbox][tabindex=0]
        div.cd-main
          span.cd-name
            "Descale kettle"
          span.cd-meta
            span.cd-every
              "every 4 weeks"
            span.cd-sep
              "·"
            span.cd-last[data-tooltip=Wed 2 Sep][data-tooltip-placement=top]
              "5 weeks ago"
        span.cd-pill.is-warn[data-tooltip=Due Wed 30 Sep, hidden until Tue 20 Oct]
          span.cd-long
            "snoozed till 20 Oct"
          span.cd-short
            "zz 20 Oct"
        div.cd-bar
          i.is-bad.is-faded[style=--cd-fill: 100%;]"
    `)
  })

  it('draws the code block row open, with no row button', async () => {
    expect(outline(await drawOpenRow(props(kettle, BLOCK)))).toMatchInlineSnapshot(`
      "div.cd-row.is-open
        div.cd-check[aria-checked=false][data-cd-focus=check:Chores/Descale kettle.md][data-tooltip=Done today][role=checkbox][tabindex=0]
        div.cd-main
          span.cd-name
            "Descale kettle"
          span.cd-meta
            span.cd-every
              "every 4 weeks"
            span.cd-sep
              "·"
            span.cd-last[data-tooltip=Sat 26 Sep][data-tooltip-placement=top]
              "2 weeks ago"
        span.cd-pill.is-none[data-tooltip=Due Sat 24 Oct]
          span.cd-long
            "in 2 weeks"
          span.cd-short
            "2w"
        div.cd-bar
          i.is-ok[style=--cd-fill: 50%;]
        div.cd-hist
          div.cd-strip-host
            svg.cd-strip[aria-label=Descale kettle history][height=44][role=img][viewBox=0 0 600 44][width=600] {17 children}
            div.cd-hit[data-tooltip=Done Sat 26 Sep][data-tooltip-placement=top][style=--cd-x: 457.4543670264982px;]
            div.cd-hit.is-passive[data-tooltip=Due Sat 24 Oct][data-tooltip-placement=top][style=--cd-x: 536.0412168792952px;]
          p.cd-summary
            "Done 1 time since September""
    `)
  })
})

describe('Row updated in place', () => {
  const never = chore({ done: [] })

  it.each<[string, RowProps, RowProps]>([
    ['resting to expanded', props(kettle), props(kettle, { expanded: true })],
    ['expanded to resting', props(kettle, { expanded: true }), props(kettle)],
    ['resting to picking', props(kettle), props(kettle, { picking: { selected: false } })],
    ['picking to resting', props(kettle, { picking: { selected: false } }), props(kettle)],
    ['never done to done', props(never), props(kettle)],
    ['done to never done', props(kettle), props(never)],
  ])('%s matches a fresh row', (_, from, to) => {
    const box = mount(<Row {...from} />)
    const row = box.firstElementChild
    render(withHost(<Row {...to} />), box)
    expect(box.firstElementChild).toBe(row)
    expect(outline(row!)).toBe(outline(drawRow(to)))
  })
})

describe('Row interactions', () => {
  const check = (row: HTMLElement): HTMLElement => row.querySelector<HTMLElement>('.cd-check')!
  const key = (el: HTMLElement, k: string, shiftKey = false): KeyboardEvent => {
    const ev = new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true })
    el.dispatchEvent(ev)
    return ev
  }

  it('ticks the chore when its check is clicked, without expanding the row', () => {
    check(drawRow(props(kettle))).click()
    expect(kit.tick.mock.calls).toEqual([[kettle]])
    expect(kit.toggleExpanded).not.toHaveBeenCalled()
  })

  it('does not tick a row that is still settling', () => {
    check(drawRow(props(kettle, { justDone: true }))).click()
    expect(kit.tick).not.toHaveBeenCalled()
  })

  it('toggles the row open each time it is clicked', () => {
    const row = drawRow(props(kettle))
    row.click()
    row.click()
    expect(kit.toggleExpanded.mock.calls).toEqual([[kettle.path], [kettle.path]])
  })

  it('picks the row, from the row or its check, while picking', () => {
    const row = drawRow(props(kettle, { picking: { selected: false } }))
    row.click()
    check(row).click()
    expect(on.toggle.mock.calls).toEqual([[kettle.path], [kettle.path]])
    expect([kit.toggleExpanded.mock.calls.length, kit.tick.mock.calls.length]).toEqual([0, 0])
  })

  it('opens the row menu at the pointer on right-click, offering Select', () => {
    const row = drawRow(props(kettle))
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    row.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(kit.rowMenu.mock.calls).toEqual([[kettle, { mode: 'off', start: fn }, ev]])
  })

  it('opens no row menu while picking', () => {
    drawRow(props(kettle, { picking: { selected: false } })).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    )
    expect(kit.rowMenu).not.toHaveBeenCalled()
  })

  it('clicks the row when Enter is pressed on it', () => {
    const ev = key(drawRow(props(kettle)), 'Enter')
    expect([kit.toggleExpanded.mock.calls, ev.defaultPrevented]).toEqual([[[kettle.path]], true])
  })

  it('opens the row menu under the row on Shift+F10', () => {
    const row = drawRow(props(kettle))
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 12, y: 30, height: 44 }),
    )
    const ev = key(row, 'F10', true)
    expect(ev.defaultPrevented).toBe(true)
    expect(kit.rowMenu.mock.calls).toEqual([[kettle, { mode: 'off', start: fn }, { x: 12, y: 74 }]])
  })

  it('opens the row menu on Shift+F10 pressed on the check', () => {
    key(check(drawRow(props(kettle))), 'F10', true)
    expect(kit.rowMenu).toHaveBeenCalledOnce()
  })

  it('opens a history dot menu at the pointer, without toggling the row', async () => {
    const row = await drawOpenRow(props(kettle, { expanded: true }))
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    row.querySelector('.cd-hit:not(.is-passive)')!.dispatchEvent(ev)
    expect(kit.dotMenu.mock.calls).toEqual([[kettle, 'done', d('2026-09-26'), ev]])
    expect(kit.toggleExpanded).not.toHaveBeenCalled()
  })
})

describe('keyed rows', () => {
  const a = chore({ path: 'Chores/A.md', name: 'A', done: [d('2026-09-26')] })
  const b = chore({ path: 'Chores/B.md', name: 'B', done: [d('2026-09-20')] })
  const c = chore({ path: 'Chores/C.md', name: 'C', done: [d('2026-10-01')] })

  const list = (chores: Chore[]): VNode => (
    <div>
      {chores.map((ch) => (
        <Row key={ch.path} {...props(ch)} />
      ))}
    </div>
  )

  it('redraws only the changed row, keeping the other rows and the focused control', () => {
    const box = mount(list([a, b, c]))
    const rows = Array.from(box.querySelectorAll('.cd-row'))
    rows[1]!.querySelector<HTMLElement>('.cd-check')!.focus()
    const focused = document.activeElement
    expect(focused?.getAttribute('data-cd-focus')).toBe(`check:${b.path}`)

    const ticked = { ...a, done: [d('2026-10-10'), ...a.done] }
    const n = countRenders(RowBody, () => render(withHost(list([ticked, b, c])), box))

    const after = Array.from(box.querySelectorAll('.cd-row'))
    expect(n).toBe(1)
    expect([after[1] === rows[1], after[2] === rows[2]]).toEqual([true, true])
    expect(document.activeElement).toBe(focused)
  })

  it('redraws every row when the day changes, in the same nodes', () => {
    const box = mount(list([a, b, c]))
    const rows = Array.from(box.querySelectorAll('.cd-row'))
    const tomorrow = (ch: Chore): VNode => (
      <Row key={ch.path} {...props(ch, { today: TODAY + 1, x: derive(ch, TODAY + 1, true) })} />
    )
    const n = countRenders(RowBody, () =>
      render(withHost(<div>{[a, b, c].map(tomorrow)}</div>), box),
    )
    expect(n).toBe(3)
    expect(Array.from(box.querySelectorAll('.cd-row'))).toEqual(rows)
  })
})

describe('sameRowProps', () => {
  const base = props(kettle, { picking: { selected: false } })

  it.each<[string, Partial<RowProps>, boolean]>([
    ['nothing changed', {}, true],
    ['a fresh Derived for the same chore and day', { x: derive(kettle, TODAY, true) }, true],
    ['fresh select handlers', { on: { start: () => {}, toggle: () => {} } }, true],
    ['the same chore read again into a new object', { c: { ...kettle } }, false],
    ['the day', { today: TODAY + 1 }, false],
    ['early ticks', { early: false }, false],
    ['expanded', { expanded: true }, false],
    ['just done', { justDone: true }, false],
    ['expandable', { expandable: false }, false],
    ['always open', { alwaysOpen: true }, false],
    ['selectable', { selectable: false }, false],
    ['the kit', { kit: fakeActions() }, false],
    ['picking ended', { picking: undefined }, false],
    ['picked', { picking: { selected: true } }, false],
    ['no pressure', { noPressure: true }, false],
    ['a fresh picking object with the same answer', { picking: { selected: false } }, true],
  ])('%s: same is %s', (_, over, same) => {
    expect(sameRowProps(base, { ...base, ...over })).toBe(same)
  })
})
