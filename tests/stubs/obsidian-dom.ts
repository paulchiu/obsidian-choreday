/**
 * Installs the DOM extensions Obsidian adds at startup that the imperative code still calls
 * (`createEl` and friends for `fillMenu` and toasts, `empty`, `addClass`, `Node.doc`,
 * `activeDocument`, `activeWindow`, `createFragment`) onto happy-dom, plus a counting
 * `ResizeObserver` and the `spellcheck` property happy-dom lacks. Import it for its side effect
 * from a test that runs under happy-dom.
 */
import { vi } from 'vitest'

type Attrs = Record<string, string | number | boolean | null>

/** The fields of Obsidian's `DomElementInfo` that the shim applies. */
interface ElementInfo {
  cls?: string | string[]
  text?: string | DocumentFragment
  attr?: Attrs
  title?: string
  href?: string
  type?: string
  value?: string
  placeholder?: string
  prepend?: boolean
}

type Callback = (el: Element) => void

const classList = (cls: string | string[]): string[] =>
  (Array.isArray(cls) ? cls : cls.split(' ')).filter(Boolean)

function setAttrs(el: Element, attrs: Attrs): void {
  for (const [name, value] of Object.entries(attrs))
    if (value === null) el.removeAttribute(name)
    else el.setAttribute(name, String(value))
}

/** Builds `tag` the way Obsidian's `createEl` does and appends (or prepends) it to `parent`. */
function create(
  parent: Node,
  el: Element,
  o: ElementInfo | string | undefined,
  cb: Callback | undefined,
): Element {
  const info: ElementInfo = typeof o === 'string' ? { cls: o } : (o ?? {})
  if (info.cls !== undefined) el.classList.add(...classList(info.cls))
  if (info.text !== undefined)
    if (typeof info.text === 'string') el.textContent = info.text
    else el.appendChild(info.text)
  if (info.attr) setAttrs(el, info.attr)
  for (const name of ['title', 'href', 'type', 'value', 'placeholder'] as const) {
    const value = info[name]
    if (value !== undefined) el.setAttribute(name, value)
  }
  if (info.prepend) parent.insertBefore(el, parent.firstChild)
  else parent.appendChild(el)
  cb?.(el)
  return el
}

const docOf = (node: Node): Document => node.ownerDocument ?? (node as Document)

Object.defineProperty(Node.prototype, 'doc', {
  configurable: true,
  get(this: Node): Document {
    return docOf(this)
  },
})

Object.assign(Node.prototype, {
  createEl(this: Node, tag: string, o?: ElementInfo | string, cb?: Callback): Element {
    return create(this, docOf(this).createElement(tag), o, cb)
  },
  createDiv(this: Node, o?: ElementInfo | string, cb?: Callback): Element {
    return create(this, docOf(this).createElement('div'), o, cb)
  },
  createSpan(this: Node, o?: ElementInfo | string, cb?: Callback): Element {
    return create(this, docOf(this).createElement('span'), o, cb)
  },
  empty(this: Node): void {
    while (this.firstChild) this.removeChild(this.firstChild)
  },
})

Object.assign(Element.prototype, {
  addClass(this: Element, ...cls: string[]): void {
    this.classList.add(...cls)
  },
})

/** Reflects to the attribute as browsers do, so Preact sets it as a property there and here alike. */
if (!('spellcheck' in HTMLElement.prototype))
  Object.defineProperty(HTMLElement.prototype, 'spellcheck', {
    configurable: true,
    get(this: HTMLElement): boolean {
      return this.getAttribute('spellcheck') !== 'false'
    },
    set(this: HTMLElement, on: boolean): void {
      this.setAttribute('spellcheck', String(on))
    },
  })

/** How many targets `ResizeObserver`s have been asked to observe, and how many they let go. */
export const observers = { observed: 0, disconnected: 0 }

const watching = new Set<CountingResizeObserver>()

/** Calls back once as soon as it observes, as browsers do with an initial size, and counts its targets. */
class CountingResizeObserver {
  private targets: Element[] = []
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    this.targets.push(target)
    watching.add(this)
    observers.observed++
    this.callback([], this)
  }
  /** Calls back as a browser does when an observed target changes size. */
  resize(): void {
    if (this.targets.length) this.callback([], this)
  }
  unobserve(target: Element): void {
    const before = this.targets.length
    this.targets = this.targets.filter((t) => t !== target)
    observers.disconnected += before - this.targets.length
  }
  disconnect(): void {
    observers.disconnected += this.targets.length
    this.targets = []
    watching.delete(this)
  }
}

/** Tells every connected `ResizeObserver` its targets changed size. */
export function resizeObserved(): void {
  watching.forEach((o) => o.resize())
}

function createFragment(cb?: (f: DocumentFragment) => void): DocumentFragment {
  const f = document.createDocumentFragment()
  cb?.(f)
  return f
}

vi.stubGlobal('activeDocument', document)
vi.stubGlobal('activeWindow', window)
vi.stubGlobal('createFragment', createFragment)
vi.stubGlobal('ResizeObserver', CountingResizeObserver)
if (typeof window.matchMedia !== 'function') vi.stubGlobal('matchMedia', () => ({ matches: false }))

/** Clears the document body and the observer counts between tests. */
export function resetDom(): void {
  document.body.replaceChildren()
  watching.clear()
  observers.observed = 0
  observers.disconnected = 0
}
