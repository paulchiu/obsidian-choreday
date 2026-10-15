import type { Component } from 'obsidian'
import { render, type JSX } from 'preact'
import type { Chore } from '../domain/chore'
import type { Day } from '../domain/day'
import { unresolvedText } from '../domain/names'
import { derive } from '../domain/schedule'
import { Art } from './art'
import { keepFocus } from './keys'
import { PUZZLED } from './mascot-art'
import { Row } from './row'
import { RowKit, type RowContext } from './rows'

/**
 * Draws a `choreday` code block into `el`: the chore named on its `chore:` line, or the note's own
 * chore, as an open row. It mounts one Preact root, updates it on every index change, and unmounts
 * it when `child` unloads.
 */
export function mountChoreBlock(
  ctx: RowContext,
  source: string,
  el: HTMLElement,
  sourcePath: string,
  child: Pick<Component, 'register'>,
): void {
  const named = /chore:\s*(.+)/.exec(source)?.[1]?.trim()
  const kit = new RowKit(ctx, () => draw())
  const draw = (): void => {
    const match = named ? ctx.index.find(named) : null
    const chore = match
      ? match.kind === 'found'
        ? match.chore
        : undefined
      : ctx.index.get(sourcePath)
    keepFocus(el, () =>
      render(
        <ChoreBlock
          chore={chore}
          text={unresolvedText(named, match)}
          today={ctx.today()}
          early={ctx.earlyTicks()}
          kit={kit}
        />,
        el,
      ),
    )
  }
  el.addClass('cd-root', 'cd-block')
  child.register(ctx.index.subscribe(draw))
  child.register(ctx.actions.onUndo((paths) => kit.settle(paths)))
  child.register(() => render(null, el))
  draw()
}

function ChoreBlock({
  chore: c,
  text,
  today,
  early,
  kit,
}: {
  chore: Chore | undefined
  text: string
  today: Day
  early: boolean
  kit: RowKit
}): JSX.Element {
  if (!c)
    return (
      <div class="cd-empty cd-missing">
        <Art as="span" svg={PUZZLED} cls="is-puzzled" />
        <span>{text}</span>
      </div>
    )
  return (
    <Row
      c={c}
      x={derive(c, today, early)}
      today={today}
      early={early}
      expanded={false}
      justDone={kit.justDone.has(c.path)}
      expandable={false}
      alwaysOpen
      selectable={false}
      kit={kit}
    />
  )
}
