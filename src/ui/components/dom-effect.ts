import type { RefObject } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

/**
 * Runs `apply` on the element the returned ref is attached to, after mount and again only when a
 * value in `deps` changes, and runs its cleanup before the next apply and on unmount. Components
 * run imperative DOM work (the host's icons and tooltips, `drawArt`) only through this, so it runs
 * when its inputs change rather than on every render. Pass the ref from an earlier call as `shared`
 * to give the same element a second effect with deps of its own.
 */
export function useDomEffect<T extends HTMLElement>(
  apply: (el: T) => void | (() => void),
  deps: readonly unknown[],
  shared?: RefObject<T | null>,
): RefObject<T | null> {
  const own = useRef<T>(null)
  const ref = shared ?? own
  useLayoutEffect(() => {
    const el = ref.current
    return el ? apply(el) : undefined
  }, deps)
  return ref
}
