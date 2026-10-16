import { createContext, type RefObject } from 'preact'
import { useContext } from 'preact/hooks'
import { useDomEffect } from './dom-effect'

/** Where a tooltip opens relative to its element. */
export interface TooltipOptions {
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

/** What components need from the platform: Obsidian's helpers in the plugin, a fake in tests. */
export interface Host {
  icon(el: HTMLElement, name: string): void
  tooltip(el: HTMLElement, text: string, opts?: TooltipOptions): void
}

const missing = (): never => {
  throw new Error('No Host provided')
}

/** The host components draw through; the default throws so a missing provider fails loudly. */
export const HostContext = createContext<Host>({ icon: missing, tooltip: missing })

/** Sets icon `name` on the ref's element when it changes; `undefined` empties the element. */
export function useIcon<T extends HTMLElement>(
  name: string | undefined,
  shared?: RefObject<T | null>,
): RefObject<T | null> {
  const host = useContext(HostContext)
  return useDomEffect<T>(
    (el) => {
      if (name === undefined) el.replaceChildren()
      else host.icon(el, name)
    },
    [name],
    shared,
  )
}

/** Sets tooltip `text` on the ref's element when it or its placement changes; `undefined` sets none. */
export function useTooltip<T extends HTMLElement>(
  text: string | undefined,
  opts?: TooltipOptions,
  shared?: RefObject<T | null>,
): RefObject<T | null> {
  const host = useContext(HostContext)
  return useDomEffect<T>(
    (el) => {
      if (text !== undefined) host.tooltip(el, text, opts)
    },
    [text, opts?.placement],
    shared,
  )
}
