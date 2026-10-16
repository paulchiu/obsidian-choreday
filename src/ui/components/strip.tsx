import type { JSX, RefObject } from 'preact'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { Chore } from '../../domain/chore'
import type { Day } from '../../domain/day'
import type { Derived } from '../../domain/schedule'
import {
  STRIP_HEIGHT,
  STRIP_PAD,
  stripModel,
  type Hit,
  type Mark,
  type StripModel,
} from '../model/strip-model'
import { useTooltip } from './host'

type DotHandler = (ev: MouseEvent, kind: 'done' | 'skip', d: Day) => void

/**
 * The ref'd element's client width, at least 200px, updated as it resizes; `undefined` until mount.
 * The one sanctioned `useState`: the width exists only after mount and nothing focusable renders
 * inside the strip, so its microtask re-render cannot replace a focused node.
 */
function useMeasuredWidth(): [RefObject<HTMLDivElement | null>, number | undefined] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>()
  useLayoutEffect(() => {
    const host = ref.current
    if (!host) return
    const observer = new ResizeObserver(() =>
      setWidth(Math.max(200, Math.round(host.clientWidth || 600))),
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/** The history strip, drawn at its box's measured width rather than stretched, so circles stay round. */
export function Strip({
  c,
  x,
  today,
  onDot,
}: {
  c: Chore
  /** `derive(c, today, early)`. */
  x: Derived
  today: Day
  onDot: DotHandler
}): JSX.Element {
  const [ref, width] = useMeasuredWidth()
  return (
    <div class="cd-strip-host" ref={ref}>
      {width !== undefined && <StripSvg m={stripModel(c, x, today, width)} onDot={onDot} />}
    </div>
  )
}

function StripSvg({ m, onDot }: { m: StripModel; onDot: DotHandler }): JSX.Element {
  const right = m.width - STRIP_PAD
  return (
    <>
      <svg
        class="cd-strip"
        viewBox={`0 0 ${m.width} ${STRIP_HEIGHT}`}
        width={m.width}
        height={STRIP_HEIGHT}
        role="img"
        aria-label={m.label}
      >
        {m.late && (
          <rect class="cd-late" x={m.late.x} y={9} width={m.late.width} height={18} rx={3} />
        )}
        <line class="cd-base" x1={STRIP_PAD} y1={18} x2={right} y2={18} />
        {m.ticks.map((x) => (
          <line class="cd-tick" x1={x} y1={11} x2={x} y2={25} />
        ))}
        {m.months.map(({ x, label }) => (
          <text class="cd-mlabel" x={x} y={40}>
            {label}
          </text>
        ))}
        <line class="cd-today" x1={m.today} y1={4} x2={m.today} y2={30} />
        {m.marks.map((mark) => {
          const { cls, r } = markShape(mark)
          return <circle class={cls} cx={mark.x} cy={18} r={r} />
        })}
      </svg>
      {m.hits.map((hit) => (
        <HitTarget hit={hit} onDot={onDot} />
      ))}
    </>
  )
}

function markShape(mark: Mark): { cls: string; r: number } {
  switch (mark.kind) {
    case 'miss':
      return { cls: 'cd-miss', r: 4 }
    case 'skip':
      return { cls: 'cd-skip', r: 5 }
    case 'done':
      return { cls: 'cd-dot', r: 5 }
    case 'due':
      return { cls: mark.late ? 'cd-ring is-late' : 'cd-ring', r: 7 }
  }
}

/** Obsidian tooltips only attach to HTML elements, so each mark gets an HTML hit target over the SVG. */
function HitTarget({ hit, onDot }: { hit: Hit; onDot: DotHandler }): JSX.Element {
  const ref = useTooltip<HTMLDivElement>(hit.tip, { placement: 'top' })
  const { dot } = hit
  return (
    <div
      class={dot ? 'cd-hit' : 'cd-hit is-passive'}
      ref={ref}
      style={{ '--cd-x': `${hit.x}px` }}
      onClick={dot && ((ev) => onDot(ev, dot.kind, dot.d))}
    />
  )
}
