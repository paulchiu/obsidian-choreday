/**
 * `el` and everything under it as indented lines, so a snapshot pins the structure `styles.css` and
 * the focus code depend on rather than how the DOM was built. An element reads
 * `tag.cls1.cls2[attr=value]` with its other attributes sorted by name; an `<svg>` is one line with
 * a child count, since its drawing is tested elsewhere; text is trimmed and quoted, blanks skipped.
 */
export function outline(el: Element): string {
  return lines(el, 0).join('\n')
}

function lines(node: Node, depth: number): string[] {
  const pad = '  '.repeat(depth)
  if (node.nodeType === node.TEXT_NODE) {
    const text = (node.textContent ?? '').trim()
    return text ? [`${pad}"${text}"`] : []
  }
  if (node.nodeType !== node.ELEMENT_NODE) return []
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const head = pad + tag + classes(el) + attributes(el)
  if (tag === 'svg') return [`${head} {${el.childElementCount} children}`]
  return [head, ...Array.from(el.childNodes).flatMap((child) => lines(child, depth + 1))]
}

const classes = (el: Element): string => Array.from(el.classList, (c) => `.${c}`).join('')

const attributes = (el: Element): string =>
  Array.from(el.attributes)
    .filter((a) => a.name !== 'class')
    .map((a) => [a.name, a.value] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `[${name}=${value}]`)
    .join('')
