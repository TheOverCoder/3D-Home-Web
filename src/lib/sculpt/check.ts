import { Matrix4, Vector3, type BufferGeometry } from 'three'
import type { V3 } from './core'
import type { Parts } from './parts'

// The kit's inspector: does every piece of a model hold on to the rest of it, and does the model stand on what it
// stands on? A model is split into pieces (connected bits of mesh: a face, an eye, a lip, a horn, a tomato), and two
// pieces hold together when they touch (within a tolerance), when their surfaces cross, or when one is buried in
// the other. Every piece must be linked, through the others, to the main body — or to the ground, when the model
// stands on one (a clump of wheat is three stalks, each in the soil); a piece that is not is "loose" (a mouth
// hovering in front of a face, a head floating off its neck, a tomato in mid-air). The model's lowest point must be
// on the ground: above it, it is "floating"; deep under it, "sunk".
//
// An open end (a ring a loft stops on, a pot's rim) is fine where it is buried in another piece — a leg's top in
// the body — and a hole where it is not: you would see into the shape, and through it. Every open end is closed
// for the check with a flat cap of its own, so a piece counts as solid wherever it is, and that cap must lie inside
// another piece (or on the ground): otherwise it is "open". Leaves and other thin, open surfaces are named in
// `open` and left alone.
//
// Models are checked in several poses (grazing, walking, pecking…), so joints that open as the parts move are
// caught too. The gallery (?gallery) runs every check and lists what it finds; the e2e suite fails on any finding.

export interface Piece {
  part: string
  index: number
  /** vertex positions in the model's frame */
  p: Float32Array
  /** triangles (indices into p / 3) */
  t: Uint32Array
  min: V3
  max: V3
  grid?: TriGrid
  /** its open ends: loops of vertices (indices into p / 3), each with the centre of the cap that closes it */
  loops?: { ring: number[]; centre: V3; size: number }[]
  /** the piece closed with those caps (for telling inside from outside) */
  solid?: { p: Float32Array; t: Uint32Array }
}

export interface Issue {
  kind: 'loose' | 'floating' | 'sunk' | 'open'
  /** the model, its variant and pose, and the piece */
  where: string
  /** how far it is from what it should touch, metres */
  gap: number
  /** where it is, in the model's frame */
  at: V3
}

export interface CheckOptions {
  /** the height of the surface the model stands on (none: do not check the ground) */
  ground?: number
  /** how close counts as touching (metres) */
  tolerance?: number
  /** how far under the ground the lowest point may be (hooves in grass, roots in soil) */
  sink?: number
  /** parts that are open surfaces by design (leaves, petals, a shell seen from both sides): their edges are not
   *  holes */
  open?: string[]
}

const v = new Vector3()

/** Splits a geometry (placed by `matrix`) into its connected pieces, in the model's frame. */
export function piecesOf(part: string, geometry: BufferGeometry, matrix?: Matrix4): Piece[] {
  const pos = geometry.getAttribute('position')
  const n = pos.count
  const index = geometry.getIndex()
  const tri: ArrayLike<number> = index ? index.array : Array.from({ length: n }, (_, i) => i)
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (a: number) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]]
      a = parent[a]
    }
    return a
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  for (let k = 0; k < tri.length; k += 3) {
    union(tri[k], tri[k + 1])
    union(tri[k], tri[k + 2])
  }
  // vertices at the same spot are one (a flat cap has vertices of its own along the edge it closes)
  const at = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`
    const j = at.get(key)
    if (j === undefined) at.set(key, i)
    else union(i, j)
  }
  const groups = new Map<number, { map: Map<number, number>; t: number[] }>()
  for (let k = 0; k < tri.length; k += 3) {
    const root = find(tri[k])
    let g = groups.get(root)
    if (!g) groups.set(root, (g = { map: new Map(), t: [] }))
    for (let j = 0; j < 3; j++) {
      const vi = tri[k + j]
      let li = g.map.get(vi)
      if (li === undefined) g.map.set(vi, (li = g.map.size))
      g.t.push(li)
    }
  }
  const out: Piece[] = []
  let index_ = 0
  for (const g of groups.values()) {
    const p = new Float32Array(g.map.size * 3)
    const min: V3 = [Infinity, Infinity, Infinity]
    const max: V3 = [-Infinity, -Infinity, -Infinity]
    for (const [vi, li] of g.map) {
      v.fromBufferAttribute(pos, vi)
      if (matrix) v.applyMatrix4(matrix)
      p[li * 3] = v.x
      p[li * 3 + 1] = v.y
      p[li * 3 + 2] = v.z
      min[0] = Math.min(min[0], v.x)
      min[1] = Math.min(min[1], v.y)
      min[2] = Math.min(min[2], v.z)
      max[0] = Math.max(max[0], v.x)
      max[1] = Math.max(max[1], v.y)
      max[2] = Math.max(max[2], v.z)
    }
    out.push({ part, index: index_++, p, t: Uint32Array.from(g.t), min, max })
  }
  return out
}

// ───────────────────────────── geometry helpers ─────────────────────────────

/** Triangles of a piece bucketed in a coarse grid, to find the ones near a point or a segment quickly. */
class TriGrid {
  readonly cell: number
  readonly origin: V3
  readonly dims: [number, number, number]
  readonly cells = new Map<number, number[]>()
  constructor(readonly piece: Piece) {
    const { min, max, p, t } = piece
    const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2])
    this.cell = Math.max(diag / 14, 1e-4)
    this.origin = [min[0] - this.cell, min[1] - this.cell, min[2] - this.cell]
    this.dims = [0, 1, 2].map((a) => Math.max(1, Math.ceil((max[a] - min[a]) / this.cell) + 2)) as [number, number, number]
    for (let k = 0; k < t.length; k += 3) {
      let x0 = Infinity
      let y0 = Infinity
      let z0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      let z1 = -Infinity
      for (let j = 0; j < 3; j++) {
        const o = t[k + j] * 3
        x0 = Math.min(x0, p[o])
        y0 = Math.min(y0, p[o + 1])
        z0 = Math.min(z0, p[o + 2])
        x1 = Math.max(x1, p[o])
        y1 = Math.max(y1, p[o + 1])
        z1 = Math.max(z1, p[o + 2])
      }
      this.each(x0, y0, z0, x1, y1, z1, (key) => {
        let list = this.cells.get(key)
        if (!list) this.cells.set(key, (list = []))
        list.push(k)
      })
    }
  }
  private each(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, fn: (key: number) => void) {
    const [ox, oy, oz] = this.origin
    const c = this.cell
    const [nx, ny, nz] = this.dims
    const i0 = Math.max(0, Math.floor((x0 - ox) / c))
    const i1 = Math.min(nx - 1, Math.floor((x1 - ox) / c))
    const j0 = Math.max(0, Math.floor((y0 - oy) / c))
    const j1 = Math.min(ny - 1, Math.floor((y1 - oy) / c))
    const k0 = Math.max(0, Math.floor((z0 - oz) / c))
    const k1 = Math.min(nz - 1, Math.floor((z1 - oz) / c))
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) fn(i + nx * (j + ny * k))
  }
  /** Triangles (their first index in piece.t) in the cells a box touches. */
  near(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, out: Set<number>) {
    out.clear()
    this.each(x0, y0, z0, x1, y1, z1, (key) => this.cells.get(key)?.forEach((k) => out.add(k)))
    return out
  }
}

const grid = (piece: Piece) => (piece.grid ??= new TriGrid(piece))

/** A piece's open ends: the edges only one triangle has (after joining vertices at the same spot), followed round
 *  into loops. */
function loopsOf(piece: Piece) {
  if (piece.loops) return piece.loops
  const { p, t } = piece
  const id = new Int32Array(p.length / 3)
  const at = new Map<string, number>()
  for (let i = 0; i < id.length; i++) {
    const key = `${Math.round(p[i * 3] * 1e5)},${Math.round(p[i * 3 + 1] * 1e5)},${Math.round(p[i * 3 + 2] * 1e5)}`
    let j = at.get(key)
    if (j === undefined) at.set(key, (j = i))
    id[i] = j
  }
  const edges = new Set<string>()
  for (let k = 0; k < t.length; k += 3) {
    const a = id[t[k]]
    const b = id[t[k + 1]]
    const c = id[t[k + 2]]
    if (a === b || b === c || a === c) continue
    edges.add(`${a},${b}`).add(`${b},${c}`).add(`${c},${a}`)
  }
  const next = new Map<number, number[]>()
  for (const e of edges) {
    const [a, b] = e.split(',').map(Number)
    if (edges.has(`${b},${a}`)) continue
    const list = next.get(a)
    if (list) list.push(b)
    else next.set(a, [b])
  }
  const loops: NonNullable<Piece['loops']> = []
  for (const start of next.keys()) {
    while (next.get(start)?.length) {
      const ring: number[] = []
      let v_ = start
      for (let guard = 0; guard <= edges.size; guard++) {
        ring.push(v_)
        const out = next.get(v_)
        if (!out?.length) break
        v_ = out.pop()!
        if (v_ === start) break
      }
      const centre: V3 = [0, 0, 0]
      for (const i of ring) for (let j = 0; j < 3; j++) centre[j] += p[i * 3 + j] / ring.length
      let size = 0
      for (const i of ring) size = Math.max(size, 2 * Math.hypot(p[i * 3] - centre[0], p[i * 3 + 1] - centre[1], p[i * 3 + 2] - centre[2]))
      loops.push({ ring, centre, size })
    }
  }
  return (piece.loops = loops)
}

/** The piece with its open ends capped: a closed surface, so a ray's crossings tell inside from outside. */
function solidOf(piece: Piece) {
  if (piece.solid) return piece.solid
  const loops = loopsOf(piece)
  if (!loops.length) return (piece.solid = { p: piece.p, t: piece.t })
  const n = piece.p.length / 3
  const p = new Float32Array(piece.p.length + loops.length * 3)
  p.set(piece.p)
  const t: number[] = Array.from(piece.t)
  loops.forEach((l, k) => {
    p.set(l.centre, (n + k) * 3)
    for (let j = 0; j < l.ring.length; j++) t.push(n + k, l.ring[j], l.ring[(j + 1) % l.ring.length])
  })
  return (piece.solid = { p, t: Uint32Array.from(t) })
}

/** A divisor that is never zero (degenerate edges at the tips of shapes would give NaN). */
const nz = (x: number) => (Math.abs(x) < 1e-30 ? (x < 0 ? -1e-30 : 1e-30) : x)

/** Squared distance from point (px, py, pz) to triangle k of a piece (Ericson, "closest point on triangle"). */
function triDist2(piece: Piece, k: number, px: number, py: number, pz: number) {
  const p = piece.p
  const ia = piece.t[k] * 3
  const ib = piece.t[k + 1] * 3
  const ic = piece.t[k + 2] * 3
  const ax = p[ia]
  const ay = p[ia + 1]
  const az = p[ia + 2]
  const abx = p[ib] - ax
  const aby = p[ib + 1] - ay
  const abz = p[ib + 2] - az
  const acx = p[ic] - ax
  const acy = p[ic + 1] - ay
  const acz = p[ic + 2] - az
  const apx = px - ax
  const apy = py - ay
  const apz = pz - az
  const d1 = abx * apx + aby * apy + abz * apz
  const d2 = acx * apx + acy * apy + acz * apz
  let qx: number
  let qy: number
  let qz: number
  if (d1 <= 0 && d2 <= 0) {
    qx = ax
    qy = ay
    qz = az
  } else {
    const bpx = px - p[ib]
    const bpy = py - p[ib + 1]
    const bpz = pz - p[ib + 2]
    const d3 = abx * bpx + aby * bpy + abz * bpz
    const d4 = acx * bpx + acy * bpy + acz * bpz
    if (d3 >= 0 && d4 <= d3) {
      qx = p[ib]
      qy = p[ib + 1]
      qz = p[ib + 2]
    } else {
      const vc = d1 * d4 - d3 * d2
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const s = d1 / nz(d1 - d3)
        qx = ax + abx * s
        qy = ay + aby * s
        qz = az + abz * s
      } else {
        const cpx = px - p[ic]
        const cpy = py - p[ic + 1]
        const cpz = pz - p[ic + 2]
        const d5 = abx * cpx + aby * cpy + abz * cpz
        const d6 = acx * cpx + acy * cpy + acz * cpz
        if (d6 >= 0 && d5 <= d6) {
          qx = p[ic]
          qy = p[ic + 1]
          qz = p[ic + 2]
        } else {
          const vb = d5 * d2 - d1 * d6
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const s = d2 / nz(d2 - d6)
            qx = ax + acx * s
            qy = ay + acy * s
            qz = az + acz * s
          } else {
            const va = d3 * d6 - d5 * d4
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              const s = (d4 - d3) / nz(d4 - d3 + (d5 - d6))
              qx = p[ib] + (p[ic] - p[ib]) * s
              qy = p[ib + 1] + (p[ic + 1] - p[ib + 1]) * s
              qz = p[ib + 2] + (p[ic + 2] - p[ib + 2]) * s
            } else {
              const sum = va + vb + vc
              if (!(sum > 1e-30)) {
                // a triangle with no area (the tip of a shape, a pole): its nearest corner will do
                qx = ax
                qy = ay
                qz = az
              } else {
                const s = vb / sum
                const w = vc / sum
                qx = ax + abx * s + acx * w
                qy = ay + aby * s + acy * w
                qz = az + abz * s + acz * w
              }
            }
          }
        }
      }
    }
  }
  const dx = px - qx
  const dy = py - qy
  const dz = pz - qz
  return dx * dx + dy * dy + dz * dz
}

/** Does segment (x0..x1) cross triangle k of a piece? (Möller–Trumbore, both faces, t in [0, 1].) */
function segHitsTri(piece: { p: Float32Array; t: Uint32Array }, k: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const p = piece.p
  const ia = piece.t[k] * 3
  const ib = piece.t[k + 1] * 3
  const ic = piece.t[k + 2] * 3
  const e1x = p[ib] - p[ia]
  const e1y = p[ib + 1] - p[ia + 1]
  const e1z = p[ib + 2] - p[ia + 2]
  const e2x = p[ic] - p[ia]
  const e2y = p[ic + 1] - p[ia + 1]
  const e2z = p[ic + 2] - p[ia + 2]
  const dx = x1 - x0
  const dy = y1 - y0
  const dz = z1 - z0
  const hx = dy * e2z - dz * e2y
  const hy = dz * e2x - dx * e2z
  const hz = dx * e2y - dy * e2x
  const a = e1x * hx + e1y * hy + e1z * hz
  if (Math.abs(a) < 1e-14) return false
  const f = 1 / a
  const sx = x0 - p[ia]
  const sy = y0 - p[ia + 1]
  const sz = z0 - p[ia + 2]
  const u = f * (sx * hx + sy * hy + sz * hz)
  if (u < 0 || u > 1) return false
  const qx = sy * e1z - sz * e1y
  const qy = sz * e1x - sx * e1z
  const qz = sx * e1y - sy * e1x
  const w = f * (dx * qx + dy * qy + dz * qz)
  if (w < 0 || u + w > 1) return false
  const t = f * (e2x * qx + e2y * qy + e2z * qz)
  return t >= 0 && t <= 1
}

/** Is a point inside a piece (a ray from it crosses the surface, its open ends capped, an odd number of times)? */
function inside(piece: Piece, px: number, py: number, pz: number) {
  const solid = solidOf(piece)
  // an awkward direction, so the ray does not run along an edge
  const far = 1e3
  let hits = 0
  for (let k = 0; k < solid.t.length; k += 3) if (segHitsTri(solid, k, px, py, pz, px + far, py + far * 0.0137, pz + far * 0.0071)) hits++
  return hits % 2 === 1
}

const overlap = (a: Piece, b: Piece, pad: number) =>
  a.min[0] - pad <= b.max[0] && a.max[0] + pad >= b.min[0] && a.min[1] - pad <= b.max[1] && a.max[1] + pad >= b.min[1] && a.min[2] - pad <= b.max[2] && a.max[2] + pad >= b.min[2]

const scratch = new Set<number>()

/** Do two pieces hold together: touching within `tol`, surfaces crossing, or one buried in the other? */
export function touching(a: Piece, b: Piece, tol: number): boolean {
  if (!overlap(a, b, tol)) return false
  const tol2 = tol * tol
  // a vertex of one close to the other's surface
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as [Piece, Piece][]) {
    const g = grid(y)
    const p = x.p
    for (let i = 0; i < p.length; i += 3) {
      const px = p[i]
      const py = p[i + 1]
      const pz = p[i + 2]
      if (px < y.min[0] - tol || px > y.max[0] + tol || py < y.min[1] - tol || py > y.max[1] + tol || pz < y.min[2] - tol || pz > y.max[2] + tol) continue
      for (const k of g.near(px - tol, py - tol, pz - tol, px + tol, py + tol, pz + tol, scratch)) if (triDist2(y, k, px, py, pz) <= tol2) return true
    }
  }
  // an edge of one crossing a face of the other
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as [Piece, Piece][]) {
    const g = grid(y)
    const p = x.p
    const t = x.t
    for (let k = 0; k < t.length; k += 3) {
      for (let e = 0; e < 3; e++) {
        const i0 = t[k + e] * 3
        const i1 = t[k + ((e + 1) % 3)] * 3
        const x0 = p[i0]
        const y0 = p[i0 + 1]
        const z0 = p[i0 + 2]
        const x1 = p[i1]
        const y1 = p[i1 + 1]
        const z1 = p[i1 + 2]
        if (Math.max(x0, x1) < y.min[0] || Math.min(x0, x1) > y.max[0] || Math.max(y0, y1) < y.min[1] || Math.min(y0, y1) > y.max[1] || Math.max(z0, z1) < y.min[2] || Math.min(z0, z1) > y.max[2]) continue
        for (const kk of g.near(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), scratch)) if (segHitsTri(y, kk, x0, y0, z0, x1, y1, z1)) return true
      }
    }
  }
  // one buried whole inside the other
  const within = (x: Piece, y: Piece) => x.min[0] >= y.min[0] && x.max[0] <= y.max[0] && x.min[1] >= y.min[1] && x.max[1] <= y.max[1] && x.min[2] >= y.min[2] && x.max[2] <= y.max[2]
  if (within(a, b) && inside(b, a.p[0], a.p[1], a.p[2])) return true
  if (within(b, a) && inside(a, b.p[0], b.p[1], b.p[2])) return true
  return false
}

/** The smallest gap between two pieces (vertex to surface, both ways). */
export function gapBetween(a: Piece, b: Piece): number {
  let best = Infinity
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as [Piece, Piece][]) {
    const p = x.p
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < y.t.length; k += 3) best = Math.min(best, triDist2(y, k, p[i], p[i + 1], p[i + 2]))
  }
  return Math.sqrt(best)
}

const boxGap = (a: Piece, b: Piece) => Math.hypot(Math.max(0, a.min[0] - b.max[0], b.min[0] - a.max[0]), Math.max(0, a.min[1] - b.max[1], b.min[1] - a.max[1]), Math.max(0, a.min[2] - b.max[2], b.min[2] - a.max[2]))

const centre = (p: Piece): V3 => [(p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2]

/** Checks a whole model (its pieces in the model's frame): one connected body, standing on its ground. */
export function checkPieces(name: string, pieces: Piece[], o: CheckOptions = {}): Issue[] {
  const tol = o.tolerance ?? 0.0025
  const issues: Issue[] = []
  if (!pieces.length) return issues
  // pieces that hold together
  const links: number[][] = pieces.map(() => [])
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++)
      if (touching(pieces[i], pieces[j], tol)) {
        links[i].push(j)
        links[j].push(i)
      }
  // the ground holds whatever stands on it (it joins the main body below)
  const onGround = (piece: Piece) => o.ground !== undefined && piece.min[1] <= o.ground + tol && piece.min[1] >= o.ground - (o.sink ?? 0.03) - tol
  const grounded = pieces.map(onGround)
  const firstGrounded = grounded.indexOf(true)
  if (firstGrounded >= 0)
    for (let i = 0; i < pieces.length; i++)
      if (grounded[i] && i !== firstGrounded) {
        links[i].push(firstGrounded)
        links[firstGrounded].push(i)
      }
  // the main body: the group standing on the ground, or else the one with the most triangles
  const group = new Int32Array(pieces.length).fill(-1)
  const sizes: number[] = []
  for (let i = 0; i < pieces.length; i++) {
    if (group[i] >= 0) continue
    const g = sizes.length
    sizes.push(0)
    const stack = [i]
    group[i] = g
    while (stack.length) {
      const k = stack.pop()!
      sizes[g] += pieces[k].t.length
      for (const j of links[k])
        if (group[j] < 0) {
          group[j] = g
          stack.push(j)
        }
    }
  }
  const main = firstGrounded >= 0 ? group[firstGrounded] : sizes.indexOf(Math.max(...sizes))
  const body = pieces.filter((_, i) => group[i] === main)
  pieces.forEach((piece, i) => {
    if (group[i] === main) return
    // how far it is from the body (only the nearest few, measured exactly)
    const near = body.map((b) => ({ b, d: boxGap(piece, b) })).sort((x, y) => x.d - y.d)
    let gap = Infinity
    for (const { b, d } of near) {
      if (d >= gap) break
      gap = Math.min(gap, gapBetween(piece, b))
    }
    issues.push({ kind: 'loose', where: `${name}: ${piece.part} piece ${piece.index}`, gap, at: centre(piece) })
  })
  // open ends must be buried: the cap that closes each one inside another piece, against one, or on the ground
  const hidden = (self: Piece, x: number, y: number, z: number) => {
    if (o.ground !== undefined && y <= o.ground + tol) return true
    for (const other of pieces) {
      if (other === self || x < other.min[0] - tol || x > other.max[0] + tol || y < other.min[1] - tol || y > other.max[1] + tol || z < other.min[2] - tol || z > other.max[2] + tol) continue
      for (const k of grid(other).near(x - tol, y - tol, z - tol, x + tol, y + tol, z + tol, scratch)) if (triDist2(other, k, x, y, z) <= tol * tol) return true
      if (inside(other, x, y, z)) return true
    }
    return false
  }
  for (const piece of pieces) {
    if (o.open?.includes(piece.part)) continue
    for (const l of loopsOf(piece)) {
      if (l.size <= tol * 2) continue
      // the cap's middle, and points most of the way out to its edge all round
      const c = l.centre
      const samples: V3[] = [c]
      const step = Math.max(1, Math.floor(l.ring.length / 6))
      for (let j = 0; j < l.ring.length; j += step) {
        const q = l.ring[j] * 3
        samples.push([c[0] + (piece.p[q] - c[0]) * 0.8, c[1] + (piece.p[q + 1] - c[1]) * 0.8, c[2] + (piece.p[q + 2] - c[2]) * 0.8])
      }
      if (samples.every(([x, y, z]) => hidden(piece, x, y, z))) continue
      issues.push({ kind: 'open', where: `${name}: ${piece.part} piece ${piece.index}`, gap: l.size, at: c })
    }
  }
  if (o.ground !== undefined) {
    let low = Infinity
    let lowest: Piece | undefined
    for (const piece of pieces)
      if (piece.min[1] < low) {
        low = piece.min[1]
        lowest = piece
      }
    if (low > o.ground + tol) issues.push({ kind: 'floating', where: `${name}: lowest point ${(low - o.ground).toFixed(3)} m above the ground (${lowest!.part})`, gap: low - o.ground, at: centre(lowest!) })
    else if (low < o.ground - (o.sink ?? 0.03)) issues.push({ kind: 'sunk', where: `${name}: lowest point ${(o.ground - low).toFixed(3)} m under the ground (${lowest!.part})`, gap: o.ground - low, at: centre(lowest!) })
  }
  return issues
}

/** Poses a model with its put function and returns its pieces in the model's frame (shadows left out). */
export function posedPieces<K extends string>(parts: Parts<K>, pose: (parts: Parts<K>) => void, skip: string[] = ['shadow']): Piece[] {
  parts.record = []
  parts.begin()
  pose(parts)
  parts.end()
  const rec = parts.record
  parts.record = undefined
  return rec.filter((r) => !skip.includes(r.name)).flatMap((r) => piecesOf(r.name, parts.meshes[r.name].geometry, r.matrix))
}

/** Checks a model in a pose: posedPieces, then checkPieces. */
export function checkPose<K extends string>(name: string, parts: Parts<K>, pose: (parts: Parts<K>) => void, o: CheckOptions = {}): Issue[] {
  return checkPieces(name, posedPieces(parts, pose), o)
}

export const describeIssue = (i: Issue) =>
  i.kind === 'loose'
    ? `${i.where} is loose: ${(i.gap * 1000).toFixed(1)} mm from the rest`
    : i.kind === 'open'
      ? `${i.where} has an open end that shows: a hole ${(i.gap * 1000).toFixed(0)} mm across`
      : i.kind === 'floating'
        ? `${i.where} — floating`
        : `${i.where} — sunk`

// a matrix for callers that pose things by hand
export const identity = new Matrix4()
