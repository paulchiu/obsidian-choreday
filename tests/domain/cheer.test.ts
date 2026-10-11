import { describe, expect, it } from 'vitest'
import { caughtUpLine, cheerStep, type CheerState } from '../../src/domain/cheer'
import { TODAY } from './helpers'

/** Runs one render per entry: whether each row left in Needs doing is still settling from a tick. */
const renders = (...needs: (readonly boolean[])[]): boolean[] => {
  let state: CheerState = { armed: false, play: false }
  return needs.map((n) => {
    state = cheerStep(state.armed, n)
    return state.play
  })
}

describe('cheerStep', () => {
  it('cheers once the last row in Needs doing settles after its tick', () => {
    expect(renders([false], [true], [])).toEqual([false, false, true])
  })

  it('stays quiet when Needs doing is already empty as the view opens or the day rolls over', () => {
    expect(renders([], [])).toEqual([false, false])
  })

  it('stays quiet when the last row leaves Needs doing without a tick, such as a snooze', () => {
    expect(renders([false], [])).toEqual([false, false])
  })

  it('stays quiet when the tick is undone before its row settles', () => {
    expect(renders([true], [false], [])).toEqual([false, false, false])
  })

  it('stays quiet when an unticked row leaves Needs doing in the same render as the last tick', () => {
    expect(renders([true, false], [])).toEqual([false, false])
  })

  it('cheers once, not on every render after', () => {
    expect(renders([true], [], [])).toEqual([false, true, false])
  })
})

describe('caughtUpLine', () => {
  it('offers at least ten cheerful lines over a fortnight, none of them the old flat one', () => {
    const fortnight = Array.from({ length: 14 }, (_, i) => caughtUpLine(TODAY + i))
    expect(new Set(fortnight).size).toBeGreaterThanOrEqual(10)
    expect(fortnight).not.toContain('Nothing needs doing.')
  })

  it('holds the same line all day and moves to a new one the next day', () => {
    const month = Array.from({ length: 30 }, (_, i) => TODAY + i)
    month.forEach((day) => expect(caughtUpLine(day)).toBe(caughtUpLine(day)))
    month.slice(1).forEach((day) => expect(caughtUpLine(day)).not.toBe(caughtUpLine(day - 1)))
  })
})
