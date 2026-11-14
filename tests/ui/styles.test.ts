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
  it.each([
    '.cd-group-select',
    '.cd-check',
    '.cd-row',
    '.cd-later',
    '.cd-broken',
    '.cd-group',
    '.cd-item-name',
  ])('draws a 2px ring in the accent colour on %s when focused from the keyboard', (cls) => {
    expect(ring(`${cls}:focus-visible`)).toMatch(/\b2px (solid )?var\(--interactive-accent\)$/)
  })

  it('draws the tick box ring clear of the tick box on whatever surface the row has', () => {
    expect(declared('.cd-check:focus-visible').get('outline-offset')).toBe('2px')
  })
})

describe('chore form', () => {
  it('leaves room below the last field on a phone to scroll it clear of the on-screen keyboard', () => {
    const props = declared('.is-phone .cd-modal .modal-content')
    expect({
      padding: props.get('padding-bottom'),
      scrollPadding: props.get('scroll-padding-bottom'),
    }).toEqual({
      padding: 'max(var(--keyboard-height), var(--size-4-4))',
      scrollPadding: 'var(--keyboard-height)',
    })
  })

  it.each(['.cd-preview', '.cd-rotate-warning'])(
    'draws the line Obsidian draws between modal rows under the rotation switch when %s follows it',
    (next) => {
      expect(declared(`.cd-modal .mod-toggle:has(+ ${next})`).get('border-bottom')).toBe(
        'var(--border-width) solid var(--background-modifier-border)',
      )
    },
  )

  it('starts the due summary at the left edge of the setting labels, with no box to inset it', () => {
    const props = declared('.cd-preview')
    expect({ padding: props.get('padding'), background: props.get('background') }).toEqual({
      padding: 'var(--size-4-2) 0',
      background: undefined,
    })
  })

  it('gives the Add field the row and keeps the + button at its own size beside it', () => {
    expect([declared('.cd-add-item').get('flex'), declared('.cd-add-button').get('flex')]).toEqual([
      '1',
      'none',
    ])
  })

  it('draws the items as one bordered list, rows split by a line, names inset from its edge', () => {
    const line = 'var(--border-width) solid var(--background-modifier-border)'
    expect({
      list: declared('.cd-rotate-items').get('border'),
      between: declared('.cd-rotate-item + .cd-rotate-item').get('border-top'),
      inset: declared('.cd-rotate-item').get('padding-inline-start'),
    }).toEqual({ list: line, between: line, inset: 'var(--size-4-3)' })
  })

  it("keeps the item rows' icon buttons compact over Obsidian's padded phone buttons", () => {
    expect(
      declared('.cd-modal .setting-item-control .cd-rotate-item button.clickable-icon').get(
        'padding',
      ),
    ).toBe('var(--size-2-2)')
  })

  it('fits each dropdown to its picked option, as Obsidian fits its own', () => {
    expect(declared('.cd-modal .setting-item-control select.dropdown').get('field-sizing')).toBe(
      'content',
    )
  })
})

describe("a rotating chore's chips on the last-done line", () => {
  it('sit inline with padding only at the sides, so the line keeps its height', () => {
    const props = declared('.cd-item')
    expect({ display: props.get('display'), padding: props.get('padding') }).toEqual({
      display: 'inline-block',
      padding: '0 var(--size-2-3)',
    })
  })

  it('wrap a long item rather than truncating it', () => {
    const props = declared('.cd-item')
    expect({
      wrap: props.get('overflow-wrap'),
      overflow: props.get('overflow'),
      ellipsis: props.get('text-overflow'),
      nowrap: props.get('white-space'),
    }).toEqual({ wrap: 'anywhere', overflow: undefined, ellipsis: undefined, nowrap: undefined })
  })

  it('drop the separator on a phone when No pressure leaves nothing before it', () => {
    expect(declared('.cd-every + .cd-turn .cd-turn-sep').get('display')).toBe('none')
  })
})
