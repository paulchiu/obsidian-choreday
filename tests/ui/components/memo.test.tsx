// @vitest-environment happy-dom
import { render, type VNode } from 'preact'
import { beforeEach, describe, expect, it } from 'vitest'
import { memo } from '../../../src/ui/components/memo'

interface Props {
  label: string
  n: number
}

let renders = 0

function Counted({ label }: Props) {
  renders++
  return <span>{label}</span>
}

const sameLabel = (a: Props, b: Props): boolean => a.label === b.label

/** Renders `first` then `second` into one container, as an update, and returns the container. */
function twice(vnode: (p: Props) => VNode, first: Props, second: Props): HTMLElement {
  const el = document.createElement('div')
  render(vnode(first), el)
  render(vnode(second), el)
  return el
}

beforeEach(() => {
  renders = 0
})

describe('memo', () => {
  it('skips the render when the comparator calls the props the same', () => {
    const Memo = memo(Counted, sameLabel)
    twice((p) => <Memo {...p} />, { label: 'a', n: 1 }, { label: 'a', n: 2 })
    expect(renders).toBe(1)
  })

  it('renders again when the comparator calls the props different', () => {
    const Memo = memo(Counted, sameLabel)
    const el = twice((p) => <Memo {...p} />, { label: 'a', n: 1 }, { label: 'b', n: 1 })
    expect([renders, el.textContent]).toEqual([2, 'b'])
  })

  it('renders every time without memo', () => {
    twice((p) => <Counted {...p} />, { label: 'a', n: 1 }, { label: 'a', n: 2 })
    expect(renders).toBe(2)
  })

  it('names the wrapper after the inner component', () => {
    expect(memo(Counted, sameLabel).displayName).toBe('Memo(Counted)')
  })
})
