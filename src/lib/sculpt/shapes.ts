import { Vector3 } from 'three'
import { Shape, type V3 } from './core'

// The kit's shapes. All of them come out as a Shape (colour white, tint 1) to be painted, bent and merged.
//
// loft   — the workhorse: elliptical rings along a spine, smoothed between the rings you give. A cow's body is
//          eight rings from tail to chest; a leg is five rings from hip to hoof; a carrot is three.
// lathe  — a loft around the vertical axis from a profile [radius, height]: fruit, pots, hats, eggs.
// tube   — a round loft along a path with a radius at each point: stems, tails, horns, toes.
// blade  — a leaf: an outline along its length, a fold at the midrib, a bend, frilled edges.
// blob   — a lumpy ball (noise on a subdivided sphere): wool, clumps of leaves, tassels.

export interface Ring {
  /** centre of the ring */
  c: V3
  /** half-width (across the spine, sideways) */
  rx: number
  /** half-height (across the spine, "up") */
  ry: number
}

export interface LoftOptions {
  /** vertices around each ring */
  seg?: number
  /** extra rings between two given rings (smoothed with Catmull-Rom) */
  steps?: number
  /** which way is "up" for the rings (ry points there); for vertical spines give a forward direction */
  up?: V3
  /** radius multiplier by angle around the ring (0 = sideways right, π/2 = up) and position along (0..1) */
  shape?: (angle: number, along: number) => number
  /** close the open ends with a flat fan (otherwise end on a ring; give it radius 0 for a point) */
  caps?: [boolean, boolean]
  /** round the ends off: a dome this deep (along the spine) beyond the first and the last ring — a rump, a
   *  fingertip, the end of a fruit. Smooth, unlike closing in with ever smaller rings. */
  round?: [number, number]
}

/** A rounded square's radius at angle a, for a loft's `shape`: 1 on the axes; n = 2 is an ellipse, higher is
 *  squarer (3: a cow's rump, a loaf; 4 and up: a box with soft corners). */
export const squircle = (a: number, n: number) => Math.pow(Math.pow(Math.abs(Math.cos(a)), n) + Math.pow(Math.abs(Math.sin(a)), n), -1 / n)

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

/** Interpolates the given rings (Catmull-Rom through centres and radii). */
function sampleRings(rings: Ring[], steps: number): Ring[] {
  if (rings.length < 2) return rings
  const out: Ring[] = []
  const at = (k: number) => rings[Math.max(0, Math.min(rings.length - 1, k))]
  for (let k = 0; k < rings.length - 1; k++) {
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const [a, b, c, d] = [at(k - 1), at(k), at(k + 1), at(k + 2)]
      out.push({
        c: [0, 1, 2].map((j) => catmull(a.c[j], b.c[j], c.c[j], d.c[j], t)) as V3,
        rx: Math.max(0, catmull(a.rx, b.rx, c.rx, d.rx, t)),
        ry: Math.max(0, catmull(a.ry, b.ry, c.ry, d.ry, t)),
      })
    }
  }
  out.push(rings[rings.length - 1])
  return out
}

/** Elliptical rings along a spine: bodies, heads, limbs, fruit. */
export function loft(rings: Ring[], o: LoftOptions = {}): Shape {
  const seg = o.seg ?? 12
  let all = sampleRings(rings, o.steps ?? 3)
  const up = new Vector3(...(o.up ?? [0, 1, 0]))
  // the spine's direction at each ring
  const tangent = (r: number, list: Ring[]) => {
    const prev = list[Math.max(0, r - 1)].c
    const next = list[Math.min(list.length - 1, r + 1)].c
    return new Vector3(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]).normalize()
  }
  // rounded ends: rings on a quarter ellipse beyond the first and last, closing to a point
  const [r0, r1] = o.round ?? [0, 0]
  const domeRings = (base: Ring, dir: Vector3, depth: number) => {
    const k = Math.max(3, Math.round(seg / 3))
    const out: Ring[] = []
    for (let j = 1; j <= k; j++) {
      const th = (j / k) * (Math.PI / 2)
      const f = j === k ? 0.001 : Math.cos(th)
      out.push({ c: [base.c[0] + dir.x * depth * Math.sin(th), base.c[1] + dir.y * depth * Math.sin(th), base.c[2] + dir.z * depth * Math.sin(th)], rx: base.rx * f, ry: base.ry * f })
    }
    return out
  }
  const domeStart = r0 > 0 ? domeRings(all[0], tangent(0, all).negate(), r0).reverse() : []
  const domeEnd = r1 > 0 ? domeRings(all[all.length - 1], tangent(all.length - 1, all), r1) : []
  const startCount = domeStart.length
  const bodyCount = all.length
  all = [...domeStart, ...all, ...domeEnd]
  const shape = new Shape()
  const T = new Vector3()
  const N = new Vector3()
  const S = new Vector3()
  const n = all.length
  for (let r = 0; r < n; r++) {
    // dome rings share the frame of the ring they grow from, so the end stays round
    const own = Math.max(startCount, Math.min(startCount + bodyCount - 1, r))
    const prev = all[Math.max(startCount, own - 1)].c
    const next = all[Math.min(startCount + bodyCount - 1, own + 1)].c
    T.set(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]).normalize()
    // "up" for this ring: the reference up, made square to the spine
    N.copy(up).addScaledVector(T, -up.dot(T))
    if (N.lengthSq() < 1e-8) N.set(0, 0, 1).addScaledVector(T, -T.z)
    N.normalize()
    S.crossVectors(N, T).normalize()
    const ring = all[r]
    const along = bodyCount > 1 ? Math.max(0, Math.min(1, (r - startCount) / (bodyCount - 1))) : 0
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2
      const m = o.shape ? o.shape(a, along) : 1
      const cx = Math.cos(a) * ring.rx * m
      const cy = Math.sin(a) * ring.ry * m
      shape.vertex(ring.c[0] + S.x * cx + N.x * cy, ring.c[1] + S.y * cx + N.y * cy, ring.c[2] + S.z * cx + N.z * cy)
    }
  }
  for (let r = 0; r < n - 1; r++) {
    for (let k = 0; k < seg; k++) {
      const a = r * seg + k
      const b = r * seg + ((k + 1) % seg)
      const c = (r + 1) * seg + k
      const d = (r + 1) * seg + ((k + 1) % seg)
      shape.tri(a, b, c)
      shape.tri(b, d, c)
    }
  }
  const [capStart, capEnd] = o.caps ?? [false, false]
  if (capStart && !r0) {
    const c0 = all[0].c
    const centre = shape.vertex(c0[0], c0[1], c0[2])
    for (let k = 0; k < seg; k++) shape.tri(centre, (k + 1) % seg, k)
  }
  if (capEnd && !r1) {
    const cn = all[n - 1].c
    const centre = shape.vertex(cn[0], cn[1], cn[2])
    const base = (n - 1) * seg
    for (let k = 0; k < seg; k++) shape.tri(centre, base + k, base + ((k + 1) % seg))
  }
  return shape
}

/** Round about the vertical axis, from [radius, height] pairs bottom to top. */
export function lathe(profile: [number, number][], o: Omit<LoftOptions, 'up'> = {}): Shape {
  return loft(
    profile.map(([r, y]) => ({ c: [0, y, 0] as V3, rx: r, ry: r })),
    { ...o, up: [0, 0, 1] },
  )
}

/** A round tube along points, with a radius at each point. */
export function tube(points: V3[], radii: number[] | number, o: LoftOptions = {}): Shape {
  const r = (k: number) => (typeof radii === 'number' ? radii : radii[Math.min(k, radii.length - 1)])
  // a vertical-ish path needs a horizontal "up" for its rings
  const d = new Vector3(points[points.length - 1][0] - points[0][0], points[points.length - 1][1] - points[0][1], points[points.length - 1][2] - points[0][2]).normalize()
  const up: V3 = Math.abs(d.y) > 0.8 ? [0, 0, 1] : [0, 1, 0]
  return loft(
    points.map((c, k) => ({ c, rx: r(k), ry: r(k) })),
    { up, ...o },
  )
}

/** An ellipsoid (a loft from pole to pole): heads of hens, eyes, beads, berries. */
export function ellipsoid(rx: number, ry: number, rz: number, seg = 10, rings = 6): Shape {
  const list: Ring[] = []
  for (let k = 0; k <= rings; k++) {
    const t = -Math.PI / 2 + (k / rings) * Math.PI
    list.push({ c: [0, 0, rz * Math.sin(t)], rx: rx * Math.cos(t), ry: ry * Math.cos(t) })
  }
  return loft(list, { seg, steps: 1 })
}

export interface BladeOptions {
  length: number
  width: number
  /** half-width at u (0 base … 1 tip), as a share of `width` (default: a classic leaf, 0 at both ends) */
  outline?: (u: number) => number
  /** fold at the midrib, radians: the two halves rise into a shallow V */
  fold?: number
  /** curl along the length, radians in total (positive arches up, negative droops) */
  bend?: number
  /** wavy edges: amplitude (share of width) and number of waves along the leaf */
  frill?: number
  waves?: number
  /** saw-toothed edges: depth (share of width) and number of teeth */
  teeth?: number
  toothCount?: number
  /** subdivisions along and across (each half) */
  segL?: number
  segW?: number
}

const classic = (u: number) => Math.sin(Math.PI * Math.pow(u, 0.85)) * (1 - 0.15 * u)

/** A leaf blade: from the origin along +z, flat in x, facing up (+y). Draw it double-sided. */
export function blade(o: BladeOptions): Shape {
  const L = o.length
  const W = o.width / 2
  const segL = o.segL ?? 6
  const segW = o.segW ?? 2
  const outline = o.outline ?? classic
  const fold = o.fold ?? 0.25
  const bend = o.bend ?? 0.4
  const shape = new Shape()
  const cols = segW * 2 + 1
  for (let i = 0; i <= segL; i++) {
    const u = i / segL
    // position on the bent midrib: an arc of total angle `bend`
    const th = bend * u
    const R = Math.abs(bend) > 1e-4 ? L / bend : 0
    const mz = R ? R * Math.sin(th) : L * u
    const my = R ? R * (1 - Math.cos(th)) : 0
    // the midrib's local up (the leaf's normal before the fold), tilting as it curls
    const ny = Math.cos(th)
    const nz = -Math.sin(th)
    let half = outline(u) * W
    if (o.teeth && o.toothCount) half *= 1 - o.teeth * Math.abs(Math.sin(u * Math.PI * o.toothCount)) ** 2
    for (let j = 0; j < cols; j++) {
      const v = (j - segW) / segW // −1 … 1 across
      const x = v * half
      // the fold lifts the edges, the frill waves them
      let lift = Math.abs(v) * half * Math.tan(fold)
      if (o.frill) lift += Math.sin(u * Math.PI * (o.waves ?? 5) + v * 2) * o.frill * W * Math.abs(v) ** 1.5
      shape.vertex(x, my + ny * lift, mz + nz * lift)
    }
  }
  for (let i = 0; i < segL; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j
      const b = a + 1
      const c = a + cols
      const d = c + 1
      shape.tri(a, c, b)
      shape.tri(b, c, d)
    }
  }
  return shape
}

/** A lumpy ball: a subdivided octahedron pushed out by `bump` (wool, leaf clumps, tassels). */
export function blob(radius: number, detail = 2, bump?: (x: number, y: number, z: number) => number): Shape {
  // octahedron, subdivided `detail` times, projected onto the sphere
  let verts: V3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]
  let faces: [number, number, number][] = [
    [0, 2, 4],
    [4, 2, 1],
    [1, 2, 5],
    [5, 2, 0],
    [4, 3, 0],
    [1, 3, 4],
    [5, 3, 1],
    [0, 3, 5],
  ]
  for (let d = 0; d < detail; d++) {
    const mid = new Map<string, number>()
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`
      let m = mid.get(key)
      if (m === undefined) {
        const p = verts[a]
        const q = verts[b]
        const v: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]
        const l = Math.hypot(...v)
        verts.push([v[0] / l, v[1] / l, v[2] / l])
        m = verts.length - 1
        mid.set(key, m)
      }
      return m
    }
    const next: typeof faces = []
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b)
      const bc = midpoint(b, c)
      const ca = midpoint(c, a)
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca])
    }
    faces = next
    verts = verts.slice()
  }
  const shape = new Shape()
  for (const [x, y, z] of verts) {
    const k = radius * (1 + (bump ? bump(x, y, z) : 0))
    shape.vertex(x * k, y * k, z * k)
  }
  for (const [a, b, c] of faces) shape.tri(a, b, c)
  return shape
}
