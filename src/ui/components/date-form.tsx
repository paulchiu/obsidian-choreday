import type { JSX } from 'preact'
import { FormButtons, SettingRow } from './setting-row'

/** One date input, as an ISO `value`; used by "Done on…" and snooze "Pick date…". */
export function DateForm({
  value,
  on,
}: {
  value: string
  on: { change(v: string): void; cancel(): void; save(): void }
}): JSX.Element {
  return (
    <>
      <SettingRow name="Date">
        <input type="date" value={value} onInput={(e) => on.change(e.currentTarget.value)} />
      </SettingRow>
      <FormButtons on={on} />
    </>
  )
}
