import { describe, expect, it } from 'vitest'
import { toIso } from '../../src/domain/day'
import { isSlot, patternFor, slotAfter, slotOnOrBefore } from '../../src/domain/slots'
import { TODAY, d } from './helpers'

const TUESDAY = 2
const fortnightlyTuesdays = (ticks: string[]) => patternFor([TUESDAY], 2, ticks.map(d), TODAY)

describe('patternFor', () => {
  it('anchors on the week phase most ticks share, even when the newest tick is off it', () => {
    const p = fortnightlyTuesdays(['2026-09-15', '2026-09-29', '2026-10-06'])
    expect(isSlot(p, d('2026-10-13'))).toBe(true)
    expect(isSlot(p, d('2026-10-20'))).toBe(false)
  })

  it('anchors on the newest tick when phases tie', () => {
    const p = fortnightlyTuesdays(['2026-10-06', '2026-09-29'])
    expect(isSlot(p, d('2026-10-20'))).toBe(true)
    expect(isSlot(p, d('2026-10-13'))).toBe(false)
  })

  it('ignores ticks on weekdays the chore is not set for', () => {
    const p = fortnightlyTuesdays(['2026-09-29', '2026-10-07', '2026-10-08'])
    expect(isSlot(p, d('2026-10-13'))).toBe(true)
    expect(isSlot(p, d('2026-10-20'))).toBe(false)
  })

  it('without a tick on a chosen weekday, starts at the first one on or after the oldest tick', () => {
    const p = fortnightlyTuesdays(['2026-10-08', '2026-10-01'])
    expect(toIso(slotAfter(p, d('2026-10-01')))).toBe('2026-10-06')
    expect(toIso(slotAfter(p, d('2026-10-06')))).toBe('2026-10-20')
  })

  it('without any ticks, starts at the first chosen weekday on or after today', () => {
    const p = fortnightlyTuesdays([])
    expect(toIso(slotAfter(p, TODAY))).toBe('2026-10-13')
    expect(toIso(slotAfter(p, d('2026-10-13')))).toBe('2026-10-27')
  })
})

describe('slots across a week boundary', () => {
  /** Sundays and Mondays, fortnightly, on the week of Monday 5 October. */
  const p = patternFor([0, 1], 2, [d('2026-10-05')], TODAY)

  it('counts Sunday as the end of the Monday-start week', () => {
    expect(toIso(slotAfter(p, d('2026-10-05')))).toBe('2026-10-11')
    expect(toIso(slotAfter(p, d('2026-10-11')))).toBe('2026-10-19')
  })

  it('finds the latest slot on or before a day in an off week', () => {
    expect(toIso(slotOnOrBefore(p, d('2026-10-18')))).toBe('2026-10-11')
    expect(toIso(slotOnOrBefore(p, d('2026-10-19')))).toBe('2026-10-19')
  })
})
