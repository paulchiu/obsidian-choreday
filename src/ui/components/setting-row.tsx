import type { ComponentChildren, JSX } from 'preact'

/**
 * One form row in the markup Obsidian's `Setting` builds, so Obsidian's own CSS lays it out. `desc`
 * is the smaller line under the name.
 */
export function SettingRow({
  name,
  desc,
  cls,
  children,
}: {
  name?: string
  desc?: string
  cls?: string
  children: ComponentChildren
}): JSX.Element {
  return (
    <div class={cls ? `setting-item ${cls}` : 'setting-item'} tabIndex={-1}>
      <div class="setting-item-info">
        <div class="setting-item-name">{name}</div>
        <div class="setting-item-description">{desc}</div>
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

/**
 * A setting row with Obsidian's toggle, which calls `flip` when clicked. `mod-toggle` is the class
 * `addToggle` gives the row, which keeps the toggle beside its name on phones.
 */
export function Switch({
  name,
  desc,
  on,
  flip,
  disabled = false,
}: {
  name: string
  desc?: string
  on: boolean
  flip: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <SettingRow name={name} desc={desc} cls="mod-toggle">
      <div
        class={on ? 'checkbox-container is-enabled' : 'checkbox-container'}
        role="switch"
        aria-checked={on}
        aria-label={name}
        onClick={() => {
          if (!disabled) flip()
        }}
      >
        <input type="checkbox" tabIndex={-1} checked={on} disabled={disabled} />
      </div>
    </SettingRow>
  )
}
