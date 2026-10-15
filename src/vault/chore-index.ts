import { App, TFile, normalizePath, parseYaml, type TAbstractFile } from 'obsidian'
import { isChoreFrontmatter, parseChore, type Chore } from '../domain/chore'
import { applyChoreEdits, newChoreEdits, restoreFacts } from '../domain/chore-edits'
import { applyFrontmatterEdits, frontmatterText } from '../domain/frontmatter-edit'
import { isInFolder, notePath, parentFolder } from '../domain/names'
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

  byName(name: string): Chore | undefined {
    const key = name.trim().toLowerCase()
    return this.all().find((c) => c.name.toLowerCase() === key)
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

  onChanged(file: TFile): void {
    this.forget(file.path)
    if (isInFolder(file.path, this.folder())) this.read(file)
    this.emit()
  }

  onDeleted(file: TAbstractFile): void {
    if (this.forget(file.path)) this.emit()
  }

  onRenamed(file: TAbstractFile, oldPath: string): void {
    this.forget(oldPath)
    if (file instanceof TFile) this.onChanged(file)
    else this.emit()
  }

  /**
   * Re-reads the note's current text, applies `fn`, and writes back only the keys that changed.
   * Returns the chore as it was, for undo.
   */
  async update(path: string, fn: (c: Chore) => Chore): Promise<Chore | undefined> {
    const file = this.app.vault.getFileByPath(path)
    if (!file) return undefined
    let before: Chore | undefined
    await this.app.vault.process(file, (text) => {
      const fm = parseFrontmatter(text)
      const parsed = fm && parseChore(file.path, file.basename, fm)
      if (!parsed?.ok) return text
      before = parsed.chore
      return applyChoreEdits(text, before, fn(before))
    })
    return before
  }

  /** Writes `prev`'s stored facts back over whatever the note holds now. */
  async restore(prev: Chore): Promise<void> {
    await this.update(prev.path, (now) => restoreFacts(now, prev))
  }

  async create(draft: Chore): Promise<TFile | null> {
    const path = notePath(this.folder(), draft.name)
    if (this.app.vault.getAbstractFileByPath(path)) return null
    const dir = parentFolder(path)
    if (dir && !this.app.vault.getFolderByPath(dir)) await this.app.vault.createFolder(dir)
    return this.app.vault.create(path, applyFrontmatterEdits('', newChoreEdits(draft)) + '\n')
  }

  /** Renames the note to `name` in its current folder; returns the new path or null if taken. */
  async rename(path: string, name: string): Promise<string | null> {
    const file = this.app.vault.getFileByPath(path)
    if (!file) return null
    const dir = file.parent?.path ?? ''
    const next = notePath(dir === '/' ? '' : dir, name)
    if (next === path) return path
    if (this.app.vault.getAbstractFileByPath(next)) return null
    await this.app.fileManager.renameFile(file, next)
    return next
  }

  private read(file: TFile): void {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter
    if (!isChoreFrontmatter(fm)) return
    const parsed = parseChore(file.path, file.basename, fm ?? {})
    if (parsed.ok) this.chores.set(file.path, parsed.chore)
    else
      this.broken.set(file.path, {
        path: file.path,
        name: file.basename,
        problems: parsed.problems,
      })
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
