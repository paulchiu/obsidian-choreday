import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian'
import { shortDate } from '../domain/day'
import { dueText } from '../domain/friendly'
import { derive, sortGroup, type Group } from '../domain/schedule'
import { ChoreModal } from './modals'
import { RowKit, type RowContext } from './rows'

export const VIEW_TYPE = 'choreday-view'

/** The due list: Needs doing by urgency, Coming up by date, Later collapsed. */
export class ChoresView extends ItemView {
  private kit: RowKit
  private showLater = false

  constructor(
    leaf: WorkspaceLeaf,
    private ctx: RowContext,
  ) {
    super(leaf)
    this.kit = new RowKit(ctx, () => this.render())
  }

  getViewType(): string {
    return VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Chores'
  }

  getIcon(): string {
    return 'list-checks'
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass('cd-root')
    this.register(this.ctx.index.subscribe(() => this.render()))
    this.render()
  }

  async onClose(): Promise<void> {
    this.kit.reset()
  }

  render(): void {
    const today = this.ctx.today()
    const root = this.contentEl
    this.kit.reset()
    root.empty()

    const top = root.createDiv({ cls: 'cd-top' })
    const title = top.createDiv({ cls: 'cd-title' })
    title.createEl('h4', { text: 'Chores' })
    title.createSpan({ cls: 'cd-today-label', text: shortDate(today) })
    const add = top.createEl('button', { cls: 'cd-add' })
    setIcon(add.createSpan(), 'plus')
    add.createSpan({ cls: 'cd-long', text: 'New chore' })
    add.createSpan({ cls: 'cd-short', text: 'New' })
    add.addEventListener('click', () =>
      new ChoreModal(this.app, undefined, today, this.ctx.earlyTicks(), (c) => void this.ctx.createChore(c)).open(),
    )

    const chores = this.ctx.index.all()
    const broken = this.ctx.index.problems()
    if (!chores.length && !broken.length) {
      root.createDiv({
        cls: 'cd-empty',
        text: 'No chores yet. Add one with New chore, or give a note in your chores folder type: chore and every: 2w.',
      })
      return
    }

    /** Rows ticked a moment ago keep their old place until the strike-through settles. */
    const rows = chores.map((c) => ({ c, x: this.kit.justDone.get(c.path) ?? derive(c, today, this.ctx.earlyTicks()) }))
    const group = (g: Group): typeof rows =>
      sortGroup(
        g,
        rows.filter((r) => r.x.group === g),
      )
    const needs = group('needs')
    const coming = group('coming')
    const later = group('later')

    const section = (label: string, list: typeof rows): void => {
      if (!list.length) return
      root.createDiv({ cls: 'cd-group', text: `${label} · ${list.length}` })
      list.forEach(({ c }) => this.kit.row(root, c))
    }
    section('Needs doing', needs)
    if (!needs.length) root.createDiv({ cls: 'cd-empty', text: 'Nothing needs doing.' })
    section('Coming up', coming)

    if (later.length) {
      const toggle = root.createDiv({ cls: 'cd-later' })
      setIcon(
        toggle.createSpan({ cls: 'cd-later-icon' }),
        this.showLater ? 'chevron-down' : 'chevron-right',
      )
      const names = later.map(({ c, x }) => `${c.name}, ${dueText(c, x, today).long}`).join('; ')
      toggle.createSpan({ text: `Later · ${later.length}` })
      if (!this.showLater) toggle.createSpan({ cls: 'cd-later-names', text: ` (${names})` })
      toggle.addEventListener('click', () => {
        this.showLater = !this.showLater
        this.render()
      })
      if (this.showLater) later.forEach(({ c }) => this.kit.row(root, c))
    }

    if (broken.length) {
      root.createDiv({ cls: 'cd-group', text: `Needs fixing · ${broken.length}` })
      for (const b of broken) {
        const row = root.createDiv({ cls: 'cd-broken' })
        setIcon(row.createSpan({ cls: 'cd-warn' }), 'alert-triangle')
        row.createSpan({ cls: 'cd-name', text: b.name })
        row.createSpan({ cls: 'cd-meta', text: b.problems.join('; ') })
        row.addEventListener('click', () => void this.app.workspace.openLinkText(b.path, '', 'tab'))
      }
    }
  }
}
