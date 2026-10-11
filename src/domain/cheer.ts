import type { Day } from './day'

export interface CheerState {
  armed: boolean
  play: boolean
}

/**
 * Steps the last-tick cheer once per render, given whether each row left in Needs doing is still
 * settling from a tick. Arming only while every row left is settling keeps a group that was already
 * empty, on opening or after a date rollover, from cheering.
 */
export const cheerStep = (armed: boolean, needs: readonly boolean[]): CheerState =>
  needs.length ? { armed: needs.every(Boolean), play: false } : { armed: false, play: armed }

const CAUGHT_UP = [
  'All caught up. Put your feet up.',
  "That's the lot. Pop the kettle on.",
  'Done and dusted for today.',
  'Not a chore in sight. Nap time.',
  'All squared away. Off you go.',
  'Clean slate. Go do something fun.',
  "You're on top of it. Nice one.",
  'Spick and span. Take five.',
  'Nothing left today. The cat approves.',
  'Chores: none. Cat naps: one.',
  'All clear. Enjoy the quiet.',
  'House in order. Treat yourself.',
] as const

/** The line under the sleeping cat when Needs doing is empty, picked by day so it holds until tomorrow. */
export const caughtUpLine = (today: Day): string =>
  CAUGHT_UP[today % CAUGHT_UP.length] ?? CAUGHT_UP[0]
