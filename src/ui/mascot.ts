import { addIcon } from 'obsidian'
import { ICON } from './mascot-art'
import { withIdSuffix } from './svg-ids'

/** The ribbon and Chores view icon. */
export const MASCOT_ICON = 'choreday-cat'

export const addMascotIcon = (): void => addIcon(MASCOT_ICON, ICON)

let drawn = 0

/** Appends one of the mascot SVGs in `mascot-art` to `parent`, with ids of its own. */
export const drawArt = (parent: HTMLElement, svg: string): void => {
  drawn += 1
  const doc = new DOMParser().parseFromString(withIdSuffix(svg, String(drawn)), 'image/svg+xml')
  parent.appendChild(activeDocument.importNode(doc.documentElement, true))
}
