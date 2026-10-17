# Contributing to Choreday

Bug reports, feature discussions and pull requests are welcome. Start with the [issue tracker](https://github.com/paulchiu/obsidian-choreday/issues) for almost everything below.

## Reporting bugs

A useful bug report includes your Obsidian and Choreday versions, the platform (desktop or mobile), and the steps that trigger the problem.

Choreday stores everything in a chore note's frontmatter. To make the problem reproducible, paste that frontmatter and the date you saw the problem. See [Chore notes](README.md#chore-notes) for the note format.

## Suggesting features

Open an issue to discuss a feature before starting a large PR. This can save rework if the direction changes.

Before suggesting a feature, check the Limitations section of [README.md](README.md). It lists known gaps, including reminders and long-term history.

## Development setup

Run `npm install`, then `npm run dev` to start esbuild in watch mode. Each change produces `main.js` next to `manifest.json` at the repo root.

To see your changes in Obsidian, symlink `main.js`, `manifest.json`, and `styles.css` from the repo root into `<vault>/.obsidian/plugins/choreday/`. After each build, reload Obsidian or toggle the plugin off and on. See [Development](README.md#development) in the README for details.

## Coding standards

[AGENTS.md](AGENTS.md) is the source of truth for this repo's conventions, including file layout, naming, error handling and Obsidian-specific pitfalls. Read it before making non-trivial changes. These points are especially relevant to small contributions:

- The codebase is TypeScript, and Prettier formatting is enforced (`npm run format`).
- `src/` is layered. `src/domain/` holds pure modules with no `obsidian` imports. `src/vault/` holds Obsidian-aware helpers that may depend on `src/domain/` but not `src/ui/`. `src/ui/` is split into `components/` (pure Preact, no `obsidian` import), `model/` (pure TypeScript) and `obsidian/` (shells and adapters, the only folder that imports `obsidian`). ESLint enforces these boundaries. Put new code in the right tier.
- Vault access goes through Obsidian's Vault API (`vault.process`, `fileManager.renameFile`, and so on), never the filesystem directly. Frontmatter writes are line-level text edits so hand formatting survives; see AGENTS.md.

## Tests and the local gate

Before pushing, make sure `npm test`, `npm run lint` and `npm run format` pass. Vitest covers the pure modules in `src/domain/`, the chore actions in `src/vault/chore-actions.ts` (using an in-memory store), the UI modules that run without Obsidian (`src/ui/model/` and `keys`), and the keyboard focus rings in `styles.css`. Tests under `tests/` mirror the source tiers.

Component tests run under happy-dom with the Obsidian stubs in `tests/stubs/`. They cover the Chores view, its rows, the `choreday` code block, and the chore and date modals through the `obsidian` stub's `Modal`. These components draw with Preact. The tests check the rendered DOM, that rows keep their nodes and focus as the list updates, and that closing the view or unloading the block leaves nothing mounted or subscribed. happy-dom is pinned to an exact version because snapshots depend on how it serialises attributes and styles.

Menus, popouts, mobile and the vault itself depend on the Obsidian runtime. Verify them manually against a dev vault.

## Pull requests

Use a conventional commit style for the PR title (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`, with an optional scope). Keep one logical change per PR.

Every PR needs exactly one release label: `major`, `minor`, `patch`, or `norelease`. On merge to `main`, the Release workflow reads that label to decide the version bump: `major`, `minor`, and `patch` map to the matching `npm version` bump, and `norelease` skips the version bump and the GitHub release. Pick `norelease` for changes with no user-facing effect; use one of the others for anything that should ship in the next release.

## Licence

By contributing, you agree that your contribution is licensed under this repository's MIT licence.
