// @vitest-environment happy-dom
import type { App } from 'obsidian'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Chore } from '../../../src/domain/chore'
import { applyChoreEdits, choreEdits, newChoreEdits } from '../../../src/domain/chore-edits'
import { ChoreModal, DateModal, PicksModal, type PickChoice } from '../../../src/ui/obsidian/modals'
import type { PickRule } from '../../../src/domain/picks'
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

/**
 * Each field's current value, since `outline` shows attributes and Preact sets values as properties.
 * Switches are left out: a checkbox's value reads `on` whether or not it is checked.
 */
const values = (el: HTMLElement): string[] =>
  Array.from(
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([type=checkbox]), select'),
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

  it('leaves the every field alone while it is cleared to type a new number', async () => {
    const { el, onSave } = openChore(chore({ every: { n: 4, unit: 'w' } }))
    enter(input(el, 'Every'), '')
    expect(input(el, 'Every').value).toBe('')
    button(el, 'Save').click()
    await settle()
    expect(onSave.mock.calls[0]?.[0].every).toEqual({ n: 1, unit: 'w' })
  })

  it('keeps the focused field and its siblings as the same nodes across redraws', () => {
    const { el } = openChore(kettle)
    document.body.append(el)
    const name = input(el, 'Name')
    const every = input(el, 'Every')
    const save = button(el, 'Save')
    name.focus()
    enter(name, 'Descale the kettle')
    expect({ same: input(el, 'Name') === name, focused: document.activeElement === name }).toEqual({
      same: true,
      focused: true,
    })
    enter(selects(el, 'Schedule')[0]!, 'calendar')
    enter(selects(el, 'Schedule')[0]!, 'done')
    expect({ every: input(el, 'Every') === every, save: button(el, 'Save') === save }).toEqual({
      every: true,
      save: true,
    })
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

  it('owns a pending save, disables edits and allows retry after a false result', async () => {
    let finish: (saved: boolean) => void = () => {}
    const onSave = vi
      .fn()
      .mockImplementationOnce((_c: Chore) => new Promise<boolean>((resolve) => (finish = resolve)))
      .mockResolvedValueOnce(true)
    const modal = new ChoreModal(app, bins, TODAY, true, onSave)
    const close = vi.spyOn(modal, 'close')
    modal.open()
    const { contentEl: el } = modal
    button(el, 'Save').click()
    button(el, 'Save').click()
    expect(onSave).toHaveBeenCalledOnce()
    expect(
      Array.from(
        el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
          'input, select, button',
        ),
      ).every((control) => control.disabled),
    ).toBe(true)
    finish(false)
    await settle()
    expect(close).not.toHaveBeenCalled()
    expect(button(el, 'Save').disabled).toBe(false)
    button(el, 'Save').click()
    await settle()
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledOnce()
  })

  it('does not redraw after the modal closes during a pending save', async () => {
    let finish: (saved: boolean) => void = () => {}
    const onSave = vi.fn((_c: Chore) => new Promise<boolean>((resolve) => (finish = resolve)))
    const modal = new ChoreModal(app, kettle, TODAY, true, onSave)
    modal.open()
    const { contentEl: el } = modal
    button(el, 'Save').click()
    modal.close()
    expect(el.childNodes).toHaveLength(0)
    finish(false)
    await settle()
    expect(el.childNodes).toHaveLength(0)
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

describe('ChoreModal rotation', () => {
  const water = chore({
    name: 'Clean water containers',
    every: { n: 1, unit: 'w' },
    rotation: {
      items: ['Fridge ice maker', 'Water filter jug', 'Water jug', 'Kettle', 'Dog water bowl'],
      perTurn: 2,
      turn: 'Fridge ice maker',
    },
  })
  const addField = (el: HTMLElement): HTMLInputElement => control(el, 'Items', 'input.cd-add-item')
  const pressReturn = (field: HTMLElement): void => {
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  }
  /** Types each of `items` into the Add field and presses Return. */
  const add = (el: HTMLElement, ...items: string[]): void => {
    for (const item of items) {
      enter(addField(el), item)
      pressReturn(addField(el))
    }
  }
  const names = (el: HTMLElement): string[] =>
    Array.from(el.querySelectorAll('.cd-item-name'), (n) => n.textContent ?? '')
  const preview = (el: HTMLElement): string[] =>
    Array.from(el.querySelectorAll('.cd-turns li'), (li) => li.textContent ?? '')
  const TOGGLE = 'Rotate through a list'
  const toggle = (el: HTMLElement): HTMLElement => control(el, TOGGLE, '[role=switch]')
  const isOn = (el: HTMLElement): boolean => toggle(el).getAttribute('aria-checked') === 'true'

  it('offers Rotate through a list as a switch, saying what it does', () => {
    const { el } = openChore()
    expect({
      toggle: row(el, TOGGLE).classList.contains('mod-toggle'),
      desc: row(el, TOGGLE).querySelector('.setting-item-description')?.textContent,
    }).toEqual({ toggle: true, desc: 'Take turns at a few items each time.' })
  })

  /** What the rotation group under the switch holds, in order: row names, then the preview. */
  const group = (el: HTMLElement): string[] =>
    Array.from(
      el.querySelectorAll('.cd-rotate-group > .setting-item, .cd-rotate-group > .cd-turns'),
      (n) => n.querySelector('.setting-item-name')?.textContent ?? 'preview',
    )

  it('hides the items, Per turn and the preview while rotation is off', () => {
    const { el } = openChore(kettle)
    expect({
      group: group(el),
      rows: el.querySelectorAll('.cd-add-item, .cd-per-turn').length,
    }).toEqual({ group: [], rows: 0 })
  })

  it('shows Per turn, then Items, then the preview, grouped under the switch', () => {
    const { el } = openChore(water)
    expect({
      group: group(el),
      follows: el.querySelector('.mod-toggle + .cd-rotate-group') !== null,
    }).toEqual({ group: ['Per turn', 'Items', 'preview'], follows: true })
  })

  it('hints under Items that tapping an item starts this turn there', () => {
    expect(
      row(openChore(water).el, 'Items').querySelector('.setting-item-description')?.textContent,
    ).toBe('Tap an item to start this turn there.')
  })

  it('shows Per turn and Items once rotation is turned on', () => {
    const { el } = openChore(kettle)
    toggle(el).click()
    expect(group(el)).toEqual(['Per turn', 'Items'])
  })

  /** Saves the form and returns the chore it handed over. */
  async function saved(el: HTMLElement, onSave: { mock: { calls: Chore[][] } }): Promise<Chore> {
    button(el, 'Save').click()
    await settle()
    const c = onSave.mock.calls[0]?.[0]
    if (!c) throw new Error('nothing saved')
    return c
  }

  it('removes rotate, per_turn and turn when saved with rotation off', async () => {
    const { el, onSave } = openChore(water)
    toggle(el).click()
    const note = [
      '---',
      'type: chore',
      'every: 1w',
      'rotate:',
      '  - Fridge ice maker',
      '  - Water filter jug',
      '  - Water jug',
      '  - Kettle',
      '  - Dog water bowl',
      'per_turn: 2',
      'turn: Fridge ice maker',
      '---',
      'Body.',
    ].join('\n')
    expect(applyChoreEdits(note, water, await saved(el, onSave))).toBe(
      ['---', 'type: chore', 'every: 1w', '---', 'Body.'].join('\n'),
    )
  })

  it('writes no rotation keys for a new chore saved with rotation off', async () => {
    const { el, onSave } = openChore()
    enter(input(el, 'Name'), 'Mop')
    toggle(el).click()
    add(el, 'Kitchen', 'Hall')
    toggle(el).click()
    expect(Object.keys(newChoreEdits(await saved(el, onSave)))).toEqual(['type', 'every', 'done'])
  })

  it('keeps the items and Per turn entered so far when rotation is turned off and on again', async () => {
    const { el, onSave } = openChore()
    enter(input(el, 'Name'), 'Mop')
    toggle(el).click()
    add(el, 'Kitchen', 'Hall')
    enter(input(el, 'Per turn'), '2')
    toggle(el).click()
    toggle(el).click()
    expect({
      items: names(el),
      perTurn: input(el, 'Per turn').value,
      saved: (await saved(el, onSave)).rotation,
    }).toEqual({
      items: ['Kitchen', 'Hall'],
      perTurn: '2',
      saved: { items: ['Kitchen', 'Hall'], perTurn: 2 },
    })
  })

  it('writes an ordinary chore when saved with rotation on and no items', async () => {
    const { el, onSave } = openChore()
    enter(input(el, 'Name'), 'Mop')
    toggle(el).click()
    expect(Object.keys(newChoreEdits(await saved(el, onSave)))).toEqual(['type', 'every', 'done'])
  })

  const warning = (el: HTMLElement): string | undefined =>
    el.querySelector('.mod-toggle + .cd-rotate-warning')?.textContent ?? undefined

  it("warns under the switch that saving removes the note's items once rotation is off", () => {
    const { el } = openChore(water)
    toggle(el).click()
    expect(warning(el)).toBe("Saving removes this chore's 5 items.")
  })

  it('hides the warning when rotation is turned back on', () => {
    const { el } = openChore(water)
    toggle(el).click()
    toggle(el).click()
    expect(warning(el)).toBeUndefined()
  })

  it('names a single item in the singular', () => {
    const { el } = openChore(chore({ rotation: { items: ['Kettle'] } }))
    toggle(el).click()
    expect(warning(el)).toBe("Saving removes this chore's 1 item.")
  })

  it('gives no warning when the note has no list to remove', () => {
    const { el } = openChore(kettle)
    toggle(el).click()
    add(el, 'Kitchen')
    toggle(el).click()
    expect(warning(el)).toBeUndefined()
  })

  it('turns rotation on from the keyboard', () => {
    const { el } = openChore()
    toggle(el).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect({ tabIndex: toggle(el).tabIndex, on: isOn(el) }).toEqual({ tabIndex: 0, on: true })
  })

  it('opens a new chore with rotation off and a rotating chore with it on', () => {
    expect([isOn(openChore().el), isOn(openChore(kettle).el), isOn(openChore(water).el)]).toEqual([
      false,
      false,
      true,
    ])
  })

  it('fills Items and Per turn from the chore', () => {
    const { el } = openChore(water)
    expect(names(el)).toEqual([
      'Fridge ice maker',
      'Water filter jug',
      'Water jug',
      'Kettle',
      'Dog water bowl',
    ])
    expect(input(el, 'Per turn').value).toBe('2')
  })

  it('previews this turn and the next two', () => {
    const { el } = openChore(water)
    expect(preview(el)).toEqual([
      'This turn: Fridge ice maker, Water filter jug',
      'Then: Water jug, Kettle',
      'Then: Dog water bowl, Fridge ice maker',
    ])
  })

  it('updates the preview as Per turn changes', () => {
    const { el } = openChore(water)
    enter(input(el, 'Per turn'), '3')
    expect(preview(el)[1]).toBe('Then: Kettle, Dog water bowl, Fridge ice maker')
  })

  it('saves the added items, trimmed with repeats dropped, and Per turn', async () => {
    const { el, onSave } = openChore()
    enter(input(el, 'Name'), 'Clean water containers')
    toggle(el).click()
    add(el, 'Fridge ice maker', '  Kettle ', 'Kettle')
    enter(input(el, 'Per turn'), '2')
    button(el, 'Save').click()
    await settle()
    expect(onSave.mock.calls[0]?.[0].rotation).toEqual({
      items: ['Fridge ice maker', 'Kettle'],
      perTurn: 2,
    })
  })

  /** Each item row: its name, then each button's label, marked when disabled. */
  const items = (el: HTMLElement): string[][] =>
    Array.from(el.querySelectorAll('.cd-item'), (li) => [
      li.querySelector('.cd-item-name')?.textContent ?? '',
      ...Array.from(
        li.querySelectorAll('button'),
        (b) => `${b.getAttribute('aria-label')}${b.disabled ? ' (disabled)' : ''}`,
      ),
    ])
  const jugs = chore({ rotation: { items: ['Jug', 'Kettle', 'Bowl'] } })

  it('lists each item in order with move and remove buttons, labelled with the item', () => {
    expect(items(openChore(jugs).el)).toEqual([
      ['Jug', 'Move Jug up (disabled)', 'Move Jug down', 'Remove Jug'],
      ['Kettle', 'Move Kettle up', 'Move Kettle down', 'Remove Kettle'],
      ['Bowl', 'Move Bowl up', 'Move Bowl down (disabled)', 'Remove Bowl'],
    ])
  })

  /** Clicks the button labelled `label`. */
  const press = (el: HTMLElement, label: string): void => {
    const found = el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
    if (!found) throw new Error(`no ${label} button`)
    found.click()
  }

  it('swaps an item with its neighbour and previews the new order', () => {
    const { el } = openChore(chore({ rotation: { items: ['Jug', 'Kettle', 'Bowl'], turn: 'Jug' } }))
    press(el, 'Move Kettle down')
    const down = { items: names(el), preview: preview(el) }
    press(el, 'Move Kettle up')
    expect([down, { items: names(el), preview: preview(el) }]).toEqual([
      {
        items: ['Jug', 'Bowl', 'Kettle'],
        preview: ['This turn: Jug', 'Then: Bowl', 'Then: Kettle'],
      },
      {
        items: ['Jug', 'Kettle', 'Bowl'],
        preview: ['This turn: Jug', 'Then: Kettle', 'Then: Bowl'],
      },
    ])
  })

  /** The item rows' names, with the one marked as this turn's start in brackets. */
  const marked = (el: HTMLElement): string[] =>
    Array.from(el.querySelectorAll('.cd-item'), (li) => {
      const name = li.querySelector('.cd-item-name')?.textContent ?? ''
      const mark = li.querySelector('.cd-this-turn')?.textContent
      return mark ? `${name} [${mark}]` : name
    })

  it('marks the item this turn starts at', () => {
    const turn = (t?: string): string[] =>
      marked(openChore(chore({ rotation: { items: ['Jug', 'Kettle', 'Bowl'], turn: t } })).el)
    expect([turn('Kettle'), turn()]).toEqual([
      ['Jug', 'Kettle [This turn]', 'Bowl'],
      ['Jug [This turn]', 'Kettle', 'Bowl'],
    ])
  })

  /** The item name labelled `label`. */
  const itemNamed = (el: HTMLElement, label: string): HTMLElement => {
    const found = el.querySelector<HTMLElement>(`.cd-item-name[aria-label="${label}"]`)
    if (!found) throw new Error(`no ${label} item`)
    return found
  }

  it('labels each item name as starting this turn there', () => {
    const { el } = openChore(jugs)
    expect(
      Array.from(el.querySelectorAll('.cd-item-name'), (n) => [
        n.getAttribute('role'),
        n.getAttribute('aria-label'),
      ]),
    ).toEqual([
      ['button', 'Start this turn at Jug'],
      ['button', 'Start this turn at Kettle'],
      ['button', 'Start this turn at Bowl'],
    ])
  })

  it('moves the mark and the turn preview to an item when its name is tapped', () => {
    const { el } = openChore(chore({ rotation: { items: ['Jug', 'Kettle', 'Bowl'], turn: 'Jug' } }))
    itemNamed(el, 'Start this turn at Kettle').click()
    expect({ marked: marked(el), preview: preview(el) }).toEqual({
      marked: ['Jug', 'Kettle [This turn]', 'Bowl'],
      preview: ['This turn: Kettle', 'Then: Bowl', 'Then: Jug'],
    })
  })

  it.each(['Enter', ' '])('starts this turn at an item when %j is pressed on its name', (key) => {
    const { el } = openChore(jugs)
    itemNamed(el, 'Start this turn at Bowl').dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    )
    expect(marked(el)).toEqual(['Jug', 'Kettle', 'Bowl [This turn]'])
  })

  it('saves the tapped item as this turn, leaving the list and history alone', async () => {
    const { el, onSave } = openChore(kept)
    itemNamed(el, 'Start this turn at Bowl').click()
    expect(choreEdits(kept, await saved(el, onSave))).toEqual({ turn: 'Bowl' })
  })

  /** The marked list after removing `item` from Jug, Kettle and Bowl with this turn at `turn`. */
  const afterRemoving = (item: string, turn: string): string[] => {
    const { el } = openChore(chore({ rotation: { items: ['Jug', 'Kettle', 'Bowl'], turn } }))
    press(el, `Remove ${item}`)
    return marked(el)
  }

  it('removes an item, keeping this turn where it was', () => {
    expect(afterRemoving('Jug', 'Kettle')).toEqual(['Kettle [This turn]', 'Bowl'])
  })

  it('moves this turn on to the next item when its item is removed', () => {
    expect(afterRemoving('Kettle', 'Kettle')).toEqual(['Jug', 'Bowl [This turn]'])
  })

  it('wraps this turn round to the first item when the last item holds it and is removed', () => {
    expect(afterRemoving('Bowl', 'Bowl')).toEqual(['Jug [This turn]', 'Kettle'])
  })

  it('adds the typed item last on Return, then clears the field and keeps it focused', () => {
    const { el } = openChore(jugs)
    document.body.append(el)
    addField(el).focus()
    enter(addField(el), ' Dog bowl ')
    pressReturn(addField(el))
    expect({
      items: names(el),
      text: addField(el).value,
      focused: el.ownerDocument.activeElement === addField(el),
    }).toEqual({ items: ['Jug', 'Kettle', 'Bowl', 'Dog bowl'], text: '', focused: true })
  })

  it('adds the typed item from the Add button and hands focus back to the field', () => {
    const { el } = openChore(jugs)
    document.body.append(el)
    enter(addField(el), 'Tap')
    button(el, 'Add').focus()
    button(el, 'Add').click()
    expect({
      items: names(el),
      text: addField(el).value,
      focused: el.ownerDocument.activeElement === addField(el),
    }).toEqual({ items: ['Jug', 'Kettle', 'Bowl', 'Tap'], text: '', focused: true })
  })

  it('adds nothing when the Add field is blank', () => {
    const { el } = openChore(jugs)
    enter(addField(el), '   ')
    pressReturn(addField(el))
    button(el, 'Add').click()
    expect(names(el)).toEqual(['Jug', 'Kettle', 'Bowl'])
  })

  /** Pastes `text` into the Add field at its caret. */
  const paste = (el: HTMLElement, text: string): void => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)
    addField(el).dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    )
  }

  it('adds one item per non-blank line pasted into the Add field', () => {
    const { el } = openChore(jugs)
    paste(el, 'Dog bowl\n\n  Tap\r\nSink\n')
    expect({ items: names(el), text: addField(el).value }).toEqual({
      items: ['Jug', 'Kettle', 'Bowl', 'Dog bowl', 'Tap', 'Sink'],
      text: '',
    })
  })

  it('joins pasted lines to the text already typed at the caret', () => {
    const { el } = openChore(jugs)
    enter(addField(el), 'Dog ')
    addField(el).setSelectionRange(4, 4)
    paste(el, 'bowl\nTap')
    expect(names(el)).toEqual(['Jug', 'Kettle', 'Bowl', 'Dog bowl', 'Tap'])
  })

  const kept = chore({
    done: [d('2026-10-03'), d('2026-09-26')],
    skipped: [d('2026-09-19')],
    rotation: { items: ['Jug', 'Kettle', 'Bowl'], turn: 'Kettle' },
  })

  it('saves moves and removals as a new list alone, keeping history and this turn', async () => {
    const { el, onSave } = openChore(kept)
    press(el, 'Move Bowl up')
    press(el, 'Remove Jug')
    expect(choreEdits(kept, await saved(el, onSave))).toEqual({ rotate: ['Bowl', 'Kettle'] })
  })

  it("saves this turn on the next item, keeping history, when this turn's item is removed", async () => {
    const { el, onSave } = openChore(kept)
    press(el, 'Remove Kettle')
    expect(choreEdits(kept, await saved(el, onSave))).toEqual({
      rotate: ['Jug', 'Bowl'],
      turn: 'Bowl',
    })
  })

  describe('on a phone', () => {
    /** The visual viewport, which a phone shrinks as its on-screen keyboard opens. */
    let viewport: EventTarget
    /** The class of each field scrolled into view, in order. */
    let scrolled: string[]

    beforeEach(() => {
      viewport = new EventTarget()
      Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
      scrolled = []
      vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (
        this: HTMLElement,
      ) {
        scrolled.push(this.className)
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
      Reflect.deleteProperty(window, 'visualViewport')
    })

    it('scrolls the focused Add field or Per turn into view, and again as the keyboard opens', () => {
      const { el } = openChore(jugs)
      document.body.append(el)
      addField(el).focus()
      viewport.dispatchEvent(new Event('resize'))
      input(el, 'Per turn').focus()
      viewport.dispatchEvent(new Event('resize'))
      expect(scrolled).toEqual(['cd-add-item', 'cd-add-item', 'cd-per-turn', 'cd-per-turn'])
    })
  })

  it('keeps this turn on the top item when it moves and the note names no turn', async () => {
    const { el, onSave } = openChore(jugs)
    press(el, 'Move Jug down')
    expect({ marked: marked(el), saved: (await saved(el, onSave)).rotation?.turn }).toEqual({
      marked: ['Kettle', 'Jug [This turn]', 'Bowl'],
      saved: 'Jug',
    })
  })

  it('draws the due summary straight after the switch while rotation is off', () => {
    expect(openChore(kettle).el.querySelector('.mod-toggle + .cd-preview')).not.toBeNull()
  })

  it('saves an ordinary chore and shows no preview while Rotate through is empty', async () => {
    const { el, onSave } = openChore()
    enter(input(el, 'Name'), 'Mop')
    expect(preview(el)).toEqual([])
    button(el, 'Save').click()
    await settle()
    expect(onSave.mock.calls[0]?.[0].rotation).toBeUndefined()
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

/** Opens the pick form on `initial`, previewing the first `count` of a fixed list, reversed on odd seeds. */
function openPicks(initial: PickChoice) {
  const names = ['Clean oven', 'Change sheets', 'Mop floors', 'Wipe benches']
  const preview = (rule: PickRule, seed: number): string[] =>
    (seed % 2 ? [...names].reverse() : names).slice(0, rule.count)
  const onPick = vi.fn<(choice: PickChoice) => void>()
  const modal = new PicksModal(app, initial, preview, onPick)
  const close = vi.spyOn(modal, 'close')
  modal.open()
  return { modal, el: modal.contentEl, onPick, close }
}

const usual: PickChoice = {
  rule: { strategy: 'overdue', count: 2 },
  seed: 0,
  morning: false,
  noPressure: false,
}
const previewText = (el: HTMLElement): string =>
  row(el, 'Today').querySelector('.cd-preview')?.textContent ?? ''

describe('PicksModal', () => {
  it('draws Focus on, How many, a preview, Every morning and No pressure, filled from the choice', () => {
    const { modal, el } = openPicks(usual)
    expect(modal.titleEl.textContent).toBe('Focus mode')
    expect(values(el)).toEqual(['overdue', '2'])
    for (const name of ['Every morning', 'No pressure'])
      expect(control(el, name, '.checkbox-container').classList.contains('is-enabled')).toBe(false)
    expect(previewText(el)).toBe('Clean oven, Change sheets')
  })

  it('marks the switch rows as toggles, so phones keep each switch beside its name', () => {
    const { el } = openPicks(usual)
    for (const name of ['Every morning', 'No pressure'])
      expect(row(el, name).classList.contains('mod-toggle')).toBe(true)
    expect(row(el, 'Focus on').classList.contains('mod-toggle')).toBe(false)
  })

  it('explains what No pressure hides under its name', () => {
    const { el } = openPicks(usual)
    expect(row(el, 'No pressure').querySelector('.setting-item-description')?.textContent).toBe(
      'Hide how late each chore is, when it was last done and how many others need doing.',
    )
  })

  it('previews the new count as How many changes', () => {
    const { el } = openPicks(usual)
    enter(control(el, 'How many', 'select'), '3')
    expect(previewText(el)).toBe('Clean oven, Change sheets, Mop floors')
  })

  it('offers Again for Surprise me only, and reshuffles the preview with it', () => {
    const { el } = openPicks(usual)
    expect(() => button(el, 'Again')).toThrow()
    enter(control(el, 'Focus on', 'select'), 'surprise')
    button(el, 'Again').click()
    expect(previewText(el)).toBe('Wipe benches, Mop floors')
  })

  it('focuses on the chosen rule, seed and Every morning, then closes', () => {
    const { el, onPick, close } = openPicks(usual)
    enter(control(el, 'Focus on', 'select'), 'often')
    control<HTMLElement>(el, 'Every morning', '.checkbox-container').click()
    button(el, 'Focus').click()
    expect(onPick).toHaveBeenCalledWith({
      rule: { strategy: 'often', count: 2 },
      seed: 0,
      morning: true,
      noPressure: false,
    })
    expect(close).toHaveBeenCalledOnce()
  })

  it('starts No pressure on the saved value, and focuses with it turned over', () => {
    const { el, onPick } = openPicks({ ...usual, noPressure: true })
    const toggle = control<HTMLElement>(el, 'No pressure', '.checkbox-container')
    expect(toggle.classList.contains('is-enabled')).toBe(true)
    toggle.click()
    button(el, 'Focus').click()
    expect(onPick).toHaveBeenCalledWith({ ...usual, noPressure: false })
  })

  it('closes on Cancel without picking', () => {
    const { el, onPick, close } = openPicks(usual)
    button(el, 'Cancel').click()
    expect(onPick).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
})
