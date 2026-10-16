import type { Component } from 'obsidian'
import { render } from 'preact'
import { blockTarget } from '../../domain/names'
import { ChoreBlock } from '../components/chore-block'
import { HostContext } from '../components/host'
import { keepFocus } from '../components/keys'
import { obsidianHost } from './host'
import { RowKit, type RowContext } from './row-kit'

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
  /** Cleared on unload, so a settle timer that fires later cannot mount the block again. */
  let live = true
  const kit = new RowKit(ctx, () => draw())
  const draw = (): void => {
    if (!live) return
    const target = blockTarget(
      named,
      named ? ctx.index.find(named) : null,
      ctx.index.get(sourcePath),
    )
    keepFocus(el, () =>
      render(
        <HostContext.Provider value={obsidianHost}>
          <ChoreBlock
            target={target}
            today={ctx.today()}
            early={ctx.earlyTicks()}
            kit={kit}
            settling={kit.settling()}
          />
        </HostContext.Provider>,
        el,
      ),
    )
  }
  el.addClass('cd-root', 'cd-block')
  child.register(ctx.index.subscribe(draw))
  child.register(ctx.actions.onUndo((paths) => kit.settle(paths)))
  child.register(() => {
    live = false
    render(null, el)
  })
  draw()
}
