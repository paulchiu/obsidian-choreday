import { describe, expect, it } from 'vitest'
import * as art from '../../src/ui/mascot-art'

describe('mascot art', () => {
  it('stays within 18 KB, leaving room for the code that draws it in a 20 KB budget for main.js', () => {
    const bytes = new TextEncoder().encode(Object.values(art).join('')).length
    expect(bytes).toBeLessThanOrEqual(18 * 1024)
  })
})
