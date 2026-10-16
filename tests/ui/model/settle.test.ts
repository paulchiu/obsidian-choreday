import { describe, expect, it } from 'vitest'
import { derive } from '../../../src/domain/schedule'
import {
  EMPTY_SETTLING,
  holdUndone,
  releaseUndone,
  settle,
  startSettle,
  toggleExpanded,
  type Settling,
} from '../../../src/ui/model/settle'
import { TODAY, chore } from '../../domain/helpers'

const kettle = chore()
const before = derive(kettle, TODAY)
const KETTLE = kettle.path
const FILTER = 'Chores/Change filter.md'

/** Settling with `paths` ticked a moment ago. */
const ticked = (...paths: string[]): Settling =>
  paths.reduce((s, p) => startSettle(s, p, before), EMPTY_SETTLING)

describe('EMPTY_SETTLING', () => {
  it('has nothing settling, held or open', () => {
    expect([
      EMPTY_SETTLING.justDone.size,
      EMPTY_SETTLING.undone.size,
      EMPTY_SETTLING.expanded.size,
    ]).toEqual([0, 0, 0])
  })
})

describe('startSettle', () => {
  it('records the state the row had before its tick, under its path', () => {
    const s = startSettle(EMPTY_SETTLING, KETTLE, before)
    expect([...s.justDone]).toEqual([[KETTLE, before]])
  })

  it('leaves the settling it was given alone', () => {
    startSettle(EMPTY_SETTLING, KETTLE, before)
    expect(EMPTY_SETTLING.justDone.size).toBe(0)
  })
})

describe('settle', () => {
  it('drops the paths from the settling and held rows', () => {
    const s = settle(holdUndone(ticked(KETTLE, FILTER), [KETTLE]), [KETTLE])
    expect([[...s.justDone.keys()], s.undone.size]).toEqual([[FILTER], 0])
  })

  it('returns the same settling when none of the paths were settling', () => {
    const s = ticked(KETTLE)
    expect(settle(s, [FILTER])).toBe(s)
  })
})

describe('holdUndone', () => {
  it('holds only the paths that are settling', () => {
    const s = holdUndone(ticked(KETTLE), [KETTLE, FILTER])
    expect([...s.undone]).toEqual([KETTLE])
  })

  it('returns the same settling when none of the paths are settling', () => {
    const s = ticked(KETTLE)
    expect(holdUndone(s, [FILTER])).toBe(s)
  })

  it('returns the same settling when every path is already held', () => {
    const s = holdUndone(ticked(KETTLE), [KETTLE])
    expect(holdUndone(s, [KETTLE])).toBe(s)
  })
})

describe('releaseUndone', () => {
  it('releases a held row once its tick has left the index', () => {
    const s = releaseUndone(holdUndone(ticked(KETTLE), [KETTLE]), () => false)
    expect([s.justDone.size, s.undone.size]).toEqual([0, 0])
  })

  it('keeps a held row while the index still shows its tick', () => {
    const held = holdUndone(ticked(KETTLE, FILTER), [KETTLE, FILTER])
    const s = releaseUndone(held, (p) => p === FILTER)
    expect([[...s.justDone.keys()], [...s.undone]]).toEqual([[FILTER], [FILTER]])
  })

  it('returns the same settling when no row is held', () => {
    const s = ticked(KETTLE)
    expect(releaseUndone(s, () => false)).toBe(s)
  })

  it('returns the same settling when every held row is still ticked', () => {
    const s = holdUndone(ticked(KETTLE), [KETTLE])
    expect(releaseUndone(s, () => true)).toBe(s)
  })
})

describe('toggleExpanded', () => {
  it('opens a row, then closes it', () => {
    const open = toggleExpanded(EMPTY_SETTLING, KETTLE)
    const closed = toggleExpanded(open, KETTLE)
    expect([[...open.expanded], closed.expanded.size]).toEqual([[KETTLE], 0])
  })

  it('never touches the settling rows', () => {
    const s = ticked(KETTLE)
    expect(toggleExpanded(s, KETTLE).justDone).toBe(s.justDone)
  })
})
