// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceLeaf } from 'obsidian'
import { caughtUpLine } from '../../src/domain/cheer'
import type { Chore } from '../../src/domain/chore'
import type { BrokenChore } from '../../src/domain/chore-registry'
import { ChoresView } from '../../src/ui/chores-view'
import { RowBody } from '../../src/ui/row'
import { TODAY, chore, d } from '../domain/helpers'
import { observers, resetDom } from '../stubs/obsidian-dom'
import { menus, notices, resetStubs, type Menu } from '../stubs/obsidian'
import { outline } from '../stubs/outline'
import { FakeActions, FakeIndex, fakeContext } from './fakes'
import { countRenders } from './renders'

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
async function open(chores: Chore[] = everything, problems: BrokenChore[] = [broken]) {
  const index = new FakeIndex(chores, problems)
  const actions = new FakeActions()
  const leaf = { app: { scope: {}, workspace: { openLinkText: vi.fn() } } }
  const ctx = fakeContext(index, actions, leaf.app)
  const view = new ChoresView(leaf as unknown as WorkspaceLeaf, ctx)
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

/** The top bar's title and its buttons' long labels, with disabled ones marked. */
const topBar = (root: HTMLElement): string[] => [
  one(root, '.cd-title h4').textContent ?? '',
  ...all(root, '.cd-actions button').map(
    (b) =>
      `${b.querySelector('.cd-long')?.textContent ?? ''}${(b as HTMLButtonElement).disabled ? ' (disabled)' : ''}`,
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
          "No chores yet. Add one with New chore, or give a note in your chores folder type: chore and every: 2w.""
    `)
  })

  it('lists Needs doing, Coming up, a collapsed Later and Needs fixing', async () => {
    const { root } = await open()
    expect(outline(root)).toMatchSnapshot()
    expect(focusKeys(root)).toMatchInlineSnapshot(`
      [
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
    expect(topBar(root)).toEqual(['Chores', 'Select', 'New chore'])
    expect(all(root, '.is-picking')).toHaveLength(0)
  })

  it('expands a row to its history when clicked, and folds it again', async () => {
    const { root } = await open()
    rowOf(root, overdue).click()
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
    expect(one(root, '.cd-today-label').textContent).toBe('Sun 11 Oct')
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

  it('keeps focus on the mode button, and no tooltip on Select, as select mode toggles', async () => {
    const { root } = await open()
    one(root, '[data-cd-focus="mode"]').focus()
    one(root, '[data-cd-focus="mode"]').click()
    expect(document.activeElement?.textContent).toBe('Cancel')
    expect(document.activeElement?.getAttribute('data-tooltip')).toBe('Cancel')
    one(root, '[data-cd-focus="mode"]').click()
    expect(document.activeElement?.textContent).toBe('SelectSelect')
    expect(document.activeElement?.hasAttribute('data-tooltip')).toBe(false)
  })
})
