import { BufferAttribute, Color, Group, Mesh, MeshStandardMaterial, Vector2, type BufferGeometry, type Object3D } from 'three'
import { surface } from '../../../../src/lib/proceduralTextures'
import { blob, fbm3, lathe, loft, merge, mixRgb, noise3, rgb, smoothstep, tube, type Shape, type V3 } from '../../../../src/lib/sculpt'
import { mulberry, tree } from '../../../../src/scene/flora'
import { checkModel, modelGroup, trianglesOf, type LabModel } from '../../../three/model'
import type { TreeSpot } from '../../../three/place'

// The big trees, proposed three ways (the board: ./index.tsx). Today they are one maker, src/scene/flora.ts `tree`: a
// thin trunk with two limbs under a crown of six to eight noisy balls, wrapped in the lawn's grass picture and tinted one
// of three greens — the woods' fourteen round the farm and the three in the garden's corners. At the woods' distance,
// in the haze, the crown is one flat grey-green disc on a stick.
//
//   A  the same shapes (not a triangle more), coloured: light on top where the sun is, deep green underneath and in
//      the hollows, the crown's normals bent towards one ball so it shades as one volume (no grass picture)
//   B  a new round tree with the kit: a fuller, lower crown of a few big lumps (the biggest in the middle), a flatter
//      underside, a trunk that flares into the ground; coloured as A
//   C  a mixed wood: B's round tree, a tall poplar and a tiered pine in turn, so the skyline has round, tall and
//      pointed shapes; the garden's three stay round

// ───────────────────────────── colours ─────────────────────────────

/** The crown's greens, in the game's three shades (Land.tsx's '#5d7d43', '#6f8a46', '#4f6e3f'): under, middle, sunlit. */
const GREENS: { dark: V3; mid: V3; light: V3 }[] = [
  { dark: rgb(0x2f5231), mid: rgb(0x4d843d), light: rgb(0x9cc45e) },
  { dark: rgb(0x375a31), mid: rgb(0x5a8e43), light: rgb(0xaccb66) },
  { dark: rgb(0x2a4b33), mid: rgb(0x447a42), light: rgb(0x8ab95c) },
]
const POPLAR = { dark: rgb(0x24412a), mid: rgb(0x3d6c37), light: rgb(0x86ad52) }
const PINE = { dark: rgb(0x1f3a30), mid: rgb(0x325e45), light: rgb(0x6f9a5e) }
const BARK = rgb(0x5a4434)
const BARK_LIGHT = rgb(0x7d6551)

/** Light on top, deep underneath, and lighter clumps here and there, between `bottom` and `top` (heights). */
const leafy = (g: { dark: V3; mid: V3; light: V3 }, bottom: number, top: number, seed: number) => (x: number, y: number, z: number) => {
  const up = smoothstep(bottom, top, y)
  let c = mixRgb(g.dark, g.mid, smoothstep(0.02, 0.5, up))
  c = mixRgb(c, g.light, smoothstep(0.5, 1, up) * 0.85)
  return mixRgb(c, g.light, smoothstep(0.58, 0.8, fbm3(x * 0.9, y * 0.9, z * 0.9, seed)) * 0.35)
}

const barkPaint = (x: number, y: number, z: number) => mixRgb(BARK, BARK_LIGHT, 0.25 + 0.35 * noise3(x * 14, y * 4, z * 14, 31))

/** The crown's material: a leafy relief finer than its lumps (the lemon tree's, sized for a tree four times its size). */
const CROWN_MATERIAL = { roughness: 0.9, detail: { scale: 3, bump: 0.12, shade: 0.1 } }
const WOOD_MATERIAL = { roughness: 0.95, surface: { kind: 'bark' as const, size: 0.6 } }

// ───────────────────────────── A: today's shapes, coloured ─────────────────────────────

/** Today's tree, its own triangles, coloured and shaded as one crown. */
export function paintedTree(s: TreeSpot): Object3D {
  const parts = tree(0, 0, s.height, s.seed)
  const crown = parts.crown
  crown.computeBoundingBox()
  const box = crown.boundingBox!
  const g = GREENS[s.index % 3]
  const pos = crown.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const paint = leafy(g, box.min.y, box.max.y, s.seed)
  const cx = (box.min.x + box.max.x) / 2
  const cz = (box.min.z + box.max.z) / 2
  const rx = (box.max.x - box.min.x) / 2
  for (let i = 0; i < pos.count; i++) {
    const [r, gg, b] = paint(pos.getX(i), pos.getY(i), pos.getZ(i))
    // the hollows between the lumps, near the crown's middle, darker
    const k = 0.78 + 0.22 * smoothstep(0.35, 0.95, Math.hypot(pos.getX(i) - cx, pos.getZ(i) - cz) / rx + smoothstep(box.min.y, box.max.y, pos.getY(i)) * 0.5)
    col.set([r * k, gg * k, b * k], i * 3)
  }
  crown.setAttribute('color', new BufferAttribute(col, 3))
  bend(crown, [cx, (box.min.y + box.max.y) / 2, cz], [rx, (box.max.y - box.min.y) / 2, (box.max.z - box.min.z) / 2], 0.5)
  const leaves = surface('grass', 1, 1)
  const out = new Group()
  out.add(
    new Mesh(parts.wood, new MeshStandardMaterial({ color: new Color('#7a6150'), map: surface('veneer', 1, 1).map, roughness: 0.95 })),
    // no grass picture: only its relief, gentler
    new Mesh(crown, new MeshStandardMaterial({ vertexColors: true, normalMap: leaves.normalMap, normalScale: new Vector2(0.6, 0.6), roughness: 0.92 })),
  )
  out.position.set(s.x, 0, s.z)
  return out
}

/** Normals bent towards an ellipsoid's (as lab/three/model.ts does for the kit's shapes). */
function bend(g: BufferGeometry, c: V3, r: V3, k: number) {
  const p = g.getAttribute('position')
  const n = g.getAttribute('normal')
  for (let i = 0; i < n.count; i++) {
    let ex = (p.getX(i) - c[0]) / (r[0] * r[0])
    let ey = (p.getY(i) - c[1]) / (r[1] * r[1])
    let ez = (p.getZ(i) - c[2]) / (r[2] * r[2])
    const el = Math.hypot(ex, ey, ez) || 1
    ex /= el
    ey /= el
    ez /= el
    const x = n.getX(i) + (ex - n.getX(i)) * k
    const y = n.getY(i) + (ey - n.getY(i)) * k
    const z = n.getZ(i) + (ez - n.getZ(i)) * k
    const l = Math.hypot(x, y, z) || 1
    n.setXYZ(i, x / l, y / l, z / l)
  }
  n.needsUpdate = true
}

export const paintedTriangles = (s: TreeSpot) => {
  const parts = tree(0, 0, s.height, s.seed)
  const n = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3
  return n(parts.crown) + n(parts.wood)
}

// ───────────────────────────── the trunk ─────────────────────────────

/** A trunk that flares into the ground and leans a little, up to `top`, with limbs forking from it (`fork` of the way
 *  up) into the crown, to `ends`. */
function trunk(top: number, r: number, lean: number, ends: V3[], fork = 0.82): Shape {
  const tip: V3 = [Math.sin(lean) * top, top, 0]
  const stem = tube([[0, -0.03, 0], [0, 0.3, 0], [tip[0] * 0.5, top * 0.55, 0], tip], [r * 1.6, r * 1.05, r * 0.92, r * 0.72], { seg: 8, steps: 1, caps: [true, false], round: [0, r * 0.7] })
  const limbs = ends.map((to) =>
    tube([[tip[0] * fork, top * fork, 0], [tip[0] * fork * 0.4 + to[0] * 0.6, top * fork * 0.45 + to[1] * 0.55, to[2] * 0.6], to], [r * 0.6, r * 0.45, r * 0.32], {
      seg: 5,
      steps: 1,
      round: [0, r * 0.3],
    }),
  )
  return merge(stem, ...limbs).paint(barkPaint, 0)
}

// ───────────────────────────── B: the round tree ─────────────────────────────

export type TreePart = 'wood' | 'crown'

/** A round broadleaf: a big lump in the middle, five round it a little lower, one or two on top; a flatter underside. */
export function roundTree(height: number, seed: number, shade: number): LabModel<TreePart> {
  const r = mulberry(seed)
  const top = height * 0.3
  const R = height * 0.25
  const cy = top + height * 0.28
  const lean = (r() - 0.5) * 0.1
  const lump = (rad: number, at: V3, k: number) => blob(rad, 2, (x, y, z) => 0.13 * (fbm3(x * 2.2 + seed, y * 2.2, z * 2.2, seed + k) - 0.5)).place(at, [0, r() * 6, 0], [1, 0.84, 1])
  const lumps: Shape[] = [lump(R, [Math.sin(lean) * top, cy, 0], 0)]
  const ring: V3[] = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.6
    const out = R * (0.8 + r() * 0.2)
    const at: V3 = [Math.sin(lean) * top + Math.cos(a) * out, cy - R * 0.2 + r() * R * 0.26, Math.sin(a) * out]
    ring.push(at)
    lumps.push(lump(R * (0.6 + r() * 0.12), at, i + 1))
  }
  const a = r() * Math.PI * 2
  lumps.push(lump(R * 0.62, [Math.sin(lean) * top + Math.cos(a) * R * 0.3, cy + R * 0.7, Math.sin(a) * R * 0.3], 7))
  // a flatter underside: what hangs below it is pressed up
  const under = cy - R * 0.6
  const g = GREENS[shade % 3]
  const crown = merge(...lumps)
    .warp((x, y, z) => [x, y < under ? under - (under - y) * 0.5 : y, z])
    .paint(leafy(g, under - R * 0.2, cy + R * 1.25, seed), 0)
    // the hollows near the middle and underneath darker
    .shade((x, y, z) => 0.74 + 0.26 * smoothstep(0.3, 1.0, Math.hypot(x, z) / (R * 1.6) + smoothstep(under, cy + R, y) * 0.45))
  return {
    // the trunk runs up into the middle lump; three limbs fork from it into the lumps round it
    wood: {
      shape: trunk(
        under + R * 0.3,
        height * 0.032,
        lean,
        [ring[0], ring[2], ring[3]].map((p): V3 => [p[0] * 0.7, p[1] - R * 0.15, p[2] * 0.7]),
        0.62,
      ),
      material: WOOD_MATERIAL,
    },
    crown: { shape: crown, material: CROWN_MATERIAL, soft: { centre: [Math.sin(lean) * top, cy + R * 0.1, 0], radii: [R * 1.75, R * 1.35, R * 1.75], k: 0.6 } },
  }
}

// ───────────────────────────── C: the poplar and the pine ─────────────────────────────

/** A tall poplar: a lumpy column of leaves, pointed at the top, on a short trunk. */
export function poplarTree(height: number, seed: number): LabModel<TreePart> {
  const h = height * 1.12
  const base = h * 0.16
  const R = h * 0.13
  const rings = 12
  const column = loft(
    Array.from({ length: rings + 1 }, (_, k) => {
      const t = k / rings
      // widest a third of the way up, rounded at the bottom, pointed at the top
      const w = k === 0 || k === rings ? 0 : Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.8) * (1 - 0.25 * t)
      return { c: [0, base + t * (h - base), 0] as V3, rx: R * w, ry: R * w }
    }),
    { seg: 14, steps: 1, up: [0, 0, 1], shape: (a, along) => 1 + 0.1 * Math.sin(a * 3 + along * 11 + seed) + 0.07 * Math.sin(a * 5 - along * 17) },
  ).displace((x, y, z) => 0.12 * (fbm3(x * 1.6, y * 0.9, z * 1.6, seed) - 0.5))
  const crown = column.paint(leafy(POPLAR, base, h, seed), 0).shade((x, _y, z) => 0.78 + 0.22 * smoothstep(0.25, 0.9, Math.hypot(x, z) / R))
  return {
    wood: { shape: trunk(base + R * 0.6, h * 0.022, 0, []), material: WOOD_MATERIAL },
    crown: { shape: crown, material: CROWN_MATERIAL, soft: { centre: [0, base + (h - base) * 0.42, 0], radii: [R * 1.2, (h - base) * 0.55, R * 1.2], k: 0.5 } },
  }
}

/** A pine: four tiers of drooping boughs, each smaller than the one under it, on a trunk that shows below. */
export function pineTree(height: number, seed: number): LabModel<TreePart> {
  const r = mulberry(seed)
  const base = height * 0.24
  const tiers: Shape[] = []
  const n = 4
  for (let k = 0; k < n; k++) {
    const t = k / n
    const y0 = base + t * (height - base) * 0.82
    const tall = (height - base) * (0.42 - t * 0.06)
    const rad = height * (0.26 - t * 0.05)
    const turn = r() * 6
    tiers.push(
      lathe(
        [
          [0, y0 + tall * 0.16],
          [rad * 0.55, y0 + tall * 0.04],
          [rad, y0],
          [rad * 0.88, y0 + tall * 0.14],
          [rad * 0.48, y0 + tall * 0.55],
          [0, y0 + tall],
        ],
        { seg: 12, steps: 1, shape: (a) => 1 + 0.09 * Math.sin(a * 7 + turn) + 0.05 * Math.sin(a * 3 - turn) },
      ),
    )
  }
  const crown = merge(...tiers)
    .paint(leafy(PINE, base, height, seed), 0)
    .shade((x, _y, z) => 0.7 + 0.3 * smoothstep(0.2, 0.85, Math.hypot(x, z) / (height * 0.26)))
  return {
    wood: { shape: trunk(base + height * 0.08, height * 0.026, 0, []), material: WOOD_MATERIAL },
    crown: { shape: crown, material: CROWN_MATERIAL, soft: { centre: [0, base + (height - base) * 0.4, 0], radii: [height * 0.24, (height - base) * 0.5, height * 0.24], k: 0.45 } },
  }
}

// ───────────────────────────── the variants' makers ─────────────────────────────

export type TreeVariant = 'today' | 'a' | 'b' | 'c'

/** The kit's model for a spot (B and C), or none (today and A draw the game's own shapes). */
export function treeModel(v: TreeVariant, s: TreeSpot): LabModel<TreePart> | null {
  if (v === 'b' || (v === 'c' && (s.corner || s.index % 3 === 0))) return roundTree(s.height, s.seed, s.index)
  if (v === 'c') return s.index % 3 === 1 ? poplarTree(s.height, s.seed) : pineTree(s.height, s.seed)
  return null
}

/** The tree a variant puts at a spot. */
export function makeTree(v: Exclude<TreeVariant, 'today'>, s: TreeSpot): Object3D {
  if (v === 'a') return paintedTree(s)
  const g = modelGroup(treeModel(v, s)!, `tree-${s.index}`)
  g.position.set(s.x, 0, s.z)
  return g
}

/** The triangles a variant's tree draws at a spot. */
export const treeTriangles = (v: Exclude<TreeVariant, 'today'>, s: TreeSpot) => (v === 'a' ? paintedTriangles(s) : trianglesOf(treeModel(v, s)!))

/** The kit's checks on every tree a variant makes (A is today's shapes: nothing new to check). */
export function treeChecks(v: Exclude<TreeVariant, 'today'>, spots: TreeSpot[]): string[] {
  if (v === 'a') return []
  return spots.flatMap((s) => checkModel(`${v.toUpperCase()} · tree ${s.corner ? 'corner' : 'woods'} ${s.index}`, treeModel(v, s)!))
}
