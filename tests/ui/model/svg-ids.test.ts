import { describe, expect, it } from 'vitest'
import { withIdSuffix } from '../../../src/ui/model/svg-ids'

describe('withIdSuffix', () => {
  it('renames each id and every reference to it, so a second copy clips to its own shapes', () => {
    const svg =
      '<svg><defs><path id="cd-a-h"/><clipPath id="cd-a-hc"><use href="#cd-a-h"/></clipPath></defs><g clip-path="url(#cd-a-hc)"/></svg>'
    expect(withIdSuffix(svg, '2')).toBe(
      '<svg><defs><path id="cd-a-h-2"/><clipPath id="cd-a-hc-2"><use href="#cd-a-h-2"/></clipPath></defs><g clip-path="url(#cd-a-hc-2)"/></svg>',
    )
  })
})
