import { describe, expect, it, vi } from 'vitest'
import { derive, type Derived } from '../../../src/domain/schedule'
import { groupRows, laterNames } from '../../../src/ui/model/list-model'
import { TODAY, chore, d } from '../../domain/helpers'

vi.mock('../../../src/domain/schedule', async (actual) => {
  const real = await actual<typeof import('../../../src/domain/schedule')>()
  return { ...real, derive: vi.fn(real.derive) }
})

const overdue = chore({ path: 'Chores/Clean oven.md', name: 'Clean oven', done: [d('2026-09-02')] })
const dueToday = chore({
  path: 'Chores/Change sheets.md',
  name: 'Change sheets',
  done: [d('2026-09-12')],
})
const halfway = chore({ done: [d('2026-09-26')] })
const soon = chore({ path: 'Chores/Bins.md', name: 'Bins', done: [d('2026-09-20')] })
const far = chore({
  path: 'Chores/Flip mattress.md',
  name: 'Flip mattress',
  every: { n: 6, unit: 'm' },
  done: [d('2026-10-01')],
})
const farther = chore({
  path: 'Chores/Clean gutters.md',
  name: 'Clean gutters',
  every: { n: 1, unit: 'y' },
  done: [d('2026-09-01')],
})

const none = (): undefined => undefined
const paths = (rows: readonly { c: { path: string } }[]): string[] => rows.map((r) => r.c.path)

describe('groupRows', () => {
  it('sorts each chore into its group, Needs doing by urgency and the rest by date', () => {
    const groups = groupRows([halfway, far, dueToday, farther, overdue, soon], TODAY, true, none)
    expect([paths(groups.needs), paths(groups.coming), paths(groups.later)]).toEqual([
      [overdue.path, dueToday.path],
      [soon.path, halfway.path],
      [far.path, farther.path],
    ])
  })

  it('shows and places a resting row by its state today', () => {
    const [row] = groupRows([overdue], TODAY, true, none).needs
    expect(row?.c).toBe(overdue)
    expect(row?.now).toEqual(derive(overdue, TODAY, true))
    expect(row?.x).toBe(row?.now)
  })

  it('keeps a settling row in its old group and place while showing its fresh state', () => {
    const ticked = { ...overdue, done: [TODAY, ...overdue.done] }
    const before = derive(overdue, TODAY, true)
    const placeAs = (path: string): Derived | undefined =>
      path === overdue.path ? before : undefined
    const groups = groupRows([dueToday, ticked], TODAY, true, placeAs)
    expect(paths(groups.needs)).toEqual([ticked.path, dueToday.path])
    expect(groups.coming).toEqual([])
    const [row] = groups.needs
    expect(row?.x).toBe(before)
    expect(row?.now).toEqual(derive(ticked, TODAY, true))
    expect(row?.now.group).not.toBe('needs')
  })

  it('derives each chore once', () => {
    const spy = vi.mocked(derive)
    spy.mockClear()
    groupRows([overdue, halfway, far], TODAY, false, none)
    expect(spy.mock.calls.map(([c, today, early]) => [c.path, today, early])).toEqual([
      [overdue.path, TODAY, false],
      [halfway.path, TODAY, false],
      [far.path, TODAY, false],
    ])
  })

  it('keeps the chore objects it was given', () => {
    const input = [overdue, halfway, far]
    const groups = groupRows(input, TODAY, true, none)
    const rows = [...groups.needs, ...groups.coming, ...groups.later]
    expect(rows).toHaveLength(input.length)
    rows.forEach((r, i) => expect(r.c).toBe(input[i]))
  })
})

describe('laterNames', () => {
  it('lists each Later chore with when it is due', () => {
    const { later } = groupRows([far, farther], TODAY, true, none)
    expect(laterNames(later, TODAY)).toBe('Flip mattress, in 6 months; Clean gutters, in 11 months')
  })

  it('is empty when nothing is Later', () => {
    expect(laterNames([], TODAY)).toBe('')
  })
})
