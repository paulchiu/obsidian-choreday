import { describe, expect, it } from 'vitest'
import { withAnchor, withUnit } from '../../src/domain/chore-form'
import { showChore, type ScheduleControls } from '../../src/ui/chore-form-controls'
import { chore } from '../domain/helpers'

/** The slice of a form control `showChore` touches, since the tests run without a DOM. */
class FakeControl {
  value = ''
  shown = true
  readonly classes = new Set<string>()
  readonly attrs = new Map<string, string>()
  toggle(show: boolean): void {
    this.shown = show
  }
  toggleClass(cls: string, on: boolean): void {
    if (on) this.classes.add(cls)
    else this.classes.delete(cls)
  }
  setAttr(name: string, value: string): void {
    this.attrs.set(name, value)
  }
}

/** Controls as the form opens them on `c`, so a test sees only what `showChore` changes. */
const formFor = (c: { every: { n: number; unit: string }; schedule: { anchor: string } }) => {
  const control = (value = ''): FakeControl => Object.assign(new FakeControl(), { value })
  const fakes = {
    n: control(String(c.every.n)),
    unit: control(c.every.unit),
    anchor: control(c.schedule.anchor),
    daySetting: control(),
    chips: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, el: control() })),
  }
  return { fakes, controls: fakes as unknown as ScheduleControls }
}

const bins = chore({ every: { n: 1, unit: 'w' }, schedule: { anchor: 'calendar', days: [2] } })

describe('showChore', () => {
  it('shows after last done with the day picker hidden once a chore on set days leaves weeks', () => {
    const { fakes, controls } = formFor(bins)
    showChore(controls, withUnit({ chore: bins }, 'm').chore)
    expect({ anchor: fakes.anchor.value, days: fakes.daySetting.shown }).toEqual({
      anchor: 'done',
      days: false,
    })
  })

  it('shows every 1 weeks once set days are picked on a monthly chore', () => {
    const monthly = chore({ every: { n: 3, unit: 'm' } })
    const { fakes, controls } = formFor(monthly)
    showChore(controls, withAnchor({ chore: monthly }, 'calendar').chore)
    expect({ n: fakes.n.value, unit: fakes.unit.value }).toEqual({ n: '1', unit: 'w' })
  })

  it('leaves the every field alone while it is cleared to type a new number', () => {
    const weekly = chore({ every: { n: 1, unit: 'w' } })
    const { fakes, controls } = formFor(weekly)
    fakes.n.value = ''
    showChore(controls, weekly)
    expect(fakes.n.value).toBe('')
  })
})
