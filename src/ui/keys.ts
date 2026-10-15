/**
 * Lets the keyboard click `el`: it joins the tab order, and Enter or Space pressed on it, not on a
 * control inside it, clicks it, so its click handler serves both. `key` names it for `keepFocus`.
 */
export function pressable(el: HTMLElement, key: string): void {
  el.setAttribute('tabindex', '0')
  el.setAttribute('data-cd-focus', key)
  el.addEventListener('keydown', (ev) => {
    if (ev.target !== el || (ev.key !== 'Enter' && ev.key !== ' ')) return
    ev.preventDefault()
    el.click()
  })
}

/** The keys that open a context menu for the focused element. */
export function isMenuKey(ev: Pick<KeyboardEvent, 'key' | 'shiftKey'>): boolean {
  return ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey)
}

/** A focusable control as `keepFocus` sees it: its key, and the list group it sits in. */
interface Slot {
  key: string
  group: string
}

const slotOf = (el: Element): Slot => ({
  key: el.getAttribute('data-cd-focus') ?? '',
  group: el.closest('[data-cd-group]')?.getAttribute('data-cd-group') ?? '',
})

const kindOf = (key: string): string => key.split(':')[0] ?? key

/** Where focus goes when the control at `at` is gone from its group after a rebuild, best first. */
function fallbacks(slots: readonly Slot[], at: number): Slot[] {
  const here = slots[at]
  if (!here) return []
  const sameKind = (s: Slot): boolean =>
    s.group === here.group && kindOf(s.key) === kindOf(here.key)
  return [...slots.slice(at + 1).filter(sameKind), ...slots.slice(0, at).reverse().filter(sameKind)]
}

/**
 * Runs `rebuild`, which replaces everything under `root`, then refocuses the pressable control that
 * had focus, so a keyboard action does not drop focus to the page. A control that left its group,
 * such as a ticked row, hands focus to its neighbour in that group.
 */
export function keepFocus(root: HTMLElement, rebuild: () => void): void {
  const controls = (): HTMLElement[] =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-cd-focus]'))
  const active = root.doc.activeElement
  const before = controls()
  const at = active && root.contains(active) ? before.findIndex((el) => el === active) : -1
  const slots = before.map(slotOf)
  rebuild()
  const here = slots[at]
  if (!here) return
  const after = controls()
  for (const want of [here, ...fallbacks(slots, at)]) {
    const el = after.find((c) => {
      const s = slotOf(c)
      return s.key === want.key && s.group === want.group
    })
    if (el) return el.focus()
  }
}
