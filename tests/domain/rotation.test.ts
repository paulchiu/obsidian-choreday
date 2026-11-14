import { describe, expect, it } from 'vitest'
import { turnItems } from '../../src/domain/rotation'

const items = ['Fridge ice maker', 'Water filter jug', 'Water jug', 'Kettle']

describe('turnItems', () => {
  it('starts this turn at the named item and takes per_turn of them', () => {
    expect(turnItems({ items, perTurn: 2, turn: 'Water filter jug' })).toEqual([
      'Water filter jug',
      'Water jug',
    ])
  })

  it('wraps a later turn round to the top of the list', () => {
    expect(turnItems({ items, perTurn: 3, turn: 'Water jug' }, 1)).toEqual([
      'Water filter jug',
      'Water jug',
      'Kettle',
    ])
  })

  it('does one item per turn without per_turn', () => {
    expect(turnItems({ items, turn: 'Kettle' })).toEqual(['Kettle'])
  })

  it('starts at the top without a turn', () => {
    expect(turnItems({ items, perTurn: 2 })).toEqual(['Fridge ice maker', 'Water filter jug'])
  })

  it('starts at the top when the turn names an item no longer in the list', () => {
    expect(turnItems({ items, perTurn: 2, turn: 'Dog water bowl' })).toEqual([
      'Fridge ice maker',
      'Water filter jug',
    ])
  })

  it('does the whole list each turn when per_turn is larger than it', () => {
    const r = { items, perTurn: 9, turn: 'Water jug' }
    expect(turnItems(r)).toEqual(['Water jug', 'Kettle', 'Fridge ice maker', 'Water filter jug'])
    expect(turnItems(r, 1)).toEqual(['Water jug', 'Kettle', 'Fridge ice maker', 'Water filter jug'])
  })
})
