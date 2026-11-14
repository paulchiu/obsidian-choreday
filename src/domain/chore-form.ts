import type { Anchor, Chore } from './chore'
import type { Unit } from './every'
import { turnItems, type Rotation } from './rotation'

const TUESDAY = 2

/** The count a form's number field means; blank or under 1 reads as 1. */
export function wholeCount(text: string): number {
  return Math.max(1, Math.floor(Number(text)) || 1)
}

/** A blank chore for the New chore form; `path` is filled in when the note is created. */
export function blankChore(): Chore {
  return {
    path: '',
    name: '',
    every: { n: 2, unit: 'w' },
    schedule: { anchor: 'done' },
    done: [],
    skipped: [],
    unreadable: { done: [], skipped: [] },
    warnings: [],
  }
}

/**
 * The chore form's state: the chore Save writes, set days put aside while it is not weekly, and the
 * rotation put aside while Rotate through a list is off.
 */
export interface ChoreDraft {
  readonly chore: Chore
  readonly parkedDays?: readonly number[]
  readonly parkedRotation?: Rotation
}

/** The draft after picking a unit in the form; set days only repeat in weeks, so they wait for it. */
export function withUnit({ chore: c, parkedDays }: ChoreDraft, unit: Unit): ChoreDraft {
  const every = { ...c.every, unit }
  if (unit === 'w')
    return parkedDays
      ? { chore: { ...c, every, schedule: { anchor: 'calendar', days: parkedDays } } }
      : { chore: { ...c, every } }
  return {
    chore: { ...c, every, schedule: { anchor: 'done' } },
    parkedDays: c.schedule.anchor === 'calendar' ? c.schedule.days : parkedDays,
  }
}

/** The draft after editing the chore's fields directly, keeping any set days put aside. */
export function withEdit(draft: ChoreDraft, fields: Partial<Chore>): ChoreDraft {
  return { ...draft, chore: { ...draft.chore, ...fields } }
}

/** The draft after picking a schedule in the form; set days switch to weeks, on any put aside or else Tuesday. */
export function withAnchor(draft: ChoreDraft, anchor: Anchor): ChoreDraft {
  const c = draft.chore
  if (anchor === c.schedule.anchor) return draft
  if (anchor === 'done') return { chore: { ...c, schedule: { anchor } } }
  if (draft.parkedDays) return withUnit(draft, 'w')
  return {
    chore: {
      ...c,
      every: c.every.unit === 'w' ? c.every : { n: 1, unit: 'w' },
      schedule: { anchor, days: [TUESDAY] },
    },
  }
}

/** The draft after turning Rotate through a list on or off; off puts the rotation aside for Save to drop. */
export function withRotating(draft: ChoreDraft, on: boolean): ChoreDraft {
  const { parkedRotation, ...kept } = draft
  const { rotation, ...chore } = draft.chore
  if (on === Boolean(rotation)) return draft
  if (on) return { ...kept, chore: { ...chore, rotation: parkedRotation ?? { items: [] } } }
  return { ...kept, chore, parkedRotation: rotation }
}

/** The draft with each non-blank line of `text` added as a last item; repeats are dropped, as `turn` names one. */
export function withItemsAdded(draft: ChoreDraft, text: string): ChoreDraft {
  const r = draft.chore.rotation
  if (!r) return draft
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return withEdit(draft, { rotation: { ...r, items: [...new Set([...r.items, ...lines])] } })
}

/**
 * The draft after swapping the item at `index` with the one `by` places away. The turn is pinned to
 * the item it starts at, since an absent turn means the top and the top may be what moved.
 */
export function withItemMoved(draft: ChoreDraft, index: number, by: -1 | 1): ChoreDraft {
  const r = draft.chore.rotation
  if (!r) return draft
  const items = [...r.items]
  ;[items[index], items[index + by]] = [items[index + by]!, items[index]!]
  return withEdit(draft, { rotation: { ...r, items, turn: turnItems(r)[0]! } })
}

/** The draft without the item at `index`; when this turn starts there, it moves on to the next item. */
export function withItemRemoved(draft: ChoreDraft, index: number): ChoreDraft {
  const r = draft.chore.rotation
  if (!r) return draft
  const { turn, ...rest } = r
  const items = r.items.filter((_, i) => i !== index)
  if (turn !== r.items[index]) return withEdit(draft, { rotation: { ...r, items } })
  const next = r.items[(index + 1) % r.items.length]!
  return withEdit(draft, {
    rotation: items.length ? { ...rest, items, turn: next } : { ...rest, items },
  })
}

/** The draft with this turn starting at the item at `index`. */
export function withTurnAt(draft: ChoreDraft, index: number): ChoreDraft {
  const r = draft.chore.rotation
  if (!r) return draft
  return withEdit(draft, { rotation: { ...r, turn: r.items[index]! } })
}

/** The draft after setting Per turn. */
export function withPerTurn(draft: ChoreDraft, perTurn: number): ChoreDraft {
  return withEdit(draft, { rotation: { items: [], ...draft.chore.rotation, perTurn } })
}
