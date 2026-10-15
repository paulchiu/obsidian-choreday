const FOCUS_ATTR = 'data-cd-focus'
const GROUP_ATTR = 'data-cd-group'

/** Names `el` as `key`, so `keepFocus` can find its replacement after a rebuild. */
export function focusKey(el: HTMLElement, key: string): void {
  el.setAttribute(FOCUS_ATTR, key)
}

/** A box for one list group's controls; `keepFocus` hands focus on within the group a control left. */
export function focusGroup(parent: HTMLElement, label: string): HTMLElement {
  return parent.createDiv({ attr: { [GROUP_ATTR]: label } })
}

/**
 * Lets the keyboard click `el`: it joins the tab order, and Enter or Space pressed on it, not on a
 * control inside it, clicks it, so its click handler serves both. `key` names it for `keepFocus`.
 */
export function pressable(el: HTMLElement, key: string): void {
  el.setAttribute('tabindex', '0')
  focusKey(el, key)
  el.addEventListener('keydown', (ev) => {
    if (ev.target !== el || (ev.key !== 'Enter' && ev.key !== ' ')) return
    ev.preventDefault()
    el.click()
  })
}

/** Lets `keepFocus` land on `el`, a heading, without putting it in the tab order. */
export function focusLanding(el: HTMLElement, key: string): void {
  el.setAttribute('tabindex', '-1')
  focusKey(el, key)
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
  key: el.getAttribute(FOCUS_ATTR) ?? '',
  group: el.closest(`[${GROUP_ATTR}]`)?.getAttribute(GROUP_ATTR) ?? '',
})

const kindOf = (key: string): string => key.split(':')[0] ?? key

/**
 * The index in `after` that takes focus from `before[at]`: the same control, else a neighbour of the
 * same kind and then any control above it in its group, else the first control of a group that now sits
 * where its group was, else the nearest control below or above.
 */
function landing(before: readonly Slot[], at: number, after: readonly Slot[]): number {
  const here = before[at]
  if (!here) return -1
  const find = (want: Slot): number =>
    after.findIndex((s) => s.key === want.key && s.group === want.group)
  const first = (list: readonly Slot[]): number => list.map(find).find((i) => i >= 0) ?? -1
  const sameGroup = (s: Slot): boolean => s.group === here.group
  const sameKind = (s: Slot): boolean => sameGroup(s) && kindOf(s.key) === kindOf(here.key)
  const otherGroup = (s: Slot): boolean => !sameGroup(s)
  const below = before.slice(at + 1)
  const above = before.slice(0, at).reverse()
  const kept = first([
    here,
    ...below.filter(sameKind),
    ...above.filter(sameKind),
    ...above.filter(sameGroup),
  ])
  if (kept >= 0) return kept
  const up = first(above.filter(otherGroup))
  const down = first(below.filter(otherGroup))
  const upGroup = after[up]?.group
  const arrived = after.findIndex((s, i) => i > up && (down < 0 || i < down) && s.group !== upGroup)
  if (arrived >= 0) return arrived
  return down >= 0 ? down : up
}

/**
 * Runs `rebuild`, which replaces everything under `root`, then refocuses the pressable control that
 * had focus, so a keyboard action does not drop focus to the page. A control that left its group,
 * such as a ticked row, hands focus to its neighbour in that group.
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
