import { describe, expect, it } from 'vitest'
import {
  editFrontmatter,
  fieldEdits,
  readFrontmatter,
  removeField,
  setField,
  writeFrontmatter,
  type FieldValue,
} from '../../src/domain/frontmatter'

const note = [
  '---',
  'type: chore',
  'every: 4w             # <n><d|w|m|y>',
  'done:                 # newest first',
  '  - 2026-09-02',
  '  - 2026-08-01',
  'tags: [home]',
  '---',
  '',
  'Citric acid, 2 tbsp.',
].join('\n')

/** The record form every caller uses: `fieldEdits` run through `editFrontmatter`. */
const edit = <K extends string>(
  text: string,
  edits: Partial<Record<K, FieldValue | null>>,
  order?: readonly K[],
): string => editFrontmatter(text, fieldEdits(edits, order))

describe('editFrontmatter with fieldEdits', () => {
  it('replaces a scalar and keeps its comment', () => {
    const out = edit(note, { every: '6w' })
    expect(out).toContain('every: 6w             # <n><d|w|m|y>')
    expect(out.replace('6w', '4w')).toBe(note)
  })

  it('rewrites a block list in its existing indent and keeps the key comment', () => {
    const out = edit(note, { done: ['2026-10-10', '2026-09-02', '2026-08-01'] })
    expect(out).toBe(
      note.replace(
        'done:                 # newest first\n',
        'done:                 # newest first\n  - 2026-10-10\n',
      ),
    )
  })

  it('keeps an unindented list style', () => {
    const text = '---\ndone:\n- 2026-09-02\nevery: 1w\n---\n'
    expect(edit(text, { done: ['2026-10-01', '2026-09-02'] })).toBe(
      '---\ndone:\n- 2026-10-01\n- 2026-09-02\nevery: 1w\n---\n',
    )
  })

  it('keeps a flow list as a flow list', () => {
    const text = '---\ndone: [2026-09-02]\n---\n'
    expect(edit(text, { done: ['2026-10-01', '2026-09-02'] })).toBe(
      '---\ndone: [2026-10-01, 2026-09-02]\n---\n',
    )
  })

  it('writes numbers and booleans as plain scalars', () => {
    expect(edit('---\nevery: 1w\n---\n', { keep: 10, early: false })).toBe(
      '---\nevery: 1w\nkeep: 10\nearly: false\n---\n',
    )
  })

  it('writes an inline list as a flow list over a flow list or a new key', () => {
    expect(edit(note, { tags: { inline: ['home', 'kitchen'] } })).toBe(
      note.replace('tags: [home]', 'tags: [home, kitchen]'),
    )
    expect(edit('Body', { tags: { inline: ['home'] } })).toBe('---\ntags: [home]\n---\nBody')
  })

  it('writes an inline list as a block list over a block list', () => {
    expect(edit(note, { done: { inline: ['2026-10-10', '2026-09-02'] } })).toBe(
      note.replace('  - 2026-09-02\n  - 2026-08-01', '  - 2026-10-10\n  - 2026-09-02'),
    )
  })

  it('writes an empty list as []', () => {
    expect(edit(note, { done: [] })).toBe(
      note.replace(
        'done:                 # newest first\n  - 2026-09-02\n  - 2026-08-01',
        'done: []                 # newest first',
      ),
    )
  })

  it('appends a missing key and removes a key with its block', () => {
    const added = edit(note, { snoozed_until: '2026-10-24' })
    expect(added).toContain('tags: [home]\nsnoozed_until: 2026-10-24\n---')
    expect(edit(added, { snoozed_until: null })).toBe(note)
    expect(edit(note, { done: null })).not.toContain('2026-09-02')
  })

  it('leaves the body alone, including a --- rule in it', () => {
    const text = '---\nevery: 1w\n---\nBody\n---\nMore'
    expect(edit(text, { every: '2w' })).toBe('---\nevery: 2w\n---\nBody\n---\nMore')
  })

  it('creates frontmatter when there is none', () => {
    expect(edit('Body', { type: 'chore', every: '1w', gone: null })).toBe(
      '---\ntype: chore\nevery: 1w\n---\nBody',
    )
    expect(edit('', { type: 'chore' })).toBe('---\ntype: chore\n---')
  })

  it('keeps CRLF line endings', () => {
    const text = '---\r\nevery: 1w\r\n---\r\nBody'
    expect(edit(text, { every: '2w' })).toBe('---\r\nevery: 2w\r\n---\r\nBody')
  })

  it('does not match a key that only shares a prefix', () => {
    const text = '---\ndone_by: me\n---\n'
    expect(edit(text, { done: ['2026-10-01'] })).toBe(
      '---\ndone_by: me\ndone:\n  - 2026-10-01\n---\n',
    )
  })

  it('stops a block at a top-level comment', () => {
    const text = '---\ndone:\n  - 2026-09-02\n# keep this\nevery: 1w\n---\n'
    expect(edit(text, { done: [] })).toBe('---\ndone: []\n# keep this\nevery: 1w\n---\n')
  })

  it('rewrites the whole block list when a blank line sits between items', () => {
    const text = '---\ndone:\n  - 2026-09-02\n\n  - 2026-08-01\nevery: 1w\n---\n'
    expect(edit(text, { done: ['2026-09-02'] })).toBe(
      '---\ndone:\n  - 2026-09-02\nevery: 1w\n---\n',
    )
  })

  it('leaves blank lines after a block list in place', () => {
    const text = '---\ndone:\n  - 2026-09-02\n\nevery: 1w\n---\n'
    expect(edit(text, { done: ['2026-10-01'] })).toBe(
      '---\ndone:\n  - 2026-10-01\n\nevery: 1w\n---\n',
    )
  })

  it('inserts a new key above the comment that labels the key after it', () => {
    const text = '---\nevery: 1w\n# newest first\ndone: []\n---\n'
    expect(edit(text, { snoozed_until: '2026-10-24' }, ['snoozed_until', 'done'])).toBe(
      '---\nevery: 1w\nsnoozed_until: 2026-10-24\n# newest first\ndone: []\n---\n',
    )
  })

  it('returns the text unchanged with no edits', () => {
    expect(edit(note, {})).toBe(note)
  })
})

describe('readFrontmatter', () => {
  it('splits the YAML between the fences from the rest', () => {
    expect(readFrontmatter('---\na: 1\nb: 2\n---\nBody')).toEqual({
      lines: ['a: 1', 'b: 2'],
      rest: ['---', 'Body'],
      eol: '\n',
      fenced: true,
    })
  })

  it('treats a note without a closing fence as all body', () => {
    expect(readFrontmatter('Body')).toMatchObject({ lines: [], fenced: false })
    expect(readFrontmatter('---\na: 1\n')).toMatchObject({
      lines: [],
      rest: ['---', 'a: 1', ''],
      fenced: false,
    })
  })

  it('reads CRLF line endings', () => {
    expect(readFrontmatter('---\r\na: 1\r\n---\r\n')).toMatchObject({
      lines: ['a: 1'],
      eol: '\r\n',
    })
  })
})

describe('writeFrontmatter', () => {
  it.each([
    ['a fenced note', note],
    ['a note closed with ...', '---\na: 1\n...\nBody'],
    ['CRLF line endings', '---\r\na: 1\r\n---\r\nBody\r\n'],
    ['no frontmatter', 'Body\nMore'],
    ['the empty string', ''],
    ['an unterminated opening fence', '---\na: 1\n'],
  ])('gives back the text it read from %s', (_, text) => {
    expect(writeFrontmatter(readFrontmatter(text))).toBe(text)
  })
})

describe('setField and removeField', () => {
  it('gives the input back after setting then removing a new key', () => {
    expect(editFrontmatter(note, [setField('owner', 'me'), removeField('owner')])).toBe(note)
    expect(editFrontmatter('Body', [setField('owner', 'me'), removeField('owner')])).toBe('Body')
  })

  it('composes left to right', () => {
    expect(editFrontmatter(note, [setField('every', '2w'), removeField('every')])).not.toContain(
      'every',
    )
    expect(editFrontmatter(note, [removeField('every'), setField('every', '2w')])).toContain(
      'tags: [home]\nevery: 2w\n---',
    )
  })

  it('leaves a note alone when removing a key it does not have', () => {
    expect(editFrontmatter(note, [removeField('owner')])).toBe(note)
  })
})

describe('fieldEdits', () => {
  it('runs keys in record order', () => {
    expect(edit('Body', { b: '2', a: '1' })).toBe('---\nb: 2\na: 1\n---\nBody')
  })

  it('maps null to removeField and skips undefined', () => {
    expect(edit(note, { tags: null, every: undefined })).toBe(
      editFrontmatter(note, [removeField('tags')]),
    )
    expect(edit('Body', { gone: null })).toBe('Body')
  })

  it('gives no edits for an empty record', () => {
    expect(fieldEdits({})).toEqual([])
    expect(editFrontmatter('', [])).toBe('')
    expect(editFrontmatter('---\r\na: 1\n---\n', [])).toBe('---\r\na: 1\n---\n')
  })
})
