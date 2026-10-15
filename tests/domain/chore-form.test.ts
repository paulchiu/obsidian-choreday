import { describe, expect, it } from 'vitest'
import { withAnchor, withUnit } from '../../src/domain/chore-form'
import { chore } from './helpers'

const bins = chore({ every: { n: 1, unit: 'w' }, schedule: { anchor: 'calendar', days: [2] } })

describe('withUnit', () => {
  it('turns set days into after last done, with no days left, when the unit leaves weeks', () => {
    expect(withUnit(bins, 'm')).toEqual(chore({ every: { n: 1, unit: 'm' } }))
  })
})

describe('withAnchor', () => {
  it('puts a monthly chore on Tuesdays every week when set days are picked', () => {
    const monthly = chore({ every: { n: 3, unit: 'm' } })
    expect(withAnchor(monthly, 'calendar')).toEqual(bins)
  })

  it('keeps a weekly interval when set days are picked', () => {
    const fortnightly = chore({ every: { n: 2, unit: 'w' } })
    expect(withAnchor(fortnightly, 'calendar')).toEqual(
      chore({ every: { n: 2, unit: 'w' }, schedule: { anchor: 'calendar', days: [2] } }),
    )
  })

  it('drops the days when after last done is picked', () => {
    expect(withAnchor(bins, 'done')).toEqual(chore({ every: { n: 1, unit: 'w' } }))
  })
})
