# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A `choreday` block can name a chore by its folder, such as `chore: Kitchen/Clean`, to pick one of several chores with the same name.

### Changed

- Tighter wording in the README, the install guide, and the plugin description, which now reads "plain Markdown notes".

### Fixed

- The Chores view and `choreday` blocks now work from the keyboard. Enter or Space ticks a chore, opens or closes a row, Later or Select all, and opens a Needs fixing note; the menu key or Shift+F10 opens a row's menu. Focus stays put when the list redraws.
- Hovering a dot in a chore's history strip no longer flickers.
- A snooze ending exactly a week out now shows its date, so it no longer reads as ending later today.
- A chore that has never been done but is not due yet now shows its first due date in its summary instead of "due now".
- A monthly or yearly chore done twice within a month now shows its rhythm in days, such as "usually every 7 days (set to 1 month)", instead of "usually every 0 months".
- A done date set in the future now shows that date as the last done, instead of "today".
- A due date two years or more out now reads in years, such as "in 2 years", instead of "in 24 months".
- Hand-typed history entries that aren't dates, such as `"*"` or `"# moved in"`, are written back quoted, so a tick no longer breaks the note's frontmatter or turns an entry into a comment.
- Removing or trimming history in a list with a blank line between entries now rewrites the whole list, so the removal sticks.
- A key Choreday adds, such as `snoozed_until`, now goes above a comment that labels the next key rather than between them.
- "Done on" with a date older than the kept history now says the date was not recorded, rather than reporting success and writing nothing.
- A `choreday` block naming a chore that several notes share now lists those notes instead of switching between them after each tick, which could record the next tick in the wrong note.
- Saving a note that is not a chore no longer redraws the Chores view and every `choreday` block, which restarted animations and dropped tooltips while typing.
- Creating a chore with the chores folder set to the vault root no longer also creates an empty folder named after the chore.

### Removed

## [1.0.0] - 2026-10-14

### Added

### Changed

- First stable release: the feature set and the chore note format are settled, and later changes to the note format will follow semantic versioning.
- The README demo is a new animated walkthrough of the main features, presented by Dewey, the Choreday cat.

### Fixed

### Removed

## [0.7.1] - 2026-10-11

### Added

### Changed

### Fixed

- A set-days chore whose oldest tick was done late no longer skips a scheduled day: that tick now counts for the day it was late for, and a first tick done the day before a scheduled day still counts early for it.

### Removed

## [0.7.0] - 2026-10-11

### Added

### Changed

- With nothing left to do, the sleeping cat sits above a cheerful line that changes each day, in place of 'Nothing needs doing.'
- The collapsed Later summary stays on one line and ends in an ellipsis when its chores don't fit.

### Fixed

### Removed

## [0.6.1] - 2026-10-10

### Added

### Changed

- The sleeping cat shown when nothing needs doing has a zzZ above it instead of a heart.

### Fixed

### Removed

## [0.6.0] - 2026-10-10

### Added

- A grey tabby mascot for the Chores view's empty states: a sleeping cat when nothing needs doing, a cat with a blank clipboard before the first chore, and a cheering cat with confetti for the tick that empties Needs doing (skipped under reduced motion). A puzzled cat head marks Needs fixing and a `choreday` code block that can't find its chore, and the ribbon and view icon is now a cat head.

### Changed

### Fixed

### Removed

## [0.5.0] - 2026-10-10

### Added

- Undo last change, in the Chores view's more options menu, the command palette and Mod+Z in the Chores view, steps back through this session's last 20 ticks, snoozes, skips and removed history entries after their toast has gone.

### Changed

### Fixed

### Removed

## [0.4.2] - 2026-10-10

### Added

### Changed

### Fixed

- On iOS, expanding Later, opening a row, ticking or selecting no longer jumps the Chores view back to the top.

### Removed

## [0.4.1] - 2026-10-10

### Added

### Changed

### Fixed

- On phones, the end of the chores list can now scroll clear of Obsidian's floating navigation bar.

### Removed

## [0.4.0] - 2026-10-10

### Added

- Snooze or skip several chores at once: select Select in the Chores view (or in a row's menu), pick chores or a whole group with Select all, then Snooze or Skip. One Undo restores them all.

### Changed

### Fixed

### Removed

## [0.3.1] - 2026-10-10

### Added

### Changed

### Fixed

- Snooze options no longer run into their dates ('TomorrowSun 11 Oct') when Obsidian uses native menus, the macOS default.

### Removed

## [0.3.0] - 2026-10-10

### Added

- A chore note can override the Early ticks count setting with `early: true` or `early: false`.

### Changed

### Fixed

### Removed

## [0.2.0] - 2026-10-10

### Added

- Calendar chores can repeat on several weekdays with a `days` list, such as `days: [monday, wednesday, friday]`, every week or every few weeks. `day` is still read.
- New chore and Edit pick days with weekday chips plus Weekdays, Weekends and Every day shortcuts.
- An Early ticks count setting (on by default): a tick before the next scheduled day counts for that day.
- The history strip marks missed scheduled days.

### Changed

- After missed days, a calendar chore is due on the latest missed day rather than the oldest, so one tick or one skip clears them all.
- The history line for calendar chores counts the scheduled days since the oldest kept tick.

### Fixed

### Removed

## [0.1.0] - 2026-10-10

### Added

- A Chores view (ribbon icon or `Open chores`) that groups chores into Needs doing, sorted by how overdue they are relative to their interval, Coming up within two weeks, and a collapsed Later list.
- One-tap done from the row's check circle, with a short-lived Undo toast. The row stays in place, struck through, for a moment before it re-sorts.
- A row menu (right-click, or long-press on mobile) with Done today, Done yesterday, Done on a picked date, Snooze (tomorrow, a preset scaled to the interval, next weekend, or a picked date), Skip this time, Edit, and Open note.
- Expanding a row shows a history strip of completions, skips, the due date and any late stretch, with a fact line comparing the real rhythm to the set interval. Clicking a dot on the strip removes that entry.
- Two schedule modes: after last done (`anchor: done`, the default) and a fixed weekday (`anchor: calendar` with `day`).
- `New chore` and Edit forms, with a preview of how an edit moves the next due date. Renaming a chore renames its note.
- A `choreday` code block that renders one chore's row with its strip open. Left empty, it shows the note it sits in; `chore: <name>` shows another chore.
- Settings for the chores folder (default `Chores`) and how many completions to keep per chore (default 12). A chore note can override the limit with `keep`.
- Chore notes with an unreadable `every` are listed under Needs fixing; other malformed values show as a warning on the row and are left untouched in the note.

### Changed

### Fixed

### Removed
