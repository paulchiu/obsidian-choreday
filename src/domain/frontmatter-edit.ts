/** A list written as `[a, b]` unless the note already holds it as a block. */
export interface InlineList {
  inline: string[]
}

/** A scalar, a list, or `null` to remove the key. */
export type FieldValue = string | number | boolean | string[] | InlineList | null

const KEY_LINE = /^([A-Za-z_][\w-]*):(.*)$/

const PLAIN_WORDS = /^[A-Za-z](?:[\w .'/()-]*[\w.'/()-])?$/
const RESERVED_WORDS = /^(?:true|false|yes|no|on|off|y|n|null)$/i

/**
 * `s` as YAML text that reads back as the same string in a block or flow list: left plain when it
 * is safe there, else double-quoted (JSON strings are valid YAML).
 */
export function yamlString(s: string): string {
  return PLAIN_WORDS.test(s) && !RESERVED_WORDS.test(s) ? s : JSON.stringify(s)
}

/** Splits `value  # comment` so a rewrite can keep the comment. */
function splitComment(rest: string): { value: string; comment: string } {
  const m = /^(.*?)(\s+#.*)?$/.exec(rest)
  return { value: m?.[1] ?? rest, comment: m?.[2] ?? '' }
}

interface Field {
  start: number
  /** Exclusive. */
  end: number
  /** The text after `key:` on the key line. */
  rest: string
}

/**
 * Locates a top-level key and the indented or `- ` lines that belong to it. Blank lines between
 * those lines belong to it too; blank lines after the last one do not.
 */
function findField(lines: string[], key: string): Field | null {
  const start = lines.findIndex((l) => KEY_LINE.exec(l)?.[1] === key)
  const rest = KEY_LINE.exec(lines[start] ?? '')?.[2]
  if (rest === undefined) return null
  let end = start + 1
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim() === '') continue
    if (!/^(\s+\S|-(\s|$))/.test(line)) break
    end = i + 1
  }
  return { start, end, rest }
}

function render(
  key: string,
  value: Exclude<FieldValue, null>,
  old: Field | null,
  lines: string[],
): string[] {
  const { comment } = old ? splitComment(old.rest) : { comment: '' }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const isBlock = old !== null && old.end > old.start + 1
    if (!isBlock) return [`${key}: [${value.inline.join(', ')}]${comment}`]
    return render(key, value.inline, old, lines)
  }
  if (!Array.isArray(value)) return [`${key}: ${value}${comment}`]
  if (value.length === 0) return [`${key}: []${comment}`]
  const oldValue = old ? splitComment(old.rest).value.trim() : ''
  if (oldValue.startsWith('[')) return [`${key}: [${value.join(', ')}]${comment}`]
  const firstItem = old
    ? lines.slice(old.start + 1, old.end).find((l) => /^\s*-/.test(l))
    : undefined
  const indent = /^(\s*)-/.exec(firstItem ?? '')?.[1] ?? '  '
  return [`${key}:${comment}`, ...value.map((v) => `${indent}- ${v}`)]
}

/**
 * Where a new key goes: before the first existing key that `order` lists after it (and above the
 * comment lines directly over that key), else last.
 */
function insertAt(lines: string[], key: string, order: readonly string[]): number {
  const later = order.slice(order.indexOf(key) + 1)
  let at = lines.findIndex((l) => later.includes(KEY_LINE.exec(l)?.[1] ?? ''))
  if (!order.includes(key) || at === -1) return lines.length
  while (at > 0 && lines[at - 1]!.startsWith('#')) at--
  return at
}

/**
 * Rewrites only the named top-level frontmatter keys, line by line, so comments, key order and
 * hand formatting elsewhere survive. New keys go where `order` puts them, else at the end; a note
 * without frontmatter gets one.
 */
export function applyFrontmatterEdits<K extends string>(
  text: string,
  edits: Partial<Record<K, FieldValue>>,
  order: readonly K[] = [],
): string {
  const keys = Object.keys(edits) as K[]
  if (!keys.length) return text
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const all = text.split(/\r?\n/)

  let fmEnd = -1
  if (all[0] === '---') fmEnd = all.findIndex((l, i) => i > 0 && (l === '---' || l === '...'))
  if (fmEnd === -1) {
    const added = keys.flatMap((k) => {
      const v = edits[k]
      return v === null || v === undefined ? [] : render(k, v, null, [])
    })
    if (!added.length) return text
    return ['---', ...added, '---', ...(text === '' ? [] : all)].join(eol)
  }

  let lines = all.slice(1, fmEnd)
  for (const key of keys) {
    const value = edits[key]
    if (value === undefined) continue
    const field = findField(lines, key)
    if (value === null) {
      if (field) lines = [...lines.slice(0, field.start), ...lines.slice(field.end)]
      continue
    }
    const next = render(key, value, field, lines)
    const at = field ? field.start : insertAt(lines, key, order)
    lines = [...lines.slice(0, at), ...next, ...lines.slice(field ? field.end : at)]
  }
  return ['---', ...lines, ...all.slice(fmEnd)].join(eol)
}

/** The YAML between the opening and closing `---`, or null when there is none. */
export function frontmatterText(text: string): string | null {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== '---') return null
  const end = lines.findIndex((l, i) => i > 0 && (l === '---' || l === '...'))
  return end === -1 ? null : lines.slice(1, end).join('\n')
}
