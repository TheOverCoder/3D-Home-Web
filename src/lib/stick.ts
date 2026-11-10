import { create } from 'zustand'
import { useSettings } from '../settings'
import { useHome } from '../store'
import { lookedAt, turnBy, turning } from './look'

// The touch screen's ways of moving, beside the stick (src/ui/TouchControls.tsx draws them, src/scene/Player.tsx reads
// them every frame): the stick's quiet middle and its run ring, walking on by itself, turning round, and the view that
// turns towards where you walk.

/** Pushed past this share of its reach the stick runs (the ring on its base shows where); inside DEAD it does nothing
 *  yet (a thumb settling on it). */
export const RUN_AT = 0.8
export const DEAD = 0.14

interface StickState {
  /** walking on by itself, straight ahead: until you take the stick, use something, open a panel or walk into a wall */
  cruise: boolean
  setCruise: (on: boolean) => void
}
export const useStick = create<StickState>()((set) => ({ cruise: false, setCruise: (cruise) => set({ cruise }) }))

/** Where the touch controls are, for what has to keep clear of them (the tag on a thing): the boxes they take in the
 *  bottom corners, and how high the prompt reaches above the bottom edge, in CSS pixels. TouchControls keeps it. */
export const touchLayout = { left: { w: 0, h: 0 }, right: { w: 0, h: 0 }, prompt: 0 }

/** Turns the third-person camera round you (radians, positive to the left); the camera sets it. */
export const orbit: { turn: ((yaw: number, smooth: boolean) => void) | null } = { turn: null }

/** Half a turn, eased: the view in first person, the camera round you in third. */
export function turnRound() {
  if (useHome.getState().view === 'third') orbit.turn?.(Math.PI, true)
  else turnBy(Math.PI)
}

const FOLLOW_RATE = 1.0 // radians a second for each radian the stick leans off straight ahead
const STRAIGHT = 0.14 // a thumb this far off straight ahead (about 8°) does not turn the view
const BACK_FROM = 1.75 // pushed back past 100° the view turns less and less…
const BACK_TO = 2.36 // …and not at all past 135°: walking backwards keeps the view
const follow = { rate: 0 }

/**
 * The view that turns towards where you walk (the button beside the stick, `followMove` in the settings): how far to
 * turn it this frame, radians, positive to the left, from the stick (x to the right, y ahead). It eases in and out,
 * turns faster the more the stick leans to a side (at most about 80° a second), never while the stick points back
 * (walking backwards keeps the view), and waits while you turn the view yourself or the game turns you to something.
 */
export function followTurn(x: number, y: number, moving: boolean, dt: number) {
  let want = 0
  if (useSettings.getState().followMove && moving && Math.hypot(x, y) > DEAD && !turning() && performance.now() - lookedAt.time > 400) {
    const a = Math.atan2(x, y) // 0 straight ahead, positive to the right
    const off = Math.abs(a)
    const back = Math.min(1, Math.max(0, (BACK_TO - off) / (BACK_TO - BACK_FROM)))
    want = -Math.sign(a) * Math.max(0, Math.min(off, Math.PI / 2) - STRAIGHT) * FOLLOW_RATE * back
  }
  follow.rate += (want - follow.rate) * (1 - Math.exp(-dt / 0.18))
  if (want === 0 && Math.abs(follow.rate) < 1e-3) follow.rate = 0
  return follow.rate * dt
}
