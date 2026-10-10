export interface CheerState {
  armed: boolean
  cheer: boolean
}

/**
 * Steps the last-tick cheer on each render of the Chores view. `needs` says, for each row left in
 * Needs doing, whether it is still settling from a tick. The cheer arms while every row left is
 * settling, and plays on the render that then finds the group empty, so a group that is already
 * empty when the view opens or the date rolls over never cheers.
 */
export const cheerStep = (armed: boolean, needs: readonly boolean[]): CheerState =>
  needs.length ? { armed: needs.every(Boolean), cheer: false } : { armed: false, cheer: armed }
