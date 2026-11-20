import { parseIso, toIso } from './day'
import type { Holiday } from './holiday'
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
  /** Days away that don't count towards any chore's cycle, kept after they end. */
  holidays: Holiday[]
}

/** A holiday as `data.json` keeps it. */
interface HolidayData {
  start: string
  end: string
}

export const DEFAULT_SETTINGS: ChoredaySettings = {
  folder: 'Chores',
  historyLimit: 12,
  earlyTicks: true,
  morningPicks: null,
  noPressure: false,
  holidays: [],
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
  if (key === 'holidays' && Array.isArray(value))
    return { ...settings, holidays: value.flatMap(parseHoliday) }
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
  if (before.earlyTicks !== after.earlyTicks || before.holidays !== after.holidays) return 'redraw'
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

/** A saved holiday, or none when it isn't a start and an end date in order. */
function parseHoliday(value: unknown): Holiday[] {
  const { start, end } = (typeof value === 'object' && value !== null ? value : {}) as {
    start?: unknown
    end?: unknown
  }
  const [s, e] = [start, end].map((v) => (typeof v === 'string' ? parseIso(v) : null))
  return s != null && e != null && s <= e ? [{ start: s, end: e }] : []
}

/** Holidays as `data.json` keeps them, with ISO dates, which `withSetting` reads back. */
export const holidaysData = (holidays: readonly Holiday[]): HolidayData[] =>
  holidays.map((h) => ({ start: toIso(h.start), end: toIso(h.end) }))

/** Settings as `data.json` keeps them, with dates written as ISO text. */
export const settingsData = (
  s: ChoredaySettings,
): Omit<ChoredaySettings, 'holidays'> & { holidays: HolidayData[] } => ({
  ...s,
  holidays: holidaysData(s.holidays),
})
