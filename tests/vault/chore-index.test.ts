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
  const createFile = vi.fn(async (path: string, text: string) => {
    const file = note(path, text)
    files.set(path, file)
    return file
  })
  const renameFile = vi.fn()
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
      read: async (file: TFile) => files.get(file.path)?.text ?? '',
      process: async (file: TFile, fn: (text: string) => string) => {
        const note = files.get(file.path)
        if (note) note.text = fn(note.text)
      },
      createFolder: vi.fn(),
      create: createFile,
    },
    metadataCache: {
      getFileCache: (file: TFile) => ({ frontmatter: files.get(file.path)?.frontmatter }),
    },
    fileManager: { renameFile },
  } as unknown as App
  return { app, files, createFile, renameFile, index: new ChoreIndex(app, folder) }
}

const note = (
  path = 'Chores/Dishes.md',
  text = '---\ntype: chore\nevery: 1w\ndone:\n  - 2026-10-17\n---\nKeep this body.\n',
): Note =>
  Object.assign(new TFile(), {
    path,
    basename: path.split('/').at(-1)?.replace(/\.md$/, '') ?? '',
    extension: 'md',
    parent: { path: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '' } as never,
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

  it('renames an eligible chore and preserves same-name no-op behavior', async () => {
    const original = note()
    const { index, renameFile } = setup([original])

    expect(await index.rename(original.path, 'Dishes')).toBe(original.path)
    expect(renameFile).not.toHaveBeenCalled()
    expect(await index.rename(original.path, 'New dishes')).toBe('Chores/New dishes.md')
    expect(renameFile).toHaveBeenCalledWith(original, 'Chores/New dishes.md')
  })

  it.each([
    ['removed marker', 'Chores/Dishes.md', '---\nevery: 1w\n---\nBody\n'],
    ['malformed interval', 'Chores/Dishes.md', '---\ntype: chore\nevery: nope\n---\nBody\n'],
    ['out-of-folder membership', 'Other/Dishes.md', '---\ntype: chore\nevery: 1w\n---\nBody\n'],
  ])('does not rename a note with fresh %s eligibility', async (_label, path, freshText) => {
    const original = note(path)
    const { index, files, renameFile } = setup([original])
    index.rescan()
    files.get(original.path)!.text = freshText

    const result = await index.rename(original.path, 'Renamed')

    expect(result).toBeNull()
    expect(renameFile).not.toHaveBeenCalled()
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

  it('creates notes in the active folder before and after a folder scan', async () => {
    const { index, createFile } = setup([
      Object.assign(note('Chores/Old.md'), { frontmatter: { type: 'chore', every: '1w' } }),
      Object.assign(note('Next/Existing.md'), { frontmatter: { type: 'chore', every: '1w' } }),
    ])
    index.rescan()

    const beforeSwitch = await index.create({ ...index.all()[0]!, name: 'Before switch' })
    index.rescan('Next')
    const afterSwitch = await index.create({ ...index.all()[0]!, name: 'After switch' })

    expect(beforeSwitch).toBe('Chores/Before switch.md')
    expect(afterSwitch).toBe('Next/After switch.md')
    expect(createFile.mock.calls.map(([path]) => path)).toEqual([
      'Chores/Before switch.md',
      'Next/After switch.md',
    ])
  })
})
