import { Vector3 } from 'three'
import type { Angle, Cam, Size } from './format'

// Where the camera stands for a shot, worked out from what it frames and the screen it is drawn on: a shot names its
// subjects, how much of them it shows (size), the angle and the move; this finds the distance that fits them upright
// or sideways, keeps the camera on one side of the scene's line (the 180° rule), and plays the move through the shot.
// A phone held upright is narrow: there two people side by side are turned into depth (a three-quarter two-shot)
// rather than shrunk, favouring the first one named.

/** What a camera can frame: a person (their head's middle, their height) or a thing (its middle and size). */
export interface Subject {
  x: number
  y: number
  z: number
  /** a person's head's middle, or a thing's middle */
  head: number
  h: number
  w: number
  heading: number
  person: boolean
  /** an animal: framed by its own height, its head in a close shot (as a person's face is) */
  animal?: boolean
  /** how long it is along its heading (an animal: a cow seen from the side is wide), m */
  long?: number
}

export interface CamNow {
  pos: Vector3
  look: Vector3
  fov: number
}

/** The height of the picture at the subject (m) for each size: a person, and a thing (times its height). */
const PERSON_FRAME: Record<Size, number> = { extreme: 0.34, close: 0.62, medium: 1.15, full: 2.4, wide: 4.4 }
const THING_FRAME: Record<Size, number> = { extreme: 1.25, close: 1.7, medium: 2.4, full: 3.2, wide: 4.6 }
/** An animal's (times its height): a close shot is its head and neck, a full one all of it with room round it. */
const ANIMAL_FRAME: Record<Size, number> = { extreme: 0.55, close: 0.9, medium: 1.6, full: 2.6, wide: 4.6 }
/** The lens (vertical degrees, sideways) for each size: longer for the close ones, as a film's. */
const LENS: Record<Size, number> = { extreme: 28, close: 32, medium: 38, full: 44, wide: 48 }
/** How far above (+) or below (−) the look point the camera is, in radians of pitch. */
const PITCH: Record<Angle, number> = { eye: 0.02, low: -0.32, ground: -0.42, high: 0.42, top: 1.15 }

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k))
const out = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3

/** The point a shot looks at on a subject, for its size. */
function lookPoint(s: Subject, size: Size) {
  if (s.animal && (size === 'close' || size === 'extreme')) return new Vector3(s.x + Math.sin(s.heading) * (s.long ?? 0) * 0.3, s.h * 0.8, s.z + Math.cos(s.heading) * (s.long ?? 0) * 0.3)
  if (!s.person) return new Vector3(s.x, s.y, s.z)
  const y = size === 'extreme' || size === 'close' ? s.head : size === 'medium' ? s.head - 0.32 : size === 'full' ? s.head * 0.58 : s.head * 0.5
  return new Vector3(s.x, y, s.z)
}

const facing = (h: number) => new Vector3(Math.sin(h), 0, Math.cos(h))
const turnY = (v: Vector3, a: number) => new Vector3(v.x * Math.cos(a) + v.z * Math.sin(a), 0, -v.x * Math.sin(a) + v.z * Math.cos(a))

export interface CamContext {
  /** the subjects where they are at the shot's end (the camera's place: whoever walks, walks into the picture), and
   *  now (where it looks) */
  from: Subject[]
  now: Subject[]
  /** an over-the-shoulder shot's near person (start, now) */
  shoulder?: { from: Subject; now: Subject }
  /** the scene's line (its two people where they are) and its side */
  line?: [Subject, Subject]
  side: number
  /** the camera stays on the lane's side of what it films (north of it, looking south at the woods: the pen's films
   *  never look across the lane at the player's own farm, FILM.md) */
  south?: boolean
  aspect: number
  /** through the shot (0..1) and seconds into it */
  u: number
  secs: number
  reduced: boolean
}

/** The scene's side of its line: the right of its first person looking at the second, or the left. */
function sideNormal(c: CamContext) {
  if (!c.line) return null
  const [a, b] = c.line
  const v = new Vector3(b.x - a.x, 0, b.z - a.z).normalize()
  return new Vector3(-v.z, 0, v.x).multiplyScalar(c.side)
}

export function shotCamera(cam: Cam, c: CamContext): CamNow {
  const size = cam.size ?? 'medium'
  const angle = cam.angle ?? 'eye'
  const upright = c.aspect < 1
  const n = sideNormal(c)
  // from the floor: a wide lens, near, so the subject towers
  let fov = LENS[size] * (upright ? 1.25 : 1) * (angle === 'ground' ? 1.45 : 1)

  let pos: Vector3
  let look: Vector3
  if (c.shoulder) {
    // over the shoulder: behind the near person's head and to the scene's side, the far one in the picture
    const near = c.shoulder.from
    const far = c.from[0]
    const back = new Vector3(near.x - far.x, 0, near.z - far.z).normalize()
    const side = n ?? new Vector3(-back.z, 0, back.x)
    const k = size === 'close' || size === 'extreme' ? 0.55 : size === 'medium' ? 0.8 : 1.3
    // (over a shoulder onto a thing, further aside: the thing is small and the head near; behind an animal, behind its
    // back half too)
    const aside = (upright ? 0.24 : 0.36) * Math.min(1.2, k + 0.3) + (far.person ? 0 : 0.22) + (near.long ?? 0) * 0.25
    pos = new Vector3(near.x, near.head + 0.1, near.z).addScaledVector(back, 0.62 * k + 0.1 + (near.long ?? 0) / 2).addScaledVector(side, aside)
    const f = lookPoint(c.now[0], size)
    const nh = lookPoint(c.shoulder.now, size)
    look = f.multiplyScalar(0.88).addScaledVector(nh, 0.12)
    look.y = lookPoint(c.now[0], size).y
    // over a shoulder the camera stays put: a push or a punch is the lens closing in
    if (cam.move === 'punch' && !c.reduced) fov *= 1.35 - 0.35 * out(c.secs / 0.16)
    if (cam.move === 'push') fov *= 1.1 - 0.2 * ease(c.u)
  } else {
    const centre = (list: Subject[]) => list.reduce((v, s) => v.add(lookPoint(s, size)), new Vector3()).multiplyScalar(1 / list.length)
    const at = centre(c.from)
    look = centre(c.now)
    const first = c.from[0]
    // the camera's way from the subject, on the ground
    let dir: Vector3
    if (typeof cam.from === 'number') dir = facing(first.heading + (cam.from * Math.PI) / 180)
    else if (cam.from === 'side' && n) {
      dir = n.clone()
      // upright: turned towards the second's back, so the two stand in depth and the first is favoured
      if (upright && c.from.length > 1) {
        const second = c.from[1]
        const towards = new Vector3(second.x - first.x, 0, second.z - first.z).normalize()
        dir = dir.multiplyScalar(Math.cos(0.85)).addScaledVector(towards, Math.sin(0.85)).normalize()
      }
    } else if (first.person) {
      // a three-quarter view from the front, on the scene's side of the line
      const a = facing(first.heading + 0.6)
      const b = facing(first.heading - 0.6)
      dir = n ? (a.dot(n) >= b.dot(n) ? a : b) : a
    } else dir = facing(first.heading)
    // (on the lane's side: an angle that would stand the camera south of them, looking at the farm, is turned to the
    // north of them, the same side of them east or west)
    if (c.south && dir.z > -0.5) {
      dir.z = -Math.max(0.5, Math.abs(dir.z))
      dir.x = (Math.sign(dir.x) || 1) * Math.sqrt(1 - dir.z * dir.z)
    }
    // how big a picture: the size, or the subjects' own spread up and down
    const tall = Math.max(
      ...c.from.map((s) => (s.person ? PERSON_FRAME[size] : (s.animal ? ANIMAL_FRAME[size] : THING_FRAME[size]) * s.h)),
      c.from.length > 1 ? Math.max(...c.from.map((s) => lookPoint(s, size).y)) - Math.min(...c.from.map((s) => lookPoint(s, size).y)) + PERSON_FRAME[size] : 0,
    )
    const across = new Vector3(-dir.z, 0, dir.x)
    const xs = c.from.map((s) => across.dot(new Vector3(s.x, 0, s.z)))
    // a thing is as wide as its face looks from here (seen along its length, a run of shelves is narrow)
    // (an animal is as wide as its body across and its length along its heading, as it stands to the camera)
    const width = (s: Subject) =>
      s.person
        ? size === 'close' || size === 'extreme'
          ? 0.42
          : 0.6
        : Math.max(0.4, s.w * 1.1 * Math.abs(across.dot(new Vector3(Math.cos(s.heading), 0, -Math.sin(s.heading)))), (s.long ?? 0) * 1.1 * Math.abs(across.dot(facing(s.heading))))
    const wide = Math.max(...xs) - Math.min(...xs) + Math.max(...c.from.map(width))
    const tanV = Math.tan(((fov / 2) * Math.PI) / 180)
    let d = Math.max(tall / 2 / tanV, wide / 2 / (tanV * c.aspect)) * (angle === 'ground' ? 0.85 : 1)
    // from the floor, a thing up on a wall is seen from far enough to look over what juts out under it (an awning)
    if (angle === 'ground' && c.from.every((s) => !s.person && s.y > 1.2)) d = Math.max(d, 4.5)
    // the move: in, out, round, sideways, or a comic punch in at the start
    const u = ease(c.u)
    let pitch = PITCH[angle] * (angle === 'low' && (size === 'close' || size === 'extreme') ? 0.6 : 1)
    const move = c.reduced && (cam.move === 'punch' || cam.move === 'orbit') ? 'still' : (cam.move ?? 'still')
    if (move === 'push') d *= 1.14 - 0.26 * u
    if (move === 'pull') d *= 0.86 + 0.3 * u
    if (move === 'punch') d *= 1.35 - 0.35 * out(c.secs / 0.16)
    if (move === 'orbit') dir = turnY(dir, (u - 0.5) * 0.5)
    if (move === 'crane') pitch += -0.18 + 0.42 * u
    pos = at.clone().addScaledVector(dir, d * Math.cos(pitch))
    pos.y = at.y + d * Math.sin(pitch)
    if (move === 'drift') pos.addScaledVector(across, (u - 0.5) * 0.18 * d)
    if (move === 'crane') pos.y += 1.0 * u
    if (angle === 'ground') {
      // from the floor: the camera at a hand's height, looking up at the subject
      pos.y = 0.2
      look.y = Math.max(look.y, at.y)
    }
  }
  // never under the ground
  pos.y = Math.max(0.15, pos.y)
  // an impact: a short shake, gone in half a second (none for less motion)
  if (cam.shake && !c.reduced && c.secs < 0.5) {
    const k = cam.shake * (1 - c.secs / 0.5) ** 2 * 0.06
    pos.x += Math.sin(c.secs * 71) * k
    pos.y += Math.sin(c.secs * 53 + 1) * k
    look.x += Math.sin(c.secs * 61 + 2) * k
  }
  return { pos, look, fov }
}
