import type { Derived } from '../../domain/schedule'

/**
 * Which rows are open and which are settling after a tick. Every function here returns `s` itself
 * when nothing changed, so a caller compares identity to decide whether to redraw.
 */
export interface Settling {
  /** Rows ticked a moment ago, with the state they had before, so they keep their place. */
  readonly justDone: ReadonlyMap<string, Derived>
  /** Settling rows whose tick was undone, held in place until the index drops the tick. */
  readonly undone: ReadonlySet<string>
  /** Rows open on their history. */
  readonly expanded: ReadonlySet<string>
}

export const EMPTY_SETTLING: Settling = {
  justDone: new Map(),
  undone: new Set(),
  expanded: new Set(),
}

/** Starts `path` settling, remembering the state it had `before` its tick. */
export function startSettle(s: Settling, path: string, before: Derived): Settling {
  return { ...s, justDone: new Map(s.justDone).set(path, before) }
}

/** Lets the settling rows among `paths` go back to normal, held or not. */
export function settle(s: Settling, paths: readonly string[]): Settling {
  const gone = paths.filter((p) => s.justDone.has(p) || s.undone.has(p))
  return gone.length ? drop(s, gone) : s
}

/** Holds the settling rows among `paths`, whose tick was undone, so they keep their node and focus. */
export function holdUndone(s: Settling, paths: readonly string[]): Settling {
  const held = paths.filter((p) => s.justDone.has(p) && !s.undone.has(p))
  return held.length ? { ...s, undone: new Set([...s.undone, ...held]) } : s
}

/** Releases the held rows whose tick has left the index. */
export function releaseUndone(s: Settling, stillTicked: (path: string) => boolean): Settling {
  const gone = [...s.undone].filter((p) => !stillTicked(p))
  return gone.length ? drop(s, gone) : s
}

/** Opens or closes the history of the row for `path`. */
export function toggleExpanded(s: Settling, path: string): Settling {
  const expanded = new Set(s.expanded)
  if (!expanded.delete(path)) expanded.add(path)
  return { ...s, expanded }
}

/** Drops `paths` from the settling and held rows. */
function drop(s: Settling, paths: readonly string[]): Settling {
  const justDone = new Map(s.justDone)
  const undone = new Set(s.undone)
  paths.forEach((p) => {
    justDone.delete(p)
    undone.delete(p)
  })
  return { ...s, justDone, undone }
}
