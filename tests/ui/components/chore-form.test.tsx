// @vitest-environment happy-dom
import { render } from 'preact'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Chore } from '../../../src/domain/chore'
import { blankChore } from '../../../src/domain/chore-form'
import { ChoreForm, type ChoreFormHandlers } from '../../../src/ui/components/chore-form'
import { DateForm } from '../../../src/ui/components/date-form'
import { TODAY, chore, d } from '../../domain/helpers'
import { resetDom } from '../../stubs/obsidian-dom'

let on: { [K in keyof ChoreFormHandlers]: Mock<ChoreFormHandlers[K]> }

beforeEach(() => {
  resetDom()
  on = {
    name: vi.fn(),
    everyN: vi.fn(),
    unit: vi.fn(),
    anchor: vi.fn(),
    days: vi.fn(),
    cancel: vi.fn(),
    save: vi.fn(),
  }
})

/** Draws the form for `c` against `original` into a fresh box and returns the box. */
function form(c: Chore, original: Chore | undefined, everyText = String(c.every.n)): HTMLElement {
  const el = document.body.appendChild(document.createElement('div'))
  render(
    <ChoreForm
      draft={{ chore: c }}
      everyText={everyText}
      original={original}
      today={TODAY}
      early={true}
      on={on}
    />,
    el,
  )
  return el
}

const preview = (el: HTMLElement): string => el.querySelector('.cd-preview')?.textContent ?? ''

const field = <T extends Element>(el: HTMLElement, selector: string): T => {
  const found = el.querySelector<T>(selector)
  if (!found) throw new Error(`no ${selector}`)
  return found
}

/** The button reading or labelled `text`. */
function buttonNamed(el: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(el.querySelectorAll('button')).find(
    (b) => b.textContent === text || b.getAttribute('aria-label') === text,
  )
  if (!found) throw new Error(`no ${text} button`)
  return found
}

const kettle = chore({ done: [d('2026-09-26')] })
const bins = chore({ every: { n: 1, unit: 'w' }, schedule: { anchor: 'calendar', days: [2] } })

describe('ChoreForm preview', () => {
  it('says the next due date stays when the edit does not move it', () => {
    expect(preview(form({ ...kettle, name: 'Descale the kettle' }, kettle))).toBe(
      'Next due stays Sat 24 Oct (in 2 weeks).',
    )
  })

  it('names both dates in bold when the edit moves the next due date', () => {
    const el = form({ ...kettle, every: { n: 2, unit: 'w' } }, kettle)
    expect({
      text: preview(el),
      bold: Array.from(el.querySelectorAll('.cd-preview b'), (b) => b.textContent),
    }).toEqual({
      text: 'Next due moves from Sat 24 Oct (in 2 weeks) to Sat 10 Oct (today). History is unchanged.',
      bold: ['Sat 24 Oct (in 2 weeks)', 'Sat 10 Oct (today)'],
    })
  })

  it('says a new chore is due today when nothing holds it back', () => {
    expect(preview(form(blankChore(), undefined))).toBe('Due today, since it has never been done.')
  })

  it('gives the first due date of a new chore on set days', () => {
    expect(preview(form({ ...bins, name: '' }, undefined))).toBe('First due Tue 13 Oct.')
  })
})

describe('ChoreForm controls', () => {
  it("draws rows and fields with the attributes Obsidian's Setting gives them", () => {
    const el = form(bins, bins)
    expect({
      rows: Array.from(el.querySelectorAll('.setting-item'), (r) => r.getAttribute('tabindex')),
      spellcheck: Array.from(el.querySelectorAll('input'), (i) => i.spellcheck),
    }).toEqual({ rows: ['-1', '-1', '-1', '-1', '-1'], spellcheck: [false, false] })
  })

  it('passes the typed name and every text straight through', () => {
    const el = form(kettle, kettle)
    const name = field<HTMLInputElement>(el, 'input[type=text]')
    name.value = 'Kettle'
    name.dispatchEvent(new Event('input'))
    const n = field<HTMLInputElement>(el, 'input.cd-every-n')
    n.value = ''
    n.dispatchEvent(new Event('input'))
    expect([on.name.mock.calls, on.everyN.mock.calls]).toEqual([[['Kettle']], [['']]])
  })

  it('shows the every text it is given rather than the repeat count', () => {
    expect(field<HTMLInputElement>(form(kettle, kettle, ''), 'input.cd-every-n').value).toBe('')
  })

  it('passes the picked unit and schedule', () => {
    const el = form(kettle, kettle)
    const [unit, anchor] = Array.from(el.querySelectorAll('select'))
    unit!.value = 'm'
    unit!.dispatchEvent(new Event('change'))
    anchor!.value = 'calendar'
    anchor!.dispatchEvent(new Event('change'))
    expect([on.unit.mock.calls, on.anchor.mock.calls]).toEqual([[['m']], [['calendar']]])
  })

  it('draws the On row only for a chore on set days', () => {
    expect([
      form(kettle, kettle).querySelector('.cd-day-setting'),
      form(bins, bins).querySelector('.cd-day-setting .setting-item-name')?.textContent,
    ]).toEqual([null, 'On'])
  })

  it('toggles a chip into the set days and applies a preset', () => {
    const el = form(bins, bins)
    buttonNamed(el, 'Thursday').click()
    buttonNamed(el, 'Tuesday').click()
    buttonNamed(el, 'Weekends').click()
    expect(on.days.mock.calls).toEqual([[[2, 4]], [[2]], [[0, 6]]])
  })

  it('cancels and saves from the buttons', () => {
    const el = form(kettle, kettle)
    buttonNamed(el, 'Cancel').click()
    buttonNamed(el, 'Save').click()
    expect([on.cancel, on.save].map((h) => h.mock.calls.length)).toEqual([1, 1])
  })
})

describe('DateForm', () => {
  it('passes the entered date and the button presses', () => {
    const change = vi.fn<(v: string) => void>()
    const cancel = vi.fn()
    const save = vi.fn()
    const el = document.body.appendChild(document.createElement('div'))
    render(<DateForm value="2026-10-12" on={{ change, cancel, save }} />, el)
    const date = field<HTMLInputElement>(el, 'input[type=date]')
    expect([date.value, date.spellcheck]).toEqual(['2026-10-12', false])
    date.value = '2026-10-20'
    date.dispatchEvent(new Event('input'))
    buttonNamed(el, 'Cancel').click()
    buttonNamed(el, 'Save').click()
    expect([change.mock.calls, cancel.mock.calls.length, save.mock.calls.length]).toEqual([
      [['2026-10-20']],
      1,
      1,
    ])
  })
})
