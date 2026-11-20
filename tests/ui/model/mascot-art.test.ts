import { describe, expect, it } from 'vitest'
import * as art from '../../../src/ui/model/mascot-art'

describe('mascot art', () => {
  it('stays within 32 KB, leaving room for the code that draws it in a 34 KB budget for main.js', () => {
    const bytes = new TextEncoder().encode(Object.values(art).join('')).length
    expect(bytes).toBeLessThanOrEqual(32 * 1024)
  })
})
