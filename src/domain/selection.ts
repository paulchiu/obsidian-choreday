/** Chore paths picked in the Chores view to snooze or skip together. */
export type Selection = ReadonlySet<string>

export const toggleSelected = (selected: Selection, path: string): Selection =>
  selected.has(path)
    ? new Set([...selected].filter((p) => p !== path))
    : new Set([...selected, path])

export const allSelected = (selected: Selection, paths: readonly string[]): boolean =>
  paths.every((p) => selected.has(p))

/** Selects every chore in a group, or unselects them all when they already are. */
export const toggleGroup = (selected: Selection, paths: readonly string[]): Selection =>
  allSelected(selected, paths)
    ? new Set([...selected].filter((p) => !paths.includes(p)))
    : new Set([...selected, ...paths])
