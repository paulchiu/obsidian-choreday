import { describe, expect, it } from 'vitest'
import {
  choreBasename,
  findChore,
  isInFolder,
  normalizeFolder,
  notePath,
  parentFolder,
  unresolvedText,
} from '../../src/domain/names'
import { chore } from './helpers'

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

  describe('findChore', () => {
    const kitchen = chore({ path: 'Chores/Kitchen/Clean.md', name: 'Clean' })
    const bathroom = chore({ path: 'Chores/Bathroom/Clean.md', name: 'Clean' })
    const kettle = chore({ path: 'Chores/Descale kettle.md', name: 'Descale kettle' })
    const chores = [kitchen, bathroom, kettle]

    it('finds a uniquely named chore, ignoring case', () => {
      expect(findChore(chores, ' descale KETTLE ')).toEqual({ kind: 'found', chore: kettle })
    })

    it('lists every match instead of picking one when a name is shared', () => {
      expect(findChore(chores, 'Clean')).toEqual({
        kind: 'ambiguous',
        paths: ['Chores/Bathroom/Clean.md', 'Chores/Kitchen/Clean.md'],
      })
    })

    it('picks one of several same-named chores by its folder', () => {
      expect(findChore(chores, 'Kitchen/Clean')).toEqual({ kind: 'found', chore: kitchen })
      expect(findChore(chores, 'Chores/Bathroom/Clean.md')).toEqual({
        kind: 'found',
        chore: bathroom,
      })
    })

    it('does not match a partial folder or note name', () => {
      expect(findChore(chores, 'chen/Clean')).toEqual({ kind: 'none' })
      expect(findChore(chores, 'kettle')).toEqual({ kind: 'none' })
    })
  })

  describe('unresolvedText', () => {
    it('names every match and shows how to pick one when a name is shared', () => {
      const match = {
        kind: 'ambiguous' as const,
        paths: ['Chores/Bathroom/Clean.md', 'Chores/Kitchen/Clean.md'],
      }
      expect(unresolvedText('Clean', match)).toBe(
        'Several chores are named Clean: Chores/Bathroom/Clean, Chores/Kitchen/Clean. ' +
          'Name one by its folder, for example chore: Chores/Bathroom/Clean.',
      )
    })

    it('says no chore has the name when nothing matches', () => {
      expect(unresolvedText('Mop', { kind: 'none' })).toBe('No chore named Mop.')
    })

    it('says the note is not a chore when the block names none', () => {
      expect(unresolvedText(undefined, null)).toBe('This note is not a chore.')
    })
  })
})
