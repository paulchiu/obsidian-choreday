import { describe, expect, it, vi } from 'vitest'
import { TFile, type App } from 'obsidian'
import { d } from '../domain/helpers'
import { ChoreIndex } from '../../src/vault/chore-index'

type Note = TFile & {
  text: string
  frontmatter?: Record<string, unknown>
}

function setup(notes: Note[], folder = 'Chores') {
  const files = new Map(notes.map((note) => [note.path, note]))
  const dirs = new Map<string, { path: string; children: unknown[] }>()
  for (const note of notes) {
    const dir = note.path.includes('/') ? note.path.slice(0, note.path.lastIndexOf('/')) : ''
    if (!dirs.has(dir)) dirs.set(dir, { path: dir, children: [] })
    dirs.get(dir)?.children.push(note)
  }
  const root = { path: '', children: [...dirs.values()].filter((dir) => !dir.path.includes('/')) }
  for (const dir of dirs.values()) {
    if (!dir.path) continue
    const parent = dir.path.includes('/') ? dir.path.slice(0, dir.path.lastIndexOf('/')) : ''
    const parentDir = dirs.get(parent) ?? root
    if (!parentDir.children.includes(dir)) parentDir.children.push(dir)
  }
  const app = {
    vault: {
      getFileByPath: (path: string) => files.get(path),
      getFolderByPath: (path: string) => dirs.get(path) as never,
      getRoot: () => root as never,
      process: async (file: TFile, fn: (text: string) => string) => {
        const note = files.get(file.path)
        if (note) note.text = fn(note.text)
      },
      createFolder: vi.fn(),
      create: vi.fn(),
    },
    metadataCache: {
      getFileCache: (file: TFile) => ({ frontmatter: files.get(file.path)?.frontmatter }),
    },
    fileManager: { renameFile: vi.fn() },
  } as unknown as App
  return { app, files, index: new ChoreIndex(app, folder) }
}

const note = (
  path = 'Chores/Dishes.md',
  text = '---\ntype: chore\nevery: 1w\ndone:\n  - 2026-10-17\n---\nKeep this body.\n',
): Note =>
  Object.assign(new TFile(), {
    path,
    basename: path.split('/').at(-1)?.replace(/\.md$/, '') ?? '',
    extension: 'md',
    text,
  })

describe('ChoreIndex adapter', () => {
  it.each([
    ['removed marker', '---\nevery: 1w\n---\nBody\n'],
    ['changed marker', '---\ntype: project\nevery: 1w\n---\nBody\n'],
    ['malformed interval', '---\ntype: chore\nevery: nope\n---\nBody\n'],
  ])('does not write when fresh text has %s', async (_label, freshText) => {
    const original: Note = note()
    const { index, files } = setup([original])
    index.rescan()
    files.get(original.path)!.text = freshText

    const result = await index.update(original.path, (chore) => ({
      ...chore,
      done: [d('2026-10-18')],
    }))

    expect(result).toBeUndefined()
    expect(files.get(original.path)?.text).toBe(freshText)
  })

  it('rejects a note outside the committed folder even when its YAML is valid', async () => {
    const outside = note('Other/Dishes.md')
    const { index, files } = setup([outside])
    index.rescan()

    const result = await index.update(outside.path, (chore) => ({
      ...chore,
      done: [d('2026-10-18')],
    }))

    expect(result).toBeUndefined()
    expect(files.get(outside.path)?.text).toBe(outside.text)
  })

  it('uses callback text instead of stale metadata and preserves body and YAML comments', async () => {
    const original: Note = note()
    original.frontmatter = { type: 'chore', every: '1w', done: ['2026-10-17'] }
    const { index, files } = setup([original])
    index.rescan()
    const fresh = '---\n# hand-edited\ntype: chore\nevery: 1w\ndone: []\n---\nBody stays here.\n'
    files.get(original.path)!.text = fresh

    const written = await index.update(original.path, (chore) => ({
      ...chore,
      done: [d('2026-10-18')],
    }))

    expect(written?.before.done).toEqual([])
    expect(files.get(original.path)?.text).toContain('# hand-edited')
    expect(files.get(original.path)?.text).toContain('Body stays here.')
    expect(files.get(original.path)?.text).toContain('done: [2026-10-18]')
  })

  it('returns a write result but leaves text unchanged for a no-op', async () => {
    const original = note()
    const { index, files } = setup([original])
    index.rescan()

    const written = await index.update(original.path, (chore) => chore)

    expect(written).toBeDefined()
    expect(files.get(original.path)?.text).toBe(original.text)
  })

  it('keeps the current folder policy until a rescan commits the new folder', async () => {
    const oldNote = Object.assign(note('Chores/Old.md'), {
      frontmatter: { type: 'chore', every: '1w' },
    })
    const nextNote = Object.assign(note('Next/Next.md'), {
      frontmatter: { type: 'chore', every: '1w' },
    })
    const { index } = setup([oldNote, nextNote])
    index.rescan()
    expect(index.all().map(({ path }) => path)).toEqual(['Chores/Old.md'])

    index.onChanged(nextNote)
    expect(index.all().map(({ path }) => path)).toEqual(['Chores/Old.md'])

    index.rescan('Next')
    expect(index.all().map(({ path }) => path)).toEqual(['Next/Next.md'])
  })
})
