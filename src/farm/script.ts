// Movement scripts: a person walks a list of steps — go to a point, wait (facing a way, in a pose) — one after another
// (the shoppers in the market, the manager leaving it, the contractor and the estate agent coming and going). Not
// saved: the steps are only what is seen; what a shopper bought is already in the till when they set off to pay.
//
// The ways themselves are made here from the market's row (src/data/market.ts): the path in from the lane, the browse
// spots, the pay spot and the line behind it, the manager's place, the contractor's window, and the lane's ends; and
// from the estate office's (src/data/estate.ts): its door, the way round the agent's desk, his chair.

import { BROWSE_SPOTS, CABIN, CAFE_SEATS, CAFE_TABLES, CONTRACTOR_SPOT, COUNTERS, CROSS_Z, INNER_DOOR, MANAGER_SPOT, MARKET_PATH, PAY_SPOTS, PAY_STEP, DESK } from '../data/market'
import { AGENT_SEAT, ESTATE_DESK, ESTATE_PATH } from '../data/estate'
import { dampAngle } from '../lib/damp'
import { LANE_ENDS, SHOP, WALK_Z } from './data'

export type Pose = 'stand' | 'browse' | 'pay' | 'wave' | 'sit'

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

// Ways through the hall that keep a person's body clear of the counters, the gondolas and the café (worked out from
// their boxes in src/data/market.ts): in from the door to the hall's north-west, along the cross aisle to an aisle's
// top, and down it to a browse spot.
/** In the hall's north-west, past the first counter's west end, south of the pay line. */
const MIDDLE: Point = { x: 7.6, z: 18.6 }
/** The top of the aisle a point is in (on the cross aisle). */
const aisleTop = (p: Point): Point => ({ x: p.x, z: CROSS_Z })
/** Just west of a checkout's counter, on the way out from paying. */
const byCounter = (till: number): Point => ({ x: COUNTERS[till].x0 - 0.4, z: PAY_SPOTS[till].z + 0.2 })
/** The doorway between the hall and the manager's room, a step either side of it, and the way round his desk. */
const DOOR_X = (INNER_DOOR.x0 + INNER_DOOR.x1) / 2
const BACK_SIDE: Point = { x: DOOR_X, z: INNER_DOOR.z1 + 0.3 }
const HALL_SIDE: Point = { x: DOOR_X, z: INNER_DOOR.z0 - 0.4 }
/** The aisle the doorway opens on, at the cross aisle. */
const DOOR_AISLE: Point = { x: DOOR_X, z: CROSS_Z }
const ROUND_DESK: Point = { x: DESK.x1 + 0.5, z: MANAGER_SPOT.z }
/** The contractor's way out of his cabin, through the door in its north side (towards the lane: CABIN_DOOR in
 *  src/models/market.ts), and the corner of the lot beside it. */
const CABIN_DOOR: Point = { x: CONTRACTOR_SPOT.x, z: CABIN.z0 - 0.2 }
const CORNER: Point = { x: CABIN.x1 + 0.5, z: CABIN.z0 - 0.75 }

/** Where the k-th of those paying at checkout `till` stands: the first at the counter, the rest behind to the east,
 *  facing up the line. */
export const payPlace = (k: number, till = 0) => ({ x: PAY_SPOTS[till].x + k * PAY_STEP, z: PAY_SPOTS[till].z, heading: k === 0 ? PAY_SPOTS[till].heading : -Math.PI / 2 })

/** A shopper's way in (they start at a lane end): through the front door, along the cross aisle and down their aisle to
 *  their browse spot, then a browse there. */
export function shopperIn(spot: number): Step[] {
  const s = BROWSE_SPOTS[spot]
  return [to(LANE), to(OUTSIDE), to(INSIDE), to(MIDDLE), to(aisleTop(s)), to(s), { wait: SHOP.browse, face: s.heading, pose: 'browse' }]
}

/** From their browse spot up their aisle to their place in checkout `till`'s line (`ahead`: how many pay there before
 *  them), a wait while those ahead pay, then paying at the counter. */
export function shopperPay(spot: number, ahead: number, till = 0): Step[] {
  const s = BROWSE_SPOTS[spot]
  const place = payPlace(ahead, till)
  const front = payPlace(0, till)
  const queue: Step[] = ahead > 0 ? [{ wait: ahead * SHOP.pay, face: place.heading }, to(front)] : []
  return [to(aisleTop(s)), to({ x: place.x, z: CROSS_Z }), to(place), ...queue, { wait: SHOP.pay, face: front.heading, pose: 'pay' }]
}

/** Café seat `seat` (src/data/market.ts, CAFE_SEATS) from the checkout: west of its table, from the cross aisle; east of
 *  it, round the tables' south side and up between them and the coffee counter. */
function toSeat(seat: number): Step[] {
  const c = CAFE_SEATS[seat]
  const t = CAFE_TABLES[Math.floor(seat / 2)]
  const west = c.x < t.x
  const south = CAFE_TABLES[CAFE_TABLES.length - 1].z + CAFE_TABLES[0].r + 0.35
  const lane = c.x + 0.4
  return west
    ? [to({ x: c.x - 0.35, z: CROSS_Z }), to({ x: c.x - 0.35, z: c.z }), to(c)]
    : [to({ x: c.x - 1.5, z: CROSS_Z }), to({ x: c.x - 1.5, z: south }), to({ x: lane, z: south }), to({ x: lane, z: c.z }), to(c)]
}

/** A shopper who has paid at checkout `till` sits a while in the café, at seat `seat` (life only: the till has their
 *  coins already). */
export function shopperSit(seat: number, till: number): Step[] {
  const c = CAFE_SEATS[seat]
  return [to({ x: PAY_SPOTS[till].x, z: CROSS_Z }), ...toSeat(seat), { wait: SHOP.cafe.seconds, face: c.heading, pose: 'sit' }]
}

/** Out of the shop to a lane end: from checkout `till` (`paid`), from a café seat (`seat`), or from their browse spot
 *  (nothing they wanted). */
export function shopperOut(spot: number, paid: boolean, side: 0 | 1, till = 0, seat: number | null = null): Step[] {
  const s = BROWSE_SPOTS[spot]
  const back = seat === null ? [] : toSeat(seat).slice(0, -1).reverse()
  const inside: Step[] = seat !== null ? [...back, to(MIDDLE)] : paid ? [to(byCounter(till)), to(MIDDLE)] : [to(aisleTop(s)), to(MIDDLE)]
  return [...inside, to(INSIDE), to(OUTSIDE), to(LANE), to(laneEnd(side))]
}

/** The manager, once the shop is yours: a wave goodbye, then through the doorway, up the aisle, out of the front door,
 *  down the lane. */
export function managerLeaves(): Step[] {
  return [{ wait: 2, face: MANAGER_SPOT.heading, pose: 'wave' }, to(ROUND_DESK), to(BACK_SIDE), to(HALL_SIDE), to(DOOR_AISLE), to(MIDDLE), to(INSIDE), to(OUTSIDE), to(LANE), to(laneEnd(1))]
}

/** The contractor at night: a wave, out of his cabin to the lane, and off to its east end. */
export function contractorLeaves(): Step[] {
  return [{ wait: 2, face: CONTRACTOR_SPOT.heading, pose: 'wave' }, to(CABIN_DOOR), to(CORNER), to({ x: CORNER.x, z: WALK_Z }), to(laneEnd(1))]
}

/** The contractor in the morning: from the lane's east end back to his window. */
export function contractorComes(): Step[] {
  return [to({ x: CORNER.x, z: WALK_Z }), to(CORNER), to(CABIN_DOOR), to(CONTRACTOR_SPOT), { wait: 0.5, face: CONTRACTOR_SPOT.heading }]
}

/** The estate office's way in, and round the east end of the agent's desk (the cabinet stands at its west end) to
 *  behind it, beside his chair. */
const [ESTATE_LANE, ESTATE_OUTSIDE, ESTATE_INSIDE] = ESTATE_PATH
const DESK_EAST: Point = { x: ESTATE_DESK.x1 + 0.25, z: ESTATE_DESK.z0 - 0.2 }
const BEHIND_DESK: Point = { x: ESTATE_DESK.x1 + 0.25, z: AGENT_SEAT.z }

/** The estate agent in the morning: from the lane's west end along the lane to his office, in at its door, round his
 *  desk, and down into his chair. */
export function agentComes(): Step[] {
  return [to({ x: ESTATE_LANE.x, z: WALK_Z }), to(ESTATE_OUTSIDE), to(ESTATE_INSIDE), to(DESK_EAST), to(BEHIND_DESK), to(AGENT_SEAT), { wait: 0.6, face: AGENT_SEAT.heading, pose: 'sit' }]
}

/** The estate agent at four: up from his chair with a wave, round his desk, out of the door and off to the lane's west
 *  end. */
export function agentLeaves(): Step[] {
  return [{ wait: 2, face: AGENT_SEAT.heading, pose: 'wave' }, to(BEHIND_DESK), to(DESK_EAST), to(ESTATE_INSIDE), to(ESTATE_OUTSIDE), to(ESTATE_LANE), to(laneEnd(0))]
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

/** Places to stand `n` people along the ways in through the hall (from just inside the front door towards each browse
 *  spot), each at least `apart` from the others and from `taken` (those already standing): the shop at its fullest,
 *  for measuring what it draws. Fewer come back when the ways have no more room. */
export function hallStands(n: number, taken: readonly Point[], apart = 0.6): { x: number; z: number; heading: number }[] {
  const out: { x: number; z: number; heading: number }[] = []
  const clear = (p: Point) => [...taken, ...out].every((q) => Math.hypot(q.x - p.x, q.z - p.z) >= apart)
  for (let spot = 0; spot < BROWSE_SPOTS.length && out.length < n; spot++) {
    const steps = shopperIn(spot).filter((s): s is { to: Point } => 'to' in s)
    const way = steps.slice(steps.findIndex((s) => s.to.x === INSIDE.x && s.to.z === INSIDE.z)).map((s) => s.to)
    for (let k = 1; k < way.length && out.length < n; k++) {
      const [a, b] = [way[k - 1], way[k]]
      const d = Math.hypot(b.x - a.x, b.z - a.z)
      const heading = Math.atan2(b.x - a.x, b.z - a.z)
      for (let at = 0; at < d && out.length < n; at += 0.1) {
        const p = { x: a.x + ((b.x - a.x) * at) / d, z: a.z + ((b.z - a.z) * at) / d }
        if (clear(p)) out.push({ ...p, heading })
      }
    }
  }
  return out
}
