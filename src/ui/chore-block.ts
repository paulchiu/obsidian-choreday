import type { Component } from 'obsidian'
import { unresolvedText } from '../domain/names'
import { derive } from '../domain/schedule'
import { keepFocus } from './keys'
import { drawArt } from './mascot'
import { PUZZLED } from './mascot-art'
import { RowKit, type RowContext } from './rows'

/**
 * Draws a `choreday` code block into `el`: the chore named on its `chore:` line, or the note's own
 * chore, as an open row that redraws on every index change until `child` unloads.
 */
export function mountChoreBlock(
  ctx: RowContext,
  source: string,
  el: HTMLElement,
  sourcePath: string,
  child: Pick<Component, 'register'>,
): void {
  const named = /chore:\s*(.+)/.exec(source)?.[1]?.trim()
  const kit = new RowKit(ctx, () => render())
  const render = (): void =>
    keepFocus(el, () => {
      kit.reset()
      el.empty()
      el.addClass('cd-root', 'cd-block')
      const match = named ? ctx.index.find(named) : null
      const c = match
        ? match.kind === 'found'
          ? match.chore
          : undefined
        : ctx.index.get(sourcePath)
      if (!c) {
        const missing = el.createDiv({ cls: 'cd-empty cd-missing' })
        drawArt(missing.createSpan({ cls: 'cd-art is-puzzled' }), PUZZLED)
        missing.createSpan({ text: unresolvedText(named, match) })
        return
      }
      kit.row(el, c, derive(c, ctx.today(), ctx.earlyTicks()), {
        expandable: false,
        alwaysOpen: true,
      })
    })
  child.register(ctx.index.subscribe(render))
  child.register(ctx.actions.onUndo((paths) => kit.settle(paths)))
  child.register(() => kit.reset())
  render()
}
