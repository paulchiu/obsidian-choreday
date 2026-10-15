import { App, TFile, normalizePath, parseYaml, type TAbstractFile } from 'obsidian'
import { parseChore, readChoreNote, type Chore } from '../domain/chore'
import { applyChoreEdits, newChoreEdits } from '../domain/chore-edits'
import { applyFrontmatterEdits, frontmatterText } from '../domain/frontmatter-edit'
import { findChore, nameTaken, notePath, parentFolder, type ChoreMatch } from '../domain/names'
import type { Written } from '../domain/undo-history'
import { markdownFilesInFolder } from './folder-scan'

/** A `type: chore` note that cannot be scheduled, listed so the user can fix it. */
export interface BrokenChore {
  path: string
  name: string
  problems: string[]
}

/**
 * Chore notes in the configured folder, kept current from the metadata cache. Notes are the only
 * store: every write goes through `vault.process` and is re-read from the cache afterwards.
 */
export class ChoreIndex {
  private chores = new Map<string, Chore>()
  private broken = new Map<string, BrokenChore>()
  private listeners = new Set<() => void>()
  /** The configured folder, normalised; `/` means the vault root. */
  private folder: () => string

  constructor(
    private app: App,
    folder: () => string,
  ) {
    this.folder = () => normalizePath(folder())
  }

  all(): Chore[] {
    return [...this.chores.values()]
  }

  problems(): BrokenChore[] {
    return [...this.broken.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  get(path: string): Chore | undefined {
    return this.chores.get(path)
  }

  /** Resolves a code block's `chore:` reference by name or folder path. */
  find(ref: string): ChoreMatch {
    return findChore(this.all(), ref)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Rebuilds from scratch; used on load and when the folder setting changes. */
  rescan(): void {
    this.chores.clear()
    this.broken.clear()
    for (const file of markdownFilesInFolder(this.app, this.folder())) this.read(file)
    this.emit()
  }

  /** Notifies listeners only when the note was or is a chore, so edits elsewhere cost nothing. */
  onChanged(file: TFile): void {
    const had = this.forget(file.path)
    if (this.read(file) || had) this.emit()
  }

  onDeleted(file: TAbstractFile): void {
    if (this.forget(file.path)) this.emit()
  }

  /** A folder rename also renames each file in it, and those events update the index. */
  onRenamed(file: TAbstractFile, oldPath: string): void {
    const had = this.forget(oldPath)
    const has = file instanceof TFile && this.read(file)
    if (has || had) this.emit()
  }

  /**
   * Re-reads the note's current text, applies `fn`, and writes back only the keys that changed.
   * Returns the chore before and after, or undefined when the note is gone or no longer a chore.
   */
  async update(path: string, fn: (c: Chore) => Chore): Promise<Written | undefined> {
    const file = this.app.vault.getFileByPath(path)
    if (!file) return undefined
    let written: Written | undefined
    await this.app.vault.process(file, (text) => {
      const fm = parseFrontmatter(text)
      const parsed = fm && parseChore(file.path, file.basename, fm)
      if (!parsed?.ok) return text
      written = { before: parsed.chore, after: fn(parsed.chore) }
      return applyChoreEdits(text, written.before, written.after)
    })
    return written
  }

  /** Creates the note for `draft`; returns its path, or null if the name is taken. */
  async create(draft: Chore): Promise<string | null> {
    const path = notePath(this.folder(), draft.name)
    if (this.taken(path)) return null
    const dir = parentFolder(path)
    if (dir && !this.app.vault.getFolderByPath(dir)) await this.app.vault.createFolder(dir)
    const file = await this.app.vault.create(
      path,
      applyFrontmatterEdits('', newChoreEdits(draft)) + '\n',
    )
    return file.path
  }

  /** Renames the note to `name` in its current folder; returns the new path or null if taken. */
  async rename(path: string, name: string): Promise<string | null> {
    const file = this.app.vault.getFileByPath(path)
    if (!file) return null
    const dir = file.parent?.path ?? ''
    const next = notePath(dir === '/' ? '' : dir, name)
    if (next === path) return path
    if (this.taken(next, path)) return null
    await this.app.fileManager.renameFile(file, next)
    return next
  }

  /** Whether another file in `path`'s folder already has its name, ignoring case. */
  private taken(path: string, self?: string): boolean {
    const dir = parentFolder(path)
    const folder = dir ? this.app.vault.getFolderByPath(dir) : this.app.vault.getRoot()
    const siblings = folder?.children.map((f) => f.path) ?? []
    return nameTaken(siblings, path, self)
  }

  /** Indexes the note if it is a chore in the folder; returns whether it was. */
  private read(file: TFile): boolean {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter
    const parsed = readChoreNote(file.path, file.basename, fm, this.folder())
    if (!parsed) return false
    if (parsed.ok) this.chores.set(file.path, parsed.chore)
    else
      this.broken.set(file.path, {
        path: file.path,
        name: file.basename,
        problems: parsed.problems,
      })
    return true
  }

  private forget(path: string): boolean {
    const had = this.chores.delete(path)
    return this.broken.delete(path) || had
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn())
  }
}

function parseFrontmatter(text: string): Record<string, unknown> | null {
  const yaml = frontmatterText(text)
  if (yaml === null) return null
  const parsed: unknown = parseYaml(yaml)
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
}
