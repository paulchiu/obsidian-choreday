// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { outline } from './outline'

/** A `tag` element with `attrs`, holding `children` (strings become text nodes). */
const el = (tag: string, attrs: Record<string, string> = {}, ...children: (Node | string)[]) => {
  const node =
    tag === 'svg'
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag)
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value))
  node.append(...children)
  return node
}

describe('outline', () => {
  it('joins adjacent text nodes, so text split across nodes reads as it renders', () => {
    expect(outline(el('span', {}, 'Needs doing', ' · ', '2'))).toBe('span\n  "Needs doing · 2"')
  })

  it('keeps text on either side of an element as separate runs, skipping blanks', () => {
    expect(outline(el('p', {}, ' a ', el('b', {}, 'bold'), ' ', ' '))).toBe(
      'p\n  "a"\n  b\n    "bold"',
    )
  })

  it('sorts attributes by name and keeps classes in order', () => {
    const row = el('div', { class: 'cd-row is-open', tabindex: '0', 'aria-checked': 'false' })
    expect(outline(row)).toBe('div.cd-row.is-open[aria-checked=false][tabindex=0]')
  })

  it('collapses an svg to a child count', () => {
    const svg = el('svg', { viewBox: '0 0 1 1' }, el('g'), el('g'))
    expect(outline(svg)).toBe('svg[viewBox=0 0 1 1] {2 children}')
  })
})
