import type { JSX } from 'preact'
import type { Day } from '../../domain/day'
import type { BlockTarget } from '../../domain/names'
import { derive } from '../../domain/schedule'
import { PUZZLED } from '../model/mascot-art'
import { Art } from './art'
import { Row, type RowActions } from './row'

/** A `choreday` code block's body: its chore as an open row, or why it has none. */
export function ChoreBlock({
  target,
  today,
  early,
  kit,
  settling,
}: {
  target: BlockTarget
  today: Day
  early: boolean
  kit: RowActions
  /** Paths of the rows ticked a moment ago and still settling. */
  settling: ReadonlySet<string>
}): JSX.Element {
  if ('text' in target)
    return (
      <div class="cd-empty cd-missing">
        <Art as="span" svg={PUZZLED} cls="is-puzzled" />
        <span>{target.text}</span>
      </div>
    )
  const c = target.chore
  return (
    <Row
      c={c}
      x={derive(c, today, early)}
      today={today}
      early={early}
      expanded={false}
      justDone={settling.has(c.path)}
      expandable={false}
      alwaysOpen
      selectable={false}
      kit={kit}
    />
  )
}
