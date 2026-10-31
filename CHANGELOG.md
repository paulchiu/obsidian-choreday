# Changelog

This file documents notable changes to the project.

The format is based on [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Pick for today shows a few chores picked by most overdue, most recently done, done most often or at random, and hides the rest until tomorrow. Every morning saves the choice so each day opens picked.
- Search lists every chore whose name matches, from all groups, tagged with its group.

### Changed

- The Chores view is headed with today's date, and its top buttons are icons with tooltips.
- The first-run message no longer repeats the word chore.

### Fixed

### Removed

## [1.0.9] - 2026-10-18

### Added

### Changed

### Fixed

### Removed

## [1.0.8] - 2026-10-17

### Added

### Changed

### Fixed

- When picking set days switches the chore form's Every unit to weeks, the dropdown now resizes to fit instead of keeping its previous width.
- Undo now follows renamed and deleted chore notes without affecting a different chore that reuses the old path.
- Stale chore writes now fail when their note is no longer a chore.
- Changing the chores folder during a pending debounce now leaves the view showing one folder consistently.
- The New and Edit chore forms now prevent repeated saves and editing while a save is pending.

### Removed

## [1.0.7] - 2026-10-16

### Added

### Changed

### Fixed

- Undoing a tick while its row is still settling now keeps keyboard focus on that row's check, instead of moving it to the next chore, because the row no longer leaves Needs doing for a moment before the note is re-read.

### Removed

## [1.0.6] - 2026-10-16

### Added

### Changed

### Fixed

- The Chores view now updates rows in place. A row under the pointer keeps its hover, an expanded history strip no longer flickers, and keyboard focus stays on the same control when another chore changes.

### Removed

## [1.0.5] - 2026-10-15

### Added

### Changed

### Fixed

- A chore that has never been done no longer shows a red bar while its due date is still ahead, so the bar now agrees with its due label.
- A chore that has never been done now shows its due date on hover like any other chore, including the "hidden until" date while it is snoozed.

### Removed

## [1.0.4] - 2026-10-15

### Added

### Changed

### Fixed

- Typing a new chores folder in settings no longer flashes "No chores yet" in the Chores view with each keystroke. Choreday rescans when you pause typing. Changing History to keep or Early ticks count, or setting a value it already has, no longer rescans the folder.

### Removed

## [1.0.3] - 2026-10-15

### Added

### Changed

### Fixed

- Ticking a chore from the keyboard in the Chores view no longer drops focus to the page when its row moves to another group. Focus moves to the next tick box in the same group, the previous one if the ticked row was last, or the next group's heading if the group is now empty.
- Select all and Clear now show a focus ring, and the tick box, rows and Later toggle draw theirs in the accent colour so they stand out on dark themes.
- Pressing Enter on Select now puts focus on Cancel, and leaving select mode with Cancel or Skip puts it back on Select. Escape now leaves select mode.
- Changing a chore on set days to repeat in months, days or years in the New or Edit chore form now shows Schedule as "After last done", the schedule Save writes, instead of leaving "On set days" showing. Switching back to weeks, or picking "On set days" again, in the same form brings back its set days and interval.
- Picking "On set days" for a chore that repeats in months, days or years, with no set days to bring back, now shows Every as 1 weeks, the interval Save writes.
- Ticking a chore that is already done that day, such as from a `choreday` block, now says it was already done and adds no undo step. The next Undo therefore takes back the previous change instead of reporting "Undone" while leaving the tick in place. A skip, snooze or history removal that changes nothing also says the chore was already that way and adds no undo step. For a partial change, Undo names and restores only the chores that changed.

### Removed

## [1.0.2] - 2026-10-15

### Added

### Changed

### Fixed

- Undo now puts back only what that change wrote, so a later edit to the chore, such as a new schedule, survives it. If what the change wrote has changed since, for example by a tick synced from another device, Undo leaves the note alone and says so instead of reporting "Undone".
- Undo follows a chore note renamed after the change, and no longer reports "Undone" when the note is gone or the write fails.
- Undo with Mod+Z, the view menu or the Undo last change command now unticks a row straight away, as the toast's Undo already did, instead of leaving it struck through for a moment.
- Ticking a chore whose note cannot be read or written now says so, instead of showing "done today" with nothing recorded.
- A tick straight after the device wakes or the app resumes now records today rather than yesterday, and the Chores view moves on to the new day when the app comes back.
- Creating a chore, or renaming one in Edit, to a name already taken in a different case now says so and keeps the form open. Any other failure to create, rename or save a chore shows a notice and keeps the form open, instead of closing it with nothing said.
- A setting in Choreday's `data.json` that is missing, of the wrong type or out of range, such as a hand-edited History to keep of 0, now falls back to its default. A History to keep of 0 used to wipe a chore's history on its next tick.
- A chore note with `day: tuesday` and no `anchor` is now a chore on set days, the same as `days: [tuesday]`, instead of counting from the last done date.
- Changing a chore on set days to repeat in months, days or years in Edit now removes its `days` from the note, instead of leaving them behind.

### Removed

## [1.0.1] - 2026-10-15

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
