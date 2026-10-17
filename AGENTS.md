# Project context and coding standards

Context, rules and constraints for AI coding agents working on Choreday.

## 1. Project context

- Type: Obsidian community plugin.
- Language: TypeScript (strict, ES2018 target to match Obsidian's bundling constraints).
- Runtime: Loads inside Obsidian (Electron). Desktop and mobile both supported unless a feature needs `isDesktopOnly`.
- Bundler: esbuild (CJS, bundled to `main.js`).
- JSX: `.tsx` files compile with Preact's automatic runtime (`jsx: react-jsx`, `jsxImportSource: preact` in `tsconfig.json`, and the matching options in `esbuild.config.mjs` and `vitest.config.ts`). Preact is a pinned devDependency, since esbuild bundles it.
- Package manager: npm.

- Related work: The UX prototype and product brief are kept outside this repo; ask the maintainer before introducing new patterns.

### Tests

Vitest covers the pure modules in `src/domain/` (parsing, scheduling, friendly text, frontmatter edits), the chore actions in `src/vault/chore-actions.ts` (against an in-memory store), the pure UI modules in `src/ui/model/` (`row-model`, `list-model`, `strip-model`, the menu builders in `row-menu`, the settle rules in `settle`, `focus-landing`, `mascot-art`, `svg-ids`), the prop builders and `keepFocus` in `src/ui/components/keys.ts`, the `fillMenu` adapter (`src/ui/obsidian/menus.ts`) against fake menus with Obsidian's `createFragment` global stubbed, and the keyboard focus rings in `styles.css`.

Component tests cover the rendered DOM of the Chores view (`src/ui/obsidian/chores-view.tsx`, `src/ui/components/chores-root.tsx`), the row (`src/ui/components/row.tsx`), its history strip (`src/ui/components/strip.tsx`), the `choreday` code block (`src/ui/obsidian/chore-block.tsx`) and the chore and date modals (`src/ui/obsidian/modals.tsx`, through the stub's `Modal`, whose `open` and `close` run `onOpen` and `onClose`) under happy-dom, including that rows keep their nodes and focus across renders and that closing or unloading leaves nothing mounted or subscribed, with the stubs in `tests/stubs/`: an `obsidian` module stub aliased in by `vitest.config.ts`, a shim installing Obsidian's DOM helpers (`createEl` and friends, `empty`, `Node.doc`, a counting `ResizeObserver`), and `outline()` for structural snapshots; those tests start with `// @vitest-environment happy-dom`.

Tests mirror the tiers under `tests/ui/components/`, `tests/ui/model/` and `tests/ui/obsidian/`.

Preact component tests (`tests/ui/components/*.test.tsx`) run the same way, rendering with plain `preact` `render` into a container wrapped by `withHost` (`tests/ui/fakes.ts`), whose `fakeHost` marks icons and tooltips as data attributes, and driving the handler interfaces (`RowActions`) with `vi.fn()` fakes; the shells' tests go through the real `obsidianHost` and the stub.

Other UI and vault flows are checked by hand against a dev vault; the Obsidian CLI (`obsidian vault=<name> plugin:reload id=choreday`, `eval`, `dev:mobile on`) drives most of that.

## 2. Architecture

- Use pure functions where Obsidian allows:
  - Pure functions for parsing, serialisation, normalisation, and registry logic. Extract into `src/` modules that are unit-testable without `App`.
  - Classes are fine where Obsidian requires them (`Plugin`, `Modal`, `ItemView`, `SettingTab`). Keep them thin: hold references, wire events, delegate logic to pure helpers.
  - Immutability: `const` by default. Avoid in-place mutation of data structures that flow between modules.
- File layout: `src/` is split into three tiers plus a thin top level for the plugin entry-point and configuration glue.
  - `src/main.ts`: plugin entry point (`export default class ... extends Plugin`).
  - `src/settings.ts`: the `PluginSettingTab` subclass. The settings type, defaults and validation are pure, in `src/domain/settings.ts`.
  - `src/domain/`: pure modules (dates, intervals, chore parsing, scheduling, friendly text, frontmatter text edits, names, settings). No `obsidian` imports allowed.
  - `src/vault/`: Obsidian-aware, non-UI helpers (the chore index and folder scan). May import from `obsidian` and `src/domain/`. Must not import from `src/ui/`.
  - `src/ui/`: the UI, split by what each file may touch:
    - `src/ui/components/`: pure Preact function components and hooks. May import `preact`, `preact/hooks`, `ts-pattern`, `src/domain/`, `src/ui/model/` and each other. Never `obsidian`, `src/ui/obsidian/`, `src/vault/` or the plugin shell (`src/main.ts`, `src/settings.ts`), nor the `activeDocument`, `activeWindow` and `createFragment` globals or Obsidian's DOM extensions (`empty`, `createEl` and friends). They reach the platform through the `Host` context (`components/host.ts`) and act through handler interfaces (`ViewHandlers`, `RowActions`).
    - `src/ui/model/`: pure TypeScript with no DOM, Preact or Obsidian: the row and list models, the menu builders, the settle rules, focus landing and the mascot art. May import `ts-pattern` and `src/domain/`.
    - `src/ui/obsidian/`: the only folder in `src/ui` that imports `obsidian`. Thin shells and adapters: the `ItemView`, the code block mount, modals, `fillMenu`, the row kit and `obsidianHost`. May import from anywhere.
  - Lint fences: `eslint.config.mts` enforces the tiers with `@typescript-eslint/no-restricted-imports` (type imports count), `no-restricted-globals` and `no-restricted-properties` (Obsidian's DOM extensions): `src/domain/` may import neither `src/ui/` nor `src/vault/`, `src/ui/model/` and `src/ui/components/` follow the rules above, none of the three may import the plugin shell, and `src/vault/` may not import from `src/ui/`. In those folders obsidianmd's own restricted imports and globals are errors rather than warnings. `src/main.ts`, `src/settings.ts` and `src/ui/obsidian/` are unrestricted.
  - Within a tier, imports use `./` relative paths. Cross-tier, use `../<tier>/` (e.g. `../domain/types`), or `../../<tier>/` from a `src/ui` sub-folder. `src/ui` is the one tier with sub-folders, because it carries three constraint sets; `src/domain/` and `src/vault/` stay flat.
- Drawing the UI with Preact:
  - `src/ui/components` draws the Chores view body, its rows, the `choreday` code block and the chore and date forms with Preact function components in `.tsx` files, mounted by the shells in `src/ui/obsidian` under a `HostContext` provider of `obsidianHost`. Modal bodies are components rendered into `contentEl` by thin `Modal` shells that hold the draft; the settings tab, menus and toasts stay on Obsidian's own builders.
  - State lives in the Obsidian class (`ChoresView`, `ChoreModal`) or in the row kit (`createRowKit`, `src/ui/obsidian/row-kit.ts`), whose settle rules are pure functions in `src/ui/model/settle.ts`; components keep none, and use no `useState` or `useReducer` (`keepFocus` relies on Preact's top-level `render` being synchronous, and component state updates on a microtask). The one exception is the strip's measured width (`useMeasuredWidth`): it exists only after mount and nothing focusable renders inside the strip.
  - Mount once and update: Preact `render` in `onOpen` or the block processor, again on every change, and `render(null, el)` in `onClose` or on unload. Register every subscription for cleanup; nothing re-mounts on a rescan or a day rollover.
  - Classes in `src/ui`: `Memo` (`components/memo.ts`) is the only Preact class component, since without `preact/compat` `shouldComponentUpdate` is the one way to skip a render. Every other class subclasses an Obsidian type (`ChoresView` is an `ItemView`; `ChoreModal` and `DateModal` are `Modal`s). Any other stateful object is a closure factory, like `createRowKit`.
  - Rows are keyed by `c.path` and memoised with `sameRowProps`. An unchanged row keeps its node, focus and hover, and skips rendering. Callbacks handed to rows are created once and read current state when called, never closures built per render.
  - Imperative DOM work (`drawArt`) runs only through `useDomEffect`, with deps listing everything the effect reads. `setIcon` and `setTooltip` run only through `useIcon` and `useTooltip`, built on `useDomEffect` over the `Host` context; components never import `obsidian`.
  - Use keyed, memoised rows. The list is small enough to render within a frame without `preact/compat`, `@preact/signals` or virtualisation.
- Pattern matching: `ts-pattern` (pinned and bundled; pure, so `src/domain/` may import it) for structural matches over shaped unions, such as menu entries in `fillMenu` and block references in `blockTarget`. A flat tagged union or enum uses `switch`, kept exhaustive by `@typescript-eslint/switch-exhaustiveness-check`; ordered numeric thresholds stay as if-chains.
- State:
  - Plugin settings persisted via `loadData` / `saveData`. Loaded settings go through `parseSettings`, and the settings tab writes through `withSetting`, so both apply the same rules.
  - Recompute derived state from files and settings when needed. `ChoreIndex` mirrors the metadata cache for the chores folder and stores only facts from the notes. We should add other long-lived caches only when profiling shows a need.

## 3. Naming and file conventions

- Files: `kebab-case.ts` (e.g. `frontmatter.ts`, `chore-index.ts`, `chores-view.ts`).
- Symbols:
  - Classes / types / interfaces: `PascalCase`.
  - Functions / variables: `camelCase`.
  - Constants: `SCREAMING_SNAKE_CASE` for module-level immutable values; `camelCase` for locals.
- Exports: Named exports preferred. Default export only for the Plugin class itself (Obsidian requires it).
- Return types: Required on all exported functions.

## 4. Coding standards

- Formatting: 2 spaces for indentation (Prettier enforces, `printWidth: 100`). Semicolons omitted (Prettier semi false). Single quotes. Trailing commas where valid (`trailingComma: 'all'`). Run `npm run format` before committing; `npm run format:check` runs in CI.
- TypeScript:
  - `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` enabled.
  - No `any`. Use `unknown` and narrow.
  - `import type { ... }` for type-only imports.
- Comments & docs:
  - Default to no comments. Let names carry the meaning.
  - When a comment is warranted (non-obvious invariant, workaround, subtle edge case), write a JSDoc block (`/** ... */`) rather than stacked `//` lines.
  - Explain why the code is the way it is; the code already says what it does. Keep PR numbers, tickets and the current task out of comments, as that context dates quickly.
- Error handling:
  - Recoverable: return `null` or a typed result (e.g. `{ok: false, reason}`). Don't throw across module boundaries.
  - User-facing: surface via `Notice` for quick feedback, or a modal banner for anything the user must acknowledge. Never swallow errors silently.
- Destructive UI: Buttons that delete, remove, or overwrite must be neutral at rest and only take on destructive affordances (red border/text) on hover or keyboard focus.

## 5. Obsidian-specific guidance

Official references (authoritative):

- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Submission requirements: https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins
- Linter (most rules auto-enforced by `npm run lint`): https://github.com/obsidianmd/eslint-plugin

### Pitfalls reviewers and the linter look for

- Manifest: `id` and `name` must not include `obsidian`, and `id` must not end with `plugin`. `description` must not begin with "This plugin"/"Obsidian" and must end with terminal punctuation.
- UI text: all user-visible strings (settings, command names, modal copy, locale JSON/TS) are sentence case.
- Commands: don't include the word "command" or duplicate the plugin id in command IDs/names. Don't set default hotkeys.
- Vault I/O: use `vault.process(file, current => next)` for background rewrites and the `Editor` API for active-file edits. Use `fileManager.trashFile(file)` for deletes. Look files up with `vault.getAbstractFileByPath(path)`. Normalise all user-supplied paths with `normalizePath()`. Never touch the filesystem directly. Use `markdownFilesInFolder` (`src/vault/folder-scan.ts`) for folder scans rather than `vault.getMarkdownFiles()`, which enumerates the whole vault.
- Popout safety: use `activeWindow` / `activeDocument` (declared as ESLint readonly globals here, and allowed only outside `src/ui/components` and `src/ui/model`, which reach the document through an element's `ownerDocument`) for DOM lookups and event targets, but `window.setTimeout` / `setInterval` / `clearTimeout` / `clearInterval` for timers, since a timer owned by a popout dies when that popout closes. Bare `document` / `setTimeout` break in popout windows.
- DOM: components build DOM with JSX; imperative code (menus and toasts) builds it via Obsidian helpers (`createEl`, `createDiv`, `createSpan`). Never use `document.createElement`, `innerHTML`, `outerHTML`, `dangerouslySetInnerHTML`, or inline styles. All styling lives in `styles.css` using Obsidian CSS variables.
- Network & platform: `requestUrl()` over `fetch()`; `Platform.isMobile` over `navigator.userAgent`.
- Lifecycle: register subscriptions with `this.registerEvent / registerDomEvent / registerInterval`. Don't store view references on the plugin or call `detachLeavesOfType` in `onunload`.
- Logging: no `console.log` in `onload` / `onunload`. Use `Notice` for user feedback.
- Mobile: avoid regex lookbehind (broken on iOS < 16.4) and Node APIs. Keep `isDesktopOnly: false` unless a feature needs desktop.

### Project-specific patterns

- Notes are the only store. One note per chore; every stored fact lives in frontmatter. Last done, next due, urgency, groups and friendly dates are derived and never written back. `data.json` holds plugin settings only.
- Frontmatter contract: `type: chore` marks a chore note and only `type` and `every` are required. Keys: `every` (`<n><d|w|m|y>`), `anchor` (`done` or `calendar`), `days` (inline list of weekdays, calendar chores only; `day` is read as a one-day alias and replaced on the next schedule write; never `on`, which YAML 1.1 reads as `true`), `keep`, `early` (overrides the early ticks setting), `snoozed_until`, `done` and `skipped` (ISO dates, newest first). The note basename is the chore name; the body is free text and Choreday never writes to it.
- One path for writes and undo. Every tick, skip, snooze, history removal, edit and create goes through `createChoreActions` (`src/vault/chore-actions.ts`), which returns a label or a failure message for the UI to show and keeps the undo history. Undo puts back only the keys a change wrote, and leaves a note alone when one of those keys has changed since.
- Writes are line-level text transforms. `ChoreIndex.update` re-reads the note inside `vault.process`, applies a pure `Chore => Chore` function, and rewrites only the keys that changed (`applyChoreEdits`, which runs `choreEdits` through `fieldEdits` and `editFrontmatter`). Do not use `processFrontMatter`; it reformats the YAML and drops comments.
- Flag invalid hand-typed values for the user to fix. A malformed `every` lists the note under Needs fixing; anything else becomes a row warning. Unreadable history entries are carried through writes verbatim.
- History is trimmed on every write to the note's `keep` or the global setting.
- Mascot art is inline SVG in `src/ui/model/mascot-art.ts`, drawn by `drawArt` in `src/ui/components/art.tsx`, which gives each copy its own ids. A test holds the set to 20 KB of `main.js`.
- Menus are data. Row, dot and snooze menus are built as `MenuEntry` lists by pure builders in `src/ui/model/row-menu.ts`, which see only narrow capability interfaces (never the row kit), and drawn by one adapter, `fillMenu` in `src/ui/obsidian/menus.ts`.
- Undocumented APIs: `MenuItem.setSubmenu()` is optional on `MenuItemLike`, and `fillMenu` checks each item for it, falling back to a label and the items inline.

## 6. Development commands

- Install: `npm install`
- Dev (watch): `npm run dev`
- Build: `npm run build` (runs `tsc -noEmit` then esbuild in production mode; must complete with zero errors).
- Lint: `npm run lint` (zero warnings tolerated).
- Format: `npm run format` (check with `npm run format:check`).
- Test: `npm test` (Vitest, runs unit tests for the pure modules in `src/domain/`, the chore actions in `src/vault/`, and the pure helpers in `src/ui/`).
- Typecheck: `npm run typecheck` (`src/` and `tests/`; `build` checks `src/` only).
- Version bump: automated. Every PR must carry exactly one of the labels `major`, `minor`, `patch`, or `norelease`. On push to `main`, the Release workflow takes the highest of those labels across every PR merged since the last tag (skipping when all are `norelease`), runs `npm version` with that bump, tags the commit as bare `X.Y.Z` (no `v` prefix, so BRAT and the community registry resolve it), and publishes a GitHub release with `main.js`, `manifest.json`, and `styles.css` attached. `npm version <patch|minor|major>` still works locally for dev; it runs `version-bump.mjs` to update `manifest.json` and `versions.json`.
- Changelog: add entries to `CHANGELOG.md` under `## [Unreleased]` as part of each PR. Bullets do not carry per-bullet dates. The version heading captures the date in UTC. On merge, the Release workflow renames the `[Unreleased]` heading to `## [X.Y.Z] - YYYY-MM-DD` and inserts a fresh empty `[Unreleased]` block above it. Do not rename the heading manually.

## 7. Git commit convention

Conventional commits, sentence case, imperative mood:

- `feat:` new user-facing feature
- `fix:` bug fix
- `refactor:` internal change with no user-facing effect
- `test:` adding/updating tests
- `chore:` tooling, deps, config
- `docs:` docs only

Scope in parens is welcome when it clarifies (e.g. `feat(view): ...`). Keep subject under 72 chars. The body explains the reason for the change.

## 8. Constraints

1. Do not use em dashes in any prose or code comments. Use commas, parentheses, colons, or separate sentences.
2. Do not leave `console.log` in shipped code. Use `Notice` for user feedback and throw/return for programmatic signals.
3. Do not introduce abstractions, feature flags, or backwards-compat shims without a concrete second use case.
4. Do not add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code; validate only at system boundaries.
5. Do not leave the repo in a broken state. `npm run build` and `npm run lint` must pass before calling a task done.
6. Do not ignore warnings (ESLint, TypeScript, deprecation). Fix them in the same change.
7. Do not commit `main.js`, `node_modules`, or `data.json` (user plugin settings).
8. Do not write to a chore note's body, or store derived values in its frontmatter.
9. Do not open a PR without exactly one version label (`major`, `minor`, `patch`, or `norelease`). The `check-labels` CI gate enforces this.
10. Do not add user-visible changes without a matching entry under `## [Unreleased]` in `CHANGELOG.md`. Use `norelease` only when batching a user-invisible change into a later bump.
