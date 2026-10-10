import { describe, expect, it } from 'vitest'
import {
  latestChange,
  recordChange,
  withoutChange,
  type Change,
} from '../../src/domain/undo-history'
import { chore } from './helpers'

const kettle = chore()
const bins = chore({ path: 'Chores/Bins.md', name: 'Bins' })
const ticked: Change = { label: 'Descale kettle done today', prevs: [kettle] }
const snoozed: Change = { label: 'Bins snoozed till Mon 12 Oct', prevs: [bins] }

describe('recordChange', () => {
  it('puts the newest change next in line to undo', () => {
    expect(latestChange(recordChange(recordChange([], ticked), snoozed))).toBe(snoozed)
  })

  it('leaves out a change that wrote no chores', () => {
    const history = recordChange([], ticked)
    expect(recordChange(history, { label: 'Bins skipped', prevs: [] })).toEqual([ticked])
  })

  it('keeps the 20 most recent changes, dropping the oldest', () => {
    const changes = Array.from({ length: 21 }, (_, i) => ({
      label: `change ${i + 1}`,
      prevs: [kettle],
    }))
    const history = changes.reduce((h: readonly Change[], c) => recordChange(h, c), [])
    expect(history).toHaveLength(20)
    expect(history[0]?.label).toBe('change 2')
    expect(latestChange(history)?.label).toBe('change 21')
  })
})

describe('latestChange', () => {
  it('has nothing to undo in an empty history', () => {
    expect(latestChange([])).toBeUndefined()
  })
})

describe('withoutChange', () => {
  it('steps back to the earlier change once the newest is undone', () => {
    const history = recordChange(recordChange([], ticked), snoozed)
    const stepped = withoutChange(history, snoozed)
    expect(stepped && latestChange(stepped)).toBe(ticked)
    expect(stepped && withoutChange(stepped, ticked)).toEqual([])
  })

  it('removes an older change undone from its toast, keeping the newer one next', () => {
    const history = recordChange(recordChange([], ticked), snoozed)
    expect(withoutChange(history, ticked)).toEqual([snoozed])
  })

  it('has nothing to undo for a change already undone, so it is not restored twice', () => {
    const history = recordChange([], ticked)
    expect(withoutChange(history, snoozed)).toBeUndefined()
  })
})
