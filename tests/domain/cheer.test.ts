import { describe, expect, it } from 'vitest'
import { cheerStep, type CheerState } from '../../src/domain/cheer'

/** Runs one render per entry: whether each row left in Needs doing is still settling from a tick. */
const renders = (...needs: (readonly boolean[])[]): boolean[] => {
  let state: CheerState = { armed: false, cheer: false }
  return needs.map((n) => {
    state = cheerStep(state.armed, n)
    return state.cheer
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
