import { describe, expect, it } from 'vitest'
import * as art from '../../src/ui/mascot-art'

describe('mascot art', () => {
  it('adds no more than 20 KB to main.js', () => {
    const bytes = new TextEncoder().encode(Object.values(art).join('')).length
    expect(bytes).toBeLessThanOrEqual(20 * 1024)
  })
})
