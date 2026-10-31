// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Plugin as ObsidianPlugin, TFile, type App } from 'obsidian'
import { ChoredaySettingTab } from '../src/settings'
import ChoredayPlugin from '../src/main'
import { resetDom } from './stubs/obsidian-dom'
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
  const app = {
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
