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

/** A rebuildable list of focusable controls, keyed the way `pressable` keys them. */
class FakeRoot {
  doc: { activeElement: FakeFocusable | null } = { activeElement: null }
  children: FakeFocusable[] = []
  build(...keys: string[]): void {
    this.children = keys.map((key) => new FakeFocusable(this, key))
  }
  contains(node: unknown): boolean {
    return this.children.includes(node as FakeFocusable)
  }
  querySelectorAll(): FakeFocusable[] {
    return this.children
  }
}

class FakeFocusable {
  constructor(
    private root: FakeRoot,
    private key: string,
  ) {}
  getAttribute(): string {
    return this.key
  }
  focus(): void {
    this.root.doc.activeElement = this
  }
}

const rebuild = (root: FakeRoot, run: () => void): void =>
  keepFocus(root as unknown as HTMLElement, run)

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
})
