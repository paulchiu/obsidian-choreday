import { describe, expect, it } from 'vitest'
import { withAnchor, withEdit, withUnit } from '../../src/domain/chore-form'
import { chore } from './helpers'

const bins = chore({ every: { n: 1, unit: 'w' }, schedule: { anchor: 'calendar', days: [2] } })
const mondaysAndThursdays = chore({
  every: { n: 2, unit: 'w' },
  schedule: { anchor: 'calendar', days: [1, 4] },
})

describe('withUnit', () => {
  it('turns set days into after last done, with no days left, when the unit leaves weeks', () => {
    expect(withUnit({ chore: bins }, 'm').chore).toEqual(chore({ every: { n: 1, unit: 'm' } }))
  })

  it('brings back the set days when the unit returns to weeks', () => {
    const monthly = withUnit({ chore: mondaysAndThursdays }, 'm')
    expect(withUnit(monthly, 'w').chore).toEqual(mondaysAndThursdays)
  })

  it('brings back the set days after passing through more than one other unit', () => {
    const daily = withUnit(withUnit({ chore: mondaysAndThursdays }, 'm'), 'd')
    expect(withUnit(daily, 'w').chore).toEqual(mondaysAndThursdays)
  })

  it('keeps after last done, picked while the set days were put aside, when it returns to weeks', () => {
    const monthly = withUnit({ chore: mondaysAndThursdays }, 'm')
    const afterDone = withAnchor(withAnchor(monthly, 'calendar'), 'done')
    expect(withUnit(afterDone, 'w').chore).toEqual(chore({ every: { n: 2, unit: 'w' } }))
  })
})

describe('withAnchor', () => {
  it('puts a monthly chore on Tuesdays every week when set days are picked', () => {
    const monthly = chore({ every: { n: 3, unit: 'm' } })
    expect(withAnchor({ chore: monthly }, 'calendar').chore).toEqual(bins)
  })

  it('brings back the set days and interval the chore had before its unit left weeks', () => {
    const monthly = withUnit({ chore: mondaysAndThursdays }, 'm')
    expect(withAnchor(monthly, 'calendar').chore).toEqual(mondaysAndThursdays)
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

describe('withEdit', () => {
  it('keeps the set days put aside through edits to the name and Every count', () => {
    const monthly = withUnit({ chore: mondaysAndThursdays }, 'm')
    const renamed = withEdit(monthly, { name: 'Bins', every: { n: 2, unit: 'm' } })
    expect(withUnit(renamed, 'w').chore).toEqual({ ...mondaysAndThursdays, name: 'Bins' })
  })
})
