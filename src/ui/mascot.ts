import { withIdSuffix } from './model/svg-ids'

let drawn = 0

/** Appends one of the mascot SVGs in `mascot-art` to `parent`, with ids of its own. */
export const drawArt = (parent: HTMLElement, svg: string): void => {
  drawn += 1
  const doc = new DOMParser().parseFromString(withIdSuffix(svg, String(drawn)), 'image/svg+xml')
  parent.appendChild(activeDocument.importNode(doc.documentElement, true))
}
