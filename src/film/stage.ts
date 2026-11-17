import type { Act, Pose, PropAct, Spot, Timeline } from './format'
import type { PoseNow } from './poses'
import { THINGS_AT, markOf, pathOf, type Mark } from './set'
import { BODY_RADIUS, route, solidsOf } from './solids'

// Where everyone and everything is at a moment of a film: a pure function of the world's clock, replayed from the
// start, so any frame can be drawn on its own (a picture at 12.5 s is the same however it was reached). A walk goes
// round the set's solids (./solids.ts: the walls, the desk, the fence, the tool), its corners turning the body; a mark
// up on something (a hen's nest) is hopped up to; a prop is held, stands, is set down, or flies where it is thrown.

const TURN = 0.35 // seconds to turn to a new heading
const BLEND = 0.25 // seconds for a pose to blend in
const OPEN = 0.45 // seconds for a lid, a banner or the lights to open
const PACE = 1.15 // m/s, walking
const STRIDE = 5.2 // the stride's phase per metre (as the market's people walk)
const FLY = 0.6 // seconds a thrown prop is in the air
const HEAD = 1.66 // where a hat sits on a person (m)

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k))
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const deg = (d: number) => (d * Math.PI) / 180

interface Turn {
  from: number
  to: number
  t0: number
}
const headingOf = (turn: Turn, t: number) => turn.from + wrap(turn.to - turn.from) * ease((t - turn.t0) / TURN)

interface Pt {
  x: number
  z: number
  y: number
}

interface Walk {
  t0: number
  pts: Pt[]
  pace: number
  /** the metres to each point from the start */
  at: number[]
}

/** A walk from `from` through each of `to`, every leg round the solids for a body `r` wide. */
function walkOf(t0: number, from: Pt, to: Mark[], pace: number, solids: ReturnType<typeof solidsOf>, r: number): Walk {
  const pts: Pt[] = [from]
  for (const m of to) {
    const last = pts[pts.length - 1]
    const way = route(last, m, solids, r)
    for (const p of way.slice(0, -1)) pts.push({ x: p.x, z: p.z, y: 0 })
    pts.push({ x: m.x, z: m.z, y: m.y ?? 0 })
  }
  const at = [0]
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z))
  return { t0, pts, pace, at }
}

/** Where a walk has got to at t: the point (a leg that goes up or down is a hop: an arc over it), the segment it is on
 *  (its direction), the metres walked, whether it goes on. */
function along(w: Walk, t: number) {
  const total = w.at[w.at.length - 1]
  const d = Math.max(0, Math.min(total, (t - w.t0) * w.pace))
  let i = 1
  while (i < w.at.length - 1 && w.at[i] < d) i++
  const a = w.pts[i - 1]
  const b = w.pts[i] ?? a
  const len = w.at[i] - w.at[i - 1] || 1
  const k = Math.max(0, Math.min(1, (d - w.at[i - 1]) / len))
  const hop = a.y !== b.y ? Math.sin(Math.PI * k) * (0.18 + 0.3 * Math.abs(b.y - a.y)) : 0
  return {
    x: a.x + (b.x - a.x) * k,
    z: a.z + (b.z - a.z) * k,
    y: a.y + (b.y - a.y) * (a.y !== b.y ? ease(k) : k) + hop,
    dir: Math.atan2(b.x - a.x, b.z - a.z),
    segStart: w.t0 + w.at[i - 1] / w.pace,
    d,
    total,
    moving: d < total - 1e-6 && t >= w.t0,
    hopping: a.y !== b.y && k > 0 && k < 1,
    /** how far the segment runs on the ground (m) */
    run: Math.hypot(b.x - a.x, b.z - a.z),
  }
}

export interface MemberNow {
  x: number
  z: number
  /** up off the ground (in a nest, mid-hop), m */
  y: number
  heading: number
  visible: boolean
  pose: PoseNow
  /** a sheep's fleece (0 just shorn … 1 full) */
  wool: number
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
  /** in the air (thrown): how far through its flight (0..1), and how far it has tumbled (radians); null: not flying */
  fly: { k: number; spin: number } | null
}

/** How wide a cast member's body is on the ground (a person, or an animal of the film's herd). */
function radiusOf(tl: Timeline, id: string) {
  const look = tl.film.cast[id].look
  return typeof look === 'object' && 'herd' in look && tl.film.herd ? BODY_RADIUS[tl.film.herd] : BODY_RADIUS.person
}

/** Each walk as it was worked out, by its act (where it starts is the same every time the film is replayed). */
const walks = new WeakMap<object, Walk>()

/** Whoever stands still on the ground when a walk begins, as a solid it goes round (their body's width: the walker's is
 *  added by the route). */
function bystanders(tl: Timeline, id: string, t: number) {
  const out: ReturnType<typeof solidsOf> = []
  for (const other of Object.keys(tl.film.cast)) {
    if (other === id) continue
    const o = memberAt(tl, other, t, null, false, false)
    if (!o.visible || o.pose.walk > 0 || o.y > 0.2) continue
    const r = radiusOf(tl, other) * 0.9
    out.push({ name: tl.film.cast[other].name, x0: o.x - r, x1: o.x + r, z0: o.z - r, z1: o.z + r })
  }
  return out
}

/** One cast member at world time w. `talk`: how loud their voice is now while they are saying something (null: they are
 *  not). `turning` false: where they are only (the ones they turn to face are found so, so two who face each other do
 *  not ask each other forever); `around` false: their walks are not yet worked out round the others (asked while
 *  working one out). */
export function memberAt(tl: Timeline, id: string, w: number, talk: number | null = null, turning = true, around = true): MemberNow {
  const m = tl.film.cast[id]
  const start = markOf(m.at)
  let x = start.x
  let z = start.z
  let y = start.y ?? 0
  // (to face: a heading, a thing of the set, a prop where it stands, a mark, or someone)
  const facing = (target: string | number, from: { x: number; z: number }, t: number) => {
    if (typeof target === 'number') return deg(target)
    const thing = THINGS_AT[target]
    if (thing) return Math.atan2(thing.x - from.x, thing.z - from.z)
    const prop = tl.film.props[target]
    if (prop && typeof prop.on !== 'string') return 0
    if (prop || !tl.film.cast[target]) {
      const at = prop ? markOf(prop.on as string) : markOf(target)
      return Math.atan2(at.x - from.x, at.z - from.z)
    }
    if (!turning) return 0
    const o = memberAt(tl, target, t, null, false)
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
  let wool = { from: 1, to: 1, t0: -99, over: 0.5 }
  /** a walk's turn on arriving (its act's `face`), and when it arrives */
  let arrive: { at: number; face: string | number } | null = null
  const woolAt = (t: number) => wool.from + (wool.to - wool.from) * ease((t - wool.t0) / wool.over)
  const r = radiusOf(tl, id)

  // the walk carried on to t: its corners turn the body
  const settle = (t: number) => {
    if (!walk) return
    const p = along(walk, t)
    x = p.x
    z = p.z
    y = p.y
    phase = p.d * STRIDE + id.length * 1.3
    if (p.moving || p.d > 0) {
      const seg = p.segStart
      if (seg !== lastSeg) {
        // (a hop straight up keeps the way it faced)
        if (p.run > 0.05) turn = { from: headingOf(turn, seg), to: p.dir, t0: seg }
        lastSeg = seg
      }
    }
    // arrived: turned the way the walk's act asked
    if (arrive && t >= arrive.at) {
      turn = { from: headingOf(turn, arrive.at), to: facing(arrive.face, { x, z }, arrive.at), t0: arrive.at }
      arrive = null
    }
  }
  const mine = tl.acts.filter((a) => a.item.who === id && a.t <= w)
  for (const timed of mine) {
    const { t, item: a, place } = timed as { t: number; item: Act; place: 'market' | 'pen' }
    settle(t)
    if (a.put !== undefined) {
      const s = markOf(a.put)
      x = s.x
      z = s.z
      y = s.y ?? 0
      walk = null
      visible = true
      if (s.heading !== undefined) turn = { from: s.heading, to: s.heading, t0: t }
    }
    if (a.off) visible = false
    if (a.to !== undefined) {
      // (round the set's solids, and round whoever stands still in the way; worked out once)
      let made = around ? walks.get(timed) : undefined
      if (!made) {
        const solids = solidsOf(place, tl.film.herd)
        made = walkOf(t, { x, z, y }, pathOf(a.to as Spot | Spot[]), a.pace ?? PACE, around ? [...solids, ...bystanders(tl, id, t)] : solids, r)
        if (around) walks.set(timed, made)
      }
      walk = made
      lastSeg = -1
      visible = true
      // (a walk with a `face` turns that way once it has arrived)
      arrive = a.face !== undefined ? { at: t + made.at[made.at.length - 1] / made.pace, face: a.face } : null
    }
    if (a.face !== undefined && a.to === undefined) {
      if (walk) settle(t)
      turn = { from: headingOf(turn, t), to: facing(a.face, { x, z }, t), t0: t }
    }
    if (a.wool !== undefined) wool = { from: woolAt(t), to: a.wool, t0: t, over: a.over ?? 0.5 }
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
  // the legs: walking while the walk goes on, easing in and out at its ends (not in the air)
  let walking = 0
  let speed = 0
  if (walk) {
    const p = along(walk, w)
    if (p.moving && !p.hopping) walking = Math.min(1, (w - walk.t0) / 0.15, (p.total - p.d) / (walk.pace * 0.15))
    if (p.moving) speed = walk.pace
  }
  return {
    x,
    z,
    y,
    heading: headingOf(turn, w),
    visible,
    wool: woolAt(w),
    pose: { pose, was, blend: ease((w - poseT) / BLEND), since: w - poseT, wasSince: w - wasT, walk: Math.max(0, walking), speed, phase, talking: talk !== null, voice: talk ?? 0, frozenAt },
  }
}

/** One prop at world time w (where a holder's hand is, the player finds on the holder's rig). */
export function propAt(tl: Timeline, id: string, w: number): PropNow {
  const p = tl.film.props[id]
  type Place = { holder: string | null; x: number; y: number; z: number; heading: number }
  const place = (on: string | Spot | undefined, t: number, was: Place): Place => {
    if (on === undefined) return { holder: null, x: 0, y: 0, z: 0, heading: 0 }
    if (on === 'down') {
      // set down in front of whoever held it, on the ground
      if (!was.holder) return { ...was, y: 0 }
      const h = memberAt(tl, was.holder, t, null, false)
      return { holder: null, x: h.x + Math.sin(h.heading) * 0.48, y: 0, z: h.z + Math.cos(h.heading) * 0.48, heading: h.heading }
    }
    if (typeof on === 'string' && tl.film.cast[on]) return { holder: on, x: 0, y: 0, z: 0, heading: 0 }
    const m = markOf(on)
    return { holder: null, x: m.x, y: m.y ?? 0, z: m.z, heading: m.heading ?? 0 }
  }
  /** where a place is in the world (a holder: about their hands) */
  const where = (q: Place, t: number) => {
    if (!q.holder) return q
    const h = memberAt(tl, q.holder, t, null, false)
    return { ...q, x: h.x + Math.sin(h.heading) * 0.35, y: 0.95, z: h.z + Math.cos(h.heading) * 0.35, heading: h.heading }
  }
  let at = place(p.on, 0, { holder: null, x: 0, y: 0, z: 0, heading: 0 })
  let open = { from: p.open ?? 0, to: p.open ?? 0, t0: -99, over: OPEN }
  const openAt = (x: number) => open.from + (open.to - open.from) * ease((x - open.t0) / open.over)
  let show = p.show ?? ''
  let flight: { t0: number; over: number; from: Place; to: string | Spot } | null = null
  for (const { t, item: a } of tl.props.filter((q) => q.item.prop === id && q.t <= w) as { t: number; item: PropAct }[]) {
    if (flight && t >= flight.t0 + flight.over) {
      at = landing(flight.to, flight.t0 + flight.over)
      flight = null
    }
    if (a.to !== undefined) {
      flight = { t0: t, over: a.over ?? FLY, from: where(at, t), to: a.to }
      at = flight.from
    } else if (a.on !== undefined) {
      flight = null
      at = place(a.on, t, at)
    }
    if (a.open !== undefined && a.to === undefined) open = { from: openAt(t), to: a.open, t0: t, over: a.over ?? OPEN }
    if (a.show !== undefined) show = a.show
  }
  function landing(to: string | Spot, t: number): Place {
    if (typeof to === 'string' && tl.film.cast[to]) return { holder: to, x: 0, y: 0, z: 0, heading: 0 }
    return place(to, t, at)
  }
  if (flight) {
    const k = Math.min(1, (w - flight.t0) / flight.over)
    if (k >= 1) at = landing(flight.to, flight.t0 + flight.over)
    else {
      const a = flight.from
      const end = flight.t0 + flight.over
      let b: Place
      if (typeof flight.to === 'string' && tl.film.cast[flight.to]) {
        const h = memberAt(tl, flight.to, end, null, false)
        b = { holder: null, x: h.x, y: show === 'head' ? HEAD : 0.95, z: h.z, heading: h.heading }
      } else b = place(flight.to, end, at)
      const span = Math.hypot(b.x - a.x, b.z - a.z)
      const arc = 0.35 + 0.3 * span
      return {
        holder: null,
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k + Math.sin(Math.PI * k) * arc,
        z: a.z + (b.z - a.z) * k,
        heading: a.heading + (b.heading - a.heading) * k,
        open: openAt(w),
        show,
        fly: { k, spin: k * Math.PI * (1.5 + span * 0.6) },
      }
    }
  }
  return { ...at, open: openAt(w), show, fly: null }
}
