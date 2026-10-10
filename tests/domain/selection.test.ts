import { describe, expect, it } from 'vitest'
import { allSelected, toggleGroup, toggleSelected } from '../../src/domain/selection'

describe('toggleSelected', () => {
  it('adds an unselected chore and removes a selected one', () => {
    const one = toggleSelected(new Set(), 'Chores/Kettle.md')
    expect([...one]).toEqual(['Chores/Kettle.md'])
    expect([...toggleSelected(one, 'Chores/Kettle.md')]).toEqual([])
    expect([...one]).toEqual(['Chores/Kettle.md'])
  })
})

describe('toggleGroup', () => {
  const group = ['Chores/Kettle.md', 'Chores/Sheets.md']

  it('selects the whole group when any of it is unselected, keeping other picks', () => {
    const next = toggleGroup(new Set(['Chores/Kettle.md', 'Chores/Bins.md']), group)
    expect([...next].sort()).toEqual(['Chores/Bins.md', 'Chores/Kettle.md', 'Chores/Sheets.md'])
    expect(allSelected(next, group)).toBe(true)
  })

  it('clears the group when all of it is selected, keeping other picks', () => {
    const next = toggleGroup(new Set([...group, 'Chores/Bins.md']), group)
    expect([...next]).toEqual(['Chores/Bins.md'])
    expect(allSelected(next, group)).toBe(false)
  })
})
