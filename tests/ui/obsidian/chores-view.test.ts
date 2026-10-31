// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceLeaf } from 'obsidian'
import { caughtUpLine } from '../../../src/domain/cheer'
import type { Chore } from '../../../src/domain/chore'
import type { BrokenChore } from '../../../src/domain/chore-registry'
import { ChoresView } from '../../../src/ui/obsidian/chores-view'
import { RowBody } from '../../../src/ui/components/row'
import { TODAY, chore, d } from '../../domain/helpers'
import { observers, resetDom } from '../../stubs/obsidian-dom'
import { menus, notices, resetStubs, type Menu } from '../../stubs/obsidian'
import { outline } from '../../stubs/outline'
import { FakeActions, FakeIndex, fakeContext, fakePicks } from '../fakes'
import type { PickStore } from '../../../src/ui/obsidian/chores-view'
import { PicksModal } from '../../../src/ui/obsidian/modals'
import { countRenders, flush } from '../renders'

const overdue = chore({ path: 'Chores/Clean oven.md', name: 'Clean oven', done: [d('2026-09-02')] })
const dueToday = chore({
  path: 'Chores/Change sheets.md',
  name: 'Change sheets',
  done: [d('2026-09-12')],
})
const halfway = chore({ done: [d('2026-09-26')] })
const far = chore({
  path: 'Chores/Flip mattress.md',
  name: 'Flip mattress',
  every: { n: 6, unit: 'm' },
  done: [d('2026-10-01')],
})
const broken: BrokenChore = {
  path: 'Chores/Water plants.md',
  name: 'Water plants',
  problems: ['every is missing (e.g. every: 2w)'],
}
const everything = [overdue, dueToday, halfway, far]

/** Opens a Chores view over `chores` and `problems`, attached to the document so focus works. */
async function open(
  chores: Chore[] = everything,
  problems: BrokenChore[] = [broken],
  picks: PickStore = fakePicks(),
) {
  const index = new FakeIndex(chores, problems)
  const actions = new FakeActions()
  const leaf = { app: { scope: {}, workspace: { openLinkText: vi.fn() } } }
  const ctx = fakeContext(index, actions, leaf.app)
  const view = new ChoresView(leaf as unknown as WorkspaceLeaf, ctx, picks)
  document.body.append(view.contentEl)
  await view.onOpen()
  return { view, root: view.contentEl, index, actions, ctx }
}

const all = (root: HTMLElement, selector: string): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(selector))

const one = (root: HTMLElement, selector: string): HTMLElement => {
  const el = root.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(`nothing matches ${selector}`)
  return el
}

const focusKeys = (root: HTMLElement): (string | null)[] =>
  all(root, '[data-cd-focus]').map((el) => el.getAttribute('data-cd-focus'))

const rowOf = (root: HTMLElement, c: Chore): HTMLElement => {
  const row = all(root, '.cd-row').find((r) => r.querySelector('.cd-name')?.textContent === c.name)
  if (!row) throw new Error(`no row for ${c.name}`)
  return row
}

/** The top bar's title and its buttons' long labels or icon labels, with disabled ones marked. */
const topBar = (root: HTMLElement): string[] => [
  (root.querySelector('.cd-title h4 .cd-long') ?? one(root, '.cd-title h4')).textContent ?? '',
  ...all(root, '.cd-actions button').map(
    (b) =>
      `${b.querySelector('.cd-long')?.textContent ?? b.getAttribute('aria-label') ?? ''}${(b as HTMLButtonElement).disabled ? ' (disabled)' : ''}`,
  ),
]

beforeEach(() => {
  resetDom()
  resetStubs()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ChoresView', () => {
  it('shows the first-run scene when there are no chores', async () => {
    const { root } = await open([], [])
    expect(outline(one(root, '.cd-empty'))).toMatchInlineSnapshot(`
      "div.cd-empty.cd-scene
        div.cd-art.is-first-run
          svg[aria-hidden=true][viewBox=13 5.5 107.3 136.3][xmlns=http://www.w3.org/2000/svg] {1 children}
        div
          "Nothing here yet. Press + to add one, or give a note in your folder type: chore and every: 2w.""
    `)
  })

  it("titles the view with today's date and shows its buttons as icons with tooltips", async () => {
    const { root } = await open()
    expect(one(root, '.cd-title h4 .cd-long').textContent).toBe('Saturday 10 October')
    expect(one(root, '.cd-title h4 .cd-short').textContent).toBe('Sat 10 Oct')
    expect(
      all(root, '.cd-actions button').map((b) => [
        b.getAttribute('data-tooltip'),
        b.getAttribute('aria-label'),
        b.textContent,
      ]),
    ).toEqual([
      ['Search', 'Search', ''],
      ['Pick for today', 'Pick for today', ''],
      ['Select', 'Select', ''],
      ['New', 'New', ''],
    ])
  })

  it('searches every group by name, as one list tagged with each group', async () => {
    const { root } = await open()
    one(root, '[data-cd-focus="search"]').click()
    const field = one(root, 'input.cd-search') as HTMLInputElement
    expect(document.activeElement).toBe(field)
    field.value = 'TT'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    expect(
      all(root, '.cd-row').map((r) => [
        r.querySelector('.cd-name')?.textContent,
        r.querySelector('.cd-tag')?.textContent,
      ]),
    ).toEqual([
      ['Descale kettle', 'Coming up'],
      ['Flip mattress', 'Later'],
    ])
    expect(all(root, '.cd-group')).toHaveLength(0)
  })

  it('shows the puzzled cat when a search matches nothing, and closes on Escape', async () => {
    const { root } = await open()
    one(root, '[data-cd-focus="search"]').click()
    const field = one(root, 'input.cd-search') as HTMLInputElement
    field.value = 'gutters'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    expect(one(root, '.cd-scene').textContent).toBe('Nothing matches "gutters".')
    expect(one(root, '.cd-scene .cd-art').classList.contains('is-puzzled')).toBe(true)
    expect(field.getAttribute('aria-label')).toBe('Search')
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(root.querySelector('input.cd-search')).toBeNull()
    expect(document.activeElement).toBe(one(root, '[data-cd-focus="search"]'))
    expect(all(root, '.cd-group > span:not(.cd-art)').map((el) => el.textContent)).toEqual([
      'Needs doing · 2',
      'Coming up · 1',
      'Needs fixing · 1',
    ])
  })

  it('closes search when its button is pressed again', async () => {
    const { root } = await open()
    one(root, '[data-cd-focus="search"]').click()
    one(root, '[data-cd-focus="search"]').click()
    expect(root.querySelector('input.cd-search')).toBeNull()
  })

  it('lists Needs doing, Coming up, a collapsed Later and Needs fixing', async () => {
    const { root } = await open()
    expect(outline(root)).toMatchSnapshot()
    expect(focusKeys(root)).toMatchInlineSnapshot(`
      [
        "search",
        "picks",
        "mode",
        "new",
        "group:Needs doing",
        "row:Chores/Clean oven.md",
        "check:Chores/Clean oven.md",
        "row:Chores/Change sheets.md",
        "check:Chores/Change sheets.md",
        "group:Coming up",
        "row:Chores/Descale kettle.md",
        "check:Chores/Descale kettle.md",
        "later",
        "broken:Chores/Water plants.md",
      ]
    `)
    expect(all(root, '[data-cd-group]').map((el) => el.getAttribute('data-cd-group'))).toEqual([
      'top',
      'Needs doing',
      'Coming up',
      'Later',
      'Needs fixing',
    ])
    expect(all(root, '.cd-group > span:not(.cd-art)').map((el) => el.textContent)).toEqual([
      'Needs doing · 2',
      'Coming up · 1',
      'Needs fixing · 1',
    ])
    const later = one(root, '.cd-later')
    expect(later.getAttribute('aria-expanded')).toBe('false')
    expect(later.textContent).toBe('Later · 1 (Flip mattress, in 6 months)')
    expect(later.querySelector('.cd-later-names')).not.toBeNull()
    expect(rowOf(root, overdue).querySelector('.cd-meta')?.textContent).toBe(
      'every 4 weeks · 5 weeks ago',
    )
    expect(all(root, '[data-cd-group="Later"] .cd-row')).toHaveLength(0)
    expect(one(root, '.cd-broken').textContent).toBe(
      'Water plantsevery is missing (e.g. every: 2w)',
    )
  })

  it('opens Later when its toggle is clicked', async () => {
    const { root } = await open()
    one(root, '.cd-later').click()
    const later = one(root, '.cd-later')
    expect(later.getAttribute('aria-expanded')).toBe('true')
    expect(later.querySelector('.cd-later-names')).toBeNull()
    expect(all(root, '[data-cd-group="Later"] .cd-row .cd-name').map((n) => n.textContent)).toEqual(
      ['Flip mattress'],
    )
  })

  it('picks rows in select mode, a group at a time with Select all, until Cancel', async () => {
    const { root } = await open()
    one(root, '[data-cd-focus="mode"]').click()
    expect(topBar(root)).toEqual(['0 selected', 'Snooze (disabled)', 'Skip (disabled)', 'Cancel'])
    expect(one(root, '.cd-actions button:last-child').getAttribute('data-cd-focus')).toBe('mode')
    expect(all(root, '.cd-row').every((r) => r.classList.contains('is-picking'))).toBe(true)
    expect(
      all(root, '.cd-group:not(.cd-fixing)').map(
        (h) => h.querySelector('a.cd-group-select')?.textContent,
      ),
    ).toEqual(['Select all', 'Select all'])

    rowOf(root, overdue).click()
    expect(one(root, '.cd-title h4').textContent).toBe('1 selected')
    expect(rowOf(root, overdue).classList.contains('is-selected')).toBe(true)

    one(root, '[data-cd-group="Needs doing"] a.cd-group-select').click()
    expect(topBar(root)).toEqual(['2 selected', 'Snooze', 'Skip', 'Cancel'])
    expect(one(root, '[data-cd-group="Needs doing"] a.cd-group-select').textContent).toBe('Clear')

    one(root, '[data-cd-focus="mode"]').click()
    expect(topBar(root)).toEqual([
      'Saturday 10 October',
      'Search',
      'Pick for today',
      'Select',
      'New',
    ])
    expect(all(root, '.is-picking')).toHaveLength(0)
  })

  it('expands a row to its history when clicked, and folds it again', async () => {
    const { root } = await open()
    rowOf(root, overdue).click()
    await flush()
    const row = rowOf(root, overdue)
    expect(row.classList.contains('is-open')).toBe(true)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(row.querySelector('.cd-hist svg.cd-strip')).not.toBeNull()
    expect(row.querySelector('.cd-summary')?.textContent).toBe('Done 1 time since September')

    rowOf(root, overdue).click()
    expect(rowOf(root, overdue).classList.contains('is-open')).toBe(false)
    expect(root.querySelector('.cd-hist')).toBeNull()
  })

  it('shows the sleeping cat when nothing needs doing', async () => {
    const { root } = await open([halfway], [])
    const scene = one(root, '.cd-empty.cd-scene')
    expect(scene.querySelector('.cd-art.is-caught-up')).not.toBeNull()
    expect(scene.textContent).toBe(caughtUpLine(TODAY))
  })

  it('keeps focus on the same tick box when the index changes', async () => {
    const { root, index } = await open()
    const key = `check:${overdue.path}`
    one(root, `[data-cd-focus="${key}"]`).focus()
    index.notify()
    expect(document.activeElement?.getAttribute('data-cd-focus')).toBe(key)
  })

  it('lets go of the index, the undo listener and the strip observers when closed', async () => {
    const { view, root, index, actions } = await open()
    rowOf(root, overdue).click()
    index.notify()
    expect([index.listeners, actions.listeners]).toEqual([1, 1])
    expect(observers.observed).toBeGreaterThan(0)
    await view.onClose()
    view.unload()
    expect([index.listeners, actions.listeners]).toEqual([0, 0])
    expect(observers.disconnected).toBe(observers.observed)
    const closed = outline(root)
    index.notify()
    expect(outline(root)).toBe(closed)
  })
})

/** The names in Needs doing, in order. */
const needsDoing = (root: HTMLElement): (string | null)[] =>
  all(root, '[data-cd-group="Needs doing"] .cd-name').map((n) => n.textContent)

/** The group a row sits in. */
const groupOf = (row: HTMLElement): string | null | undefined =>
  row.closest('[data-cd-group]')?.getAttribute('data-cd-group')

const press = (el: HTMLElement, key: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

/** Each item's title, with labels in brackets and separators as a dash. */
const titles = (menu: Menu | undefined): string[] =>
  (menu?.items ?? []).map((item) => {
    if (item === 'separator') return '-'
    const title = item.calls.find(([method]) => method === 'setTitle')?.[1]
    const text =
      typeof title === 'string' ? title : ((title as Node | undefined)?.textContent ?? '')
    return item.calls.some(([method]) => method === 'setIsLabel') ? `[${text}]` : text
  })

describe('ChoresView actions', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a ticked row in place and checked until it settles, then moves it', async () => {
    vi.useFakeTimers()
    const { root, index, actions } = await open()
    const check = one(rowOf(root, overdue), '.cd-check')
    check.click()
    expect(actions.tick).toHaveBeenCalledOnce()
    expect(actions.tick.mock.lastCall?.[0]).toBe(overdue)
    expect(actions.tick.mock.lastCall?.[1]).toBeUndefined()

    const ticked = { ...overdue, done: [TODAY, ...overdue.done] }
    index.chores = index.chores.map((c) => (c === overdue ? ticked : c))
    index.notify()
    const row = rowOf(root, overdue)
    expect(groupOf(row)).toBe('Needs doing')
    expect(row.classList.contains('is-done-now')).toBe(true)
    expect(one(row, '.cd-check').getAttribute('aria-checked')).toBe('true')
    expect(one(row, '.cd-check').getAttribute('data-icon')).toBe('check')
    one(row, '.cd-check').click()
    expect(actions.tick).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(1400)
    expect(notices).toEqual(['Done'])
    expect(all(root, '[data-cd-group="Needs doing"] .cd-name').map((n) => n.textContent)).toEqual([
      'Change sheets',
    ])
    expect(all(root, '.is-done-now')).toHaveLength(0)
  })

  it('puts a settling row back at once when its tick is undone before the index sees it', async () => {
    vi.useFakeTimers()
    const { root, actions } = await open()
    one(rowOf(root, overdue), '.cd-check').click()
    expect(rowOf(root, overdue).classList.contains('is-done-now')).toBe(true)
    actions.undone([overdue.path])
    const row = rowOf(root, overdue)
    expect(row.classList.contains('is-done-now')).toBe(false)
    expect(one(row, '.cd-check').getAttribute('aria-checked')).toBe('false')
  })

  it('presses rows, tick boxes and the Later toggle with Enter or Space', async () => {
    const { root, actions } = await open()
    press(rowOf(root, overdue), 'Enter')
    expect(rowOf(root, overdue).getAttribute('aria-expanded')).toBe('true')
    press(rowOf(root, overdue), ' ')
    expect(rowOf(root, overdue).getAttribute('aria-expanded')).toBe('false')

    press(one(rowOf(root, dueToday), '.cd-check'), 'Enter')
    expect(actions.tick.mock.lastCall?.[0]).toBe(dueToday)
    expect(rowOf(root, dueToday).getAttribute('aria-expanded')).toBe('false')

    press(one(root, '.cd-later'), 'Enter')
    expect(one(root, '.cd-later').getAttribute('aria-expanded')).toBe('true')
    press(rowOf(root, halfway), 'a')
    expect(rowOf(root, halfway).getAttribute('aria-expanded')).toBe('false')
  })

  it('opens the row menu on right-click and on the menu key, but not while picking', async () => {
    const { root } = await open()
    const click = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    rowOf(root, overdue).dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    press(rowOf(root, overdue), 'ContextMenu')
    expect(menus.map((m) => m.shownAt.length)).toEqual([1, 1])
    expect(titles(menus[0])).toMatchInlineSnapshot(`
      [
        "Done today",
        "Done yesterday",
        "Done on…",
        "-",
        "[Snooze]",
        "Tomorrow · Sun 11 Oct",
        "1 week · Sat 17 Oct",
        "Next weekend · Sat 17 Oct",
        "Pick date…",
        "Skip this time",
        "-",
        "Select",
        "Edit…",
        "Open note",
      ]
    `)
    expect(titles(menus[1])).toEqual(titles(menus[0]))

    one(root, '[data-cd-focus="mode"]').click()
    rowOf(root, overdue).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    press(rowOf(root, overdue), 'ContextMenu')
    expect(menus).toHaveLength(2)
  })
})

describe('ChoresView updating in place', () => {
  it('empties the pane when closed', async () => {
    const { view, root, index, actions } = await open()
    rowOf(root, overdue).click()
    await view.onClose()
    view.unload()
    expect(root.childElementCount).toBe(0)
    expect([index.listeners, actions.listeners]).toEqual([0, 0])
    expect(observers.disconnected).toBe(observers.observed)
  })

  it('draws nothing when a settle timer fires after close', async () => {
    vi.useFakeTimers()
    const { view, root } = await open()
    one(root, `[data-cd-focus="check:${overdue.path}"]`).click()
    await view.onClose()
    view.unload()
    vi.runAllTimers()
    expect(root.childElementCount).toBe(0)
  })

  it('keeps the row node and the focused tick box when the index changes', async () => {
    const { root, index } = await open()
    const row = rowOf(root, overdue)
    const check = one(row, '.cd-check')
    check.focus()
    index.notify()
    expect(rowOf(root, overdue)).toBe(row)
    expect(document.activeElement).toBe(check)
  })

  it('moves a keyed row node, with its focus, when its place in the group changes', async () => {
    const soon = chore({
      path: 'Chores/Wipe benches.md',
      name: 'Wipe benches',
      done: [d('2026-09-20')],
    })
    const { root, index } = await open([overdue, soon, halfway], [])
    const coming = (): string[] =>
      all(root, '[data-cd-group="Coming up"] .cd-name').map((n) => n.textContent ?? '')
    expect(coming()).toEqual(['Wipe benches', 'Descale kettle'])
    const row = rowOf(root, soon)
    const check = one(row, '.cd-check')
    check.focus()
    index.chores = [overdue, { ...soon, done: [d('2026-09-26')] }, halfway]
    index.notify()
    expect(coming()).toEqual(['Descale kettle', 'Wipe benches'])
    expect(rowOf(root, soon)).toBe(row)
    expect(document.activeElement).toBe(check)
  })

  it("keeps an open row's history strip when the index changes", async () => {
    const { root, index } = await open()
    rowOf(root, overdue).click()
    await flush()
    const strip = one(rowOf(root, overdue), 'svg.cd-strip')
    index.notify()
    expect(one(rowOf(root, overdue), 'svg.cd-strip')).toBe(strip)
  })

  it('redraws only the row whose chore changed', async () => {
    const { root, index } = await open()
    const rows = all(root, '.cd-row')
    index.chores = index.chores.map((c) =>
      c === halfway ? { ...halfway, done: [d('2026-09-25')] } : c,
    )
    expect(countRenders(RowBody, () => index.notify())).toBe(1)
    expect(all(root, '.cd-row')).toEqual(rows)
    expect(rowOf(root, halfway).querySelector('.cd-pill .cd-long')?.textContent).toBe('in 13 days')
  })

  it('redraws every row in its own node when the day changes', async () => {
    const { root, index, ctx } = await open()
    const rows = all(root, '.cd-row')
    ctx.today = () => TODAY + 1
    expect(countRenders(RowBody, () => index.notify())).toBe(rows.length)
    expect(all(root, '.cd-row').every((r, i) => r === rows[i])).toBe(true)
    expect(one(root, '.cd-title h4 .cd-short').textContent).toBe('Sun 11 Oct')
  })

  it('hands focus to the next tick box in the group when a ticked row settles', async () => {
    vi.useFakeTimers()
    const { root, index } = await open()
    const check = one(rowOf(root, overdue), '.cd-check')
    check.focus()
    check.click()
    index.chores = index.chores.map((c) =>
      c === overdue ? { ...overdue, done: [TODAY, ...overdue.done] } : c,
    )
    index.notify()
    expect(one(root, '[data-cd-group="Needs doing"] .cd-row .cd-name').textContent).toBe(
      'Clean oven',
    )
    expect(document.activeElement).toBe(check)

    vi.advanceTimersByTime(1400)
    expect(all(root, '[data-cd-group="Needs doing"] .cd-name').map((n) => n.textContent)).toEqual([
      'Change sheets',
    ])
    expect(document.activeElement?.getAttribute('data-cd-focus')).toBe(`check:${dueToday.path}`)
  })

  it('keeps the row node and focus when a settling tick is undone before the index catches up', async () => {
    vi.useFakeTimers()
    const { root, index, actions } = await open()
    const row = rowOf(root, overdue)
    const check = one(row, '.cd-check')
    check.focus()
    press(check, ' ')
    index.chores = index.chores.map((c) =>
      c === overdue ? { ...overdue, done: [TODAY, ...overdue.done] } : c,
    )
    index.notify()

    /** Undo tells its listeners once the note is written, before the metadata cache re-indexes it. */
    actions.undone([overdue.path])
    expect(needsDoing(root)).toEqual(['Clean oven', 'Change sheets'])
    expect(document.activeElement).toBe(check)
    index.chores = index.chores.map((c) => (c.path === overdue.path ? overdue : c))
    index.notify()

    expect(rowOf(root, overdue)).toBe(row)
    expect(groupOf(row)).toBe('Needs doing')
    expect(row.classList.contains('is-done-now')).toBe(false)
    expect(check.getAttribute('aria-checked')).toBe('false')
    expect(document.activeElement).toBe(check)
  })

  it('keeps a fresh tick in place after an undone tick settled before the index caught up', async () => {
    vi.useFakeTimers()
    const { root, index, actions } = await open()
    one(rowOf(root, overdue), '.cd-check').click()
    index.chores = index.chores.map((c) =>
      c === overdue ? { ...overdue, done: [TODAY, ...overdue.done] } : c,
    )
    index.notify()
    actions.undone([overdue.path])
    await vi.advanceTimersByTimeAsync(1400)
    one(root, '.cd-later').click()

    one(rowOf(root, overdue), '.cd-check').click()
    const row = rowOf(root, overdue)
    const group = groupOf(row)
    index.chores = index.chores.map((c) => (c.path === overdue.path ? overdue : c))
    index.notify()
    expect(rowOf(root, overdue)).toBe(row)
    expect(groupOf(row)).toBe(group)
    expect(row.classList.contains('is-done-now')).toBe(true)
  })

  it('picks a second row after the first, though that row skipped its render', async () => {
    const { root } = await open()
    one(root, '[data-cd-focus="mode"]').click()
    rowOf(root, overdue).click()
    rowOf(root, halfway).click()
    expect(one(root, '.cd-title h4').textContent).toBe('2 selected')
    one(root, '[data-cd-group="Needs doing"] a.cd-group-select').click()
    expect(one(root, '.cd-title h4').textContent).toBe('3 selected')
  })

  it('keeps focus on the mode button, with its own tooltip, as select mode toggles', async () => {
    const { root } = await open()
    one(root, '[data-cd-focus="mode"]').focus()
    one(root, '[data-cd-focus="mode"]').click()
    expect(document.activeElement?.textContent).toBe('Cancel')
    expect(document.activeElement?.getAttribute('data-tooltip')).toBe('Cancel')
    one(root, '[data-cd-focus="mode"]').click()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Select')
    expect(document.activeElement?.getAttribute('data-tooltip')).toBe('Select')
  })
})

describe("ChoresView with today's picks", () => {
  const pickedOven = () =>
    fakePicks({
      day: TODAY,
      kind: 'picked',
      rule: { strategy: 'overdue', count: 1 },
      seed: 0,
      paths: [overdue.path],
    })
  const groupLabels = (root: HTMLElement): (string | null)[] =>
    all(root, '.cd-group > span:not(.cd-art)').map((el) => el.textContent)

  it('lists only the picks under Today, counts the rest as hidden, and hides later groups', async () => {
    const { root } = await open(everything, [], pickedOven())
    expect(groupLabels(root)).toEqual(['Today · 1'])
    expect(all(root, '.cd-row .cd-name').map((el) => el.textContent)).toEqual(['Clean oven'])
    expect(one(root, '.cd-hidden').textContent).toBe('1 more needs doing, hidden till tomorrow')
    expect(root.querySelector('.cd-later')).toBeNull()
  })

  it('names the rule under the date, with Change and Show all', async () => {
    const { root } = await open(everything, [], pickedOven())
    expect(one(root, '.cd-picks-line').textContent).toBe(
      "Today's picks: Most overdue · Change · Show all",
    )
  })

  it('goes back to the full list on Show all, and stays there when reopened today', async () => {
    const picks = pickedOven()
    const { root } = await open(everything, [], picks)
    one(root, '[data-cd-focus="show-all"]').click()
    expect(groupLabels(root)).toEqual(['Needs doing · 2', 'Coming up · 1'])
    const again = await open(everything, [], picks)
    expect(groupLabels(again.root)).toEqual(['Needs doing · 2', 'Coming up · 1'])
  })

  it('keeps the picks when the view is reopened the same day', async () => {
    const picks = pickedOven()
    await open(everything, [], picks)
    const { root } = await open(everything, [], picks)
    expect(groupLabels(root)).toEqual(['Today · 1'])
  })

  it('drops the picks when the date rolls over', async () => {
    const { root, index, ctx } = await open(everything, [], pickedOven())
    ctx.today = () => TODAY + 1
    index.notify()
    expect(groupLabels(root)[0]).toBe('Needs doing · 2')
  })

  it('shows the caught-up cat once every pick is done', async () => {
    const picks = pickedOven()
    const doneOven = { ...overdue, done: [TODAY, ...overdue.done] }
    const { root } = await open([doneOven, dueToday, halfway, far], [], picks)
    expect(root.querySelector('.cd-row')).toBeNull()
    expect(one(root, '.cd-scene .cd-art').classList.contains('is-caught-up')).toBe(true)
    expect(one(root, '.cd-hidden').textContent).toBe('1 more needs doing, hidden till tomorrow')
  })

  it('opens each day with picks made by the morning rule', async () => {
    const picks = fakePicks(null, { strategy: 'overdue', count: 1 })
    const { root, index, ctx } = await open(everything, [], picks)
    expect(all(root, '.cd-row .cd-name').map((el) => el.textContent)).toEqual(['Clean oven'])
    index.chores = [{ ...overdue, done: [TODAY + 1, ...overdue.done] }, dueToday, halfway, far]
    ctx.today = () => TODAY + 1
    index.notify()
    expect(groupLabels(root)[0]).toBe('Today · 1')
    expect(all(root, '.cd-row .cd-name').map((el) => el.textContent)).toEqual(['Change sheets'])
  })

  it('makes the morning picks once chores have loaded, not from an empty list', async () => {
    const picks = fakePicks(null, { strategy: 'overdue', count: 1 })
    const { root, index } = await open([], [], picks)
    index.chores = everything
    index.notify()
    expect(all(root, '.cd-row .cd-name').map((el) => el.textContent)).toEqual(['Clean oven'])
  })

  it('searches chores hidden by the picks too', async () => {
    const { root } = await open(everything, [], pickedOven())
    one(root, '[data-cd-focus="search"]').click()
    const field = one(root, 'input.cd-search') as HTMLInputElement
    field.value = 'sheets'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    expect(all(root, '.cd-row .cd-name').map((el) => el.textContent)).toEqual(['Change sheets'])
  })
})

describe('ChoresView picking for today', () => {
  /** Catches the next pick form the view opens, so a test can fill it in. */
  function catchPicks(): () => PicksModal {
    const opened = vi.spyOn(PicksModal.prototype, 'open').mockImplementation(function (
      this: PicksModal,
    ) {
      this.onOpen()
    })
    return () => {
      const caught = opened.mock.contexts.at(-1) as PicksModal | undefined
      if (!caught) throw new Error('no pick form opened')
      return caught
    }
  }
  const pressIn = (el: HTMLElement, text: string): void => {
    const b = Array.from(el.querySelectorAll('button')).find((x) => x.textContent === text)
    if (!b) throw new Error(`no ${text} button`)
    b.click()
  }
  const choose = (el: HTMLElement, name: string, value: string): void => {
    const item = Array.from(el.querySelectorAll<HTMLElement>('.setting-item')).find(
      (r) => r.querySelector('.setting-item-name')?.textContent === name,
    )
    const field = item?.querySelector<HTMLSelectElement | HTMLInputElement>('select, input')
    if (!field) throw new Error(`no ${name} field`)
    if (field instanceof HTMLInputElement) field.checked = value === 'on'
    else field.value = value
    field.dispatchEvent(new Event('change'))
  }

  it('lists what the pick form picks under Today', async () => {
    const form = catchPicks()
    const { root } = await open(everything, [])
    one(root, '[data-cd-focus="picks"]').click()
    choose(form().contentEl, 'How many', '1')
    pressIn(form().contentEl, 'Pick')
    expect(all(root, '.cd-row .cd-name').map((el) => el.textContent)).toEqual(['Clean oven'])
    expect(one(root, '.cd-picks-line').textContent).toContain('Most overdue')
  })

  it('previews the chores that need doing in the pick form', async () => {
    const form = catchPicks()
    const { root } = await open(everything, [])
    one(root, '[data-cd-focus="picks"]').click()
    expect(form().contentEl.querySelector('.cd-preview')?.textContent).toBe(
      'Clean oven, Change sheets',
    )
  })

  it('saves Every morning as the morning rule, and clears it when turned off', async () => {
    const form = catchPicks()
    const picks = fakePicks()
    const { root } = await open(everything, [], picks)
    one(root, '[data-cd-focus="picks"]').click()
    choose(form().contentEl, 'Pick by', 'recent')
    choose(form().contentEl, 'Every morning', 'on')
    pressIn(form().contentEl, 'Pick')
    expect(picks.rule).toEqual({ strategy: 'recent', count: 3 })

    one(root, '[data-cd-focus="change-picks"]').click()
    choose(form().contentEl, 'Every morning', 'off')
    pressIn(form().contentEl, 'Pick')
    expect(picks.rule).toBeNull()
  })
})
