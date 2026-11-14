import type { Anchor, Chore } from './chore'
import type { Unit } from './every'
import type { Rotation } from './rotation'

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

/** The draft after typing in Rotate through: one item per line, repeats dropped as `turn` names one. */
export function withRotateText(draft: ChoreDraft, text: string): ChoreDraft {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const items = [...new Set(lines)]
  return withEdit(draft, { rotation: { ...draft.chore.rotation, items } })
}

/** The draft after setting Per turn. */
export function withPerTurn(draft: ChoreDraft, perTurn: number): ChoreDraft {
  return withEdit(draft, { rotation: { items: [], ...draft.chore.rotation, perTurn } })
}
