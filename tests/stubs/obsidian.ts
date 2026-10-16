/**
 * The slice of the `obsidian` module that `src/ui` uses at runtime, aliased in for Vitest. Types
 * still come from the real package, so this only has to behave, not to match its declarations.
 */

/** Messages passed to `new Notice`, oldest first. */
export const notices: unknown[] = []

/** A menu item's calls, as `[method, ...args]`, so a test can read back what a menu showed. */
export type ItemCall = [method: string, ...args: unknown[]]

/** Every `Menu` built since the last reset, with what was added and how it was shown. */
export const menus: Menu[] = []

export function resetStubs(): void {
  notices.length = 0
  menus.length = 0
}

export class Notice {
  constructor(message: unknown, _duration?: number) {
    notices.push(message)
  }
  hide(): void {}
}

export class Scope {
  constructor(public parent?: unknown) {}
  register(): void {}
}

/** Like Obsidian's: `unload()` runs `onunload()`, then the callbacks passed to `register`. */
class Component {
  private cleanups: (() => unknown)[] = []
  onload(): void {}
  onunload(): void {}
  register(cb: () => unknown): void {
    this.cleanups.push(cb)
  }
  unload(): void {
    this.onunload()
    const run = this.cleanups
    this.cleanups = []
    run.forEach((cb) => cb())
  }
}

export class ItemView extends Component {
  app: unknown
  contentEl: HTMLElement = document.createElement('div')
  scope: unknown = null

  constructor(public leaf: { app: unknown }) {
    super()
    this.app = leaf.app
  }

  onPaneMenu(): void {}
}

export class Modal {
  contentEl: HTMLElement = document.createElement('div')
  modalEl: HTMLElement = document.createElement('div')
  constructor(public app: unknown) {}
  setTitle(): this {
    return this
  }
  open(): void {}
  close(): void {}
}

export class Setting {
  settingEl: HTMLElement = document.createElement('div')
  controlEl: HTMLElement = document.createElement('div')
  constructor(public containerEl: HTMLElement) {}
  setName(): this {
    return this
  }
}

class StubMenuItem {
  calls: ItemCall[] = []
  private record(method: string, args: unknown[]): this {
    this.calls.push([method, ...args])
    return this
  }
  setTitle(title: unknown): this {
    return this.record('setTitle', [title])
  }
  setIcon(icon: unknown): this {
    return this.record('setIcon', [icon])
  }
  setIsLabel(label: unknown): this {
    return this.record('setIsLabel', [label])
  }
  setWarning(warning: unknown): this {
    return this.record('setWarning', [warning])
  }
  onClick(run: unknown): this {
    return this.record('onClick', [run])
  }
}

export class Menu {
  items: (StubMenuItem | 'separator')[] = []
  shownAt: unknown[] = []

  constructor() {
    menus.push(this)
  }
  addItem(cb: (item: StubMenuItem) => unknown): this {
    const item = new StubMenuItem()
    this.items.push(item)
    cb(item)
    return this
  }
  addSeparator(): this {
    this.items.push('separator')
    return this
  }
  showAtMouseEvent(ev: unknown): this {
    this.shownAt.push(ev)
    return this
  }
  showAtPosition(position: unknown): this {
    this.shownAt.push(position)
    return this
  }
}

/** Stands in for the icon with its id, so a test sees which icon was set and that it replaced the contents. */
export function setIcon(el: HTMLElement, id: string): void {
  el.replaceChildren()
  el.setAttribute('data-icon', id)
}

export function setTooltip(el: HTMLElement, text: string, opts?: { placement?: string }): void {
  el.setAttribute('data-tooltip', text)
  if (opts?.placement !== undefined) el.setAttribute('data-tooltip-placement', opts.placement)
}
