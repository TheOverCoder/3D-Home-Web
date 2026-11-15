import { Shape, type V3 } from '../lib/sculpt'
import type { Box } from '../data/buildings'

// Boxes with flat faces, each face painted on its own: what the walk-in buildings and their fittings are made of
// (./market.ts, ./estate.ts). Each face has its own four corners, so the light and a surface pattern lie flat on it and a
// box costs twelve triangles; the colours change only from face to face, or at a line across a face (a plinth, a dado: a
// pattern linear in height, exact between any two corners).

/** How a face of a box is painted: its colour, below `band.y` another (a plinth, a dado), and how much of the
 *  material's surface pattern shows on it (0 plain, the default; 1 the brick). */
export interface Paint {
  color: V3
  band?: { y: number; color: V3 }
  surface?: number
}

/** The six faces of a box, each its outward normal and its corners in order round it (counter-clockwise seen from
 *  outside). */
export const FACES: { n: V3; corners: (b: Box) => V3[] }[] = [
  {
    n: [1, 0, 0],
    corners: (b) => [
      [b.x1, b.y0, b.z1],
      [b.x1, b.y0, b.z0],
      [b.x1, b.y1, b.z0],
      [b.x1, b.y1, b.z1],
    ],
  },
  {
    n: [-1, 0, 0],
    corners: (b) => [
      [b.x0, b.y0, b.z0],
      [b.x0, b.y0, b.z1],
      [b.x0, b.y1, b.z1],
      [b.x0, b.y1, b.z0],
    ],
  },
  {
    n: [0, 1, 0],
    corners: (b) => [
      [b.x0, b.y1, b.z0],
      [b.x0, b.y1, b.z1],
      [b.x1, b.y1, b.z1],
      [b.x1, b.y1, b.z0],
    ],
  },
  {
    n: [0, -1, 0],
    corners: (b) => [
      [b.x0, b.y0, b.z0],
      [b.x1, b.y0, b.z0],
      [b.x1, b.y0, b.z1],
      [b.x0, b.y0, b.z1],
    ],
  },
  {
    n: [0, 0, 1],
    corners: (b) => [
      [b.x0, b.y0, b.z1],
      [b.x1, b.y0, b.z1],
      [b.x1, b.y1, b.z1],
      [b.x0, b.y1, b.z1],
    ],
  },
  {
    n: [0, 0, -1],
    corners: (b) => [
      [b.x1, b.y0, b.z0],
      [b.x0, b.y0, b.z0],
      [b.x0, b.y1, b.z0],
      [b.x1, b.y1, b.z0],
    ],
  },
]

/** A closed box with flat faces, each painted by `paint` (from its outward normal and its middle). */
export function cuboid(b: Box, paint: Paint | ((n: V3, middle: V3) => Paint), hidden?: (corners: V3[], n: V3) => boolean): Shape {
  const s = new Shape()
  for (const f of FACES) {
    const corners = f.corners(b)
    if (hidden?.(corners, f.n)) continue
    const middle: V3 = [(b.x0 + b.x1) / 2 + (f.n[0] * (b.x1 - b.x0)) / 2, (b.y0 + b.y1) / 2 + (f.n[1] * (b.y1 - b.y0)) / 2, (b.z0 + b.z1) / 2 + (f.n[2] * (b.z1 - b.z0)) / 2]
    const p = typeof paint === 'function' ? paint(f.n, middle) : paint
    const first = s.count
    for (const [x, y, z] of corners) {
      const k = s.vertex(x, y, z, p.color, 0)
      if (p.band) {
        // the band's colour shows below its line: the pattern crosses 0.5 there, exactly, whatever the face's size
        s.m[k] = 0.5 + (p.band.y - y) * 50
        s.c2[k * 3] = p.band.color[0]
        s.c2[k * 3 + 1] = p.band.color[1]
        s.c2[k * 3 + 2] = p.band.color[2]
      }
      s.s[k] = p.surface ?? 0
    }
    s.tri(first, first + 1, first + 2)
    s.tri(first, first + 2, first + 3)
  }
  return s
}

/** A box from its two corners, x y z each. */
export const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({ x0, x1, y0, y1, z0, z1 })
/** A box round a middle point, by half-sizes. */
export const around = (x: number, y: number, z: number, hx: number, hy: number, hz: number): Box => box(x - hx, x + hx, y - hy, y + hy, z - hz, z + hz)
