// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceLeaf } from 'obsidian'
import { caughtUpLine } from '../../src/domain/cheer'
import type { Chore } from '../../src/domain/chore'
import type { BrokenChore } from '../../src/domain/chore-registry'
import { ChoresView } from '../../src/ui/chores-view'
import { TODAY, chore, d } from '../domain/helpers'
import { observers, resetDom } from '../stubs/obsidian-dom'
import { resetStubs } from '../stubs/obsidian'
import { outline } from '../stubs/outline'
import { FakeActions, FakeIndex, fakeContext } from './fakes'

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
  const view = new ChoresView(
    leaf as unknown as WorkspaceLeaf,
    fakeContext(index, actions, leaf.app),
  )
  document.body.append(view.contentEl)
  await view.onOpen()
  return { view, root: view.contentEl, index, actions }
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
    expect([index.listeners, actions.listeners]).toEqual([1, 1])
    expect(observers.observed).toBeGreaterThan(0)
    await view.onClose()
    view.unload()
    expect([index.listeners, actions.listeners]).toEqual([0, 0])
    expect(observers.disconnected).toBe(observers.observed)
  })
})
