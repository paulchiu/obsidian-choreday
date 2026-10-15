import type { Chore } from './chore'

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

/** The folder holding `path`; empty for the vault root. */
export function parentFolder(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

/** How a `chore:` reference in a code block resolves against the indexed chores. */
export type ChoreMatch =
  { kind: 'found'; chore: Chore } | { kind: 'none' } | { kind: 'ambiguous'; paths: string[] }

/**
 * Matches a chore name or the tail of its path (`Kitchen/Clean`), ignoring case and `.md`. Never
 * guesses between several matches, since a guess can flip and tick the wrong note.
 */
export function findChore(chores: Chore[], ref: string): ChoreMatch {
  const key = withoutMd(ref.trim().toLowerCase())
  const matches = chores.filter((c) => {
    const p = withoutMd(c.path.toLowerCase())
    return p === key || p.endsWith(`/${key}`)
  })
  const [only] = matches
  if (!only) return { kind: 'none' }
  if (matches.length === 1) return { kind: 'found', chore: only }
  return { kind: 'ambiguous', paths: matches.map((c) => c.path).sort() }
}

const withoutMd = (path: string): string => path.replace(/\.md$/, '')

/** What a `choreday` block says when it has no chore to show. */
export function unresolvedText(ref: string | undefined, match: ChoreMatch | null): string {
  if (ref === undefined) return 'This note is not a chore.'
  if (match?.kind !== 'ambiguous') return `No chore named ${ref}.`
  const paths = match.paths.map(withoutMd)
  return (
    `Several chores are named ${ref}: ${paths.join(', ')}. ` +
    `Name one by its folder, for example chore: ${paths[0]}.`
  )
}
