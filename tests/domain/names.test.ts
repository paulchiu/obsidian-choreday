import { describe, expect, it } from 'vitest'
import {
  choreBasename,
  isInFolder,
  normalizeFolder,
  notePath,
  parentFolder,
} from '../../src/domain/names'

describe('names', () => {
  it('strips characters a note name cannot hold', () => {
    expect(choreBasename(' Clean  filter: hood/oven [weekly] ')).toBe(
      'Clean filter hood oven weekly',
    )
  })

  it('normalises folders and builds note paths', () => {
    expect(normalizeFolder('/Home/Chores/')).toBe('Home/Chores')
    expect(notePath('Chores/', 'Bins out')).toBe('Chores/Bins out.md')
    expect(notePath('', 'Bins out')).toBe('Bins out.md')
  })

  it('matches paths inside a folder only', () => {
    expect(isInFolder('Chores/Bins out.md', 'Chores')).toBe(true)
    expect(isInFolder('Chores/Kitchen/Kettle.md', 'Chores')).toBe(true)
    expect(isInFolder('Chores old/Kettle.md', 'Chores')).toBe(false)
    expect(isInFolder('Kettle.md', '')).toBe(true)
  })

  it('gives the vault root as the parent of a note in the vault root', () => {
    expect(parentFolder('Dishes.md')).toBe('')
  })

  it('gives everything before the last slash as the parent of a nested note', () => {
    expect(parentFolder('Chores/Kitchen/Dishes.md')).toBe('Chores/Kitchen')
  })
})
