// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { Plugin as ObsidianPlugin, TFile, type App } from 'obsidian'
import { ChoredaySettingTab } from '../src/settings'
import ChoredayPlugin from '../src/main'
import { resetDom } from './stubs/obsidian-dom'
import { dayOf } from '../src/domain/day'
import { PicksModal } from '../src/ui/obsidian/modals'

type File = TFile & { frontmatter: Record<string, unknown>; text: string }
type Folder = { path: string; children: (Folder | File)[] }
type EventName = 'changed' | 'delete' | 'rename'

function setup() {
  const oldFile = makeFile('Old/Dishes.md', 'Dishes')
  const newFile = makeFile('New/Laundry.md', 'Laundry')
  const files = new Map([
    [oldFile.path, oldFile],
    [newFile.path, newFile],
  ])
  const folders: Record<string, Folder> = {
    '': { path: '', children: [] },
    Old: { path: 'Old', children: [oldFile] },
    New: { path: 'New', children: [newFile] },
  }
  folders['']!.children.push(folders.Old!, folders.New!)
  const listeners = new Map<EventName, ((...args: never[]) => void)[]>()
  const fire = (event: EventName, ...args: unknown[]) =>
    listeners.get(event)?.forEach((listener) => listener(...(args as never[])))
  let layoutReady: (() => void) | undefined
  let folderReads = 0
  /** The vault's local storage, kept as JSON text as Obsidian keeps it. */
  const local = new Map<string, string>()
  const app = {
    loadLocalStorage: (key: string): unknown => {
      const text = local.get(key)
      return text === undefined ? null : JSON.parse(text)
    },
    saveLocalStorage: (key: string, data: unknown) => {
      if (data === null) local.delete(key)
      else local.set(key, JSON.stringify(data))
    },
    workspace: {
      onLayoutReady: (callback: () => void) => (layoutReady = callback),
      getLeavesOfType: () => [],
      getLeaf: () => ({ setViewState: vi.fn(), app }),
      revealLeaf: vi.fn(),
    },
    metadataCache: {
      getFileCache: (file: File) => ({ frontmatter: file.frontmatter }),
      on: (event: EventName, callback: (...args: never[]) => void) => {
        const callbacks = listeners.get(event) ?? []
        callbacks.push(callback)
        listeners.set(event, callbacks)
        return {} as never
      },
    },
    vault: {
      getFileByPath: (path: string) => files.get(path) ?? null,
      getFolderByPath: (path: string) => {
        folderReads++
        return folders[path] ?? null
      },
      getRoot: () => folders[''],
      process: async (file: File, update: (text: string) => string) => {
        file.text = update(file.text)
      },
      on: (event: EventName, callback: (...args: never[]) => void) => {
        const callbacks = listeners.get(event) ?? []
        callbacks.push(callback)
        listeners.set(event, callbacks)
        return {} as never
      },
      createFolder: vi.fn(),
      create: vi.fn(),
      getMarkdownFiles: () => [oldFile, newFile],
    },
    fileManager: { renameFile: vi.fn() },
  } as unknown as App
  return {
    app,
    oldFile,
    newFile,
    fire,
    local,
    ready: () => layoutReady?.(),
    folderReads: () => folderReads,
    replace: (file: File) => {
      files.set(file.path, file)
      const folder = folders[file.path.slice(0, file.path.lastIndexOf('/'))]
      if (folder)
        folder.children = folder.children.filter((child) => child.path !== file.path).concat(file)
    },
  }
}

function makeFile(path: string, name: string): File {
  return Object.assign(new TFile(), {
    path,
    name: `${name}.md`,
    basename: name,
    extension: 'md',
    parent: { path: path.slice(0, path.lastIndexOf('/')) } as never,
    frontmatter: { type: 'chore', every: '1d' },
    text: `---\ntype: chore\nevery: 1d\n---\n${name} body\n`,
  })
}

describe('plugin folder and day behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'))
    resetDom()
  })
  afterEach(() => {
    resetDom()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('keeps note membership stable until the requested folder scan completes', async () => {
    const state = setup()
    const plugin = new ChoredayPlugin(state.app, {} as never)
    plugin.loadData = async () => ({ folder: 'Old', historyLimit: 20, earlyTicks: true })
    await plugin.onload()
    state.ready()
    expect(plugin.index.all().map(({ path }) => path)).toEqual(['Old/Dishes.md'])

    await new ChoredaySettingTab(state.app, plugin).setControlValue('folder', 'New')
    state.fire('changed', state.newFile)
    expect(plugin.index.all().map(({ path }) => path)).toEqual(['Old/Dishes.md'])

    await vi.advanceTimersByTimeAsync(400)
    expect(plugin.index.all().map(({ path }) => path)).toEqual(['New/Laundry.md'])
  })

  it('notifies subscribers when the day rolls over without scanning the vault', async () => {
    const state = setup()
    const plugin = new ChoredayPlugin(state.app, {} as never)
    plugin.loadData = async () => ({ folder: 'Old', historyLimit: 20, earlyTicks: true })
    await plugin.onload()
    state.ready()
    let updates = 0
    plugin.index.subscribe(() => updates++)
    const scansBeforeRollover = state.folderReads()
    const today = new Date()
    vi.setSystemTime(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))

    await vi.advanceTimersByTimeAsync(60_000)

    expect(updates).toBe(1)
    expect(state.folderReads()).toBe(scansBeforeRollover)
    expect(plugin.index.find('Dishes')).toMatchObject({
      kind: 'found',
      chore: { path: 'Old/Dishes.md' },
    })
  })

  it('leaves a replacement note unchanged when undo follows its deleted chore', async () => {
    const state = setup()
    const registerView = vi.spyOn(ObsidianPlugin.prototype, 'registerView')
    const addCommand = vi.spyOn(ObsidianPlugin.prototype, 'addCommand')
    const plugin = new ChoredayPlugin(state.app, {} as never)
    plugin.loadData = async () => ({ folder: 'Old', historyLimit: 20, earlyTicks: true })
    await plugin.onload()
    state.ready()

    const makeView = registerView.mock.calls[0]?.[1]
    const view = makeView?.({ app: state.app } as never) as
      { onOpen(): Promise<void>; onClose?(): Promise<void>; contentEl: HTMLElement } | undefined
    await view?.onOpen()
    view?.contentEl.querySelector<HTMLElement>('.cd-check')?.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.oldFile.text).toContain('done:\n  - 2026-10-18')

    const undo = addCommand.mock.calls.find(([command]) => command.id === 'undo')?.[0]
    expect(undo?.checkCallback?.(true)).toBe(true)

    const replacement = makeFile('Old/Dishes.md', 'Replacement')
    replacement.text = '---\ntype: chore\nevery: 1d\ndone:\n  - 2026-10-18\n---\nReplacement body\n'
    state.replace(replacement)
    state.fire('delete', state.oldFile)
    undo?.checkCallback?.(false)
    await vi.advanceTimersByTimeAsync(0)

    expect(replacement.text).toBe(
      '---\ntype: chore\nevery: 1d\ndone:\n  - 2026-10-18\n---\nReplacement body\n',
    )
    registerView.mockRestore()
    addCommand.mockRestore()
    await view?.onClose?.()
  })

  it('saves No pressure from the Focus mode form, so it is on after a restart', async () => {
    const state = setup()
    const registerView = vi.spyOn(ObsidianPlugin.prototype, 'registerView')
    const opened = vi.spyOn(PicksModal.prototype, 'open').mockImplementation(function (
      this: PicksModal,
    ) {
      this.onOpen()
    })
    const plugin = new ChoredayPlugin(state.app, {} as never)
    plugin.loadData = async () => ({ folder: 'Old' })
    let saved: unknown
    plugin.saveData = async (data) => {
      saved = structuredClone(data)
    }
    await plugin.onload()
    state.ready()

    const view = registerView.mock.calls[0]?.[1]?.({ app: state.app } as never) as
      { onOpen(): Promise<void>; onClose(): Promise<void>; contentEl: HTMLElement } | undefined
    await view?.onOpen()
    view?.contentEl.querySelector<HTMLElement>('[data-cd-focus="focus"]')?.click()
    const form = (opened.mock.contexts.at(-1) as PicksModal | undefined)?.contentEl
    form?.querySelector<HTMLElement>('[aria-label="No pressure"]')?.click()
    Array.from(form?.querySelectorAll('button') ?? [])
      .find((b) => b.textContent === 'Focus')
      ?.click()
    await vi.advanceTimersByTimeAsync(0)

    const restarted = new ChoredayPlugin(state.app, {} as never)
    restarted.loadData = async () => saved
    await restarted.loadSettings()
    expect(restarted.settings.noPressure).toBe(true)
    registerView.mockRestore()
    opened.mockRestore()
    await view?.onClose()
  })
})

describe("today's focus across plugin reloads", () => {
  type View = { onOpen(): Promise<void>; onClose(): Promise<void>; contentEl: HTMLElement }
  let registerView: MockInstance<ObsidianPlugin['registerView']>
  let opened: MockInstance<PicksModal['open']>
  let views: View[]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T02:00:00Z'))
    resetDom()
    views = []
    registerView = vi.spyOn(ObsidianPlugin.prototype, 'registerView')
    opened = vi.spyOn(PicksModal.prototype, 'open').mockImplementation(function (this: PicksModal) {
      this.onOpen()
    })
  })
  afterEach(async () => {
    await Promise.all(views.map((v) => v.onClose()))
    resetDom()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  /**
   * Loads a plugin on `state.app` with `data` as its saved settings, which it saves back into,
   * keeping every save as text in `writes`.
   */
  async function load(
    state: ReturnType<typeof setup>,
    data: { saved: unknown; writes?: string[] },
  ) {
    const plugin = new ChoredayPlugin(state.app, {} as never)
    plugin.loadData = async () => data.saved
    plugin.saveData = async (next) => {
      data.saved = structuredClone(next)
      data.writes?.push(JSON.stringify(next))
    }
    await plugin.onload()
    state.ready()
    const view = registerView.mock.calls.at(-1)?.[1]?.({ app: state.app } as never) as View
    views.push(view)
    await view.onOpen()
    return view.contentEl
  }

  /** Opens the Focus mode form from `root`, lets `fill` change it, then presses Focus. */
  async function focus(root: HTMLElement, fill: (form: HTMLElement) => void = () => {}) {
    root.querySelector<HTMLElement>('[data-cd-focus="focus"]')?.click()
    const form = (opened.mock.contexts.at(-1) as PicksModal).contentEl
    fill(form)
    Array.from(form.querySelectorAll('button'))
      .find((b) => b.textContent === 'Focus')
      ?.click()
    await vi.advanceTimersByTimeAsync(0)
  }

  const groups = (root: HTMLElement): (string | null)[] =>
    Array.from(root.querySelectorAll('.cd-group > span'), (el) => el.textContent)

  it('keeps the picks made today', async () => {
    const state = setup()
    const data = { saved: { folder: 'Old' } as unknown }
    await focus(await load(state, data), (form) => {
      const field = form.querySelector('select')
      if (!field) throw new Error('no Focus on field')
      field.value = 'surprise'
      field.dispatchEvent(new Event('change'))
    })

    const root = await load(state, data)
    expect(groups(root)).toEqual(['Focus · 1'])
    expect(root.querySelector('.cd-picks-line')?.textContent).toBe(
      'Focus mode: Surprise me · Change · Show all',
    )
  })

  /** Turns on Every morning in the Focus mode form. */
  const everyMorning = (form: HTMLElement): void =>
    form.querySelector<HTMLElement>('[aria-label="Every morning"]')?.click()

  it('keeps Show all, rather than picking again by the morning rule', async () => {
    const state = setup()
    const data = { saved: { folder: 'Old' } as unknown }
    const first = await load(state, data)
    await focus(first, everyMorning)
    first.querySelector<HTMLElement>('[data-cd-focus="show-all"]')?.click()

    const root = await load(state, data)
    expect(groups(root)).toEqual(['Needs doing · 1'])
    expect(root.querySelector('.cd-picks-line')).toBeNull()
  })

  it('ignores a focus saved on an earlier day, picking again by the morning rule', async () => {
    const state = setup()
    const data = { saved: { folder: 'Old' } as unknown }
    const first = await load(state, data)
    await focus(first, everyMorning)
    first.querySelector<HTMLElement>('[data-cd-focus="show-all"]')?.click()

    vi.setSystemTime(new Date('2026-10-19T02:00:00Z'))
    expect(groups(await load(state, data))).toEqual(['Focus · 1'])
  })

  it('ignores a saved focus it cannot read', async () => {
    const state = setup()
    const today = dayOf(new Date())
    state.local.set('choreday-today-picks', JSON.stringify({ day: today, kind: 'picked' }))
    expect(groups(await load(state, { saved: { folder: 'Old' } }))).toEqual(['Needs doing · 1'])
  })

  it("keeps today's focus out of the settings file", async () => {
    const state = setup()
    const data = { saved: { folder: 'Old' } as unknown, writes: [] as string[] }
    const root = await load(state, data)
    await focus(root, everyMorning)
    expect([...state.local.values()].join()).toContain('Old/Dishes.md')
    root.querySelector<HTMLElement>('[data-cd-focus="show-all"]')?.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(data.writes.length).toBeGreaterThan(0)
    for (const text of data.writes) {
      expect(text).not.toContain('Old/Dishes.md')
      expect(text).not.toContain('"kind"')
    }
  })
})
