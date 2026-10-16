// @vitest-environment happy-dom
import type { App } from 'obsidian'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Chore } from '../../../src/domain/chore'
import { ChoreModal, DateModal } from '../../../src/ui/obsidian/modals'
import { TODAY, chore, d } from '../../domain/helpers'
import { resetDom } from '../../stubs/obsidian-dom'
import { outline } from '../../stubs/outline'

const app = {} as App
const kettle = chore()
const bins = chore({ every: { n: 1, unit: 'w' }, schedule: { anchor: 'calendar', days: [2] } })

/** Lets a pending save settle. */
const settle = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0))

/** Opens the chore form on `original`, or a new one, with `onSave` resolving `saved`. */
function openChore(original?: Chore, saved = true) {
  const onSave = vi.fn((_c: Chore) => Promise.resolve(saved))
  const modal = new ChoreModal(app, original, TODAY, true, onSave)
  const close = vi.spyOn(modal, 'close')
  modal.open()
  return { modal, el: modal.contentEl, onSave, close }
}

/** The setting row labelled `name`. */
function row(el: HTMLElement, name: string): HTMLElement {
  const item = Array.from(el.querySelectorAll<HTMLElement>('.setting-item')).find(
    (s) => s.querySelector('.setting-item-name')?.textContent === name,
  )
  if (!item) throw new Error(`no ${name} row`)
  return item
}

const control = <T extends Element>(el: HTMLElement, name: string, selector: string): T => {
  const found = row(el, name).querySelector<T>(selector)
  if (!found) throw new Error(`no ${selector} in ${name}`)
  return found
}

const input = (el: HTMLElement, name: string): HTMLInputElement => control(el, name, 'input')
const selects = (el: HTMLElement, name: string): HTMLSelectElement[] =>
  Array.from(row(el, name).querySelectorAll('select'))

function button(el: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(el.querySelectorAll('button')).find((b) => b.textContent === text)
  if (!found) throw new Error(`no ${text} button`)
  return found
}

/** Sets a field's value and fires the event Preact listens for on it. */
function enter(field: HTMLInputElement | HTMLSelectElement, value: string): void {
  field.value = value
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'))
}

/** Each field's current value, since `outline` shows attributes and Preact sets values as properties. */
const values = (el: HTMLElement): string[] =>
  Array.from(
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select'),
    (f) => f.value,
  )

const lit = (el: HTMLElement): string[] =>
  Array.from(el.querySelectorAll('.cd-chip.is-on[aria-pressed=true]'), (c) => c.textContent ?? '')

beforeEach(() => {
  resetDom()
})

describe('ChoreModal', () => {
  it('draws the edit form as setting rows with the chore filled in', () => {
    const { modal, el } = openChore(kettle)
    expect(modal.titleEl.textContent).toBe('Edit chore')
    expect(modal.modalEl.classList.contains('cd-modal')).toBe(true)
    expect(values(el)).toEqual(['Descale kettle', '4', 'w', 'done'])
    expect(outline(el)).toMatchSnapshot()
  })

  it('draws the On row with the set days lit for a chore on set days', () => {
    const { el } = openChore(bins)
    expect(outline(row(el, 'On'))).toMatchSnapshot()
  })

  it('opens a new chore blank, due today', () => {
    const { modal, el } = openChore()
    expect(modal.titleEl.textContent).toBe('New chore')
    expect(values(el)).toEqual(['', '2', 'w', 'done'])
    expect(el.querySelector('.cd-preview')?.textContent).toBe(
      'Due today, since it has never been done.',
    )
  })

  it('shows after last done with no On row once a chore on set days leaves weeks', () => {
    const { el } = openChore(bins)
    enter(selects(el, 'Every')[0]!, 'm')
    expect(selects(el, 'Schedule')[0]!.value).toBe('done')
    expect(el.querySelector('.cd-day-setting')).toBeNull()
  })

  it('lights the set days back up when a chore that left weeks returns to them', () => {
    const { el } = openChore(
      chore({ every: { n: 2, unit: 'w' }, schedule: { anchor: 'calendar', days: [1, 4] } }),
    )
    enter(selects(el, 'Every')[0]!, 'm')
    enter(selects(el, 'Every')[0]!, 'w')
    expect({ anchor: selects(el, 'Schedule')[0]!.value, lit: lit(el) }).toEqual({
      anchor: 'calendar',
      lit: ['Mo', 'Th'],
    })
  })

  it('shows every 1 weeks once set days are picked on a monthly chore', () => {
    const { el } = openChore(chore({ every: { n: 3, unit: 'm' } }))
    enter(selects(el, 'Schedule')[0]!, 'calendar')
    expect({ n: input(el, 'Every').value, unit: selects(el, 'Every')[0]!.value }).toEqual({
      n: '1',
      unit: 'w',
    })
  })

  it('leaves the every field alone while it is cleared to type a new number', () => {
    const { el } = openChore(chore({ every: { n: 1, unit: 'w' } }))
    enter(input(el, 'Every'), '')
    expect(input(el, 'Every').value).toBe('')
  })

  it('previews the move when the repeat changes', () => {
    const { el } = openChore(chore({ done: [d('2026-09-26')] }))
    enter(input(el, 'Every'), '2')
    expect(el.querySelector('.cd-preview')?.textContent).toMatch(
      /^Next due moves from .+ to .+\. History is unchanged\.$/,
    )
  })

  it('saves the edited chore and closes once the save goes through', async () => {
    const { el, onSave, close } = openChore(kettle)
    enter(input(el, 'Name'), 'Descale the kettle')
    button(el, 'Save').click()
    await settle()
    expect(onSave).toHaveBeenCalledWith({ ...kettle, name: 'Descale the kettle' })
    expect(close).toHaveBeenCalledOnce()
  })

  it('stays open when the save fails', async () => {
    const { el, onSave, close } = openChore(kettle, false)
    button(el, 'Save').click()
    await settle()
    expect(onSave).toHaveBeenCalledWith(kettle)
    expect(close).not.toHaveBeenCalled()
  })

  it('does nothing on save while the name is blank', async () => {
    const { el, onSave, close } = openChore(kettle)
    enter(input(el, 'Name'), '  ')
    button(el, 'Save').click()
    await settle()
    expect(onSave).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })

  it('closes on cancel and leaves nothing mounted', () => {
    const { el, onSave, close } = openChore(kettle)
    button(el, 'Cancel').click()
    expect(close).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
    expect(el.childNodes).toHaveLength(0)
  })
})

describe('DateModal', () => {
  /** Opens the date picker on 12 October, recording what it picks. */
  function openDate() {
    const onPick = vi.fn()
    const modal = new DateModal(app, 'Done on…', d('2026-10-12'), onPick)
    const close = vi.spyOn(modal, 'close')
    modal.open()
    return { modal, el: modal.contentEl, onPick, close }
  }

  it('draws a date row and the buttons, set to the initial day', () => {
    const { modal, el } = openDate()
    expect(modal.titleEl.textContent).toBe('Done on…')
    expect(values(el)).toEqual(['2026-10-12'])
    expect(outline(el)).toMatchSnapshot()
  })

  it('picks the entered date, then closes', () => {
    const { el, onPick, close } = openDate()
    enter(input(el, 'Date'), '2026-10-20')
    button(el, 'Save').click()
    expect(onPick).toHaveBeenCalledWith(d('2026-10-20'))
    expect(onPick.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]!)
    expect(el.childNodes).toHaveLength(0)
  })

  it('closes without picking when the date does not parse', () => {
    const { el, onPick, close } = openDate()
    enter(input(el, 'Date'), '')
    button(el, 'Save').click()
    expect(onPick).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes on cancel without picking', () => {
    const { el, onPick, close } = openDate()
    button(el, 'Cancel').click()
    expect(onPick).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
})
