// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Change } from '../../../src/domain/undo-history'
import { RowKit } from '../../../src/ui/obsidian/row-kit'
import { chore, d } from '../../domain/helpers'
import { resetDom } from '../../stubs/obsidian-dom'
import { Notice, menus, notices, resetStubs } from '../../stubs/obsidian'
import { FakeActions, FakeIndex, fakeContext } from '../fakes'

const kettle = chore()
/** A day before today, so a tick does not start the settle timer. */
const EARLIER = d('2026-09-30')

let actions: FakeActions
let rerender: Mock<() => void>
let kit: RowKit

beforeEach(() => {
  resetDom()
  resetStubs()
  actions = new FakeActions()
  rerender = vi.fn<() => void>()
  kit = new RowKit(fakeContext(new FakeIndex([kettle]), actions), rerender)
})

describe('RowKit toasts', () => {
  it('says why nothing was written', async () => {
    actions.tick.mockResolvedValueOnce({ ok: false, message: 'Could not update Descale kettle' })
    await kit.tick(kettle, EARLIER)
    expect(notices).toEqual(['Could not update Descale kettle'])
  })

  it('shows the label alone when there is nothing to undo', async () => {
    actions.tick.mockResolvedValueOnce({ ok: true, label: 'Already done' })
    await kit.tick(kettle, EARLIER)
    expect(notices).toEqual(['Already done'])
  })

  it('offers Undo for a change, which hides the toast and undoes that change', async () => {
    const change: Change = { label: 'Done', writes: [] }
    actions.tick.mockResolvedValueOnce({ ok: true, label: 'Done', change })
    const hide = vi.spyOn(Notice.prototype, 'hide')
    await kit.tick(kettle, EARLIER)

    const [toast] = notices
    expect(toast).toBeInstanceOf(DocumentFragment)
    const frag = toast as DocumentFragment
    expect(frag.textContent).toBe('Done  Undo')
    const undo = frag.querySelector<HTMLAnchorElement>('a.cd-undo')!
    const click = new MouseEvent('click', { cancelable: true })
    undo.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(hide).toHaveBeenCalledOnce()
    expect(actions.undo).toHaveBeenCalledWith(change)
    await vi.waitFor(() => expect(notices).toEqual([toast, 'Undone']))
  })
})

describe('RowKit as the rows see it', () => {
  it('lists the rows still settling after a tick today', async () => {
    vi.useFakeTimers()
    try {
      await kit.tick(kettle)
      expect([...kit.settling()]).toEqual([kettle.path])
      vi.runAllTimers()
      expect(kit.settling().size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens and closes a row, redrawing each time', () => {
    kit.toggleExpanded(kettle.path)
    expect([[...kit.expandedPaths()], rerender.mock.calls.length]).toEqual([[kettle.path], 1])
    kit.toggleExpanded(kettle.path)
    expect([kit.expandedPaths().size, rerender.mock.calls.length]).toEqual([0, 2])
  })

  it('hands out the open rows as a snapshot, so a toggle gives a new set', () => {
    const before = kit.expandedPaths()
    kit.toggleExpanded(kettle.path)
    expect([before.size, kit.expandedPaths() === before]).toEqual([0, false])
  })

  it('opens the row menu at the pointer for a mouse event', () => {
    const ev = new MouseEvent('contextmenu')
    kit.rowMenu(kettle, undefined, ev)
    expect(menus.map((m) => m.shownAt)).toEqual([[ev]])
  })

  it('opens the row menu at a position for the keyboard', () => {
    kit.rowMenu(kettle, undefined, { x: 4, y: 20 })
    expect(menus.map((m) => m.shownAt)).toEqual([[{ x: 4, y: 20 }]])
  })

  it('opens a history dot menu at the pointer or at a position', () => {
    const ev = new MouseEvent('click')
    kit.dotMenu(kettle, 'done', EARLIER, ev)
    kit.dotMenu(kettle, 'skip', EARLIER, { x: 4, y: 20 })
    expect(menus.map((m) => m.shownAt)).toEqual([[ev], [{ x: 4, y: 20 }]])
  })
})
