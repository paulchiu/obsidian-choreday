import { describe, expect, it } from 'vitest'
import type { Chore } from '../../src/domain/chore'
import { withUnit } from '../../src/domain/chore-form'
import type { Day } from '../../src/domain/day'
import { nameTaken } from '../../src/domain/names'
import { createChoreActions, type ChoreStore } from '../../src/vault/chore-actions'
import { TODAY, chore, d } from '../domain/helpers'

const kettle = chore({ done: [d('2026-09-12')] })
const bins = chore({ path: 'Chores/Bins.md', name: 'Bins', every: { n: 1, unit: 'w' } })

/** A store of chore notes in memory, standing in for the vault. */
function notes(...chores: Chore[]) {
  const byPath = new Map(chores.map((c) => [c.path, c]))
  const failing = new Set<string>()
  const fail = (path: string): void => {
    if (failing.has(path)) throw new Error('disk full')
  }
  const store: ChoreStore = {
    update: async (path, fn) => {
      fail(path)
      const before = byPath.get(path)
      if (!before) return undefined
      const after = fn(before)
      byPath.set(path, after)
      return { before, after }
    },
    create: async (draft) => {
      const path = `Chores/${draft.name}.md`
      fail(path)
      if (nameTaken([...byPath.keys()], path)) return null
      byPath.set(path, { ...draft, path })
      return path
    },
    rename: async (path, name) => {
      fail(path)
      const c = byPath.get(path)
      const next = `Chores/${name}.md`
      if (!c || nameTaken([...byPath.keys()], next, path)) return null
      byPath.delete(path)
      byPath.set(next, { ...c, path: next, name })
      return next
    },
  }
  return { store, byPath, failing }
}

function setup(...chores: Chore[]) {
  const vault = notes(...chores)
  const clock = { today: TODAY }
  const actions = createChoreActions(vault.store, {
    today: (): Day => clock.today,
    historyLimit: () => 12,
    earlyTicks: () => true,
  })
  return { ...vault, clock, actions }
}

function holdUpdate(store: ChoreStore, path: string, observePath?: string) {
  let release!: () => void
  let signalEntered!: () => void
  let signalObserved!: () => void
  let held = false
  const entered = new Promise<void>((resolve) => (signalEntered = resolve))
  const observed = new Promise<void>((resolve) => (signalObserved = resolve))
  const gate = new Promise<void>((resolve) => (release = resolve))
  const heldStore: ChoreStore = {
    ...store,
    update: async (updatePath, fn) => {
      const written = await store.update(updatePath, fn)
      if (updatePath === observePath) signalObserved()
      if (updatePath === path && !held) {
        held = true
        signalEntered()
        await gate
      }
      return written
    },
  }
  return { store: heldStore, entered, observed, release }
}

describe('tick', () => {
  it('records today and says so', async () => {
    const { actions, byPath } = setup(kettle)
    const outcome = await actions.tick(kettle)
    expect(outcome).toMatchObject({ ok: true, label: 'Descale kettle done today' })
    expect(byPath.get(kettle.path)?.done).toEqual([TODAY, d('2026-09-12')])
  })

  it('uses the date at the moment of the tick, not when the actions were set up', async () => {
    const { actions, byPath, clock } = setup(kettle)
    clock.today = d('2026-10-11')
    await actions.tick(kettle)
    expect(byPath.get(kettle.path)?.done[0]).toBe(d('2026-10-11'))
  })

  it('names the date of a backfilled tick', async () => {
    const { actions } = setup(kettle)
    expect(await actions.tick(kettle, d('2026-10-08'))).toMatchObject({
      label: 'Descale kettle done Thu 8 Oct',
    })
  })

  it('refuses a backfill older than the kept history, writing nothing', async () => {
    const full = chore({ done: [TODAY], keep: 1 })
    const { actions, byPath } = setup(full)
    expect(await actions.tick(full, d('2026-10-01'))).toEqual({
      ok: false,
      message: 'Descale kettle keeps only its last 1 completions, so Thu 1 Oct was not recorded',
    })
    expect(byPath.get(full.path)?.done).toEqual([TODAY])
  })

  it('reports a note that is gone or unreadable instead of done today, with nothing to undo', async () => {
    const { actions } = setup()
    expect(await actions.tick(kettle)).toEqual({
      ok: false,
      message: 'Could not update Descale kettle: its note is missing or unreadable',
    })
    expect(actions.lastChange()).toBeUndefined()
  })

  it('records no undo step for a chore already done that day', async () => {
    const { actions } = setup(kettle)
    await actions.snooze([kettle], d('2026-10-17'))
    await actions.tick(kettle)
    await actions.tick(kettle)
    expect((await actions.undo()).message).toBe('Undone: Descale kettle done today')
    expect((await actions.undo()).message).toBe('Undone: Descale kettle snoozed till Sat 17 Oct')
  })

  it('says a chore was already done that day, with no change to undo', async () => {
    const doneToday = chore({ done: [TODAY] })
    const { actions } = setup(doneToday)
    expect(await actions.tick(doneToday)).toEqual({
      ok: true,
      label: 'Descale kettle was already done today',
    })
  })

  it('names the date of a backfill that was already recorded', async () => {
    const { actions } = setup(kettle)
    expect(await actions.tick(kettle, d('2026-09-12'))).toEqual({
      ok: true,
      label: 'Descale kettle was already done Sat 12 Sep',
    })
  })

  it('reports a write that fails', async () => {
    const { actions, failing } = setup(kettle)
    failing.add(kettle.path)
    expect(await actions.tick(kettle)).toEqual({
      ok: false,
      message: 'Could not update Descale kettle: disk full',
    })
  })
})

describe('skip', () => {
  it('says when a single chore is next due', async () => {
    const { actions } = setup(kettle)
    expect(await actions.skip([kettle])).toMatchObject({
      ok: true,
      label: 'Descale kettle skipped · next due Sat 7 Nov',
    })
  })

  it('counts several chores', async () => {
    const { actions } = setup(kettle, bins)
    expect(await actions.skip([kettle, bins])).toMatchObject({ label: '2 chores skipped' })
  })

  it('says a chore was already skipped today, with no change to undo', async () => {
    const { actions } = setup(kettle)
    await actions.skip([kettle])
    const first = actions.lastChange()
    expect(await actions.skip([kettle])).toEqual({
      ok: true,
      label: 'Descale kettle was already skipped',
    })
    expect(actions.lastChange()).toBe(first)
  })
})

describe('snooze', () => {
  it('snoozes each chore with one change to undo them all', async () => {
    const { actions, byPath } = setup(kettle, bins)
    const outcome = await actions.snooze([kettle, bins], d('2026-10-17'))
    expect(outcome).toMatchObject({ label: '2 chores snoozed till Sat 17 Oct' })
    expect(byPath.get(bins.path)?.snoozedUntil).toBe(d('2026-10-17'))
    expect(actions.lastChange()?.writes).toHaveLength(2)
  })

  it('puts back only the chores it changed when others were already snoozed till then', async () => {
    const snoozedBins = { ...bins, snoozedUntil: d('2026-10-17') }
    const { actions } = setup(kettle, snoozedBins)
    expect(await actions.snooze([kettle, snoozedBins], d('2026-10-17'))).toMatchObject({
      label: 'Descale kettle snoozed till Sat 17 Oct',
    })
    expect(await actions.undo()).toEqual({
      message: 'Undone: Descale kettle snoozed till Sat 17 Oct',
      restored: [kettle.path],
    })
  })

  it('says chores were already snoozed till then, with no change to undo', async () => {
    const until = d('2026-10-17')
    const snoozed = [kettle, bins].map((c) => ({ ...c, snoozedUntil: until }))
    const { actions } = setup(...snoozed)
    expect(await actions.snooze(snoozed, until)).toEqual({
      ok: true,
      label: '2 chores were already snoozed till Sat 17 Oct',
    })
    expect(actions.lastChange()).toBeUndefined()
  })

  it('names the chores it could not update alongside the ones it did', async () => {
    const { actions, failing } = setup(kettle, bins)
    failing.add(kettle.path)
    expect(await actions.snooze([kettle, bins], d('2026-10-17'))).toMatchObject({
      ok: true,
      label: 'Bins snoozed till Sat 17 Oct; could not update Descale kettle',
    })
  })
})

describe('removeEntry', () => {
  it('removes one history entry', async () => {
    const { actions, byPath } = setup(kettle)
    expect(await actions.removeEntry(kettle, 'done', d('2026-09-12'))).toMatchObject({
      label: 'Removed Sat 12 Sep from Descale kettle',
    })
    expect(byPath.get(kettle.path)?.done).toEqual([])
  })

  it('says an entry was already gone, with no change to undo', async () => {
    const { actions } = setup(kettle)
    expect(await actions.removeEntry(kettle, 'done', d('2026-09-05'))).toEqual({
      ok: true,
      label: 'Sat 5 Sep was already gone from Descale kettle',
    })
    expect(actions.lastChange()).toBeUndefined()
  })
})

describe('undo', () => {
  it('puts back what the change wrote and keeps a later edit to the schedule', async () => {
    const { actions, byPath } = setup(kettle)
    await actions.tick(kettle)
    const ticked = byPath.get(kettle.path)!
    byPath.set(kettle.path, { ...ticked, every: { n: 1, unit: 'w' } })
    expect(await actions.undo()).toEqual({
      message: 'Undone: Descale kettle done today',
      restored: [kettle.path],
    })
    expect(byPath.get(kettle.path)).toMatchObject({
      done: [d('2026-09-12')],
      every: { n: 1, unit: 'w' },
    })
  })

  it('leaves a note alone when what the change wrote has changed since', async () => {
    const { actions, byPath } = setup(kettle)
    await actions.tick(kettle, d('2026-10-09'))
    const synced = { ...byPath.get(kettle.path)!, done: [TODAY, d('2026-10-09'), d('2026-09-12')] }
    byPath.set(kettle.path, synced)
    expect(await actions.undo()).toEqual({
      message: 'Could not undo Descale kettle done Fri 9 Oct: its note has changed since',
      restored: [],
    })
    expect(byPath.get(kettle.path)).toEqual(synced)
  })

  it('follows a note renamed after the change', async () => {
    const { actions, byPath } = setup(kettle)
    await actions.tick(kettle)
    const moved = 'Chores/Kettle.md'
    byPath.set(moved, { ...byPath.get(kettle.path)!, path: moved, name: 'Kettle' })
    byPath.delete(kettle.path)
    actions.renamed(kettle.path, moved)
    expect(await actions.undo()).toMatchObject({ restored: [moved] })
    expect(byPath.get(moved)?.done).toEqual([d('2026-09-12')])
  })

  it('keeps each recorded write attached through an A to B to A rename chain and path reuse', async () => {
    const { actions, byPath } = setup(kettle)
    await actions.tick(kettle)
    const oldChange = actions.lastChange()!
    const moved = 'Chores/Kettle.md'
    byPath.set(moved, { ...byPath.get(kettle.path)!, path: moved, name: 'Kettle' })
    byPath.delete(kettle.path)
    actions.renamed(kettle.path, moved)

    const returned = { ...byPath.get(moved)!, path: kettle.path, name: kettle.name }
    byPath.set(kettle.path, returned)
    byPath.delete(moved)
    actions.renamed(moved, kettle.path)

    await actions.tick(returned, d('2026-10-09'))
    expect((await actions.undo()).restored).toEqual([kettle.path])
    expect(byPath.get(kettle.path)?.done).toEqual([TODAY, d('2026-09-12')])
    expect((await actions.undo(oldChange)).restored).toEqual([kettle.path])
    expect(byPath.get(kettle.path)?.done).toEqual([d('2026-09-12')])
  })

  it('does not let an old write follow a new note created at its vacated path', async () => {
    const { actions, byPath } = setup(kettle)
    await actions.tick(kettle)
    const oldChange = actions.lastChange()!
    const moved = 'Chores/Kettle.md'
    byPath.set(moved, { ...byPath.get(kettle.path)!, path: moved, name: 'Kettle' })
    byPath.delete(kettle.path)
    actions.renamed(kettle.path, moved)

    const fresh = { ...kettle, done: [] }
    byPath.set(kettle.path, fresh)
    await actions.tick(fresh)
    expect((await actions.undo()).restored).toEqual([kettle.path])
    expect((await actions.undo(oldChange)).restored).toEqual([moved])
    expect(byPath.get(kettle.path)?.done).toEqual([])
    expect(byPath.get(moved)?.done).toEqual([d('2026-09-12')])
  })

  it('does not undo onto a replacement note after deletion', async () => {
    const { actions, byPath } = setup(kettle)
    await actions.tick(kettle)
    const ticked = byPath.get(kettle.path)!
    byPath.delete(kettle.path)
    actions.deleted(kettle.path)
    const replacement = { ...ticked }
    byPath.set(kettle.path, replacement)

    expect(await actions.undo()).toEqual({
      message: 'Could not undo Descale kettle done today: its note has changed since',
      restored: [],
    })
    expect(byPath.get(kettle.path)).toEqual(replacement)
  })

  it('follows a rename that happens while the write is still resolving', async () => {
    const vault = notes(kettle)
    const held = holdUpdate(vault.store, kettle.path)
    const actions = createChoreActions(held.store, {
      today: () => TODAY,
      historyLimit: () => 12,
      earlyTicks: () => true,
    })
    const ticking = actions.tick(kettle)
    await held.entered
    const moved = 'Chores/Kettle.md'
    vault.byPath.set(moved, { ...vault.byPath.get(kettle.path)!, path: moved, name: 'Kettle' })
    vault.byPath.delete(kettle.path)
    actions.renamed(kettle.path, moved)
    held.release()

    await ticking
    expect((await actions.undo()).restored).toEqual([moved])
    expect(vault.byPath.get(moved)?.done).toEqual([d('2026-09-12')])
  })

  it('invalidates a write deleted and replaced before its promise resolves', async () => {
    const vault = notes(kettle)
    const held = holdUpdate(vault.store, kettle.path)
    const actions = createChoreActions(held.store, {
      today: () => TODAY,
      historyLimit: () => 12,
      earlyTicks: () => true,
    })
    const ticking = actions.tick(kettle)
    await held.entered
    const replacement = { ...vault.byPath.get(kettle.path)! }
    vault.byPath.delete(kettle.path)
    actions.deleted(kettle.path)
    vault.byPath.set(kettle.path, replacement)
    held.release()

    await ticking
    expect(await actions.undo()).toMatchObject({ restored: [] })
    expect(vault.byPath.get(kettle.path)).toEqual(replacement)
  })

  it('keeps a completed batch member target invalidatable while another member is pending', async () => {
    const vault = notes(kettle, bins)
    const held = holdUpdate(vault.store, bins.path, kettle.path)
    const actions = createChoreActions(held.store, {
      today: () => TODAY,
      historyLimit: () => 12,
      earlyTicks: () => true,
    })
    const snoozing = actions.snooze([kettle, bins], d('2026-10-17'))
    await Promise.all([held.entered, held.observed])
    const replacement = { ...vault.byPath.get(kettle.path)! }
    vault.byPath.delete(kettle.path)
    actions.deleted(kettle.path)
    vault.byPath.set(kettle.path, replacement)
    held.release()

    await snoozing
    expect((await actions.undo()).restored).toEqual([bins.path])
    expect(vault.byPath.get(kettle.path)).toEqual(replacement)
  })

  it('does not report Undone when the note is gone', async () => {
    const { actions, byPath } = setup(kettle)
    await actions.tick(kettle)
    byPath.delete(kettle.path)
    expect(await actions.undo()).toEqual({
      message: 'Could not undo Descale kettle done today: its note has changed since',
      restored: [],
    })
  })

  it('says how many of several notes it put back', async () => {
    const { actions, byPath } = setup(kettle, bins)
    await actions.snooze([kettle, bins], d('2026-10-17'))
    byPath.set(bins.path, { ...byPath.get(bins.path)!, snoozedUntil: d('2026-10-24') })
    expect(await actions.undo()).toEqual({
      message: 'Undid 2 chores snoozed till Sat 17 Oct for 1 of 2 chores; the other changed since',
      restored: [kettle.path],
    })
  })

  it('undoes the newest change first, each only once', async () => {
    const { actions } = setup(kettle, bins)
    await actions.tick(kettle)
    const snoozed = await actions.snooze([bins], d('2026-10-17'))
    expect((await actions.undo()).message).toBe('Undone: Bins snoozed till Sat 17 Oct')
    expect(snoozed.ok && (await actions.undo(snoozed.change)).message).toBe('Already undone')
    expect((await actions.undo()).message).toBe('Undone: Descale kettle done today')
    expect((await actions.undo()).message).toBe('Nothing to undo')
  })

  it('tells listeners which notes it put back, until they stop listening', async () => {
    const { actions } = setup(kettle)
    const heard: (readonly string[])[] = []
    const stop = actions.onUndo((paths) => heard.push(paths))
    await actions.tick(kettle)
    await actions.undo()
    stop()
    await actions.tick(kettle)
    await actions.undo()
    expect(heard).toEqual([[kettle.path]])
  })
})

describe('create', () => {
  const draft = chore({ path: '', name: ' Wash  windows ' })

  it('creates the note under a tidied name and says where', async () => {
    const { actions, byPath } = setup()
    expect(await actions.create(draft)).toEqual({
      ok: true,
      message: 'Created Chores/Wash windows.md',
    })
    expect(byPath.has('Chores/Wash windows.md')).toBe(true)
  })

  it('refuses a name already taken in another case', async () => {
    const { actions } = setup(chore({ path: 'Chores/Wash Windows.md', name: 'Wash Windows' }))
    expect(await actions.create(draft)).toEqual({
      ok: false,
      message: 'A note named Wash windows already exists.',
    })
  })

  it('refuses a name with nothing a note name can hold', async () => {
    const { actions } = setup()
    expect(await actions.create({ ...draft, name: '//' })).toEqual({
      ok: false,
      message: 'A chore name needs letters or numbers.',
    })
  })

  it('reports a create that fails', async () => {
    const { actions, failing } = setup()
    failing.add('Chores/Wash windows.md')
    expect(await actions.create(draft)).toEqual({
      ok: false,
      message: 'Could not create Wash windows: disk full',
    })
  })
})

describe('edit', () => {
  it('renames the note and writes the new schedule', async () => {
    const { actions, byPath } = setup(kettle)
    const next = { ...kettle, name: 'Kettle', every: { n: 2, unit: 'w' as const } }
    expect(await actions.edit(kettle, next)).toEqual({ ok: true })
    expect(byPath.get('Chores/Kettle.md')?.every).toEqual({ n: 2, unit: 'w' })
  })

  it('saves a chore moved off set days with no days left', async () => {
    const tuesdays = { ...bins, schedule: { anchor: 'calendar', days: [2] } } satisfies Chore
    const { actions, byPath } = setup(tuesdays)
    await actions.edit(tuesdays, withUnit({ chore: tuesdays }, 'm').chore)
    expect(byPath.get(bins.path)?.schedule).toEqual({ anchor: 'done' })
  })

  it('refuses a name another note has, writing nothing', async () => {
    const { actions, byPath } = setup(kettle, bins)
    const next = { ...kettle, name: 'bins', every: { n: 2, unit: 'w' as const } }
    expect(await actions.edit(kettle, next)).toEqual({
      ok: false,
      message: 'A note named bins already exists.',
    })
    expect(byPath.get(kettle.path)).toEqual(kettle)
  })

  it('reports a rename that fails', async () => {
    const { actions, failing } = setup(kettle)
    failing.add(kettle.path)
    expect(await actions.edit(kettle, { ...kettle, name: 'Kettle' })).toEqual({
      ok: false,
      message: 'Could not rename Descale kettle: disk full',
    })
  })

  it('reports a schedule write that fails', async () => {
    const { actions, failing } = setup(kettle)
    failing.add(kettle.path)
    expect(await actions.edit(kettle, { ...kettle, every: { n: 2, unit: 'w' } })).toEqual({
      ok: false,
      message: 'Could not update Descale kettle: disk full',
    })
  })
})
