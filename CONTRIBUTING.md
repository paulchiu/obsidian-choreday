# Contributing to Choreday

Bug reports, feature discussion, and pull requests are welcome. The issue tracker is at [github.com/paulchiu/obsidian-choreday/issues](https://github.com/paulchiu/obsidian-choreday/issues); that is the place to start for almost everything below.

## Reporting bugs

A useful bug report includes your Obsidian version, your Choreday version, and the platform you hit it on (desktop or mobile), along with the steps that trigger it.

Choreday stores everything in a chore note's frontmatter, so the fastest way to give a reproducible case is usually to paste that frontmatter and the date you saw the problem on, rather than describing it in prose. See [Chore notes](README.md#chore-notes) for the shape of a chore note.

## Suggesting features

Open an issue to discuss a feature before putting together a large PR. It saves rework if the direction needs to change.

Before suggesting something, check the Limitations section of [README.md](README.md). Several known gaps (e.g. no reminders, no long-run history) are listed there deliberately.

## Development setup

Run `npm install`, then `npm run dev` to start esbuild in watch mode. It emits `main.js` next to `manifest.json` at the repo root on every change.

To see your changes inside Obsidian, symlink `main.js`, `manifest.json`, and `styles.css` from the repo root into `<vault>/.obsidian/plugins/choreday/`, then reload Obsidian (or toggle the plugin off and on) after each build. See the [Development](README.md#development) section of the README for the full details.

## Coding standards

[AGENTS.md](AGENTS.md) is the source of truth for conventions in this repo: file layout, naming, error handling, and the Obsidian-specific pitfalls reviewers look for. Read it before making non-trivial changes. A few points matter most for a drive-by contribution:

- The codebase is TypeScript, and Prettier formatting is enforced (`npm run format`).
- `src/` is layered: `src/domain/` holds pure modules with no `obsidian` imports, `src/vault/` holds Obsidian-aware helpers that may depend on `src/domain/` but not `src/ui/`, and `src/ui/` holds the views and modals that may depend on anything. Keep new code in the right tier.
- Vault access goes through Obsidian's Vault API (`vault.process`, `fileManager.renameFile`, and so on), never the filesystem directly. Frontmatter writes are line-level text edits so hand formatting survives; see AGENTS.md.

## Tests and the local gate

Before pushing, `npm test`, `npm run lint`, and `npm run format` must all pass. Vitest covers the pure modules in `src/domain/`, the chore actions in `src/vault/chore-actions.ts` (run against an in-memory store), and the UI helpers in `src/ui/` that run without Obsidian (`keys`, `mascot-art`, `svg-ids`, `chore-form-controls`), and the keyboard focus rings in `styles.css`, with tests under `tests/` mirroring the source tiers. Component tests cover the Chores view, its rows and the `choreday` code block, which draw with Preact, under happy-dom with the Obsidian stubs in `tests/stubs/` (happy-dom is pinned to an exact version because those snapshots depend on how it serialises attributes and styles): the rendered DOM, that rows keep their nodes and focus as the list updates, and that closing the view or unloading the block leaves nothing mounted or subscribed. Menus, popouts, mobile and the vault itself depend on the Obsidian runtime, so they are verified manually against a dev vault.

## Pull requests

Use a conventional commit style for the PR title (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`, with an optional scope). Keep one logical change per PR.

Every PR needs exactly one release label: `major`, `minor`, `patch`, or `norelease`. On merge to `main`, the Release workflow reads that label to decide the version bump: `major`, `minor`, and `patch` map to the matching `npm version` bump, and `norelease` skips the version bump and the GitHub release. Pick `norelease` for changes with no user-facing effect; use one of the others for anything that should ship in the next release.

## Licence

By contributing, you agree that your contribution is licensed under this repository's MIT licence.
