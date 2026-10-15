import { vi } from 'vitest'
import type { App } from 'obsidian'
import type { Chore } from '../../src/domain/chore'
import type { BrokenChore } from '../../src/domain/chore-registry'
import { findChore, type ChoreMatch } from '../../src/domain/names'
import type { RowContext } from '../../src/ui/rows'
import type { ChoreActions } from '../../src/vault/chore-actions'
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

/** The parts of `ChoreActions` the UI calls, counting undo listeners. */
export class FakeActions {
  private undoListeners = new Set<(paths: readonly string[]) => void>()
  tick = vi.fn(() => Promise.resolve({ ok: true as const, label: 'x' }))
  skip = vi.fn(() => Promise.resolve({ ok: true as const, label: 'x' }))
  snooze = vi.fn(() => Promise.resolve({ ok: true as const, label: 'x' }))
  lastChange = (): undefined => undefined

  get listeners(): number {
    return this.undoListeners.size
  }
  onUndo(fn: (paths: readonly string[]) => void): () => void {
    this.undoListeners.add(fn)
    return () => this.undoListeners.delete(fn)
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
