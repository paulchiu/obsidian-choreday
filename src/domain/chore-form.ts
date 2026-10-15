import type { Anchor, Chore } from './chore'
import type { Unit } from './every'

const TUESDAY = 2

/** The chore after picking a unit in the form; set days only repeat in weeks. */
export function withUnit(c: Chore, unit: Unit): Chore {
  return {
    ...c,
    every: { ...c.every, unit },
    ...(unit !== 'w' && { schedule: { anchor: 'done' } }),
  }
}

/** The chore after picking a schedule in the form; set days switch to weeks and start on Tuesday. */
export function withAnchor(c: Chore, anchor: Anchor): Chore {
  if (anchor === c.schedule.anchor) return c
  if (anchor === 'done') return { ...c, schedule: { anchor } }
  return {
    ...c,
    every: c.every.unit === 'w' ? c.every : { n: 1, unit: 'w' },
    schedule: { anchor, days: [TUESDAY] },
  }
}
