import { Parts, Shape, rgb, type V3 } from '../lib/sculpt'
import type { AutoDoor, Box } from '../data/buildings'

// A walk-in building's automatic sliding door (its row's `autoDoor`, src/data/buildings.ts): two painted leaves that
// meet in the middle of the doorway and slide apart into the wall at either side (src/scene/WalkIn.tsx opens them).
// Each leaf is a closed box with flat faces. Shut, they close the doorway with no gap anywhere: each reaches FIT.pocket
// into the wall at its side and FIT.up behind the lintel, and the two overlap FIT.meet past the middle, set FIT.stagger
// apart across the wall so no face lies on another. Open, each is inside the wall. They cast no shadow: they stand in
// the shell's.

export const FIT = { pocket: 0.02, meet: 0.01, stagger: 0.01, up: 0.03 } as const

const LEAF = rgb(0x2c5c36)
const KICK = rgb(0x4a4f53)
/** The kick plate along the leaf's foot, up to here (m). */
const KICK_Y = 0.18

/** The six faces of a box: each its corners in order round it, counter-clockwise seen from outside. */
const FACES: ((b: Box) => V3[])[] = [
  (b) => [
    [b.x1, b.y0, b.z1],
    [b.x1, b.y0, b.z0],
    [b.x1, b.y1, b.z0],
    [b.x1, b.y1, b.z1],
  ],
  (b) => [
    [b.x0, b.y0, b.z0],
    [b.x0, b.y0, b.z1],
    [b.x0, b.y1, b.z1],
    [b.x0, b.y1, b.z0],
  ],
  (b) => [
    [b.x0, b.y1, b.z0],
    [b.x0, b.y1, b.z1],
    [b.x1, b.y1, b.z1],
    [b.x1, b.y1, b.z0],
  ],
  (b) => [
    [b.x0, b.y0, b.z0],
    [b.x1, b.y0, b.z0],
    [b.x1, b.y0, b.z1],
    [b.x0, b.y0, b.z1],
  ],
  (b) => [
    [b.x0, b.y0, b.z1],
    [b.x1, b.y0, b.z1],
    [b.x1, b.y1, b.z1],
    [b.x0, b.y1, b.z1],
  ],
  (b) => [
    [b.x1, b.y0, b.z0],
    [b.x0, b.y0, b.z0],
    [b.x0, b.y1, b.z0],
    [b.x1, b.y1, b.z0],
  ],
]

/** One leaf in its own frame: `door`'s half width and the fit, along x round the origin; from the ground up past the
 *  door's top; its thickness along z round the origin. Painted, with a kick plate (the pattern's second colour below
 *  KICK_Y: linear in height, so exact between any two corners). */
export function leafShape(door: AutoDoor): Shape {
  const w = (Math.max(door.x1 - door.x0, door.z1 - door.z0) / 2 + FIT.meet + FIT.pocket) / 2
  const t = door.thick / 2
  const s = new Shape()
  for (const face of FACES) {
    const first = s.count
    for (const [x, y, z] of face({ x0: -w, x1: w, y0: 0, y1: door.height + FIT.up, z0: -t, z1: t })) {
      const k = s.vertex(x, y, z, LEAF, 0)
      s.m[k] = 0.5 + (KICK_Y - y) * 50
      s.c2[k * 3] = KICK[0]
      s.c2[k * 3 + 1] = KICK[1]
      s.c2[k * 3 + 2] = KICK[2]
      s.s[k] = 0
    }
    s.tri(first, first + 1, first + 2)
    s.tri(first, first + 2, first + 3)
  }
  return s
}

/** Where the two leaves' middles stand, the door open by `open` (0 shut, 1 open; eased), and which way they face. */
export function leafPlaces(door: AutoDoor, open: number): { x: number; z: number; heading: number }[] {
  const alongX = door.x1 - door.x0 >= door.z1 - door.z0
  const [u0, u1] = alongX ? [door.x0, door.x1] : [door.z0, door.z1]
  const v = alongX ? (door.z0 + door.z1) / 2 : (door.x0 + door.x1) / 2
  const c = (u0 + u1) / 2
  const e = open * open * (3 - 2 * open)
  const slide = door.travel * e
  const left = (u0 - FIT.pocket + c + FIT.meet) / 2 - slide
  const right = (c - FIT.meet + u1 + FIT.pocket) / 2 + slide
  const place = (u: number, dv: number) => (alongX ? { x: u, z: v + dv, heading: 0 } : { x: v + dv, z: u, heading: Math.PI / 2 })
  return [place(left, -FIT.stagger / 2), place(right, FIT.stagger / 2)]
}

/** The door's leaves: one instanced draw, not casting. */
export function slidingDoorParts(door: AutoDoor): Parts<'leaf'> {
  return new Parts<'leaf'>({ leaf: { geometry: leafShape(door).geometry(), max: 2, material: { roughness: 0.5 }, castShadow: false } }, 'sliding-door')
}

/** Puts both leaves, the door open by `open`. */
export function putSlidingDoor(parts: Parts<'leaf'>, door: AutoDoor, open: number) {
  parts.begin()
  for (const p of leafPlaces(door, open)) {
    parts.at(p.x, 0, p.z, p.heading)
    parts.put('leaf', 0, 0, 0)
  }
  parts.end()
}
