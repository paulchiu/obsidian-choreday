import { describe, expect, it } from 'vitest'
import type { ParseResult } from '../../src/domain/chore'
import { EMPTY_REGISTRY, put, remove } from '../../src/domain/chore-registry'
import { chore } from './helpers'

const MOP = 'Chores/Mop.md'
const ok = (every = 1): ParseResult => ({
  ok: true,
  chore: chore({ path: MOP, name: 'Mop', every: { n: every, unit: 'w' } }),
})
const BROKEN: ParseResult = { ok: false, problems: ['every is missing'] }
const SHOPPING = 'Notes/Shopping.md'
const listed = put(EMPTY_REGISTRY, MOP, 'Mop', ok()).next

describe('put', () => {
  it('lists a new chore and reports a change', () => {
    const { next, changed } = put(EMPTY_REGISTRY, MOP, 'Mop', ok())
    expect(changed).toBe(true)
    expect(next.chores.get(MOP)?.every).toEqual({ n: 1, unit: 'w' })
  })

  it('lists a chore that cannot be scheduled under broken, named after the note', () => {
    const { next, changed } = put(EMPTY_REGISTRY, MOP, 'Mop', BROKEN)
    expect(changed).toBe(true)
    expect(next.broken.get(MOP)).toEqual({ path: MOP, name: 'Mop', problems: ['every is missing'] })
    expect(next.chores.has(MOP)).toBe(false)
  })

  it('moves a fixed chore from broken to chores and reports a change', () => {
    const wasBroken = put(EMPTY_REGISTRY, MOP, 'Mop', BROKEN).next
    const { next, changed } = put(wasBroken, MOP, 'Mop', ok())
    expect(changed).toBe(true)
    expect([next.chores.has(MOP), next.broken.has(MOP)]).toEqual([true, false])
  })

  it('moves a chore that breaks from chores to broken and reports a change', () => {
    const { next, changed } = put(listed, MOP, 'Mop', BROKEN)
    expect(changed).toBe(true)
    expect([next.chores.has(MOP), next.broken.has(MOP)]).toEqual([false, true])
  })

  it('reports a note that stops being a chore once, then never again', () => {
    const first = put(listed, MOP, 'Mop', null)
    const second = put(first.next, MOP, 'Mop', null)
    expect([first.changed, second.changed]).toEqual([true, false])
    expect(second.next.chores.has(MOP)).toBe(false)
  })

  it('reports an edit to a chore note even when the chore reads the same', () => {
    expect(put(listed, MOP, 'Mop', ok()).changed).toBe(true)
  })

  it('never reports a note that is not a chore', () => {
    const { next, changed } = put(listed, SHOPPING, 'Shopping', null)
    expect(changed).toBe(false)
    expect([...next.chores.keys()]).toEqual([MOP])
  })

  it('leaves the registry it was given untouched', () => {
    put(listed, MOP, 'Mop', BROKEN)
    put(listed, MOP, 'Mop', ok(2))
    put(listed, 'Chores/Dust.md', 'Dust', ok())
    put(listed, MOP, 'Mop', null)
    expect([...listed.chores.keys()]).toEqual([MOP])
    expect(listed.chores.get(MOP)?.every).toEqual({ n: 1, unit: 'w' })
    expect(listed.broken.size).toBe(0)
  })
})

describe('remove', () => {
  it('reports dropping a chore', () => {
    const { next, changed } = remove(listed, MOP)
    expect(changed).toBe(true)
    expect(next.chores.has(MOP)).toBe(false)
  })

  it('reports nothing for a path that was never a chore', () => {
    expect(remove(listed, SHOPPING).changed).toBe(false)
  })

  it('reports nothing when a non-chore is renamed', () => {
    const gone = remove(listed, SHOPPING)
    const back = put(gone.next, 'Notes/Groceries.md', 'Groceries', null)
    expect([gone.changed, back.changed]).toEqual([false, false])
  })

  it('leaves the registry it was given untouched', () => {
    remove(listed, MOP)
    expect(listed.chores.has(MOP)).toBe(true)
  })
})
