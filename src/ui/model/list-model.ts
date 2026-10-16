import type { Chore } from '../../domain/chore'
import type { Day } from '../../domain/day'
import { dueText } from '../../domain/friendly'
import { derive, sortGroup, type Derived, type Group } from '../../domain/schedule'

/**
 * A chore's row in the Chores view: shown from `now`, its state today, but placed by `x`, so a row
 * ticked a moment ago keeps its group and place while it settles.
 */
export interface RowData {
  c: Chore
  now: Derived
  x: Derived
}

/** The Chores view's three lists, each in display order. */
export interface Groups {
  needs: RowData[]
  coming: RowData[]
  later: RowData[]
}

/**
 * Sorts `chores` into the view's groups on `today`. `placeAs` gives a settling chore the state it
 * had before its tick; every other chore is placed by its state today.
 */
export function groupRows(
  chores: readonly Chore[],
  today: Day,
  early: boolean,
  placeAs: (path: string) => Derived | undefined,
): Groups {
  const rows = chores.map((c): RowData => {
    const now = derive(c, today, early)
    return { c, now, x: placeAs(c.path) ?? now }
  })
  const group = (g: Group): RowData[] =>
    sortGroup(
      g,
      rows.filter((r) => r.x.group === g),
    )
  return { needs: group('needs'), coming: group('coming'), later: group('later') }
}

/** The collapsed Later toggle's list: each chore's name and when it is due. */
export function laterNames(later: readonly RowData[], today: Day): string {
  return later.map(({ c, x }) => `${c.name}, ${dueText(c, x, today).long}`).join('; ')
}
