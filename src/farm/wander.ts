import type { RapierRigidBody } from '@react-three/rapier'
import { Euler, MathUtils, Quaternion, Vector3 } from 'three'
import { dampAngle } from '../lib/damp'
import { carry, rectToWorld, toWorld, turnOf, type Placement, type Rect } from './layout'

// How the farm's animals wander their pens, the same for every kind: each strolls to a free spot, turning towards it
// as she goes, then grazes (a hen pecks) or stands about for a while, and off again. They live in the world's
// coordinates and keep inside the part of the pen they roam; when the pen is moved (the edit mode) they are carried
// along. How fast, how long and where differs by kind (`Wander`); each animal's pose is her own (Cows.tsx, Sheep.tsx,
// Chickens.tsx).

export type Mode = 'walk' | 'graze' | 'idle'

/** One animal in her pen. */
export interface Agent {
  x: number
  z: number
  heading: number
  /** where she is walking to */
  tx: number
  tz: number
  mode: Mode
  /** seconds left grazing or standing about */
  timer: number
  /** her legs' cycle */
  phase: number
  /** 0 standing … 1 walking (eased, so the legs settle instead of snapping still) */
  stride: number
}

/** How a kind of animal wanders. */
export interface Wander {
  /** walking pace, m/s */
  speed: number
  /** how quickly she turns towards where she is going (a damping rate, per second) */
  turn: number
  /** she walks the way she faces and slows while she turns, to no less than this share of her pace (so she does not
   *  slide sideways); without it she walks straight at the spot as she turns (a hen) */
  ease?: number
  /** this near the spot, beyond the last step, counts as there */
  arrive: number
  /** her legs' cycles per metre walked */
  legs: number
  /** how quickly her stride eases in and out (a damping rate) */
  strideRate: number
  /** there: the odds she grazes (else she stands about), and for how long, the least and how much more at most */
  graze: number
  grazeFor: [number, number]
  idleFor: [number, number]
  /** where she may go, in her pen's own frame: this rectangle, less what `free` rules out (a shelter, a trough) */
  area: Rect
  free?: (x: number, z: number) => boolean
  /** how far a new spot keeps from where the others are going (0: anywhere) */
  spacing: number
  /** tries for a free spot, and where she goes when none turns up (in her pen's frame) */
  tries: number
  fallback: () => [number, number]
}

/** A new animal standing at (x, z). */
export const agentAt = (x: number, z: number, heading: number, mode: Mode, timer: number): Agent => ({ x, z, heading, tx: x, tz: z, mode, timer, phase: 0, stride: 0 })

/** Where a pen stands this frame, and the part of it they roam, in the world. */
export interface Pen {
  at: Placement
  area: Rect
}
export const penAt = (kind: Wander, at: Placement): Pen => ({ at, area: rectToWorld(at, kind.area) })

/** A free spot in the pen for the i-th of `herd`: in her area, clear of what it rules out and of where the others are
 *  going. */
export function freeSpot(kind: Wander, at: Placement, herd: readonly Agent[], i: number): [number, number] {
  const r = kind.area
  for (let k = 0; k < kind.tries; k++) {
    const lx = r.minX + Math.random() * (r.maxX - r.minX)
    const lz = r.minZ + Math.random() * (r.maxZ - r.minZ)
    if (kind.free && !kind.free(lx, lz)) continue
    const [x, z] = toWorld(at, lx, lz)
    if (!kind.spacing || herd.every((o, j) => j === i || Math.hypot(o.tx - x, o.tz - z) > kind.spacing)) return [x, z]
  }
  return toWorld(at, ...kind.fallback())
}

/** One frame of the i-th of `herd` wandering her pen: on to her spot, turning towards it; there, a while grazing or
 *  standing about; then off to a new free spot. She never leaves the part of the pen she roams. */
export function wander(a: Agent, i: number, herd: readonly Agent[], kind: Wander, pen: Pen, dt: number) {
  a.timer -= dt
  if (a.mode === 'walk') {
    const dx = a.tx - a.x
    const dz = a.tz - a.z
    const d = Math.hypot(dx, dz)
    const want = Math.atan2(dx, dz)
    a.heading = dampAngle(a.heading, want, kind.turn, dt)
    const step = kind.speed * dt
    if (d <= step + kind.arrive) {
      a.mode = Math.random() < kind.graze ? 'graze' : 'idle'
      const [least, more] = a.mode === 'graze' ? kind.grazeFor : kind.idleFor
      a.timer = least + Math.random() * more
    } else if (kind.ease === undefined) {
      a.x += (dx / d) * step
      a.z += (dz / d) * step
      a.phase += step * kind.legs
    } else {
      // ease off while turning, so she does not slide sideways
      const v = step * Math.max(kind.ease, Math.cos(want - a.heading))
      a.x += Math.sin(a.heading) * v
      a.z += Math.cos(a.heading) * v
      a.phase += v * kind.legs
    }
  } else if (a.timer <= 0) {
    ;[a.tx, a.tz] = freeSpot(kind, pen.at, herd, i)
    a.mode = 'walk'
  }
  a.x = Math.min(pen.area.maxX, Math.max(pen.area.minX, a.x))
  a.z = Math.min(pen.area.maxZ, Math.max(pen.area.minZ, a.z))
  a.stride = MathUtils.damp(a.stride, a.mode === 'walk' ? 1 : 0, kind.strideRate, dt)
}

/** She stands still for a while (milked, shorn): then off again. */
export function rest(a: Agent, seconds: number) {
  a.mode = 'idle'
  a.timer = seconds
}

/** The pen was moved (the edit mode): everyone in it comes along, each where she was in it. */
export function carryAlong(herd: readonly Agent[], from: Placement, to: Placement) {
  const turned = turnOf(to) - turnOf(from)
  for (const a of herd) {
    ;[a.x, a.z] = carry(from, to, a.x, a.z)
    ;[a.tx, a.tz] = carry(from, to, a.tx, a.tz)
    a.heading += turned
  }
}

const v3 = new Vector3()
const q = new Quaternion()
const eul = new Euler(0, 0, 0, 'YXZ')

/** Puts an animal's body (a kinematic box the player bumps into, its middle `y` up) where she is. One put somewhere
 *  else in one go (a test, a long pause) is placed there, not swept across the pen: a kinematic body that jumps metres
 *  in one step hits whatever is in the way at hundreds of metres a second. */
export function follow(body: RapierRigidBody, a: Agent, y: number) {
  v3.set(a.x, y, a.z)
  const at = body.translation()
  if (Math.hypot(at.x - a.x, at.z - a.z) > 0.6) body.setTranslation(v3, true)
  body.setNextKinematicTranslation(v3)
  body.setNextKinematicRotation(q.setFromEuler(eul.set(0, a.heading, 0, 'YXZ')))
}
