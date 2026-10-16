import { FOCUS_ATTR, GROUP_ATTR, landing, type Slot } from '../model/focus-landing'

/** The props that name a control, so `keepFocus` can find it again after a render. */
export function focusKeyProps(key: string): { 'data-cd-focus': string } {
  return { [FOCUS_ATTR]: key }
}

/** The props that let `keepFocus` land on a heading, without putting it in the tab order. */
export function landingProps(key: string): { tabIndex: number; 'data-cd-focus': string } {
  return { tabIndex: -1, ...focusKeyProps(key) }
}

/** The props of a list group's box; `keepFocus` hands focus on within the group a control left. */
export function groupProps(label: string): { 'data-cd-group': string } {
  return { [GROUP_ATTR]: label }
}

/** The slice of a key event `pressableProps` reads. */
export type PressEvent = Pick<KeyboardEvent, 'key' | 'target' | 'currentTarget' | 'preventDefault'>

/**
 * The props that let the keyboard click an element: it joins the tab order under focus key `key`,
 * and Enter or Space pressed on it, not on a control inside it, clicks it, so its click handler
 * serves both.
 */
export function pressableProps(key: string): {
  tabIndex: number
  'data-cd-focus': string
  onKeyDown: (ev: PressEvent) => void
} {
  return {
    tabIndex: 0,
    ...focusKeyProps(key),
    onKeyDown: (ev) => {
      if (ev.target !== ev.currentTarget || (ev.key !== 'Enter' && ev.key !== ' ')) return
      ev.preventDefault()
      ;(ev.currentTarget as HTMLElement).click()
    },
  }
}

/** The keys that open a context menu for the focused element. */
export function isMenuKey(ev: Pick<KeyboardEvent, 'key' | 'shiftKey'>): boolean {
  return ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey)
}

const slotOf = (el: Element): Slot => ({
  key: el.getAttribute(FOCUS_ATTR) ?? '',
  group: el.closest(`[${GROUP_ATTR}]`)?.getAttribute(GROUP_ATTR) ?? '',
})

/**
 * Runs `rebuild`, which renders the list under `root`, then refocuses the pressable control that
 * had focus, so a keyboard action does not drop focus to the page. A keyed row keeps its node, so
 * its control is found again as it was; `landing` matters only when the control left its group, as
 * a ticked row does, and hands focus to its neighbour in that group.
 */
export function keepFocus(root: HTMLElement, rebuild: () => void): void {
  const controls = (): HTMLElement[] =>
    Array.from(root.querySelectorAll<HTMLElement>(`[${FOCUS_ATTR}]`))
  const active = root.doc.activeElement
  const old = controls()
  const at = active && root.contains(active) ? old.findIndex((el) => el === active) : -1
  const before = old.map(slotOf)
  rebuild()
  if (at < 0) return
  const now = controls()
  now[landing(before, at, now.map(slotOf))]?.focus()
}
