import type { Act, Pose, PropAct, Spot, Timeline } from './format'
import type { PoseNow } from './poses'
import { THINGS_AT, markOf, pathOf, type Mark } from './set'

// Where everyone and everything is at a moment of a film: a pure function of the world's clock, replayed from the
// start, so any frame can be drawn on its own (a picture at 12.5 s is the same however it was reached).

const TURN = 0.35 // seconds to turn to a new heading
const BLEND = 0.25 // seconds for a pose to blend in
const OPEN = 0.45 // seconds for a lid, a banner or the lights to open
const PACE = 1.15 // m/s, walking
const STRIDE = 5.2 // the stride's phase per metre (as the market's people walk)

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k))
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const deg = (d: number) => (d * Math.PI) / 180

interface Turn {
  from: number
  to: number
  t0: number
}
const headingOf = (turn: Turn, t: number) => turn.from + wrap(turn.to - turn.from) * ease((t - turn.t0) / TURN)

interface Walk {
  t0: number
  pts: Mark[]
  pace: number
  /** the metres to each point from the start */
  at: number[]
}

function walkOf(t0: number, from: Mark, to: Mark[], pace: number): Walk {
  const pts = [from, ...to]
  const at = [0]
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z))
  return { t0, pts, pace, at }
}

/** Where a walk has got to at t: the point, the segment it is on (its direction), the metres walked, whether it goes on. */
function along(w: Walk, t: number) {
  const total = w.at[w.at.length - 1]
  const d = Math.max(0, Math.min(total, (t - w.t0) * w.pace))
  let i = 1
  while (i < w.at.length - 1 && w.at[i] < d) i++
  const a = w.pts[i - 1]
  const b = w.pts[i] ?? a
  const len = w.at[i] - w.at[i - 1] || 1
  const k = Math.max(0, Math.min(1, (d - w.at[i - 1]) / len))
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dir: Math.atan2(b.x - a.x, b.z - a.z), segStart: w.t0 + w.at[i - 1] / w.pace, d, total, moving: d < total - 1e-6 && t >= w.t0 }
}

export interface MemberNow {
  x: number
  z: number
  heading: number
  visible: boolean
  pose: PoseNow
}

export interface PropNow {
  /** held by a cast member, or standing at a point */
  holder: string | null
  x: number
  y: number
  z: number
  heading: number
  open: number
  show: string
}

/** One cast member at world time w. `talking`: a line of theirs is on now. `turning` false: where they are only (the
 *  ones they turn to face are found so, so two who face each other do not ask each other forever). */
export function memberAt(tl: Timeline, id: string, w: number, talking = false, turning = true): MemberNow {
  const m = tl.film.cast[id]
  const start = markOf(m.at)
  let x = start.x
  let z = start.z
  const facing = (target: string | number, from: { x: number; z: number }, t: number) => {
    if (typeof target === 'number') return deg(target)
    const thing = THINGS_AT[target]
    if (thing) return Math.atan2(thing.x - from.x, thing.z - from.z)
    if (!turning) return 0
    const o = memberAt(tl, target, t, false, false)
    return Math.atan2(o.x - from.x, o.z - from.z)
  }
  let turn: Turn = { from: 0, to: m.face !== undefined ? facing(m.face, start, 0) : (start.heading ?? 0), t0: -99 }
  turn.from = turn.to
  let visible = !m.off
  let walk: Walk | null = null
  let lastSeg = -1
  let pose: Pose = 'stand'
  let was: Pose = 'stand'
  let poseT = -99
  let wasT = -99
  let frozenAt: number | undefined
  let phase = id.length * 1.3

  // the walk carried on to t: its corners turn the body
  const settle = (t: number) => {
    if (!walk) return
    const p = along(walk, t)
    x = p.x
    z = p.z
    phase = p.d * STRIDE + id.length * 1.3
    if (p.moving || p.d > 0) {
      const seg = p.segStart
      if (seg !== lastSeg) {
        turn = { from: headingOf(turn, seg), to: p.dir, t0: seg }
        lastSeg = seg
      }
    }
  }
  const mine = tl.acts.filter((a) => a.item.who === id && a.t <= w)
  for (const { t, item: a } of mine as { t: number; item: Act }[]) {
    settle(t)
    if (a.put !== undefined) {
      const s = markOf(a.put)
      x = s.x
      z = s.z
      walk = null
      visible = true
      if (s.heading !== undefined) turn = { from: s.heading, to: s.heading, t0: t }
    }
    if (a.off) visible = false
    if (a.to !== undefined) {
      walk = walkOf(t, { x, z }, pathOf(a.to as Spot | Spot[]), a.pace ?? PACE)
      lastSeg = -1
      visible = true
    }
    if (a.face !== undefined) {
      if (walk) settle(t)
      turn = { from: headingOf(turn, t), to: facing(a.face, { x, z }, t), t0: t }
    }
    if (a.pose === 'freeze') frozenAt = t
    else if (a.pose) {
      was = pose
      wasT = poseT
      pose = a.pose
      poseT = t
      frozenAt = undefined
    }
  }
  settle(w)
  // the legs: walking while the walk goes on, easing in and out at its ends
  let walking = 0
  if (walk) {
    const p = along(walk, w)
    if (p.moving) walking = Math.min(1, (w - walk.t0) / 0.15, (p.total - p.d) / (walk.pace * 0.15))
  }
  return {
    x,
    z,
    heading: headingOf(turn, w),
    visible,
    pose: { pose, was, blend: ease((w - poseT) / BLEND), since: w - poseT, wasSince: w - wasT, walk: Math.max(0, walking), phase, talking, frozenAt },
  }
}

/** One prop at world time w (where a holder's hand is, the player finds on the holder's rig). */
export function propAt(tl: Timeline, id: string, w: number): PropNow {
  const p = tl.film.props[id]
  const place = (on: string | Spot | undefined) => {
    if (on === undefined) return { holder: null, x: 0, y: 0, z: 0, heading: 0 }
    if (typeof on === 'string' && tl.film.cast[on]) return { holder: on, x: 0, y: 0, z: 0, heading: 0 }
    const m = markOf(on)
    return { holder: null, x: m.x, y: m.y ?? 0, z: m.z, heading: m.heading ?? 0 }
  }
  let at = place(p.on)
  let open = { from: p.open ?? 0, to: p.open ?? 0, t0: -99, over: OPEN }
  const openAt = (x: number) => open.from + (open.to - open.from) * ease((x - open.t0) / open.over)
  let show = p.show ?? ''
  for (const { t, item: a } of tl.props.filter((q) => q.item.prop === id && q.t <= w) as { t: number; item: PropAct }[]) {
    if (a.on !== undefined) at = place(a.on)
    if (a.open !== undefined) open = { from: openAt(t), to: a.open, t0: t, over: a.over ?? OPEN }
    if (a.show !== undefined) show = a.show
  }
  return { ...at, open: openAt(w), show }
}
