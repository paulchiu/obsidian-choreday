/** Chore paths picked in the Chores view to snooze or skip together. */
export type ChoreSelection = ReadonlySet<string>

export const toggleSelected = (selected: ChoreSelection, path: string): ChoreSelection =>
  selected.has(path)
    ? new Set([...selected].filter((p) => p !== path))
    : new Set([...selected, path])

export const allSelected = (selected: ChoreSelection, paths: readonly string[]): boolean =>
  paths.every((p) => selected.has(p))

/** Selects every chore in a group, or unselects them all when they already are. */
export const toggleGroup = (selected: ChoreSelection, paths: readonly string[]): ChoreSelection =>
  allSelected(selected, paths)
    ? new Set([...selected].filter((p) => !paths.includes(p)))
    : new Set([...selected, ...paths])
