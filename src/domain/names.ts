/** Characters Obsidian refuses in file names, or that break links. */
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/g

/** A chore name made safe to use as a note basename. */
export function choreBasename(name: string): string {
  return name.replace(FORBIDDEN, ' ').replace(/\s+/g, ' ').trim()
}

/** `Chores/` and `/Chores` both become `Chores`; an empty folder means the vault root. */
export function normalizeFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, '')
}

export function notePath(folder: string, basename: string): string {
  const f = normalizeFolder(folder)
  return f ? `${f}/${basename}.md` : `${basename}.md`
}

/** True when `path` sits in `folder` or one of its subfolders. */
export function isInFolder(path: string, folder: string): boolean {
  const f = normalizeFolder(folder)
  return f === '' || path.startsWith(`${f}/`)
}
