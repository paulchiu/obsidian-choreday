import type { Chore } from '../domain/chore'
import { revertWrite } from '../domain/chore-edits'
import { shortDate, type Day } from '../domain/day'
import { choreBasename } from '../domain/names'
import { derive, keepsDone, markDone, markSkipped, removeEntry, snooze } from '../domain/schedule'
import {
  latestChange,
  recordChange,
  withoutChange,
  type Change,
  type UndoHistory,
  type Written,
} from '../domain/undo-history'

/** The note writes the actions need; `ChoreIndex` in the plugin, an in-memory fake in tests. */
export interface ChoreStore {
  update(path: string, fn: (c: Chore) => Chore): Promise<Written | undefined>
  create(draft: Chore): Promise<string | null>
  rename(path: string, name: string): Promise<string | null>
}

export interface ActionSettings {
  /** Read at the moment of each action, so a tick after sleep records the right day. */
  today: () => Day
  historyLimit: () => number
  earlyTicks: () => boolean
}

/** What a write did, to show as a toast with Undo, or why nothing was written. */
export type Outcome = { ok: true; label: string; change: Change } | { ok: false; message: string }

/** Whether a form's save went through, with a line to show. */
export type Saved = { ok: true; message?: string } | { ok: false; message: string }

/** What Undo did: a line to show, and the notes it put back. */
export interface Undone {
  message: string
  restored: readonly string[]
}

export type ChoreActions = ReturnType<typeof createChoreActions>

const taken = (name: string): string => `A note named ${name} already exists.`

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** A chore's name, or a count when there are several. */
const who = (chores: readonly Chore[]): string =>
  chores.length === 1 ? chores[0]!.name : `${chores.length} chores`

/**
 * Every write Choreday makes to chore notes, and the undo history for them. Each action returns
 * an outcome for the UI to show, so the view, the code block and the commands share one path.
 */
export function createChoreActions(store: ChoreStore, settings: ActionSettings) {
  let history: UndoHistory = []
  /** Where renamed notes went, old path to new, so undo can follow them. */
  const moves = new Map<string, string>()
  const listeners = new Set<(paths: readonly string[]) => void>()

  const currentPath = (path: string): string => {
    let p = path
    for (let next = moves.get(p); next !== undefined; next = moves.get(p)) p = next
    return p
  }

  /** Puts back what `w` wrote; returns the note's path, or why it was left alone. */
  const revert = async (w: Written): Promise<{ path: string } | string> => {
    const changedSince = 'its note has changed since'
    const path = currentPath(w.before.path)
    try {
      const done = await store.update(path, (now) => revertWrite(now, w.before, w.after) ?? now)
      return done && revertWrite(done.before, w.before, w.after) ? { path } : changedSince
    } catch (e) {
      return errorText(e)
    }
  }

  /** The write, or the reason it did not happen. */
  const write = async (path: string, fn: (c: Chore) => Chore): Promise<Written | string> => {
    try {
      return (await store.update(path, fn)) ?? 'its note is missing or unreadable'
    } catch (e) {
      return errorText(e)
    }
  }

  /** Writes `fn` to each chore, labels what was written and records it for undo. */
  const writeAll = async (
    chores: readonly Chore[],
    fn: (c: Chore) => Chore,
    label: (writes: readonly Written[]) => string,
  ): Promise<Outcome> => {
    const results = await Promise.all(chores.map((c) => write(c.path, fn)))
    const writes = results.filter((r): r is Written => typeof r !== 'string')
    const failed = chores.filter((_, i) => typeof results[i] === 'string')
    const [firstFailure] = results.filter((r): r is string => typeof r === 'string')
    if (!writes.length)
      return { ok: false, message: `Could not update ${who(failed)}: ${firstFailure}` }
    const change = { label: label(writes), writes }
    history = recordChange(history, change)
    const missed = failed.length ? `; could not update ${who(failed)}` : ''
    return { ok: true, label: change.label + missed, change }
  }

  return {
    /** Marks `c` done on `on`, today by default. */
    tick: async (c: Chore, on?: Day): Promise<Outcome> => {
      const today = settings.today()
      const day = on ?? today
      const limit = settings.historyLimit()
      if (!keepsDone(c, day, limit))
        return {
          ok: false,
          message: `${c.name} keeps only its last ${c.keep ?? limit} completions, so ${shortDate(day)} was not recorded`,
        }
      return writeAll(
        [c],
        (now) => markDone(now, day, limit),
        () => `${c.name} done ${day === today ? 'today' : shortDate(day)}`,
      )
    },

    /** Skips each chore this time; one chore's label says when it is next due. */
    skip: async (chores: readonly Chore[]): Promise<Outcome> => {
      const today = settings.today()
      const early = settings.earlyTicks()
      return writeAll(
        chores,
        (now) => markSkipped(now, today, settings.historyLimit(), early),
        (writes) => {
          const [only] = writes
          return writes.length === 1 && only
            ? `${only.after.name} skipped · next due ${shortDate(derive(only.after, today, early).due)}`
            : `${who(writes.map((w) => w.after))} skipped`
        },
      )
    },

    snooze: async (chores: readonly Chore[], until: Day): Promise<Outcome> =>
      writeAll(
        chores,
        (now) => snooze(now, until),
        (writes) => `${who(writes.map((w) => w.after))} snoozed till ${shortDate(until)}`,
      ),

    removeEntry: async (c: Chore, kind: 'done' | 'skip', d: Day): Promise<Outcome> =>
      writeAll(
        [c],
        (now) => removeEntry(now, kind, d),
        () => `Removed ${shortDate(d)} from ${c.name}`,
      ),

    /**
     * Undoes `change`, the newest by default, putting back only the keys it wrote. A note whose
     * written keys have changed since is left alone, so a later edit or synced tick survives.
     */
    undo: async (change = latestChange(history)): Promise<Undone> => {
      if (!change) return { message: 'Nothing to undo', restored: [] }
      const rest = withoutChange(history, change)
      if (!rest) return { message: 'Already undone', restored: [] }
      history = rest
      const results = await Promise.all(change.writes.map(revert))
      const restored = results.flatMap((r) => (typeof r === 'string' ? [] : [r.path]))
      if (restored.length) listeners.forEach((fn) => fn(restored))
      const total = change.writes.length
      const [reason] = results.filter((r): r is string => typeof r === 'string')
      const message =
        reason === undefined
          ? `Undone: ${change.label}`
          : !restored.length
            ? `Could not undo ${change.label}: ${reason}`
            : `Undid ${change.label} for ${restored.length} of ${total} chores; ` +
              `${total - restored.length === 1 ? 'the other' : 'the others'} changed since`
      return { message, restored }
    },

    /** Records a note rename, so undo writes to where the note is now. */
    renamed: (from: string, to: string): void => {
      /** A note renamed back to an old path must not leave a loop. */
      moves.delete(to)
      moves.set(from, to)
    },

    /** Calls `fn` with the paths each undo put back; returns a function that stops it. */
    onUndo: (fn: (paths: readonly string[]) => void): (() => void) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },

    create: async (draft: Chore): Promise<Saved> => {
      const name = choreBasename(draft.name)
      if (!name) return { ok: false, message: 'A chore name needs letters or numbers.' }
      try {
        const path = await store.create({ ...draft, name })
        return path ? { ok: true, message: `Created ${path}` } : { ok: false, message: taken(name) }
      } catch (e) {
        return { ok: false, message: `Could not create ${name}: ${errorText(e)}` }
      }
    },

    /** Renames the note when the name changed, then writes the new schedule. */
    edit: async (before: Chore, next: Chore): Promise<Saved> => {
      const name = choreBasename(next.name) || before.name
      let path = before.path
      if (name !== before.name) {
        try {
          const renamed = await store.rename(before.path, name)
          if (!renamed) return { ok: false, message: taken(name) }
          path = renamed
        } catch (e) {
          return { ok: false, message: `Could not rename ${before.name}: ${errorText(e)}` }
        }
      }
      const done = await write(path, (now) => ({
        ...now,
        every: next.every,
        schedule: next.schedule,
      }))
      return typeof done === 'string'
        ? { ok: false, message: `Could not update ${name}: ${done}` }
        : { ok: true }
    },

    lastChange: (): Change | undefined => latestChange(history),
  }
}
