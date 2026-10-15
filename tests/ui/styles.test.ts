import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of every rule whose selector list includes `selector`, joined. */
const declarationsFor = (selector: string): string =>
  Array.from(css.matchAll(/([^{}]+)\{([^}]*)\}/g))
    .filter(([, selectors]) =>
      (selectors ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(selector),
    )
    .map(([, , body]) => body)
    .join('')

describe('keyboard focus ring', () => {
  it.each(['.cd-group-select', '.cd-check', '.cd-row', '.cd-later', '.cd-broken', '.cd-group'])(
    'draws %s in the accent colour when focused from the keyboard',
    (cls) => {
      expect(declarationsFor(`${cls}:focus-visible`)).toContain('var(--interactive-accent)')
    },
  )
})
