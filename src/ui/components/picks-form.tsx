import type { JSX } from 'preact'
import {
  isStrategy,
  MAX_PICKS,
  STRATEGY_LABELS,
  type PickRule,
  type Strategy,
} from '../../domain/picks'
import { Dropdown, FormButtons, SettingRow } from './setting-row'

const COUNTS: Record<string, string> = Object.fromEntries(
  Array.from({ length: MAX_PICKS }, (_, i) => [String(i + 1), String(i + 1)]),
)

/** What each control of the pick form reports. */
export interface PicksFormHandlers {
  strategy(s: Strategy): void
  count(n: number): void
  again(): void
  morning(on: boolean): void
  cancel(): void
  save(): void
}

/** The pick form: the rule, a preview of the names it picks, and whether to pick every morning. */
export function PicksForm({
  rule,
  morning,
  preview,
  on,
}: {
  rule: PickRule
  morning: boolean
  preview: readonly string[]
  on: PicksFormHandlers
}): JSX.Element {
  return (
    <>
      <SettingRow name="Pick by">
        {rule.strategy === 'surprise' && <button onClick={() => on.again()}>Again</button>}
        <Dropdown
          options={STRATEGY_LABELS}
          value={rule.strategy}
          pick={(v) => {
            if (isStrategy(v)) on.strategy(v)
          }}
        />
      </SettingRow>
      <SettingRow name="How many">
        <Dropdown options={COUNTS} value={String(rule.count)} pick={(v) => on.count(Number(v))} />
      </SettingRow>
      <SettingRow name="Today">
        <span class="cd-preview">
          {preview.length ? preview.join(', ') : 'Nothing needs doing'}
        </span>
      </SettingRow>
      <SettingRow name="Every morning">
        <input
          type="checkbox"
          checked={morning}
          onChange={(e) => on.morning(e.currentTarget.checked)}
        />
      </SettingRow>
      <FormButtons on={on} label="Pick" />
    </>
  )
}
