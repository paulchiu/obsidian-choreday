import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The value each property ends up with across the rules whose selector list includes `selector`. */
const declared = (selector: string): Map<string, string> => {
  const props = new Map<string, string>()
  for (const [, selectors = '', body = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').some((s) => s.trim() === selector)) continue
    for (const decl of body.split(';')) {
      const colon = decl.indexOf(':')
      if (colon > 0) props.set(decl.slice(0, colon).trim(), decl.slice(colon + 1).trim())
    }
  }
  return props
}

/** The outline, or the box-shadow standing in for it when the outline is turned off. */
const ring = (selector: string): string => {
  const props = declared(selector)
  const outline = props.get('outline') ?? ''
  return outline && outline !== 'none' ? outline : (props.get('box-shadow') ?? '')
}

describe('keyboard focus ring', () => {
  it.each(['.cd-group-select', '.cd-check', '.cd-row', '.cd-later', '.cd-broken', '.cd-group'])(
    'draws a 2px ring in the accent colour on %s when focused from the keyboard',
    (cls) => {
      expect(ring(`${cls}:focus-visible`)).toMatch(/\b2px (solid )?var\(--interactive-accent\)$/)
    },
  )

  it('draws the tick box ring clear of the tick box on whatever surface the row has', () => {
    expect(declared('.cd-check:focus-visible').get('outline-offset')).toBe('2px')
  })
})

describe('chore form', () => {
  it('fits each dropdown to its picked option, as Obsidian fits its own', () => {
    expect(declared('.cd-modal .setting-item-control select.dropdown').get('field-sizing')).toBe(
      'content',
    )
  })
})
