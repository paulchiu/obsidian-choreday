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
