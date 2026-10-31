import { parsePickRule, type PickRule } from './picks'

export interface ChoredaySettings {
  /** Where chore notes live; subfolders are included. */
  folder: string
  /** Completions kept per chore unless the note sets `keep`. */
  historyLimit: number
  /** Whether a tick before a calendar chore's next scheduled day counts for that day. */
  earlyTicks: boolean
  /** The rule each day's picks are made by, or null when the view opens with everything. */
  morningPicks: PickRule | null
  /** Whether focus mode leaves out how late each pick is, when it was last done and what else needs doing. */
  noPressure: boolean
}

export const DEFAULT_SETTINGS: ChoredaySettings = {
  folder: 'Chores',
  historyLimit: 12,
  earlyTicks: true,
  morningPicks: null,
  noPressure: false,
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
  if (key === 'noPressure' && typeof value === 'boolean') return { ...settings, noPressure: value }
  if (key === 'morningPicks') {
    const rule = parsePickRule(value)
    if (value === null || rule) return { ...settings, morningPicks: rule }
  }
  return settings
}

export type SettingEffect = 'none' | 'save' | 'redraw' | 'rescan'

/** The strongest work any changed value needs, comparing `before` to `after`. */
export function settingEffect(before: ChoredaySettings, after: ChoredaySettings): SettingEffect {
  if (before.folder !== after.folder) return 'rescan'
  if (before.earlyTicks !== after.earlyTicks) return 'redraw'
  if (before.historyLimit !== after.historyLimit) return 'save'
  return 'none'
}

/** Settings from `data.json`, with the default for any value that is missing or not valid. */
export function parseSettings(raw: unknown): ChoredaySettings {
  const entries = typeof raw === 'object' && raw !== null ? Object.entries(raw) : []
  return entries.reduce((settings, [key, value]) => withSetting(settings, key, value), {
    ...DEFAULT_SETTINGS,
  })
}
