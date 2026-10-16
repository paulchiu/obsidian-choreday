import { describe, expect, it } from 'vitest'
import { landing, type Slot } from '../../../src/ui/model/focus-landing'

/** A slot as `[group, key]`, or a bare key outside any list group. */
const slots = (...specs: (string | [group: string, key: string])[]): Slot[] =>
  specs.map((s) => (typeof s === 'string' ? { key: s, group: '' } : { key: s[1], group: s[0] }))

describe('landing', () => {
  it('finds the same control again', () => {
    const list = slots(['needs', 'row:a.md'], ['needs', 'check:a.md'])
    expect(landing(list, 1, list)).toBe(1)
  })

  it('is -1 when there was no control at the index', () => {
    expect(landing(slots('new'), 3, slots('new'))).toBe(-1)
  })

  it('hands focus to the next control of the same kind when the control left its group', () => {
    const before = slots(['needs', 'check:a.md'], ['needs', 'check:b.md'], ['coming', 'check:c.md'])
    const after = slots(['needs', 'check:b.md'], ['coming', 'check:a.md'], ['coming', 'check:c.md'])
    expect(landing(before, 0, after)).toBe(0)
  })

  it('hands focus to a control above it in its group when none of its kind is left', () => {
    const before = slots(['needs', 'group:needs'], ['needs', 'select:needs'])
    const after = slots(['needs', 'group:needs'])
    expect(landing(before, 1, after)).toBe(0)
  })

  it('lands on the first control of a group that now sits where its emptied group was', () => {
    const before = slots(['top', 'new'], ['needs', 'check:a.md'], ['later', 'later'])
    const after = slots(['top', 'new'], ['coming', 'group:coming'], ['later', 'later'])
    expect(landing(before, 1, after)).toBe(1)
  })

  it('falls back to the nearest control below, then above', () => {
    expect(landing(slots(['a', 'x'], ['b', 'y']), 0, slots(['b', 'y']))).toBe(0)
    expect(landing(slots(['a', 'x'], ['b', 'y']), 1, slots(['a', 'x']))).toBe(0)
  })
})
