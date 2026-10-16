// @vitest-environment happy-dom
import { render } from 'preact'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDomEffect } from '../../src/ui/dom-effect'

const log: string[] = []

function Labelled({ text, other }: { text: string; other: number }) {
  const ref = useDomEffect<HTMLDivElement>(
    (el) => {
      log.push(`apply ${text} on ${el.tagName.toLowerCase()}`)
      return () => log.push(`cleanup ${text}`)
    },
    [text],
  )
  return <div ref={ref} data-other={other} />
}

function TwoEffects({ a, b }: { a: string; b: string }) {
  const ref = useDomEffect<HTMLDivElement>(() => void log.push(`a ${a}`), [a])
  useDomEffect(() => void log.push(`b ${b}`), [b], ref)
  return <div ref={ref} />
}

let el: HTMLElement

beforeEach(() => {
  log.length = 0
  el = document.createElement('div')
})

describe('useDomEffect', () => {
  it('applies to the element once it is mounted', () => {
    render(<Labelled text="a" other={1} />, el)
    expect(log).toEqual(['apply a on div'])
  })

  it('does not apply again when only other props change', () => {
    render(<Labelled text="a" other={1} />, el)
    render(<Labelled text="a" other={2} />, el)
    expect(log).toEqual(['apply a on div'])
  })

  it('cleans up and applies again when a dep changes', () => {
    render(<Labelled text="a" other={1} />, el)
    render(<Labelled text="b" other={1} />, el)
    expect(log).toEqual(['apply a on div', 'cleanup a', 'apply b on div'])
  })

  it('cleans up when unmounted', () => {
    render(<Labelled text="a" other={1} />, el)
    render(null, el)
    expect(log).toEqual(['apply a on div', 'cleanup a'])
  })

  it('lets two effects with their own deps share one element', () => {
    render(<TwoEffects a="1" b="1" />, el)
    render(<TwoEffects a="1" b="2" />, el)
    expect(log).toEqual(['a 1', 'b 1', 'b 2'])
  })
})
