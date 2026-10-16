import type { Anchor, Chore } from './chore'
import type { Unit } from './every'

const TUESDAY = 2

/** The repeat count the form's Every field means; blank or under 1 reads as 1. */
export function everyN(text: string): number {
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

/** The chore form's state: the chore Save writes, and set days put aside while it is not weekly. */
export interface ChoreDraft {
  readonly chore: Chore
  readonly parkedDays?: readonly number[]
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
