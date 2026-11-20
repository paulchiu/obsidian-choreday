import type { JSX } from 'preact'
import { FormButtons, SettingRow } from './setting-row'

export interface HolidayFormHandlers {
  start(v: string): void
  end(v: string): void
  cancel(): void
  save(): void
}

/** The first and last days away, as ISO text, with why they don't make a holiday under the last. */
export function HolidayForm({
  start,
  end,
  problem,
  on,
}: {
  start: string
  end: string
  problem?: string
  on: HolidayFormHandlers
}): JSX.Element {
  return (
    <>
      <SettingRow name="First day away">
        <input type="date" value={start} onInput={(e) => on.start(e.currentTarget.value)} />
      </SettingRow>
      <SettingRow name="Last day away" desc={problem}>
        <input type="date" value={end} onInput={(e) => on.end(e.currentTarget.value)} />
      </SettingRow>
      <FormButtons on={on} />
    </>
  )
}
