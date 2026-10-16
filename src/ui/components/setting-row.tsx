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

/** The Cancel and Save row that ends a form. */
export function FormButtons({ on }: { on: { cancel(): void; save(): void } }): JSX.Element {
  return (
    <SettingRow>
      <button onClick={() => on.cancel()}>Cancel</button>
      <button class="mod-cta" onClick={() => on.save()}>
        Save
      </button>
    </SettingRow>
  )
}
