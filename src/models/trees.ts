import { IcosahedronGeometry } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { fbm3, merge, mixRgb, noise3, rgb, Shape, smoothstep, spin, tube, type SculptMaterialOptions, type V3 } from '../lib/sculpt'
import { mulberry } from '../scene/flora'
import type { Structure } from './structures'

// The farm's big trees: the woods round it (src/farm/landGeometry.ts, drawn by Land.tsx) and the three in the garden's
// corners (src/farm/Places.tsx). One mixed wood, chosen in the design lab (lab/boards/woods, D): round, tall and
// pointed trees in turn along the skyline, each crown one skin over a cluster of lumps (seen from its middle, so no
// lump hides inside another: every triangle is on the outside). Four kinds:
//
//   oak     a round tree: a big lump in the middle and a ring of smaller ones, three on top, its creases darker; the
//           garden's three corners too, a little finer (seen from a few metres, the woods' from twenty)
//   birch   a slim white trunk leaning a little, marked dark, a light, small crown in a few lumps
//   poplar  a tall flame of stacked lumps, pointed at the top, on a short trunk
//   pine    four tiers of boughs, each with a ragged edge of bough tips that droop, dark blue-green, on a bare trunk
//
// Every crown is lit as one volume (its normals bent towards one ellipsoid's: the part's `soft`), coloured light where
// the sun is and deep underneath, with a leafy relief finer than its vertices (the material's detail). Each tree stands
// in its own frame, the ground under its trunk at the origin, as two parts: its wood and its crown. 369 to 809
// triangles a tree: the seventeen of a farm about 9,200 (the trees before them drew about 24,000).

// ───────────────────────────── colours ─────────────────────────────

type Greens = { dark: V3; mid: V3; light: V3 }
/** The oak's three shades (the woods' trees take them in turn). */
const OAK: Greens[] = [
  { dark: rgb(0x2f5231), mid: rgb(0x4d843d), light: rgb(0x9cc45e) },
  { dark: rgb(0x375a31), mid: rgb(0x5a8e43), light: rgb(0xaccb66) },
  { dark: rgb(0x2a4b33), mid: rgb(0x447a42), light: rgb(0x8ab95c) },
]
const BIRCH: Greens = { dark: rgb(0x40662f), mid: rgb(0x6fa044), light: rgb(0xb4d672) }
const POPLAR: Greens = { dark: rgb(0x24412a), mid: rgb(0x3d6c37), light: rgb(0x86ad52) }
const PINE: Greens = { dark: rgb(0x1c3529), mid: rgb(0x2f5a42), light: rgb(0x6f9a5e) }
const BARK = rgb(0x5a4434)
const BARK_LIGHT = rgb(0x7d6551)
const BIRCH_BARK = rgb(0xe8e2d4)
const BIRCH_DARK = rgb(0x3d3631)

/** Light on top, deep underneath, between `bottom` and `top` (heights). */
function leafy(g: Greens, y: number, bottom: number, top: number) {
  const up = smoothstep(bottom, top, y)
  const c = mixRgb(g.dark, g.mid, smoothstep(0.02, 0.5, up))
  return mixRgb(c, g.light, smoothstep(0.5, 1, up) * 0.85)
}

const barkPaint = (x: number, y: number, z: number) => mixRgb(BARK, BARK_LIGHT, 0.25 + 0.35 * noise3(x * 14, y * 4, z * 14, 31))

/** The crowns' material: a leafy relief finer than its vertices (the lemon tree's, sized for a tree four times it). */
export const CROWN_MATERIAL: SculptMaterialOptions = { roughness: 0.9, detail: { scale: 3, bump: 0.12, shade: 0.1 } }
/** The trunks' bark; the birch's white bark its own. */
export const WOOD_MATERIAL: SculptMaterialOptions = { roughness: 0.95, surface: { kind: 'bark', size: 0.6 } }
export const BIRCH_MATERIAL: SculptMaterialOptions = { roughness: 0.85, surface: { kind: 'bark', size: 0.45, bump: 0.6 } }

// ───────────────────────────── the crown: one skin over a cluster of lumps ─────────────────────────────

const balls = new Map<number, { dirs: V3[]; tris: number[] }>()
/** A geodesic ball: an icosahedron with each edge cut in `n` (20·n² triangles, evenly spread), as unit directions. */
function geodesic(n: number) {
  const known = balls.get(n)
  if (known) return known
  const g = mergeVertices(new IcosahedronGeometry(1, n - 1).deleteAttribute('normal').deleteAttribute('uv'), 1e-4)
  const p = g.getAttribute('position')
  const dirs: V3[] = []
  for (let i = 0; i < p.count; i++) dirs.push([p.getX(i), p.getY(i), p.getZ(i)])
  const ball = { dirs, tris: Array.from(g.getIndex()!.array) }
  g.dispose()
  balls.set(n, ball)
  return ball
}

interface Lump {
  c: V3
  r: number
}

/** The outside of a cluster of lumps, as seen from `centre` (inside the first lump): along each direction of a
 *  geodesic ball (spread as an ellipsoid `stretch` would, so a tall crown keeps its vertices even), the farthest a
 *  lump reaches, the lumps' edges blended (`soft`, metres) so they meet in rounded creases. Gives the skin, how deep
 *  in a crease each vertex is (0 on a lump, 1 deep where two meet) and how much it faces up on its own lump. */
function cluster(n: number, centre: V3, stretch: V3, lumps: Lump[], soft: number) {
  const { dirs, tris } = geodesic(n)
  const shape = new Shape()
  const crease: number[] = []
  const lit: number[] = []
  for (const v of dirs) {
    const dx = v[0] * stretch[0]
    const dy = v[1] * stretch[1]
    const dz = v[2] * stretch[2]
    const l = Math.hypot(dx, dy, dz)
    const d: V3 = [dx / l, dy / l, dz / l]
    const reach: number[] = []
    let own = 0
    let far = -Infinity
    lumps.forEach((b, i) => {
      const o: V3 = [b.c[0] - centre[0], b.c[1] - centre[1], b.c[2] - centre[2]]
      const along = d[0] * o[0] + d[1] * o[1] + d[2] * o[2]
      const disc = along * along - (o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - b.r * b.r)
      if (disc < 0) return
      const t = along + Math.sqrt(disc)
      reach.push(t)
      if (t > far) [far, own] = [t, i]
    })
    reach.sort((a, b) => b - a)
    // a soft maximum: where two lumps reach about as far, the skin bridges them in a rounded crease
    const t = reach.length > 1 ? reach[0] + soft * Math.log(1 + Math.exp((reach[1] - reach[0]) / soft)) * 0.6 : reach[0]
    crease.push(reach.length > 1 ? 1 - smoothstep(0, soft * 2.2, reach[0] - reach[1]) : 0)
    const p: V3 = [centre[0] + d[0] * t, centre[1] + d[1] * t, centre[2] + d[2] * t]
    // how much the point faces up on its own lump: each lump lit on its own top, so it reads as a lump although the
    // crown's normals are one ball's
    const b = lumps[own]
    lit.push((p[1] - b.c[1]) / b.r)
    shape.vertex(...p)
  }
  for (let k = 0; k < tris.length; k += 3) shape.tri(tris[k], tris[k + 1], tris[k + 2])
  return { shape, crease, lit }
}

/** Colours a crown: light on top, deep underneath, darker in its creases and its hollow middle underneath, a few
 *  lighter clumps; and presses what hangs under `under` up into a flatter underside. */
function leaves(c: { shape: Shape; crease: number[]; lit: number[] }, g: Greens, o: { under: number; bottom: number; top: number; seed: number; axis: V3; width: number }) {
  const s = c.shape
    .warp((x, y, z) => [x, y < o.under ? o.under - (o.under - y) * 0.45 : y, z])
    .paint((x, y, z, k) => {
      const base = leafy(g, y, o.bottom, o.top)
      const clump = smoothstep(0.58, 0.8, fbm3(x * 0.9, y * 0.9, z * 0.9, o.seed)) * 0.3
      const col = mixRgb(base, g.light, clump * smoothstep(o.bottom, o.top, y))
      // the creases and the middle of the underside, where little light comes
      const out = Math.hypot(x - o.axis[0], z - o.axis[2]) / o.width
      const dark = (1 - 0.45 * c.crease[k]) * (0.8 + 0.2 * smoothstep(0.25, 0.95, out + smoothstep(o.bottom, o.top, y) * 0.5)) * (0.74 + 0.36 * smoothstep(-0.5, 0.85, c.lit[k]))
      return [col[0] * dark, col[1] * dark, col[2] * dark]
    }, 0)
  // each lump's shadowed side and the creases between lumps a shade deeper, with a crisp edge: the clumps read as
  // clumps although the crown is lit as one ball
  for (let k = 0; k < s.count; k++) {
    s.m[k] = 0.62 * c.crease[k] + 0.55 * (1 - smoothstep(-0.35, 0.3, c.lit[k]))
    for (let j = 0; j < 3; j++) s.c2[k * 3 + j] = s.c[k * 3 + j] * 0.8
  }
  return s
}

// ───────────────────────────── the wood ─────────────────────────────

/** A trunk flaring into the ground, up to `tip` (buried in the crown), and limbs from `fork` of the way up out to
 *  `ends` (buried in the crown too): no end shows, so none needs closing but the one in the ground. */
function trunk(tip: V3, r: number, ends: V3[], fork: number, paint: (x: number, y: number, z: number) => V3 = barkPaint): Shape {
  const at = (t: number): V3 => [tip[0] * t * t, tip[1] * t, tip[2] * t * t]
  const stem = tube([[0, -0.03, 0], [0, 0.22, 0], at(0.5), tip], [r * 1.7, r * 1.15, r * 0.9, r * 0.62], { seg: 7, steps: 1, caps: [true, false] })
  const from = at(fork)
  const limbs = ends.map((to) => tube([from, [from[0] * 0.5 + to[0] * 0.5, from[1] * 0.4 + to[1] * 0.6, from[2] * 0.5 + to[2] * 0.5], to], [r * 0.55, r * 0.42, r * 0.3], { seg: 5, steps: 1 }))
  return merge(stem, ...limbs).paint(paint, 0)
}

// ───────────────────────────── the four kinds ─────────────────────────────

export type TreePart = 'wood' | 'crown'
export type TreeKind = 'oak' | 'birch' | 'poplar' | 'pine'

/** A round oak: a big lump in the middle, seven round it a little lower, three on top, its underside flatter. `shade`
 *  picks one of its three greens; `detail` how finely its crown is cut (20·detail² triangles). */
export function oakTree(height: number, seed: number, shade: number, detail = 5): Structure<TreePart> {
  const r = mulberry(seed)
  const R = height * 0.25
  const top = height * 0.3
  const cy = top + height * 0.28
  const lean = (r() - 0.5) * 0.1
  const cx = Math.sin(lean) * top
  const lumps: Lump[] = [{ c: [cx, cy, 0], r: R * 0.95 }]
  const ring: V3[] = []
  // a ring of seven lumps round the middle one, each its own size and height: a scalloped edge against the sky
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.5
    const out = R * (0.86 + r() * 0.2)
    const c: V3 = [cx + Math.cos(a) * out, cy - R * 0.3 + r() * R * 0.42, Math.sin(a) * out]
    ring.push(c)
    lumps.push({ c, r: R * (0.5 + r() * 0.14) })
  }
  // and three on top, off the middle, so the top is a line of bumps too
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r() * 1.2
    lumps.push({ c: [cx + Math.cos(a) * R * 0.5, cy + R * (0.42 + r() * 0.2), Math.sin(a) * R * 0.5], r: R * (0.5 + r() * 0.1) })
  }
  const under = cy - R * 0.62
  const skin = cluster(detail, [cx, cy, 0], [1, 0.9, 1], lumps, R * 0.03)
  // a leafy unevenness on the outline, finer than the lumps
  skin.shape.displace((x, y, z) => R * 0.06 * (fbm3(x * 1.3 + seed, y * 1.3, z * 1.3, seed) - 0.5))
  const crown = leaves(skin, OAK[shade % 3], { under, bottom: under - R * 0.2, top: cy + R * 1.25, seed, axis: [cx, 0, 0], width: R * 1.6 })
  return {
    // the trunk runs up into the middle lump; two limbs fork from it into the lumps round it
    wood: {
      shape: trunk(
        [cx, under + R * 0.35, 0],
        height * 0.032,
        [ring[0], ring[3]].map((p): V3 => [p[0] * 0.7, p[1] - R * 0.15, p[2] * 0.7]),
        0.66,
      ),
      material: WOOD_MATERIAL,
    },
    crown: { shape: crown, material: CROWN_MATERIAL, soft: { centre: [cx, cy + R * 0.1, 0], radii: [R * 1.75, R * 1.35, R * 1.75], k: 0.42 } },
  }
}

/** A birch: a slim white trunk leaning a little, marked dark, under a light crown of four lumps, more open below. */
export function birchTree(height: number, seed: number): Structure<TreePart> {
  const r = mulberry(seed)
  const h = height * 0.92
  const lean = 0.08 + r() * 0.08
  const turn = r() * Math.PI * 2
  const side: V3 = [Math.cos(turn), 0, Math.sin(turn)]
  const R = h * 0.15
  const base = h * 0.42
  const tipX = Math.sin(lean) * base
  const c0: V3 = [side[0] * tipX, base + R * 1.1, side[2] * tipX]
  const lumps: Lump[] = [
    { c: c0, r: R },
    { c: [c0[0] + side[0] * R * 0.35 - side[2] * R * 0.4, c0[1] + R * 1.05, c0[2] + side[2] * R * 0.35 + side[0] * R * 0.4], r: R * 0.82 },
    { c: [c0[0] - side[0] * R * 0.5 + side[2] * R * 0.3, c0[1] + R * 0.5, c0[2] - side[2] * R * 0.5 - side[0] * R * 0.3], r: R * 0.78 },
    { c: [c0[0] + side[0] * R * 0.2, c0[1] + R * 1.85, c0[2] + side[2] * R * 0.2], r: R * 0.55 },
  ]
  const centre: V3 = [c0[0], c0[1] + R * 0.6, c0[2]]
  const skin = cluster(4, centre, [1, 1.45, 1], lumps, R * 0.05)
  skin.shape.displace((x, y, z) => R * 0.1 * (fbm3(x * 1.6 + seed, y * 1.6, z * 1.6, seed) - 0.5))
  const crown = leaves(skin, BIRCH, { under: c0[1] - R * 0.75, bottom: c0[1] - R, top: c0[1] + R * 2.4, seed, axis: centre, width: R * 1.3 })
  // white bark, darker towards the ground, with dark marks across it
  const birchPaint = (x: number, y: number, z: number): V3 => {
    const marks = smoothstep(0.62, 0.72, noise3(x * 9, y * 5.5, z * 9, seed))
    const foot = 1 - smoothstep(0.1, 0.7, y)
    return mixRgb(BIRCH_BARK, BIRCH_DARK, Math.max(marks * 0.85, foot * 0.7))
  }
  const ends: V3[] = [lumps[1].c, lumps[2].c].map((p): V3 => [p[0] * 0.8, p[1] - R * 0.5, p[2] * 0.8])
  return {
    wood: { shape: trunk([c0[0], c0[1] - R * 0.2, c0[2]], h * 0.02, ends, 0.8, birchPaint), material: BIRCH_MATERIAL },
    crown: { shape: crown, material: CROWN_MATERIAL, soft: { centre, radii: [R * 1.4, R * 2.0, R * 1.4], k: 0.42 } },
  }
}

/** A Lombardy poplar: a tall flame of stacked lumps, narrowing to a point, on a short trunk. */
export function poplarTree(height: number, seed: number): Structure<TreePart> {
  const r = mulberry(seed)
  const h = height * 1.12
  const base = h * 0.13
  const R = h * 0.12
  const lumps: Lump[] = []
  const n = 6
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1)
    // widest a third of the way up, narrowing to the top
    const rad = R * (k === 0 ? 0.85 : 1 - 0.74 * Math.pow(t, 1.15)) * (0.92 + r() * 0.12)
    const a = r() * Math.PI * 2
    const off = R * 0.16 * (k > 0 && k < n - 1 ? 1 : 0)
    lumps.push({ c: [Math.cos(a) * off, base + R * 0.9 + Math.pow(t, 0.9) * (h - base - R * 1.15), Math.sin(a) * off], r: rad })
  }
  const centre: V3 = [0, base + (h - base) * 0.42, 0]
  const skin = cluster(4, centre, [1, 3.2, 1], lumps, R * 0.06)
  skin.shape.displace((x, y, z) => R * 0.1 * (fbm3(x * 1.8 + seed, y * 1.1, z * 1.8, seed) - 0.5))
  const crown = leaves(skin, POPLAR, { under: base + R * 0.3, bottom: base, top: h, seed, axis: centre, width: R * 1.1 })
  return {
    wood: { shape: trunk([0, base + R * 1.0, 0], h * 0.022, [], 1), material: WOOD_MATERIAL },
    crown: { shape: crown, material: CROWN_MATERIAL, soft: { centre, radii: [R * 1.3, (h - base) * 0.55, R * 1.3], k: 0.4 } },
  }
}

/** A pine: four tiers of boughs, each smaller than the one under it, their edges ragged with drooping tips, on a bare
 *  trunk that shows below them. */
export function pineTree(height: number, seed: number): Structure<TreePart> {
  const r = mulberry(seed)
  const base = height * 0.22
  const n = 4
  const tiers: Shape[] = []
  const W = height * 0.27
  for (let k = 0; k < n; k++) {
    const t = k / n
    const y0 = base + t * (height - base) * 0.78
    const tall = (height - base) * (0.4 - t * 0.06)
    const rad = W * (1 - t * 0.2)
    const turn = r() * 6
    const tips = 7 - (k > 1 ? 1 : 0)
    // the bough tips: out and down every so often round the edge
    const tip = (a: number) => Math.pow(0.5 + 0.5 * Math.cos(a * tips + turn), 2)
    const profile: [number, number][] = [
      [0, y0 + tall * 0.18],
      [rad * 0.5, y0 + tall * 0.07],
      [rad, y0],
      [rad * 0.84, y0 + tall * 0.15],
      [rad * 0.45, y0 + tall * 0.52],
      [0, y0 + tall],
    ]
    tiers.push(
      spin(profile, 14, {
        ring: (i, a) => (i === 2 || i === 3 ? 0.84 + 0.22 * tip(a) : i === 1 ? 0.92 + 0.1 * tip(a) : 1),
        lift: (i, a) => (i === 2 ? -tall * 0.12 * tip(a) : i === 3 ? -tall * 0.06 * tip(a) : 0),
        // each tier lit on its upper slope, deep on its underside, its tips a little lighter
        paint: (i, a) =>
          i <= 1
            ? PINE.dark
            : i === 2
              ? mixRgb(PINE.dark, PINE.mid, 0.35 + 0.4 * tip(a))
              : i === 3
                ? mixRgb(PINE.mid, PINE.light, 0.15 + 0.3 * tip(a) + t * 0.2)
                : mixRgb(PINE.mid, PINE.light, 0.3 + t * 0.5),
      }),
    )
  }
  const crown = merge(...tiers).shade((x, _y, z) => 0.8 + 0.2 * smoothstep(0.15, 0.8, Math.hypot(x, z) / W))
  return {
    wood: { shape: trunk([0, base + height * 0.12, 0], height * 0.024, [], 1), material: WOOD_MATERIAL },
    crown: { shape: crown, material: CROWN_MATERIAL, soft: { centre: [0, base + (height - base) * 0.38, 0], radii: [W * 0.95, (height - base) * 0.5, W * 0.95], k: 0.35 } },
  }
}

// ───────────────────────────── the farm's big trees ─────────────────────────────

/** The woods' fourteen trees in turn (landGeometry.ts treeSpots: round the farm from the east): round oaks between tall
 *  poplars, pines and birches, so every stretch of skyline has round, tall and pointed shapes. */
export const WOODS_KINDS: TreeKind[] = ['oak', 'pine', 'birch', 'pine', 'oak', 'poplar', 'birch', 'oak', 'pine', 'poplar', 'oak', 'birch', 'oak', 'poplar']

/** One of the farm's big trees: the woods' `index`th, or the garden's corner `index` (always an oak). */
export interface BigTree {
  height: number
  seed: number
  index: number
  corner: boolean
}

/** The kind of a big tree. */
export const bigTreeKind = (t: BigTree): TreeKind => (t.corner ? 'oak' : WOODS_KINDS[t.index % WOODS_KINDS.length])

/** A big tree's model, in its own frame (its kind's, unless given). */
export function bigTreeModel(t: BigTree, kind: TreeKind = bigTreeKind(t)): Structure<TreePart> {
  if (kind === 'birch') return birchTree(t.height, t.seed)
  if (kind === 'poplar') return poplarTree(t.height, t.seed)
  if (kind === 'pine') return pineTree(t.height, t.seed)
  // the garden's corner trees, seen from a few metres, a little finer than the woods' (seen from twenty)
  return oakTree(t.height, t.seed, t.index, t.corner ? 6 : 5)
}

/** The garden's corner trees' seeds (their heights are CORNER_TREES', src/data/garden.ts). */
export const cornerTree = (index: number, height: number): BigTree => ({ height, seed: 21 + index, index, corner: true })
