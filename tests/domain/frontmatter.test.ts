import { describe, expect, it } from 'vitest'
import { applyFrontmatterEdits, frontmatterText } from '../../src/domain/frontmatter'

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

describe('applyFrontmatterEdits', () => {
  it('replaces a scalar and keeps its comment', () => {
    const out = applyFrontmatterEdits(note, { every: '6w' })
    expect(out).toContain('every: 6w             # <n><d|w|m|y>')
    expect(out.replace('6w', '4w')).toBe(note)
  })

  it('rewrites a block list in its existing indent and keeps the key comment', () => {
    const out = applyFrontmatterEdits(note, { done: ['2026-10-10', '2026-09-02', '2026-08-01'] })
    expect(out).toBe(
      note.replace(
        'done:                 # newest first\n',
        'done:                 # newest first\n  - 2026-10-10\n',
      ),
    )
  })

  it('keeps an unindented list style', () => {
    const text = '---\ndone:\n- 2026-09-02\nevery: 1w\n---\n'
    expect(applyFrontmatterEdits(text, { done: ['2026-10-01', '2026-09-02'] })).toBe(
      '---\ndone:\n- 2026-10-01\n- 2026-09-02\nevery: 1w\n---\n',
    )
  })

  it('keeps a flow list as a flow list', () => {
    const text = '---\ndone: [2026-09-02]\n---\n'
    expect(applyFrontmatterEdits(text, { done: ['2026-10-01', '2026-09-02'] })).toBe(
      '---\ndone: [2026-10-01, 2026-09-02]\n---\n',
    )
  })

  it('writes numbers and booleans as plain scalars', () => {
    expect(applyFrontmatterEdits('---\nevery: 1w\n---\n', { keep: 10, early: false })).toBe(
      '---\nevery: 1w\nkeep: 10\nearly: false\n---\n',
    )
  })

  it('writes an inline list as a flow list over a flow list or a new key', () => {
    expect(applyFrontmatterEdits(note, { tags: { inline: ['home', 'kitchen'] } })).toBe(
      note.replace('tags: [home]', 'tags: [home, kitchen]'),
    )
    expect(applyFrontmatterEdits('Body', { tags: { inline: ['home'] } })).toBe(
      '---\ntags: [home]\n---\nBody',
    )
  })

  it('writes an inline list as a block list over a block list', () => {
    expect(applyFrontmatterEdits(note, { done: { inline: ['2026-10-10', '2026-09-02'] } })).toBe(
      note.replace('  - 2026-09-02\n  - 2026-08-01', '  - 2026-10-10\n  - 2026-09-02'),
    )
  })

  it('writes an empty list as []', () => {
    expect(applyFrontmatterEdits(note, { done: [] })).toBe(
      note.replace(
        'done:                 # newest first\n  - 2026-09-02\n  - 2026-08-01',
        'done: []                 # newest first',
      ),
    )
  })

  it('appends a missing key and removes a key with its block', () => {
    const added = applyFrontmatterEdits(note, { snoozed_until: '2026-10-24' })
    expect(added).toContain('tags: [home]\nsnoozed_until: 2026-10-24\n---')
    expect(applyFrontmatterEdits(added, { snoozed_until: null })).toBe(note)
    expect(applyFrontmatterEdits(note, { done: null })).not.toContain('2026-09-02')
  })

  it('leaves the body alone, including a --- rule in it', () => {
    const text = '---\nevery: 1w\n---\nBody\n---\nMore'
    expect(applyFrontmatterEdits(text, { every: '2w' })).toBe(
      '---\nevery: 2w\n---\nBody\n---\nMore',
    )
  })

  it('creates frontmatter when there is none', () => {
    expect(applyFrontmatterEdits('Body', { type: 'chore', every: '1w', gone: null })).toBe(
      '---\ntype: chore\nevery: 1w\n---\nBody',
    )
    expect(applyFrontmatterEdits('', { type: 'chore' })).toBe('---\ntype: chore\n---')
  })

  it('keeps CRLF line endings', () => {
    const text = '---\r\nevery: 1w\r\n---\r\nBody'
    expect(applyFrontmatterEdits(text, { every: '2w' })).toBe('---\r\nevery: 2w\r\n---\r\nBody')
  })

  it('does not match a key that only shares a prefix', () => {
    const text = '---\ndone_by: me\n---\n'
    expect(applyFrontmatterEdits(text, { done: ['2026-10-01'] })).toBe(
      '---\ndone_by: me\ndone:\n  - 2026-10-01\n---\n',
    )
  })

  it('stops a block at a top-level comment', () => {
    const text = '---\ndone:\n  - 2026-09-02\n# keep this\nevery: 1w\n---\n'
    expect(applyFrontmatterEdits(text, { done: [] })).toBe(
      '---\ndone: []\n# keep this\nevery: 1w\n---\n',
    )
  })

  it('rewrites the whole block list when a blank line sits between items', () => {
    const text = '---\ndone:\n  - 2026-09-02\n\n  - 2026-08-01\nevery: 1w\n---\n'
    expect(applyFrontmatterEdits(text, { done: ['2026-09-02'] })).toBe(
      '---\ndone:\n  - 2026-09-02\nevery: 1w\n---\n',
    )
  })

  it('leaves blank lines after a block list in place', () => {
    const text = '---\ndone:\n  - 2026-09-02\n\nevery: 1w\n---\n'
    expect(applyFrontmatterEdits(text, { done: ['2026-10-01'] })).toBe(
      '---\ndone:\n  - 2026-10-01\n\nevery: 1w\n---\n',
    )
  })

  it('inserts a new key above the comment that labels the key after it', () => {
    const text = '---\nevery: 1w\n# newest first\ndone: []\n---\n'
    expect(
      applyFrontmatterEdits(text, { snoozed_until: '2026-10-24' }, ['snoozed_until', 'done']),
    ).toBe('---\nevery: 1w\nsnoozed_until: 2026-10-24\n# newest first\ndone: []\n---\n')
  })

  it('returns the text unchanged with no edits', () => {
    expect(applyFrontmatterEdits(note, {})).toBe(note)
  })
})

describe('frontmatterText', () => {
  it('extracts the YAML between the fences', () => {
    expect(frontmatterText('---\na: 1\nb: 2\n---\nBody')).toBe('a: 1\nb: 2')
    expect(frontmatterText('Body')).toBeNull()
    expect(frontmatterText('---\na: 1\n')).toBeNull()
  })
})
