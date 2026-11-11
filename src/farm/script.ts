// Movement scripts: a person walks a list of steps — go to a point, wait (facing a way, in a pose) — one after another
// (the shoppers in the market, the manager leaving it, the contractor coming and going). Not saved: the steps are
// only what is seen; what a shopper bought is already in the till when they set off to pay.
//
// The ways themselves are made here from the market's row (src/data/market.ts): the path in from the lane, the browse
// spots, the pay spot and the line behind it, the manager's place, the contractor's window, and the lane's ends.

import { BROWSE_SPOTS, CABIN, CONTRACTOR_SPOT, COUNTER, INNER_DOOR, ISLAND, MANAGER_SPOT, MARKET_PATH, PAY_SPOT, PAY_STEP, DESK } from '../data/market'
import { dampAngle } from '../lib/damp'
import { LANE_ENDS, SHOP, WALK_Z } from './data'

export type Pose = 'stand' | 'browse' | 'pay' | 'wave'

/** One step: walk to a point; or wait there `wait` seconds, facing `face`, in a pose. */
export type Step = { to: { x: number; z: number } } | { wait: number; face?: number; pose?: Pose }

/** A person on a script: where they are, the way they face, and how far along their steps. */
export interface Walker {
  x: number
  z: number
  heading: number
  steps: Step[]
  /** the step they are on, and the seconds spent waiting on it */
  at: number
  waited: number
  walking: boolean
  pose: Pose
}

/** How fast a walker turns to face the way it goes (per second, as the buyers at the gate turn). */
const TURN = 8

/** Moves a walker along its steps for `dt` seconds at `speed` m/s; whether it has done its last step. A long `dt` goes
 *  through as many steps as it covers (time away, a page that was hidden), so the same seconds in one call or in many
 *  end in the same place. */
export function stepScript(w: Walker, dt: number, speed: number): boolean {
  let left = dt > 0 ? dt : 0
  // every step is either done (and passed) or takes the time left: the guard only stops a list gone wrong
  for (let guard = 0; guard < 1000 && w.at < w.steps.length; guard++) {
    const s = w.steps[w.at]
    if ('to' in s) {
      const dx = s.to.x - w.x
      const dz = s.to.z - w.z
      const d = Math.hypot(dx, dz)
      if (!(d > 1e-6)) {
        next(w)
        continue
      }
      if (!(left > 0)) break
      w.walking = true
      w.pose = 'stand'
      const reach = speed * left
      if (reach >= d) {
        w.heading = dampAngle(w.heading, Math.atan2(dx, dz), TURN, d / speed)
        w.x = s.to.x
        w.z = s.to.z
        left -= d / speed
        next(w)
      } else {
        w.heading = dampAngle(w.heading, Math.atan2(dx, dz), TURN, left)
        w.x += (dx / d) * reach
        w.z += (dz / d) * reach
        left = 0
      }
    } else {
      w.walking = false
      w.pose = s.pose ?? 'stand'
      const need = Math.max(0, s.wait - w.waited)
      // turning to face the way given while it waits: facing it once the wait is over
      if (s.face !== undefined) w.heading = left >= need ? s.face : dampAngle(w.heading, s.face, TURN, left)
      if (left >= need) {
        left -= need
        next(w)
      } else {
        w.waited += left
        left = 0
      }
      if (!(left > 0) && w.at < w.steps.length) break
    }
  }
  const done = w.at >= w.steps.length
  if (done) w.walking = false
  return done
}

function next(w: Walker) {
  w.at++
  w.waited = 0
}

/** A walker standing at a point, about to walk these steps. */
export function walker(x: number, z: number, heading: number, steps: Step[]): Walker {
  return { x, z, heading, steps, at: 0, waited: 0, walking: false, pose: 'stand' }
}

// ───────────────────────────── the ways ─────────────────────────────

type Point = { x: number; z: number }
const to = (p: Point): Step => ({ to: { x: p.x, z: p.z } })

/** Where people walk past on the lane, at either end of it (0: the west, 1: the east). */
export const laneEnd = (side: 0 | 1): Point => ({ x: LANE_ENDS[side], z: WALK_Z })
/** The lane, the doorstep and just inside the front door. */
const [LANE, OUTSIDE, INSIDE] = MARKET_PATH

// Ways through the hall that keep a person's body clear of the counter, the shelves and the island (worked out from
// their boxes in src/data/market.ts). TODO(lead): these could be rows of src/data/market.ts beside MARKET_PATH.
/** The hall's middle: south of the pay line, north of the shelves along the south wall. */
const MIDDLE: Point = { x: COUNTER.x0 + 0.2, z: (PAY_SPOT.z + BROWSE_SPOTS[0].z) / 2 + 0.1 }
/** Just west of the counter's end, on the way out from paying. */
const BY_COUNTER: Point = { x: COUNTER.x0 - 0.4, z: PAY_SPOT.z + 0.15 }
/** West of the island, at a spot's own depth: the way round it to the spots on its faces. */
const besideIsland = (z: number): Point => ({ x: ISLAND.x0 - 0.5, z })
const pastIsland = (p: Point) => p.x > ISLAND.x0 - 0.5
/** The doorway between the hall and the manager's room, a step either side of it, and the way round his desk. */
const DOOR_X = (INNER_DOOR.x0 + INNER_DOOR.x1) / 2
const BACK_SIDE: Point = { x: DOOR_X, z: INNER_DOOR.z1 + 0.3 }
const HALL_SIDE: Point = { x: DOOR_X, z: INNER_DOOR.z0 - 0.4 }
const ROUND_DESK: Point = { x: DESK.x1 + 0.5, z: MANAGER_SPOT.z }
/** The contractor's way out of his cabin (its north side, towards the lane) and the corner of the lot beside it. TODO(lead): a
 *  door in the cabin's north side at this x (src/models/market.ts). */
const CABIN_DOOR: Point = { x: CONTRACTOR_SPOT.x, z: CABIN.z0 - 0.2 }
const CORNER: Point = { x: CABIN.x1 + 0.5, z: CABIN.z0 - 0.75 }

/** Where the k-th of those paying stands: the first at the counter, the rest behind to the east, facing up the line. */
export const payPlace = (k: number) => ({ x: PAY_SPOT.x + k * PAY_STEP, z: PAY_SPOT.z, heading: k === 0 ? PAY_SPOT.heading : -Math.PI / 2 })

/** A shopper's way in (they start at a lane end): through the front door to their browse spot, then a browse there. */
export function shopperIn(spot: number): Step[] {
  const s = BROWSE_SPOTS[spot]
  return [to(LANE), to(OUTSIDE), to(INSIDE), to(MIDDLE), ...(pastIsland(s) ? [to(besideIsland(s.z))] : []), to(s), { wait: SHOP.browse, face: s.heading, pose: 'browse' }]
}

/** From their browse spot to their place in the line (`ahead`: how many pay before them), a wait while those ahead
 *  pay, then paying at the counter. */
export function shopperPay(spot: number, ahead: number): Step[] {
  const s = BROWSE_SPOTS[spot]
  const place = payPlace(ahead)
  const front = payPlace(0)
  const queue: Step[] = ahead > 0 ? [{ wait: ahead * SHOP.pay, face: place.heading }, to(front)] : []
  return [...(pastIsland(s) ? [to(besideIsland(s.z))] : []), to(place), ...queue, { wait: SHOP.pay, face: front.heading, pose: 'pay' }]
}

/** Out of the shop to a lane end: from the counter (`paid`), or from their browse spot (nothing they wanted). */
export function shopperOut(spot: number, paid: boolean, side: 0 | 1): Step[] {
  const s = BROWSE_SPOTS[spot]
  const inside: Step[] = paid ? [to(BY_COUNTER)] : [...(pastIsland(s) ? [to(besideIsland(s.z))] : []), to(MIDDLE)]
  return [...inside, to(INSIDE), to(OUTSIDE), to(LANE), to(laneEnd(side))]
}

/** The manager, once the shop is yours: a wave goodbye, then through the doorway, out of the front door, down the lane. */
export function managerLeaves(): Step[] {
  return [{ wait: 2, face: MANAGER_SPOT.heading, pose: 'wave' }, to(ROUND_DESK), to(BACK_SIDE), to(HALL_SIDE), to(INSIDE), to(OUTSIDE), to(LANE), to(laneEnd(1))]
}

/** The contractor at night: a wave, out of his cabin to the lane, and off to its east end. */
export function contractorLeaves(): Step[] {
  return [{ wait: 2, face: CONTRACTOR_SPOT.heading, pose: 'wave' }, to(CABIN_DOOR), to(CORNER), to({ x: CORNER.x, z: WALK_Z }), to(laneEnd(1))]
}

/** The contractor in the morning: from the lane's east end back to his window. */
export function contractorComes(): Step[] {
  return [to({ x: CORNER.x, z: WALK_Z }), to(CORNER), to(CABIN_DOOR), to(CONTRACTOR_SPOT), { wait: 0.5, face: CONTRACTOR_SPOT.heading }]
}

/** The seconds a whole script takes at `speed`, from (x, z). */
export function scriptSeconds(x: number, z: number, steps: Step[], speed: number): number {
  let t = 0
  let at = { x, z }
  for (const s of steps) {
    if ('to' in s) {
      t += Math.hypot(s.to.x - at.x, s.to.z - at.z) / speed
      at = s.to
    } else t += s.wait
  }
  return t
}

/** The seconds a walker still has to go on its steps, from where it is now. */
export const secondsLeft = (w: Walker, speed: number) => Math.max(0, scriptSeconds(w.x, w.z, w.steps.slice(w.at), speed) - w.waited)
