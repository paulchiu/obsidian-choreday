import { describe, expect, it } from 'vitest'
import { isMenuKey, keepFocus, pressable } from '../../src/ui/keys'

/** The slice of an HTML element `pressable` touches, since the tests run without a DOM. */
class FakeControl extends EventTarget {
  clicks = 0
  private attrs = new Map<string, string>()
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value)
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null
  }
  click(): void {
    this.clicks++
  }
}

const control = (): FakeControl => {
  const el = new FakeControl()
  pressable(el as unknown as HTMLElement, 'row:a.md')
  return el
}

/** Dispatches a keydown on `el`; `from` stands in for a control inside `el` the key bubbled up from. */
const press = (el: FakeControl, key: string, from?: EventTarget): Event => {
  const ev = Object.assign(new Event('keydown', { cancelable: true }), { key, shiftKey: false })
  if (from) Object.defineProperty(ev, 'target', { value: from })
  el.dispatchEvent(ev)
  return ev
}

describe('pressable', () => {
  it('clicks the control when Enter is pressed on it', () => {
    const el = control()
    press(el, 'Enter')
    expect(el.clicks).toBe(1)
  })
  it('clicks the control when Space is pressed on it, without scrolling the pane', () => {
    const el = control()
    const ev = press(el, ' ')
    expect([el.clicks, ev.defaultPrevented]).toEqual([1, true])
  })
  it('leaves other keys to their usual job', () => {
    const el = control()
    const ev = press(el, 'Tab')
    expect([el.clicks, ev.defaultPrevented]).toEqual([0, false])
  })

  it('leaves a key pressed on a control inside it to that control', () => {
    const el = control()
    const ev = press(el, 'Enter', new FakeControl())
    expect([el.clicks, ev.defaultPrevented]).toEqual([0, false])
  })

  it('puts the control in the tab order', () => {
    expect(control().getAttribute('tabindex')).toBe('0')
  })
})

describe('isMenuKey', () => {
  it('is true for the menu key and for Shift+F10, which open a context menu', () => {
    expect([
      isMenuKey({ key: 'ContextMenu', shiftKey: false }),
      isMenuKey({ key: 'F10', shiftKey: true }),
    ]).toEqual([true, true])
  })

  it('is false for F10 without Shift', () => {
    expect(isMenuKey({ key: 'F10', shiftKey: false })).toBe(false)
  })
})

/** A control as `build` takes it: a key, or a group and a key for a control inside a list group. */
type Spec = string | [group: string, key: string]

/** A rebuildable list of focusable controls, keyed and grouped the way the Chores view does it. */
class FakeRoot {
  doc: { activeElement: FakeFocusable | null } = { activeElement: null }
  children: FakeFocusable[] = []
  build(...specs: Spec[]): void {
    this.children = specs.map((s) =>
      typeof s === 'string' ? new FakeFocusable(this, s) : new FakeFocusable(this, s[1], s[0]),
    )
  }
  contains(node: unknown): boolean {
    return this.children.includes(node as FakeFocusable)
  }
  querySelectorAll(): FakeFocusable[] {
    return this.children
  }
  /** The control focused now, by key, or null when focus left the list. */
  focused(): string | null {
    const active = this.doc.activeElement
    return active && this.contains(active) ? active.getAttribute('data-cd-focus') : null
  }
}

class FakeFocusable {
  constructor(
    private root: FakeRoot,
    private key: string,
    private group?: string,
  ) {}
  getAttribute(name: string): string | null {
    return name === 'data-cd-focus' ? this.key : null
  }
  closest(): { getAttribute: () => string } | null {
    const group = this.group
    return group === undefined ? null : { getAttribute: () => group }
  }
  focus(): void {
    this.root.doc.activeElement = this
  }
}

const rebuild = (root: FakeRoot, run: () => void): void =>
  keepFocus(root as unknown as HTMLElement, run)

/** Focuses the control keyed `key`, then rebuilds the list as `next`. */
const refocus = (root: FakeRoot, key: string, next: Spec[]): string | null => {
  root.children.find((c) => c.getAttribute('data-cd-focus') === key)?.focus()
  rebuild(root, () => root.build(...next))
  return root.focused()
}

describe('keepFocus', () => {
  it('moves focus to the rebuilt control with the same key', () => {
    const root = new FakeRoot()
    root.build('check:a.md', 'row:a.md', 'row:b.md')
    root.children[1]?.focus()
    rebuild(root, () => root.build('check:a.md', 'row:a.md', 'row:b.md'))
    expect(root.doc.activeElement).toBe(root.children[1])
  })

  it('leaves focus alone when it was outside the rebuilt list', () => {
    const root = new FakeRoot()
    root.build('row:a.md')
    const elsewhere = new FakeFocusable(new FakeRoot(), 'row:a.md')
    root.doc.activeElement = elsewhere
    rebuild(root, () => root.build('row:a.md'))
    expect(root.doc.activeElement).toBe(elsewhere)
  })

  it('moves to the next tick box in the group when the ticked row moves to another group', () => {
    const root = new FakeRoot()
    root.build(['needs', 'check:a.md'], ['needs', 'check:b.md'], ['coming', 'check:c.md'])
    const next = refocus(root, 'check:a.md', [
      ['needs', 'check:b.md'],
      ['coming', 'check:a.md'],
      ['coming', 'check:c.md'],
    ])
    expect(next).toBe('check:b.md')
  })
  it('moves to the previous tick box when the ticked row was last in its group', () => {
    const root = new FakeRoot()
    root.build(['needs', 'check:a.md'], ['needs', 'check:b.md'], ['coming', 'check:c.md'])
    const next = refocus(root, 'check:b.md', [
      ['needs', 'check:a.md'],
      ['coming', 'check:b.md'],
      ['coming', 'check:c.md'],
    ])
    expect(next).toBe('check:a.md')
  })
  it('moves to the next group heading when the ticked row leaves its group empty', () => {
    const root = new FakeRoot()
    root.build(
      ['needs', 'group:needs'],
      ['needs', 'check:a.md'],
      ['coming', 'group:coming'],
      ['coming', 'check:c.md'],
    )
    const next = refocus(root, 'check:a.md', [
      ['coming', 'group:coming'],
      ['coming', 'check:a.md'],
      ['coming', 'check:c.md'],
    ])
    expect(next).toBe('group:coming')
  })

  it('moves to the Later toggle when the emptied group was the last one above it', () => {
    const root = new FakeRoot()
    root.build(['coming', 'group:coming'], ['coming', 'check:c.md'], ['later', 'later'])
    const next = refocus(root, 'check:c.md', [['later', 'later']])
    expect(next).toBe('later')
  })
  it('keeps focus on a control that is still in its group after the rebuild', () => {
    const root = new FakeRoot()
    const list: Spec[] = [
      ['needs', 'row:a.md'],
      ['needs', 'check:a.md'],
      ['needs', 'row:b.md'],
    ]
    root.build(...list)
    expect(refocus(root, 'row:a.md', list)).toBe('row:a.md')
  })

  it('moves to the control that replaced it when it shares the key, as Select and Cancel do', () => {
    const root = new FakeRoot()
    root.build('mode', 'new', ['needs', 'check:a.md'])
    expect(refocus(root, 'mode', ['snooze', 'skip', 'mode', ['needs', 'check:a.md']])).toBe('mode')
  })

  it('moves to a control left in its own group before one in a list group', () => {
    const root = new FakeRoot()
    root.build('snooze', 'skip', 'mode', ['needs', 'check:a.md'])
    expect(refocus(root, 'skip', ['mode', 'new', ['needs', 'check:a.md']])).toBe('mode')
  })
})
