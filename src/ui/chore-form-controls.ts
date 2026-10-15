import { scheduleDays, type Chore } from '../domain/chore'
import { everyN } from '../domain/chore-form'

/** The chore form's schedule controls. */
export interface ScheduleControls {
  readonly n: HTMLInputElement
  readonly unit: HTMLSelectElement
  readonly anchor: HTMLSelectElement
  readonly daySetting: HTMLElement
  readonly chips: readonly { readonly day: number; readonly el: HTMLElement }[]
}

/** Sets the schedule controls to show `c`, leaving the Every field alone while it reads the same. */
export function showChore(controls: ScheduleControls, c: Chore): void {
  if (everyN(controls.n.value) !== c.every.n) controls.n.value = String(c.every.n)
  controls.unit.value = c.every.unit
  controls.anchor.value = c.schedule.anchor
  controls.daySetting.toggle(c.schedule.anchor === 'calendar')
  const days = scheduleDays(c.schedule)
  for (const { day, el } of controls.chips) {
    const on = days.includes(day)
    el.toggleClass('is-on', on)
    el.setAttr('aria-pressed', String(on))
  }
}
