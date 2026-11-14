import type { JSX } from 'preact'
import {
  isStrategy,
  MAX_PICKS,
  STRATEGY_LABELS,
  type PickRule,
  type Strategy,
} from '../../domain/picks'
import { Dropdown, FormButtons, SettingRow, Switch } from './setting-row'

const COUNTS: Record<string, string> = Object.fromEntries(
  Array.from({ length: MAX_PICKS }, (_, i) => [String(i + 1), String(i + 1)]),
)

/** What each control of the pick form reports. */
export interface PicksFormHandlers {
  strategy(s: Strategy): void
  count(n: number): void
  again(): void
  morning(on: boolean): void
  noPressure(on: boolean): void
  cancel(): void
  save(): void
}

/**
 * The focus mode form: the rule, a preview of the names it picks, whether to pick every morning and
 * whether to leave out how pressing each pick is.
 */
export function PicksForm({
  rule,
  morning,
  noPressure,
  preview,
  on,
}: {
  rule: PickRule
  morning: boolean
  noPressure: boolean
  preview: readonly string[]
  on: PicksFormHandlers
}): JSX.Element {
  return (
    <>
      <SettingRow name="Focus on">
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
      <Switch name="Every morning" on={morning} flip={() => on.morning(!morning)} />
      <Switch
        name="No pressure"
        desc="Hide how late each chore is, when it was last done and how many others need doing."
        on={noPressure}
        flip={() => on.noPressure(!noPressure)}
      />
      <FormButtons on={on} label="Focus" />
    </>
  )
}
