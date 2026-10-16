import { h, type JSX } from 'preact'
import { withIdSuffix } from '../model/svg-ids'
import { useDomEffect } from './dom-effect'

let drawn = 0

/** Appends one of the mascot SVGs in `mascot-art` to `parent`, with ids of its own. */
function drawArt(parent: HTMLElement, svg: string): void {
  drawn += 1
  const doc = new DOMParser().parseFromString(withIdSuffix(svg, String(drawn)), 'image/svg+xml')
  parent.appendChild(parent.ownerDocument.importNode(doc.documentElement, true))
}

/** One of the mascot SVGs in `mascot-art`, drawn into a `cd-art` box, with `over` drawn on top. */
export function Art({
  svg,
  cls,
  over,
  as = 'div',
}: {
  svg: string
  cls: string
  over?: string
  as?: 'div' | 'span'
}): JSX.Element {
  const ref = useDomEffect<HTMLElement>(
    (el) => {
      el.replaceChildren()
      drawArt(el, svg)
      if (over !== undefined) drawArt(el, over)
    },
    [svg, over],
  )
  return h(as, { class: `cd-art ${cls}`, ref })
}
