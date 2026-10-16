// @vitest-environment happy-dom
import { render } from 'preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HostContext,
  useIcon,
  useTooltip,
  type Host,
  type TooltipOptions,
} from '../../../src/ui/components/host'

const host = { icon: vi.fn<Host['icon']>(), tooltip: vi.fn<Host['tooltip']>() }

function Glyph({ name, tip, opts }: { name?: string; tip?: string; opts?: TooltipOptions }) {
  const ref = useIcon<HTMLSpanElement>(name)
  useTooltip(tip, opts, ref)
  return <span ref={ref} />
}

let el: HTMLElement

/** Renders `<Glyph>` with `props` under the spy host, as an update when called again. */
const draw = (props: Parameters<typeof Glyph>[0]): HTMLSpanElement => {
  render(
    <HostContext.Provider value={host}>
      <Glyph {...props} />
    </HostContext.Provider>,
    el,
  )
  return el.firstElementChild as HTMLSpanElement
}

beforeEach(() => {
  host.icon.mockReset()
  host.tooltip.mockReset()
  el = document.createElement('div')
})

describe('useIcon', () => {
  it('sets the icon on the element through the host', () => {
    const span = draw({ name: 'check' })
    expect(host.icon.mock.calls).toEqual([[span, 'check']])
  })

  it('sets it again only when the name changes', () => {
    draw({ name: 'check', tip: 'a' })
    draw({ name: 'check', tip: 'b' })
    draw({ name: 'x', tip: 'b' })
    expect(host.icon.mock.calls.map(([, name]) => name)).toEqual(['check', 'x'])
  })

  it('clears the element when the name goes away', () => {
    const span = draw({ name: 'check' })
    span.append('drawn')
    draw({})
    expect([span.childNodes.length, host.icon.mock.calls.length]).toEqual([0, 1])
  })
})

describe('useTooltip', () => {
  it('sets the tooltip with its placement through the host', () => {
    const span = draw({ tip: 'Due Sat 24 Oct', opts: { placement: 'top' } })
    expect(host.tooltip.mock.calls).toEqual([[span, 'Due Sat 24 Oct', { placement: 'top' }]])
  })

  it('sets it again only when the text or placement changes', () => {
    draw({ tip: 'a', opts: { placement: 'top' } })
    draw({ tip: 'a', opts: { placement: 'top' } })
    draw({ tip: 'a', opts: { placement: 'left' } })
    draw({ tip: 'b', opts: { placement: 'left' } })
    expect(host.tooltip.mock.calls.length).toBe(3)
  })

  it('does nothing without text', () => {
    draw({})
    expect(host.tooltip).not.toHaveBeenCalled()
  })
})

describe('HostContext', () => {
  it('fails loudly when a component that needs the host renders without a provider', () => {
    expect(() => render(<Glyph name="check" />, el)).toThrow('No Host provided')
  })
})
