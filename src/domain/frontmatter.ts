import { match, P } from 'ts-pattern'

/** A list written as `[a, b]` unless the note already holds it as a block. */
export interface InlineList {
  inline: string[]
}

/** A scalar or a list. */
export type FieldValue = string | number | boolean | string[] | InlineList

/**
 * A note split at its fences: the YAML as lines to edit and the body as raw text, so a write puts
 * the body back byte for byte.
 */
export interface Frontmatter {
  /** The YAML between the fences; empty when there is none. */
  readonly lines: readonly string[]
  /** From the closing fence (inclusive) to the end when fenced, else the whole note. */
  readonly body: string
  /** The line ending that joins the fences and `lines`: the note's first one. */
  readonly eol: '\n' | '\r\n'
  /** Whether the note had a closed frontmatter block when read. */
  readonly fenced: boolean
}

/** One change to a note's frontmatter. */
export type FrontmatterEdit = (fm: Frontmatter) => Frontmatter

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
function findField(lines: readonly string[], key: string): Field | null {
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

/** The indent of the first `- ` item under `old`, else two spaces. */
function blockIndent(old: Field | null, lines: readonly string[]): string {
  const firstItem = old
    ? lines.slice(old.start + 1, old.end).find((l) => /^\s*-/.test(l))
    : undefined
  return /^(\s*)-/.exec(firstItem ?? '')?.[1] ?? '  '
}

/**
 * The lines for `key` set to `value`, keeping the comment on `old` and, for a list, whether `old`
 * was a flow or block list and its indent.
 */
function render(
  key: string,
  value: FieldValue,
  old: Field | null,
  lines: readonly string[],
): string[] {
  const { comment, value: oldValue } = old ? splitComment(old.rest) : { comment: '', value: '' }
  const flow = (items: string[]): string[] => [`${key}: [${items.join(', ')}]${comment}`]
  return match(value)
    .with({ inline: P.array() }, ({ inline }) =>
      old !== null && old.end > old.start + 1 ? render(key, inline, old, lines) : flow(inline),
    )
    .with(P.union(P.string, P.number, P.boolean), (v) => [`${key}: ${v}${comment}`])
    .with([], () => flow([]))
    .with(P.array(P.string), () => oldValue.trim().startsWith('['), flow)
    .with(P.array(P.string), (items) => {
      const indent = blockIndent(old, lines)
      return [`${key}:${comment}`, ...items.map((v) => `${indent}- ${v}`)]
    })
    .exhaustive()
}

/**
 * Where a new key goes: before the first existing key that `order` lists after it (and above the
 * comment lines directly over that key), else last.
 */
function insertAt(lines: readonly string[], key: string, order: readonly string[]): number {
  const later = order.slice(order.indexOf(key) + 1)
  let at = lines.findIndex((l) => later.includes(KEY_LINE.exec(l)?.[1] ?? ''))
  if (!order.includes(key) || at === -1) return lines.length
  while (at > 0 && lines[at - 1]!.startsWith('#')) at--
  return at
}

/** Splits `text` at its frontmatter fences; a note whose opening `---` never closes is all body. */
export function readFrontmatter(text: string): Frontmatter {
  const eol = /\r?\n/.exec(text)?.[0] === '\r\n' ? '\r\n' : '\n'
  const all = text.split(/\r?\n/)
  const end = all[0] === '---' ? all.findIndex((l, i) => i > 0 && (l === '---' || l === '...')) : -1
  if (end === -1) return { lines: [], body: text, eol, fenced: false }
  const starts = [0, ...Array.from(text.matchAll(/\r?\n/g), (m) => m.index + m[0].length)]
  return { lines: all.slice(1, end), body: text.slice(starts[end]), eol, fenced: true }
}

/**
 * The note text for `fm`, adding fences only when an unfenced note has gained lines.
 * Gives back the text it read unless the YAML block mixed line endings, which come back as `eol`.
 */
export function writeFrontmatter({ lines, body, eol, fenced }: Frontmatter): string {
  if (fenced) return ['---', ...lines, body].join(eol)
  if (!lines.length) return body
  return ['---', ...lines, '---'].join(eol) + (body === '' ? '' : eol + body)
}

/**
 * Sets a top-level key, rewriting an existing one in place with its comment and list style, else
 * inserting it where `order` puts it (last when `order` does not list it).
 */
export function setField(
  key: string,
  value: FieldValue,
  order: readonly string[] = [],
): FrontmatterEdit {
  return (fm) => {
    const field = findField(fm.lines, key)
    const at = field ? field.start : insertAt(fm.lines, key, order)
    const lines = [
      ...fm.lines.slice(0, at),
      ...render(key, value, field, fm.lines),
      ...fm.lines.slice(field ? field.end : at),
    ]
    return { ...fm, lines }
  }
}

/** Removes a top-level key and the indented or `- ` lines under it; a no-op when it is absent. */
export function removeField(key: string): FrontmatterEdit {
  return (fm) => {
    const field = findField(fm.lines, key)
    if (!field) return fm
    return { ...fm, lines: [...fm.lines.slice(0, field.start), ...fm.lines.slice(field.end)] }
  }
}

/** A record of edits as verbs in key order: `null` removes the key and `undefined` skips it. */
export function fieldEdits<K extends string>(
  edits: Partial<Record<K, FieldValue | null>>,
  order: readonly K[] = [],
): FrontmatterEdit[] {
  return (Object.keys(edits) as K[]).flatMap((key) => {
    const value = edits[key]
    if (value === undefined) return []
    return [value === null ? removeField(key) : setField(key, value, order)]
  })
}

/**
 * Applies `edits` to the note's frontmatter left to right, leaving every untouched line as it was.
 * Returns `text` as is when the YAML lines come out unchanged, so a no-op never rewrites the note.
 */
export function editFrontmatter(text: string, edits: readonly FrontmatterEdit[]): string {
  const read = readFrontmatter(text)
  const edited = edits.reduce((fm, edit) => edit(fm), read)
  const same =
    edited.lines.length === read.lines.length && edited.lines.every((l, i) => l === read.lines[i])
  return same ? text : writeFrontmatter(edited)
}
