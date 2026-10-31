import type { ComponentChildren, JSX } from 'preact'

/** One form row in the markup Obsidian's `Setting` builds, so Obsidian's own CSS lays it out. */
export function SettingRow({
  name,
  cls,
  children,
}: {
  name?: string
  cls?: string
  children: ComponentChildren
}): JSX.Element {
  return (
    <div class={cls ? `setting-item ${cls}` : 'setting-item'} tabIndex={-1}>
      <div class="setting-item-info">
        <div class="setting-item-name">{name}</div>
        <div class="setting-item-description" />
      </div>
      <div class="setting-item-control">{children}</div>
    </div>
  )
}

/** The Cancel and Save row that ends a form; `label` renames Save. */
export function FormButtons({
  on,
  saving = false,
  label = 'Save',
}: {
  on: { cancel(): void; save(): void }
  saving?: boolean
  label?: string
}): JSX.Element {
  return (
    <SettingRow>
      <button disabled={saving} onClick={() => on.cancel()}>
        Cancel
      </button>
      <button class="mod-cta" disabled={saving} onClick={() => on.save()}>
        {label}
      </button>
    </SettingRow>
  )
}

/** A select over `options`, keyed by value, in the markup of Obsidian's dropdown. */
export function Dropdown({
  options,
  value,
  pick,
  disabled = false,
}: {
  options: Record<string, string>
  value: string
  pick: (v: string) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <select
      class="dropdown"
      value={value}
      disabled={disabled}
      onChange={(e) => pick(e.currentTarget.value)}
    >
      {Object.entries(options).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  )
}
