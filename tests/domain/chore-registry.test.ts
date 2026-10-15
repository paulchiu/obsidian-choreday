import { describe, expect, it } from 'vitest'
import type { ParseResult } from '../../src/domain/chore'
import { emptyRegistry, put, remove, rename } from '../../src/domain/chore-registry'
import { chore } from './helpers'

const MOP = 'Chores/Mop.md'
const ok = (every = 1): ParseResult => ({
  ok: true,
  chore: chore({ path: MOP, name: 'Mop', every: { n: every, unit: 'w' } }),
})
const BROKEN: ParseResult = { ok: false, problems: ['every is missing'] }
const SHOPPING = 'Notes/Shopping.md'
const listed = put(emptyRegistry(), MOP, 'Mop', ok()).next

describe('put', () => {
  it('lists a new chore and reports a change', () => {
    const { next, changed } = put(emptyRegistry(), MOP, 'Mop', ok())
    expect(changed).toBe(true)
    expect(next.chores.get(MOP)?.every).toEqual({ n: 1, unit: 'w' })
  })

  it('lists a chore that cannot be scheduled under broken, named after the note', () => {
    const { next, changed } = put(emptyRegistry(), MOP, 'Mop', BROKEN)
    expect(changed).toBe(true)
    expect(next.broken.get(MOP)).toEqual({ path: MOP, name: 'Mop', problems: ['every is missing'] })
    expect(next.chores.has(MOP)).toBe(false)
  })

  it('moves a fixed chore from broken to chores and reports a change', () => {
    const wasBroken = put(emptyRegistry(), MOP, 'Mop', BROKEN).next
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

  it('reports dropping a broken chore', () => {
    const wasBroken = put(emptyRegistry(), MOP, 'Mop', BROKEN).next
    const { next, changed } = remove(wasBroken, MOP)
    expect(changed).toBe(true)
    expect(next.broken.has(MOP)).toBe(false)
  })

  it('leaves the registry it was given untouched', () => {
    const wasBroken = put(emptyRegistry(), MOP, 'Mop', BROKEN).next
    remove(listed, MOP)
    remove(wasBroken, MOP)
    expect(listed.chores.has(MOP)).toBe(true)
    expect(wasBroken.broken.has(MOP)).toBe(true)
  })
})

describe('rename', () => {
  const DUST = 'Chores/Dust.md'
  const moved: ParseResult = { ok: true, chore: chore({ path: DUST, name: 'Dust' }) }

  it('lists a chore renamed inside the folder under its new path only', () => {
    const { next, changed } = rename(listed, MOP, DUST, 'Dust', moved)
    expect(changed).toBe(true)
    expect([...next.chores.keys()]).toEqual([DUST])
  })

  it('reports a chore renamed out of the folder', () => {
    const { next, changed } = rename(listed, MOP, 'Archive/Mop.md', 'Mop', null)
    expect(changed).toBe(true)
    expect(next.chores.size).toBe(0)
  })

  it('reports a note renamed into the folder that reads as a chore', () => {
    const { next, changed } = rename(emptyRegistry(), 'Notes/Dust.md', DUST, 'Dust', moved)
    expect(changed).toBe(true)
    expect([...next.chores.keys()]).toEqual([DUST])
  })

  it('reports nothing when a non-chore is renamed', () => {
    const { next, changed } = rename(listed, SHOPPING, 'Notes/Groceries.md', 'Groceries', null)
    expect(changed).toBe(false)
    expect(next).toBe(listed)
  })
})
