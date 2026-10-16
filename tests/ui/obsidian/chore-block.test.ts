// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountChoreBlock } from '../../../src/ui/obsidian/chore-block'
import { RowBody } from '../../../src/ui/components/row'
import { chore, d } from '../../domain/helpers'
import { observers, resetDom } from '../../stubs/obsidian-dom'
import { resetStubs } from '../../stubs/obsidian'
import { outline } from '../../stubs/outline'
import { FakeActions, FakeIndex, fakeContext } from '../fakes'
import { countRenders, flush } from '../renders'

/** The `MarkdownRenderChild` a block registers its cleanups on. */
class FakeChild {
  private cleanups: (() => unknown)[] = []
  register(cb: () => unknown): void {
    this.cleanups.push(cb)
  }
  unload(): void {
    this.cleanups.splice(0).forEach((cb) => cb())
  }
}

const kettle = chore({ done: [d('2026-09-26')] })
const kitchenBins = chore({ path: 'Chores/Kitchen/Bins.md', name: 'Bins' })
const gardenBins = chore({ path: 'Chores/Garden/Bins.md', name: 'Bins' })

/** Mounts a block with `source` in the note at `sourcePath`, over the given chores. */
function mount(source: string, chores = [kettle], sourcePath = 'Notes/Kitchen.md') {
  const index = new FakeIndex(chores)
  const actions = new FakeActions()
  const child = new FakeChild()
  const el = document.body.createDiv()
  mountChoreBlock(fakeContext(index, actions), source, el, sourcePath, child)
  return { el, index, actions, child }
}

beforeEach(() => {
  resetDom()
  resetStubs()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('mountChoreBlock', () => {
  it('draws the chore named on the chore: line as an open row', async () => {
    const { el } = mount('chore: Descale kettle')
    await flush()
    expect(outline(el)).toMatchInlineSnapshot(`
      "div.cd-root.cd-block
        div.cd-row.is-open
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

  it('pins what the row leaves out in a block: no row button, and only the check takes focus', () => {
    const { el } = mount('chore: Descale kettle')
    const row = el.querySelector('.cd-row')
    expect(row?.getAttribute('role')).toBeNull()
    expect(
      Array.from(el.querySelectorAll('[data-cd-focus]'), (e) => e.getAttribute('data-cd-focus')),
    ).toEqual([`check:${kettle.path}`])
  })

  it("draws the note's own chore when the block names none", () => {
    const named = mount('chore: Descale kettle').el
    const own = mount('', [kettle], kettle.path).el
    expect(outline(own)).toBe(outline(named))
  })

  it('says so when no chore has the name', () => {
    const { el } = mount('chore: Mop floors')
    expect(outline(el)).toMatchInlineSnapshot(`
      "div.cd-root.cd-block
        div.cd-empty.cd-missing
          span.cd-art.is-puzzled
            svg[aria-hidden=true][viewBox=2 7 110 104][xmlns=http://www.w3.org/2000/svg] {2 children}
          span
            "No chore named Mop floors.""
    `)
    expect(el.querySelector('.cd-empty.cd-missing > span.cd-art.is-puzzled')).not.toBeNull()
    expect(el.textContent).toBe('No chore named Mop floors.')
  })

  it('names the candidates when several chores share the name', () => {
    const { el } = mount('chore: Bins', [kitchenBins, gardenBins])
    expect(el.querySelector('.cd-missing')?.textContent).toBe(
      'Several chores are named Bins: Chores/Garden/Bins, Chores/Kitchen/Bins. ' +
        'Name one by its folder, for example chore: Chores/Garden/Bins.',
    )
  })

  it('says the note is not a chore when the block names none and the note is not one', () => {
    const { el } = mount('')
    expect(el.querySelector('.cd-missing')?.textContent).toBe('This note is not a chore.')
  })

  it('redraws the same row when the index changes', () => {
    const { el, index } = mount('chore: Descale kettle')
    const before = outline(el)
    index.notify()
    expect(outline(el)).toBe(before)
    expect(el.querySelectorAll('.cd-row')).toHaveLength(1)
  })

  it('lets go of the index, the undo listener and the strip observer when unloaded', () => {
    const { el, index, actions, child } = mount('chore: Descale kettle')
    index.notify()
    expect([index.listeners, actions.listeners]).toEqual([1, 1])
    child.unload()
    expect([index.listeners, actions.listeners]).toEqual([0, 0])
    expect(observers.disconnected).toBe(observers.observed)
    const unloaded = outline(el)
    index.notify()
    expect(outline(el)).toBe(unloaded)
  })

  it('empties the block when unloaded', () => {
    const { el, index, actions, child } = mount('chore: Descale kettle')
    child.unload()
    expect(el.childElementCount).toBe(0)
    expect([index.listeners, actions.listeners]).toEqual([0, 0])
    expect(observers.disconnected).toBe(observers.observed)
  })

  it('keeps the row node and skips its render when the index changes but the chore does not', () => {
    const { el, index } = mount('chore: Descale kettle')
    const row = el.querySelector('.cd-row')
    const renders = countRenders(RowBody, () => index.notify())
    expect(el.querySelector('.cd-row')).toBe(row)
    expect(renders).toBe(0)
  })

  it('updates the row in place when its chore changes', () => {
    const { el, index } = mount('chore: Descale kettle')
    const row = el.querySelector('.cd-row')
    index.chores = [{ ...kettle, done: [d('2026-10-10'), ...kettle.done] }]
    index.notify()
    expect(el.querySelector('.cd-row')).toBe(row)
    expect(el.querySelector('.cd-last')?.textContent).toBe('today')
  })

  it('draws nothing when a settle timer fires after unload', () => {
    vi.useFakeTimers()
    const { el, child } = mount('chore: Descale kettle')
    el.querySelector<HTMLElement>('.cd-check')?.click()
    child.unload()
    vi.runAllTimers()
    expect(el.childElementCount).toBe(0)
    expect(observers.disconnected).toBe(observers.observed)
  })

  it('keeps the strip observer while a tick settles', async () => {
    const { el } = mount('chore: Descale kettle')
    await flush()
    vi.useFakeTimers()
    const strip = el.querySelector('svg.cd-strip')
    el.querySelector<HTMLElement>('.cd-check')?.click()
    expect(el.querySelector('.cd-row')?.classList.contains('is-done-now')).toBe(true)
    vi.runAllTimers()
    expect(el.querySelector('.cd-row')?.classList.contains('is-done-now')).toBe(false)
    expect(observers.observed).toBe(1)
    expect(el.querySelector('svg.cd-strip')).toBe(strip)
  })
})
