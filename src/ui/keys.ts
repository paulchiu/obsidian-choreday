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

/**
 * Runs `rebuild`, which replaces everything under `root`, then refocuses the pressable control that
 * had focus, so a keyboard action does not drop focus to the page.
 */
export function keepFocus(root: HTMLElement, rebuild: () => void): void {
  const active = root.doc.activeElement
  const key = active && root.contains(active) ? active.getAttribute('data-cd-focus') : null
  rebuild()
  if (key === null) return
  Array.from(root.querySelectorAll<HTMLElement>('[data-cd-focus]'))
    .find((el) => el.getAttribute('data-cd-focus') === key)
    ?.focus()
}
