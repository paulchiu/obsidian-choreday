# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

- After missed days, a calendar chore is due on the latest missed day rather than the oldest, so one tick or one skip clears them all.
- The history line for calendar chores counts the scheduled days since the oldest kept tick.

### Fixed

### Removed
