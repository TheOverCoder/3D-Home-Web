// The house's walls as occluders: a thing that lies wholly behind one opaque wall piece, as seen from the eye, cannot
// show, so the camera's pass leaves it out (pass.ts). Exact, not a guess: the piece's middle rectangle lies inside its
// closed, opaque box, so every line from the eye through that rectangle meets the box's near face first. A box wholly
// beyond the rectangle's plane is behind the piece when its shadow on that plane, cast from the eye, lies inside the
// rectangle (the region behind a convex rectangle is convex, so its eight corners decide). A wall fading (third
// person, decorating) is no occluder, nor one the eye is too near to (the camera's near plane could cut it open). One
// piece at a time: what is hidden only by two pieces together is drawn.
//
// Fast: the pieces are grouped by the plane they stand in (the house has six), so a box is tested once per plane it
// lies wholly beyond — two divisions for its shadow there — and then against that plane's rectangles.

export interface WallPiece {
  /** the wall runs along x (its plane is z = at) or along z (its plane is x = at) */
  axis: 'x' | 'z'
  at: number
  /** along the wall, from a to b; and from y0 up to y1 */
  a: number
  b: number
  y0: number
  y1: number
  /** the piece's box in the world: min x, y, z, max x, y, z */
  box: readonly number[]
}

export interface WallSource {
  pieces: readonly WallPiece[]
  /** piece i is opaque and drawn whole this render */
  opaque: (i: number) => boolean
  /** the walls are in the scene and shown */
  drawn: () => boolean
}

let source: WallSource | null = null

/** The walls to use (Walls.tsx); the returned function takes them away again. */
export function setWalls(s: WallSource): () => void {
  source = s
  return () => {
    if (source === s) source = null
  }
}

/** How far a box must be beyond a plane, and its shadow inside a rectangle's edges (m): rounding, and the silhouette's
 *  pixels, never decide it. */
const INSIDE = 0.02
const MAX = 96

// the planes in use this render: the axis across it (0: x = at, 2: z = at), where, which side the eye is on, and the
// range of its rectangles in `rects` (a, b, y0, y1, each already brought in by INSIDE)
const planeAxis = new Int8Array(MAX)
const planeAt = new Float64Array(MAX)
const planeSide = new Int8Array(MAX)
const planeFrom = new Int32Array(MAX)
const planeTo = new Int32Array(MAX)
const rects = new Float64Array(MAX * 4)
let planes = 0
let used = 0
const eye = [0, 0, 0]
// the pieces in use, sorted by their plane (reused from render to render)
const order: number[] = []
const keyOf = (p: WallPiece) => (p.axis === 'x' ? 2 : 0) * 1e6 + p.at

/** Sets up the pieces in use for a render from the eye; returns how many. */
export function updateWalls(ex: number, ey: number, ez: number, near: number, far: number): number {
  used = planes = 0
  const s = source
  if (!s || !s.drawn()) return 0
  eye[0] = ex
  eye[1] = ey
  eye[2] = ez
  // the near plane is nearer than this everywhere in view (a point in view at distance d is at least d·cos 80° deep)
  const nearest = Math.max(0.5, near * 8)
  order.length = 0
  for (let i = 0; i < s.pieces.length && order.length < MAX; i++) {
    if (!s.opaque(i)) continue
    const p = s.pieces[i]
    const bx = p.box
    const dx = Math.max(bx[0] - ex, 0, ex - bx[3])
    const dy = Math.max(bx[1] - ey, 0, ey - bx[4])
    const dz = Math.max(bx[2] - ez, 0, ez - bx[5])
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (d < nearest || d > far * 0.5) continue
    if (Math.abs((p.axis === 'x' ? ez : ex) - p.at) < 1e-6) continue
    // a rectangle too small to hide anything once brought in
    if (p.b - p.a <= 2 * INSIDE || p.y1 - p.y0 <= 2 * INSIDE) continue
    order.push(i)
  }
  order.sort((i, j) => keyOf(s.pieces[i]) - keyOf(s.pieces[j]))
  let last = NaN
  for (const i of order) {
    const p = s.pieces[i]
    const key = keyOf(p)
    if (key !== last) {
      last = key
      const k = p.axis === 'x' ? 2 : 0
      planeAxis[planes] = k
      planeAt[planes] = p.at
      planeSide[planes] = eye[k] > p.at ? 1 : -1
      planeFrom[planes] = used
      planes++
    }
    rects[used * 4] = p.a + INSIDE
    rects[used * 4 + 1] = p.b - INSIDE
    rects[used * 4 + 2] = p.y0 + INSIDE
    rects[used * 4 + 3] = p.y1 - INSIDE
    used++
    planeTo[planes - 1] = used
  }
  return used
}

/** Whether a world box lies wholly behind one of the pieces in use. */
export function wallHides(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
  const ey = eye[1]
  for (let q = 0; q < planes; q++) {
    const k = planeAxis[q]
    const at = planeAt[q]
    // the box's near and far extent across the plane, its extent along it
    let lo: number, hi: number, u0: number, u1: number, eu: number, ek: number
    if (k === 2) {
      lo = minZ
      hi = maxZ
      u0 = minX
      u1 = maxX
      eu = eye[0]
      ek = eye[2]
    } else {
      lo = minX
      hi = maxX
      u0 = minZ
      u1 = maxZ
      eu = eye[2]
      ek = eye[0]
    }
    // wholly beyond the plane, as seen from the eye
    if (planeSide[q] > 0 ? hi > at - INSIDE : lo < at + INSIDE) continue
    // its shadow on the plane: a corner c goes to eye + (c - eye)·t, t = (at - eye) / (c - eye) across the plane (0 < t
    // <= 1); for each t the lowest end is the box's lowest, so the extremes are at the box's ends, the nearest and the
    // farthest t
    const t0 = (at - ek) / (lo - ek)
    const t1 = (at - ek) / (hi - ek)
    const a0 = eu + (u0 - eu) * t0
    const a1 = eu + (u0 - eu) * t1
    const b0 = eu + (u1 - eu) * t0
    const b1 = eu + (u1 - eu) * t1
    const c0 = ey + (minY - ey) * t0
    const c1 = ey + (minY - ey) * t1
    const d0 = ey + (maxY - ey) * t0
    const d1 = ey + (maxY - ey) * t1
    const sMin = a0 < a1 ? a0 : a1
    const sMax = b0 > b1 ? b0 : b1
    const yMin = c0 < c1 ? c0 : c1
    const yMax = d0 > d1 ? d0 : d1
    for (let r = planeFrom[q]; r < planeTo[q]; r++) {
      const o = r * 4
      if (sMin >= rects[o] && sMax <= rects[o + 1] && yMin >= rects[o + 2] && yMax <= rects[o + 3]) return true
    }
  }
  return false
}
