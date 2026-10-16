import { vi } from 'vitest'
import type { App } from 'obsidian'
import { h, type ComponentChild, type VNode } from 'preact'
import type { Chore } from '../../src/domain/chore'
import type { Day } from '../../src/domain/day'
import type { BrokenChore } from '../../src/domain/chore-registry'
import { findChore, type ChoreMatch } from '../../src/domain/names'
import { HostContext, type Host } from '../../src/ui/components/host'
import type { RowContext } from '../../src/ui/obsidian/row-kit'
import type { Change } from '../../src/domain/undo-history'
import type { ChoreActions, Outcome, Undone } from '../../src/vault/chore-actions'
import type { ChoreIndex } from '../../src/vault/chore-index'
import { TODAY } from '../domain/helpers'

/** The parts of `ChoreIndex` the UI reads, over a fixed list, counting who is subscribed. */
export class FakeIndex {
  private subscribers = new Set<() => void>()

  constructor(
    public chores: Chore[] = [],
    public broken: BrokenChore[] = [],
  ) {}

  get listeners(): number {
    return this.subscribers.size
  }
  all(): Chore[] {
    return [...this.chores]
  }
  get(path: string): Chore | undefined {
    return this.chores.find((c) => c.path === path)
  }
  find(ref: string): ChoreMatch {
    return findChore(this.all(), ref)
  }
  problems(): BrokenChore[] {
    return [...this.broken]
  }
  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn)
    return () => this.subscribers.delete(fn)
  }
  notify(): void {
    this.subscribers.forEach((fn) => fn())
  }
}

const done = (): Promise<Outcome> => Promise.resolve({ ok: true, label: 'Done' })

/** The parts of `ChoreActions` the UI calls, counting undo listeners. */
export class FakeActions {
  private undoListeners = new Set<(paths: readonly string[]) => void>()
  tick = vi.fn<(c: Chore, on?: Day) => Promise<Outcome>>(done)
  undo = vi.fn<(change?: Change) => Promise<Undone>>(() =>
    Promise.resolve({ message: 'Undone', restored: [] }),
  )
  lastChange = (): undefined => undefined

  get listeners(): number {
    return this.undoListeners.size
  }
  onUndo(fn: (paths: readonly string[]) => void): () => void {
    this.undoListeners.add(fn)
    return () => this.undoListeners.delete(fn)
  }
  /** Tells the undo listeners that the chores at `paths` were just undone. */
  undone(paths: readonly string[]): void {
    this.undoListeners.forEach((fn) => fn(paths))
  }
}

/** A `RowContext` on `TODAY` with early ticks on, over `index` and `actions`. */
export function fakeContext(index: FakeIndex, actions: FakeActions, app: unknown = {}): RowContext {
  return {
    app: app as App,
    index: index as unknown as ChoreIndex,
    actions: actions as unknown as ChoreActions,
    today: () => TODAY,
    earlyTicks: () => true,
  }
}

/** Marks icons and tooltips as data attributes, as the `obsidian` stub's `setIcon` and `setTooltip` do. */
export const fakeHost: Host = {
  icon: (el, name) => {
    el.replaceChildren()
    el.setAttribute('data-icon', name)
  },
  tooltip: (el, text, opts) => {
    el.setAttribute('data-tooltip', text)
    if (opts?.placement !== undefined) el.setAttribute('data-tooltip-placement', opts.placement)
  },
}

/** `vnode` under a provider of `fakeHost`, for rendering a component on its own. */
export function withHost(vnode: VNode): ComponentChild {
  return h(HostContext.Provider, { value: fakeHost }, vnode)
}
