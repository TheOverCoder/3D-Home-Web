import { CAR_SPOT } from '../data/maps'
import { CAR_CABIN, CAR_SHAPE } from '../models/car'
import type { Place } from '../farm/state'
import type { Trip } from '../scene/travel'

// The drive's film (src/scene/travel.ts plays it between the two maps): a few seconds of the little red car going from
// one map to the other, as data and pure functions of time, so a moment of it is the same however it is reached (played,
// held for a picture, a unit test). Four shots, one idea — you go from here to there, under the sky of this hour:
//
//   1. it leaves (the farm's parking lot, or the house's driveway): wide and low, it pulls away towards us and out;
//   2. the open country road, beside it as it rolls along under the sky of the hour;
//   3. from the driver's seat, the sky in the windscreen and the clock on the dashboard (the day chip's hh:mm), the
//      signpost to where you are going sliding past;
//   4. it arrives (the house's driveway, or the farm's lot): it rolls in, stops, rocks on its springs, and toots.
//
// With less motion it is one still (./DriveFilm.tsx): the driver's seat and the clock, held. Each place is staged where
// the game has it (src/data/maps.ts, estate.ts, home.ts), the road on its own. Distances in metres, times in seconds,
// headings as the player's yaw (0 north, along −z; π/2 west).

/** A place the film is staged in: the farm's parking lot, the country road, the house's driveway. */
export type SetId = 'lot' | 'road' | 'home'

export type { Trip }

type Pt = readonly [number, number]

/** How fast the car goes through a shot: its speed at moments (s, m/s), straight between them, held after the last. */
type Speeds = readonly (readonly [number, number])[]

export interface CarMove {
  /** the way it goes: points on the ground, a smooth curve through them */
  path: readonly Pt[]
  /** how far along it is when the shot begins */
  from: number
  speeds: Speeds
}

/** Where the camera is in a shot (it frames the car; nothing here knows the screen but `fovFor`):
 *  `post` stands still at a spot and turns to follow the car (by `follow` of the way from `aim` to it);
 *  `track` runs beside the road with the car, `side` metres off its line, `lead` metres ahead of it at the start and
 *  falling back by `drift` m/s (the car moves on through the picture);
 *  `cabin` sits in the driver's seat, looking down the road. */
export type CamMove =
  | { kind: 'post'; at: readonly [number, number, number]; aim: readonly [number, number, number]; follow: number; lens: number }
  | { kind: 'track'; side: number; height: number; lead: number; drift: number; lens: number }
  | { kind: 'cabin'; lens: number }

export interface Shot {
  name: string
  set: SetId
  len: number
  car: CarMove
  cam: CamMove
  /** the horn: two toots, this far into the shot */
  horn?: number
}

export interface DriveFilm {
  trip: Trip
  shots: Shot[]
  length: number
  /** where the signpost to the destination stands on the road (how far along it), in the shots on the road */
  sign: number
  /** less motion: one still from the driver's seat */
  still: boolean
}

// ───────────────────────────── the ways ─────────────────────────────

/** A smooth way through points (a centripetal Catmull-Rom curve), measured along its length. */
export interface Path {
  xs: Float64Array
  zs: Float64Array
  /** the length along it at each point */
  at: Float64Array
  length: number
}

const STEPS = 24

export function pathOf(points: readonly Pt[]): Path {
  const xs: number[] = []
  const zs: number[] = []
  const p = [points[0], ...points, points[points.length - 1]]
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]]
    // centripetal knots: no loops or cusps on uneven spacing
    const d = (a: Pt, b: Pt) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5)
    const t1 = d(p0, p1)
    const t2 = t1 + d(p1, p2)
    const t3 = t2 + d(p2, p3)
    for (let k = 0; k < STEPS; k++) {
      const t = t1 + ((t2 - t1) * k) / STEPS
      const lerp = (a: Pt, b: Pt, ta: number, tb: number): Pt => {
        const w = tb === ta ? 0 : (t - ta) / (tb - ta)
        return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]
      }
      const a1 = lerp(p0, p1, 0, t1)
      const a2 = lerp(p1, p2, t1, t2)
      const a3 = lerp(p2, p3, t2, t3)
      const b1 = lerp(a1, a2, 0, t2)
      const b2 = lerp(a2, a3, t1, t3)
      const c = lerp(b1, b2, t1, t2)
      xs.push(c[0])
      zs.push(c[1])
    }
  }
  const last = points[points.length - 1]
  xs.push(last[0])
  zs.push(last[1])
  const at = new Float64Array(xs.length)
  for (let i = 1; i < xs.length; i++) at[i] = at[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1])
  return { xs: Float64Array.from(xs), zs: Float64Array.from(zs), at, length: at[at.length - 1] }
}

/** Where on a way `s` metres along is, and the heading there (past either end, on along its end's heading). */
export function along(path: Path, s: number): { x: number; z: number; yaw: number } {
  const { xs, zs, at } = path
  const n = xs.length
  let i = 0
  if (s >= path.length) i = n - 2
  else if (s > 0) {
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (at[mid] <= s) lo = mid
      else hi = mid
    }
    i = lo
  }
  const seg = Math.max(1e-9, at[i + 1] - at[i])
  const k = (s - at[i]) / seg
  const dx = xs[i + 1] - xs[i]
  const dz = zs[i + 1] - zs[i]
  return { x: xs[i] + dx * k, z: zs[i] + dz * k, yaw: Math.atan2(-dx, -dz) }
}

/** How far it has gone `t` seconds into a shot, and its speed and its acceleration then. */
export function travelled(speeds: Speeds, t: number): { s: number; v: number; a: number } {
  let s = 0
  for (let i = 0; i < speeds.length; i++) {
    const [t0, v0] = speeds[i]
    const next = speeds[i + 1]
    if (!next || t <= next[0]) {
      const a = next && next[0] > t0 ? (next[1] - v0) / (next[0] - t0) : 0
      const dt = Math.max(0, t - t0)
      return { s: s + v0 * dt + 0.5 * a * dt * dt, v: v0 + a * dt, a: dt > 0 || i > 0 ? a : 0 }
    }
    s += ((v0 + next[1]) / 2) * (next[0] - t0)
  }
  return { s, v: 0, a: 0 }
}

/** The speeds that arrive at the end of a way `length` long and stop there: on at a steady speed, then braking for
 *  `brake` seconds to a standstill `stop` seconds into the shot. */
export function arriving(length: number, stop: number, brake: number): Speeds {
  const v = length / (stop - brake / 2)
  return [
    [0, v],
    [stop - brake, v],
    [stop, 0],
  ]
}

// ───────────────────────────── the shots ─────────────────────────────

const LOT = CAR_SPOT.farm
const DRIVE = CAR_SPOT.home

/** The farm's lot: the car pulls out of its bay (facing west), on to the lane south of the lot's kerb, and away west;
 *  coming back, it comes along the lane from the east and turns into its bay. */
const LOT_OUT: Pt[] = [
  [LOT.x, LOT.z],
  [LOT.x - 3, LOT.z + 0.35],
  [LOT.x - 6.4, LOT.z + 1.25],
  [LOT.x - 12, LOT.z + 1.45],
  [LOT.x - 60, LOT.z + 1.45],
]
const LOT_IN: Pt[] = [
  [LOT.x + 40, LOT.z + 1.4],
  [LOT.x + 11, LOT.z + 1.35],
  [LOT.x + 4.5, LOT.z + 0.55],
  [LOT.x, LOT.z],
]
/** The house's driveway: out east through the gate in the fence and south down the country lane; coming home, up the
 *  lane from the south, in at the gate, and along the driveway to stop by the house. */
const HOME_OUT: Pt[] = [
  [DRIVE.x, DRIVE.z],
  [DRIVE.x + 5.4, DRIVE.z],
  [DRIVE.x + 9.2, DRIVE.z + 0.2],
  [DRIVE.x + 11.3, DRIVE.z + 2.6],
  [DRIVE.x + 11.6, DRIVE.z + 9],
  [DRIVE.x + 11.6, DRIVE.z + 60],
]
const HOME_IN: Pt[] = [...HOME_OUT].reverse()

/** The country road: straight along +x, the car in its right-hand lane. */
export const ROAD = { z: 1.6, width: 6.4 } as const
const ROAD_WAY: Pt[] = [
  [0, ROAD.z],
  [600, ROAD.z],
]
/** How fast it goes along the open road (m/s: a gentle country pace). */
const CRUISE = 12.5

/** The driver's seat: where the eyes are, in the car's frame (facing +z), and how far down the road they look. */
export const EYE = { x: CAR_CABIN.driver, y: 1.2, z: -0.3, down: 0.105 } as const

/** Leaving: the car comes at us and goes past, the place behind it — the farm's lot (out of its bay and west down the
 *  lane, towards a camera low at the lot's west end) or the house (out of its gate and down the lane past a camera
 *  on the lane's far side). */
function leaving(from: Place, len: number): Shot {
  return from === 'farm'
    ? {
        name: 'leaving the lot',
        set: 'lot',
        len,
        car: {
          path: LOT_OUT,
          from: 0.4,
          speeds: [
            [0, 1.6],
            [len, 9.5],
          ],
        },
        cam: { kind: 'post', at: [LOT.x - 13.5, 1.05, LOT.z + 3.6], aim: [LOT.x - 4, 0.9, LOT.z + 0.6], follow: 0.75, lens: 30 },
      }
    : {
        name: 'leaving the house',
        set: 'home',
        len,
        car: {
          path: HOME_OUT,
          from: 0.4,
          speeds: [
            [0, 1.6],
            [len, 9],
          ],
        },
        cam: { kind: 'post', at: [DRIVE.x + 13.6, 1.3, DRIVE.z + 7.2], aim: [DRIVE.x + 6, 1.0, DRIVE.z + 0.5], follow: 0.65, lens: 30 },
      }
}

/** Arriving: the car comes in from behind us and goes away into the place, stops, rocks on its springs and toots — at
 *  the house (up the lane, in at the gate and along the driveway to stop by the house, under a camera on the lane's far
 *  side) or at the farm (along the lane and into its bay, under a camera high on the lane by the market, the farm's
 *  silo and barn beyond). It stops `stop` seconds in. */
function arriving_(to: Place, len: number, stop: number): Shot {
  const way = to === 'home' ? HOME_IN : LOT_IN
  const length = pathOf(way).length
  const start = to === 'home' ? length - 24 : length - 12.5
  return to === 'home'
    ? {
        name: 'home',
        set: 'home',
        len,
        car: { path: way, from: start, speeds: arriving(length - start, stop, 1.3) },
        cam: { kind: 'post', at: [DRIVE.x + 14, 3.4, DRIVE.z + 5.8], aim: [DRIVE.x + 3, 0.8, DRIVE.z - 0.5], follow: 0.6, lens: 30 },
        horn: stop + 0.25,
      }
    : {
        name: 'the farm',
        set: 'lot',
        len,
        car: { path: way, from: start, speeds: arriving(length - start, stop, 1.3) },
        cam: { kind: 'post', at: [LOT.x + 9, 3.3, LOT.z + 0.9], aim: [LOT.x - 7, 0.5, LOT.z - 1.5], follow: 0.5, lens: 32 },
        horn: stop + 0.25,
      }
}

/** The film of a drive: from one map to the other (`still`: with less motion, one held picture). */
export function driveFilm(trip: Trip, still = false): DriveFilm {
  const out = 1.9
  const beside = 1.8
  const inside = 2.3
  const there = 2.7
  const cabinFrom = CRUISE * beside
  // where the signpost stands: the driver passes it at the end of the third shot
  const sign = cabinFrom + CRUISE * 1.5 + 6
  if (still) {
    return {
      trip,
      still,
      sign,
      length: 2.6,
      shots: [{ name: 'the clock', set: 'road', len: 2.6, car: { path: ROAD_WAY, from: cabinFrom + CRUISE * 0.7, speeds: [[0, 0]] }, cam: { kind: 'cabin', lens: 46 } }],
    }
  }
  const shots: Shot[] = [
    leaving(trip.from, out),
    {
      name: 'the open road',
      set: 'road',
      len: beside,
      car: { path: ROAD_WAY, from: 0, speeds: [[0, CRUISE]] },
      cam: { kind: 'track', side: 14, height: 0.8, lead: 3, drift: 2.4, lens: 24 },
    },
    {
      name: 'the clock',
      set: 'road',
      len: inside,
      car: { path: ROAD_WAY, from: cabinFrom, speeds: [[0, CRUISE]] },
      cam: { kind: 'cabin', lens: 46 },
    },
    arriving_(trip.to, there, 1.85),
  ]
  return { trip, still, sign, shots, length: shots.reduce((n, s) => n + s.len, 0) }
}

// ───────────────────────────── a moment of it ─────────────────────────────

export interface Vec {
  x: number
  y: number
  z: number
}

/** The car at a moment: where it is, its heading, how far its wheels have turned, how its body sits on its springs,
 *  how fast it goes and whether it brakes. */
export interface CarNow {
  x: number
  z: number
  yaw: number
  roll: number
  pitch: number
  lift: number
  v: number
  /** its acceleration (m/s²) */
  a: number
  braking: boolean
}

export interface CamNow {
  pos: Vec
  look: Vec
  /** vertical, degrees */
  fov: number
}

export interface Moment {
  shot: number
  set: SetId
  /** seconds into the shot */
  u: number
  car: CarNow
  cam: CamNow
}

const paths = new WeakMap<readonly Pt[], Path>()
const wayOf = (pts: readonly Pt[]) => {
  let p = paths.get(pts)
  if (!p) paths.set(pts, (p = pathOf(pts)))
  return p
}

/** The shot at a time of the film (the last one past its end), and how far into it. */
export function shotAt(film: DriveFilm, t: number): { index: number; u: number } {
  let start = 0
  for (let i = 0; i < film.shots.length; i++) {
    const len = film.shots[i].len
    if (t < start + len || i === film.shots.length - 1) return { index: i, u: Math.max(0, Math.min(len, t - start)) }
    start += len
  }
  return { index: 0, u: 0 }
}

/** The shots' starts (s). */
export const cuts = (film: DriveFilm) => film.shots.map((_, i) => film.shots.slice(0, i).reduce((n, s) => n + s.len, 0))

/** How the body sits on its springs `u` seconds into a shot: it squats as it pulls away and dips as it brakes (the
 *  springs follow the acceleration, and rock a little after it changes), and bobs on the road's small bumps. Worked out
 *  from the shot's start in small steps, so a moment is always the same. */
function sway(move: CarMove, u: number, s: number): { pitch: number; lift: number } {
  const dt = 1 / 120
  // a spring (about 1.3 bobs a second) with some damping, pushed by the acceleration (nose up as it speeds up)
  const w = 2 * Math.PI * 1.3
  const damp = 2 * 0.35 * w
  let p = 0.0055 * travelled(move.speeds, 0).a
  let dp = 0
  for (let t = 0; t < u; t += dt) {
    const target = 0.0055 * travelled(move.speeds, t).a
    const acc = w * w * (target - p) - damp * dp
    dp += acc * dt
    p += dp * dt
  }
  const bump = 0.006 * Math.sin(s * 1.7) * Math.sin(s * 0.53 + 1)
  return { pitch: Math.max(-0.05, Math.min(0.05, p)), lift: bump }
}

/** The car `u` seconds into a shot. */
export function carAt(shot: Shot, u: number): CarNow {
  const move = shot.car
  const way = wayOf(move.path)
  const go = travelled(move.speeds, u)
  const s = move.from + go.s
  const at = along(way, s)
  const { pitch, lift } = sway(move, u, s)
  return { x: at.x, z: at.z, yaw: at.yaw, roll: s, pitch, lift, v: go.v, a: go.a, braking: go.a < -0.5 || (go.v < 0.05 && u > 0 && move.speeds.length > 1) }
}

/** 0 below `a`, 1 above `b`, smooth between. */
const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** The lens for a screen: `lens` is the vertical angle on a phone held sideways; held upright (narrow), it opens up so
 *  the picture is still at least `wide` degrees across. */
export function fovFor(lens: number, aspect: number, wide = 34): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const across = 2 * Math.atan(Math.tan(rad(lens) / 2) * aspect)
  if (across >= rad(wide)) return lens
  return (2 * Math.atan(Math.tan(rad(wide) / 2) / aspect) * 180) / Math.PI
}

/** A point in the car's frame (facing +z, the ground under its middle at the origin; its body on its springs) placed in
 *  the world. */
export function carPoint(car: CarNow, p: Vec): Vec {
  // the body turns round the axles' middle (src/models/car.ts, putRollingCar)
  const r = CAR_SHAPE.wheel.r
  const th = -car.pitch
  const y0 = p.y - r
  const by = r + y0 * Math.cos(th) - p.z * Math.sin(th) + car.lift
  const bz = y0 * Math.sin(th) + p.z * Math.cos(th)
  // facing the yaw (the kit's heading is yaw + π: +z turned to the yaw's way)
  const h = car.yaw + Math.PI
  const c = Math.cos(h)
  const sn = Math.sin(h)
  return { x: car.x + p.x * c + bz * sn, y: by, z: car.z - p.x * sn + bz * c }
}

/** The camera `u` seconds into a shot, on a screen of this aspect (width over height). */
export function camAt(shot: Shot, u: number, car: CarNow, aspect: number): CamNow {
  const cam = shot.cam
  if (cam.kind === 'cabin') {
    const pos = carPoint(car, EYE)
    // down the road and a little down, over the clock in front of the wheel (upright, the narrow picture closes in on
    // the windscreen and the clock rather than the pillars either side, and looks a little higher: more of the sky)
    const down = aspect < 1 ? EYE.down * 0.5 : EYE.down
    const look = carPoint(car, { x: EYE.x, y: EYE.y - down * 10, z: EYE.z + 10 })
    return { pos, look, fov: fovFor(cam.lens, aspect, 30) }
  }
  if (cam.kind === 'track') {
    const fwd = { x: -Math.sin(car.yaw), z: -Math.cos(car.yaw) }
    // its right-hand side (the road's verge), the camera beside it there
    const right = { x: -fwd.z, z: fwd.x }
    const ahead = cam.lead - cam.drift * u
    // (upright, nearer: the car fills more of the narrow picture)
    const side = cam.side * (aspect < 1 ? 0.72 : 1)
    const pos = { x: car.x + right.x * side + fwd.x * ahead, y: cam.height, z: car.z + right.z * side + fwd.z * ahead }
    const look = { x: car.x + fwd.x * 0.4, y: 0.95, z: car.z + fwd.z * 0.4 }
    return { pos, look, fov: fovFor(cam.lens, aspect) }
  }
  const [ax, ay, az] = cam.aim
  const [px, , pz] = cam.at
  // it turns after the car only once the car is in front of it (one coming in from behind it is waited for, looking
  // where it will come)
  const toAim = Math.atan2(az - pz, ax - px)
  const toCar = Math.atan2(car.z - pz, car.x - px)
  const off = Math.abs(Math.atan2(Math.sin(toCar - toAim), Math.cos(toCar - toAim)))
  const k = cam.follow * (1 - smooth(0.55, 1.1, off))
  const look = { x: ax + (car.x - ax) * k, y: ay + (0.75 - ay) * k, z: az + (car.z - az) * k }
  return { pos: { x: px, y: cam.at[1], z: pz }, look, fov: fovFor(cam.lens, aspect) }
}

/** The film `t` seconds in, on a screen of this aspect. */
export function momentAt(film: DriveFilm, t: number, aspect: number): Moment {
  const { index, u } = shotAt(film, t)
  const shot = film.shots[index]
  const car = carAt(shot, u)
  return { shot: index, set: shot.set, u, car, cam: camAt(shot, u, car, aspect) }
}
