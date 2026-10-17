import type { Chore } from '../domain/chore'
import { changesNothing, revertWrite } from '../domain/chore-edits'
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

/**
 * What a write did, to show as a toast with Undo, or why nothing was written. `change` is absent
 * when the write left every note as it was, so there is nothing to undo.
 */
export type Outcome = { ok: true; label: string; change?: Change } | { ok: false; message: string }

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

/** Says the chores written were already `state`, as a write that changed nothing. */
const alreadyText = (writes: readonly Written[], state: string): string =>
  `${who(writes.map((w) => w.after))} ${writes.length === 1 ? 'was' : 'were'} already ${state}`

/**
 * Every write Choreday makes to chore notes, and the undo history for them. Each action returns
 * an outcome for the UI to show, so the view, the code block and the commands share one path.
 */
export function createChoreActions(store: ChoreStore, settings: ActionSettings) {
  let history: UndoHistory = []
  /** The current location of each recorded write, scoped to the note that write touched. */
  const targets = new WeakMap<Written, { path: string | undefined }>()
  const pendingTargets = new Set<{ path: string | undefined }>()
  const listeners = new Set<(paths: readonly string[]) => void>()

  /** Puts back what `w` wrote; returns the note's path, or why it was left alone. */
  const revert = async (w: Written): Promise<{ path: string } | string> => {
    const changedSince = 'its note has changed since'
    const path = targets.get(w)?.path
    if (!path) return changedSince
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

  /** Tracks a write while it runs and until its batch is recorded, for rename/delete events. */
  const writeForUndo = async (path: string, fn: (c: Chore) => Chore): Promise<Written | string> => {
    const target: { path: string | undefined } = { path }
    pendingTargets.add(target)
    const written = await write(path, fn)
    if (typeof written === 'string') {
      pendingTargets.delete(target)
    } else {
      targets.set(written, target)
    }
    return written
  }

  /**
   * Writes `fn` to each chore and records the writes that changed a note as one undo step.
   * `label` names the chores that changed; `already` names them all when none did.
   */
  const writeAll = async (
    chores: readonly Chore[],
    fn: (c: Chore) => Chore,
    label: (changed: readonly Written[]) => string,
    already: (writes: readonly Written[]) => string,
  ): Promise<Outcome> => {
    const results = await Promise.all(chores.map((c) => writeForUndo(c.path, fn)))
    const writes = results.filter((r): r is Written => typeof r !== 'string')
    for (const written of writes) {
      const target = targets.get(written)
      if (target) pendingTargets.delete(target)
    }
    const failed = chores.filter((_, i) => typeof results[i] === 'string')
    const [firstFailure] = results.filter((r): r is string => typeof r === 'string')
    if (!writes.length)
      return { ok: false, message: `Could not update ${who(failed)}: ${firstFailure}` }
    const missed = failed.length ? `; could not update ${who(failed)}` : ''
    const changed = writes.filter((w) => !changesNothing(w.before, w.after))
    if (!changed.length) return { ok: true, label: already(writes) + missed }
    const change = { label: label(changed), writes: changed }
    history = recordChange(history, change)
    return { ok: true, label: change.label + missed, change }
  }

  return {
    /** Marks `c` done on `on`, today by default. */
    tick: async (c: Chore, on?: Day): Promise<Outcome> => {
      const today = settings.today()
      const day = on ?? today
      const when = day === today ? 'today' : shortDate(day)
      const limit = settings.historyLimit()
      if (!keepsDone(c, day, limit))
        return {
          ok: false,
          message: `${c.name} keeps only its last ${c.keep ?? limit} completions, so ${shortDate(day)} was not recorded`,
        }
      return writeAll(
        [c],
        (now) => markDone(now, day, limit),
        () => `${c.name} done ${when}`,
        () => `${c.name} was already done ${when}`,
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
        (writes) => alreadyText(writes, 'skipped'),
      )
    },

    snooze: async (chores: readonly Chore[], until: Day): Promise<Outcome> =>
      writeAll(
        chores,
        (now) => snooze(now, until),
        (writes) => `${who(writes.map((w) => w.after))} snoozed till ${shortDate(until)}`,
        (writes) => alreadyText(writes, `snoozed till ${shortDate(until)}`),
      ),

    removeEntry: async (c: Chore, kind: 'done' | 'skip', d: Day): Promise<Outcome> =>
      writeAll(
        [c],
        (now) => removeEntry(now, kind, d),
        () => `Removed ${shortDate(d)} from ${c.name}`,
        () => `${shortDate(d)} was already gone from ${c.name}`,
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

    /** Records a note rename for the writes that currently belong to that note. */
    renamed: (from: string, to: string): void => {
      for (const target of pendingTargets) if (target.path === from) target.path = to
      for (const change of history)
        for (const written of change.writes) {
          const target = targets.get(written)
          if (target?.path === from) target.path = to
        }
    },

    /** Invalidates undo targets when a note is deleted, so a replacement stays untouched. */
    deleted: (path: string): void => {
      for (const target of pendingTargets) if (target.path === path) target.path = undefined
      for (const change of history)
        for (const written of change.writes) {
          const target = targets.get(written)
          if (target?.path === path) target.path = undefined
        }
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
