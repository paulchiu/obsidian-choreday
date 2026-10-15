export interface ChoredaySettings {
  /** Where chore notes live; subfolders are included. */
  folder: string
  /** Completions kept per chore unless the note sets `keep`. */
  historyLimit: number
  /** Whether a tick before a calendar chore's next scheduled day counts for that day. */
  earlyTicks: boolean
}

export const DEFAULT_SETTINGS: ChoredaySettings = {
  folder: 'Chores',
  historyLimit: 12,
  earlyTicks: true,
}

export const MIN_HISTORY = 2

export const historyProblem = (n: number): string | void =>
  Number.isInteger(n) && n >= MIN_HISTORY ? undefined : `Keep at least ${MIN_HISTORY}.`

/** `settings` with `key` set to `value`, or unchanged when `value` is not valid for `key`. */
export function withSetting(
  settings: ChoredaySettings,
  key: string,
  value: unknown,
): ChoredaySettings {
  if (key === 'folder' && typeof value === 'string') return { ...settings, folder: value }
  if (key === 'historyLimit' && typeof value === 'number' && !historyProblem(value))
    return { ...settings, historyLimit: value }
  if (key === 'earlyTicks' && typeof value === 'boolean') return { ...settings, earlyTicks: value }
  return settings
}

/** Settings from `data.json`, with the default for any value that is missing or not valid. */
export function parseSettings(raw: unknown): ChoredaySettings {
  const entries = typeof raw === 'object' && raw !== null ? Object.entries(raw) : []
  return entries.reduce((settings, [key, value]) => withSetting(settings, key, value), {
    ...DEFAULT_SETTINGS,
  })
}
