import { describe, expect, it } from 'vitest'
import { withAnchor, withUnit } from '../../src/domain/chore-form'
import { chore } from './helpers'

const bins = chore({ every: { n: 1, unit: 'w' }, schedule: { anchor: 'calendar', days: [2] } })

describe('withUnit', () => {
  it('turns set days into after last done, with no days left, when the unit leaves weeks', () => {
    expect(withUnit({ chore: bins }, 'm').chore).toEqual(chore({ every: { n: 1, unit: 'm' } }))
  })

  it('brings back the set days when the unit returns to weeks', () => {
    const mondaysAndThursdays = chore({
      every: { n: 2, unit: 'w' },
      schedule: { anchor: 'calendar', days: [1, 4] },
    })
    const monthly = withUnit({ chore: mondaysAndThursdays }, 'm')
    expect(withUnit(monthly, 'w').chore).toEqual(mondaysAndThursdays)
  })

  it('keeps after last done, picked before the unit left weeks, when it returns to weeks', () => {
    const afterDone = withAnchor({ chore: bins }, 'done')
    const monthly = withUnit(afterDone, 'm')
    expect(withUnit(monthly, 'w').chore).toEqual(chore({ every: { n: 1, unit: 'w' } }))
  })
})

describe('withAnchor', () => {
  it('puts a monthly chore on Tuesdays every week when set days are picked', () => {
    const monthly = chore({ every: { n: 3, unit: 'm' } })
    expect(withAnchor({ chore: monthly }, 'calendar').chore).toEqual(bins)
  })

  it('keeps a weekly interval when set days are picked', () => {
    const fortnightly = chore({ every: { n: 2, unit: 'w' } })
    expect(withAnchor({ chore: fortnightly }, 'calendar').chore).toEqual(
      chore({ every: { n: 2, unit: 'w' }, schedule: { anchor: 'calendar', days: [2] } }),
    )
  })

  it('drops the days when after last done is picked', () => {
    expect(withAnchor({ chore: bins }, 'done').chore).toEqual(chore({ every: { n: 1, unit: 'w' } }))
  })
})
