import type { Chore } from './chore'

/** One chore note as a write found it and as it left it. */
export interface Written {
  before: Chore
  after: Chore
}

/** A write Choreday made to one or more chores, so it can be undone. */
export interface Change {
  label: string
  writes: readonly Written[]
}

/** Recent changes, oldest first. */
export type UndoHistory = readonly Change[]

const UNDO_LIMIT = 20

/**
 * Adds `change` as the next to undo, dropping the oldest past the limit. A change that wrote no
 * chores is left out.
 */
export const recordChange = (history: UndoHistory, change: Change): UndoHistory =>
  change.writes.length ? [...history, change].slice(-UNDO_LIMIT) : history

export const latestChange = (history: UndoHistory): Change | undefined =>
  history[history.length - 1]

/** `history` without `change`, or undefined when `change` was already undone. */
export const withoutChange = (history: UndoHistory, change: Change): UndoHistory | undefined =>
  history.includes(change) ? history.filter((c) => c !== change) : undefined
