import { h, type JSX } from 'preact'
import { useDomEffect } from './dom-effect'
import { drawArt } from '../mascot'

/** One of the mascot SVGs in `mascot-art`, drawn by `drawArt` into a `cd-art` box. */
export function Art({
  svg,
  cls,
  as = 'div',
}: {
  svg: string
  cls: string
  as?: 'div' | 'span'
}): JSX.Element {
  const ref = useDomEffect<HTMLElement>(
    (el) => {
      el.empty()
      drawArt(el, svg)
    },
    [svg],
  )
  return h(as, { class: `cd-art ${cls}`, ref })
}
