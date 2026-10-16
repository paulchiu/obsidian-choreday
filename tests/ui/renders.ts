import { options } from 'preact'

/** How many times components of `type` render while `run` runs, read from Preact's `diffed` hook. */
export function countRenders(type: unknown, run: () => void): number {
  let n = 0
  const saved = { ...options }
  options.diffed = (vnode) => {
    if (vnode.type === type) n++
    saved.diffed?.(vnode)
  }
  try {
    run()
  } finally {
    Object.assign(options, saved)
  }
  return n
}

/** Waits out Preact's queued re-renders, such as one a component's own state schedules. */
export const flush = (): Promise<void> => new Promise((r) => window.setTimeout(r))
