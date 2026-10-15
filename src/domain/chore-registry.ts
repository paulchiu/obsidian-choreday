import type { Chore, ParseResult } from './chore'

/** A `type: chore` note that cannot be scheduled, listed so the user can fix it. */
export interface BrokenChore {
  path: string
  name: string
  problems: string[]
}

/** The chore notes in the folder, by path: schedulable ones and ones that need fixing. */
export interface Registry {
  readonly chores: ReadonlyMap<string, Chore>
  readonly broken: ReadonlyMap<string, BrokenChore>
}

/** A registry after one event, and whether listeners should hear about it. */
export interface RegistryUpdate {
  next: Registry
  changed: boolean
}

/** A fresh registry with nothing listed; a factory so no caller can share mutable maps. */
export function emptyRegistry(): Registry {
  return { chores: new Map(), broken: new Map() }
}

/**
 * Records the note at `path` as read, or drops it when `parsed` is null (not a chore); `changed` is
 * true whenever it was or is a chore, even if it reads the same, so edits elsewhere cost nothing.
 */
export function put(
  reg: Registry,
  path: string,
  name: string,
  parsed: ParseResult | null,
): RegistryUpdate {
  const gone = remove(reg, path)
  if (!parsed) return gone
  const { chores, broken } = gone.next
  const next = parsed.ok
    ? { chores: new Map(chores).set(path, parsed.chore), broken }
    : { chores, broken: new Map(broken).set(path, { path, name, problems: parsed.problems }) }
  return { next, changed: true }
}

/** Drops `path`; `changed` is true only when it was a chore. */
export function remove(reg: Registry, path: string): RegistryUpdate {
  if (!reg.chores.has(path) && !reg.broken.has(path)) return { next: reg, changed: false }
  return {
    next: { chores: without(reg.chores, path), broken: without(reg.broken, path) },
    changed: true,
  }
}

/** Moves the note from `oldPath` to `path` as read; `changed` when either side was or is a chore. */
export function rename(
  reg: Registry,
  oldPath: string,
  path: string,
  name: string,
  parsed: ParseResult | null,
): RegistryUpdate {
  const gone = remove(reg, oldPath)
  const back = put(gone.next, path, name, parsed)
  return { next: back.next, changed: gone.changed || back.changed }
}

function without<V>(map: ReadonlyMap<string, V>, key: string): ReadonlyMap<string, V> {
  if (!map.has(key)) return map
  const copy = new Map(map)
  copy.delete(key)
  return copy
}
