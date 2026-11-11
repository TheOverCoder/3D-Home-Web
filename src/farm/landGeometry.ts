import { type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { WALK_INS, bounds } from '../data/buildings'
import { SHRUB_SPOTS } from '../data/garden'
import { GARDEN, GATE, LANE } from '../data/layout'
import { CABIN } from '../data/market'
import { fenceRun, hedgeRun, mulberry, tree, type TreeParts } from '../scene/flora'
import { TRACTOR } from './data'
import { boundary, ownedRects, type Edge, type FarmLayout, type Rect } from './layout'

// What the farm's land is made of (src/farm/Land.tsx draws it): the hedge along the sides that face north and west, the
// fence along those that face south and east, the woods beyond — made from seeds, the same every time for a layout.

const SEP = 0.5 // a fence stops this short of a hedge it runs into
/** Sections of hedge in one piece (each 2.4 to 3.6 m long). */
export const HEDGE_PIECE = 2

// The hedge (26k triangles) and the woods' crowns (18k) are drawn in pieces a few metres across, never as one mesh round
// the farm: the frustum, and from the house the portals (src/lib/visibility), then leave out the pieces out of view, where
// one mesh is always partly in view and so always drawn whole. A piece is whole sections of one hedge or one tree's crown,
// each made on its own exactly as before, so its vertices, normals and UVs are the ones the single mesh had. And they are
// drawn in the single mesh's order: three draws one material's meshes nearest first, but materials in the order they
// were made, so each piece has a material of its own (the same settings: one shader), made in that order — where two
// sections overlap, the one drawn last still wins a tie in the depth buffer.
// The trunks (128 triangles a tree) and the fence (600 in all) stay one mesh each: a draw costs more than they would save.

/** What the land is made of, each section and tree made on its own (from its seed). */
interface Sections {
  /** each hedge's sections, in the order of the boundary's edges */
  hedges: BufferGeometry[][]
  fence: BufferGeometry[]
  trees: TreeParts[]
  edges: Edge[]
}

export interface Built {
  /** the hedge in pieces: a few whole sections of one hedge each */
  hedge: BufferGeometry[]
  fence: BufferGeometry | null
  /** the woods' trunks */
  wood: BufferGeometry
  /** each tree's crown in its shade of green (every third tree in each) */
  crowns: { geometry: BufferGeometry; shade: number }[]
  edges: Edge[]
}

const flat = (gs: BufferGeometry[]) => gs.map((g) => (g.index ? g.toNonIndexed() : g))

/** How far the woods stand clear of the land the farm owns and of the buildings beyond it, metres. */
export const WOODS_CLEAR = 3.5

/** Where the woods' trees stand: a loose ring round the farm. One standing on land the farm owns, or by a walk-in
 *  building (src/data/buildings.ts) or the contractor's cabin, has stepped back (outwards, away from the house) until it
 *  stands clear of it. */
export function treeSpots(layout: FarmLayout): { x: number; z: number; height: number; seed: number }[] {
  const r = mulberry(9)
  // the same seed once laid out the shrubs: skip what it gave them, so the woods stand where they always have
  for (let i = 0; i < SHRUB_SPOTS.length; i++) r()
  const owned = ownedRects(layout)
  const built = [...WALK_INS.map(bounds), CABIN].map((b) => ({ minX: b.x0, maxX: b.x1, minZ: b.z0, maxZ: b.z1 }))
  const C = WOODS_CLEAR
  const near = (rects: Rect[]) => (x: number, z: number) => rects.some((o) => x > o.minX - C && x < o.maxX + C && z > o.minZ - C && z < o.maxZ + C)
  const onLand = near(owned)
  const byBuilding = near(built)
  const out: { x: number; z: number; height: number; seed: number }[] = []
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + (r() - 0.5) * 0.35
    let radius = 19 + r() * 9
    const height = 6 + r() * 4
    while (onLand(Math.cos(angle) * radius, Math.sin(angle) * radius) && radius < 80) radius += 1
    let x = Math.cos(angle) * radius
    let z = Math.sin(angle) * radius
    // keep the tractor's track out of the west hedge clear (and the ground beside it where it turns round), and the
    // lane outside the farm gate: those trees step back from them
    if (x < -8 && Math.abs(z - TRACTOR.z) < 5) z = TRACTOR.z + (z >= TRACTOR.z ? 1 : -1) * (5.5 + (i % 3))
    if (Math.abs(z - LANE.z) < 3.2) z = LANE.z + 5.5 + (i % 3)
    // and from the buildings beyond the lane, the same way: outwards, away from the house
    if (byBuilding(x, z)) {
      const a = Math.atan2(z, x)
      let d = Math.hypot(x, z)
      while ((byBuilding(Math.cos(a) * d, Math.sin(a) * d) || onLand(Math.cos(a) * d, Math.sin(a) * d)) && d < 80) d += 1
      x = Math.cos(a) * d
      z = Math.sin(a) * d
    }
    out.push({ x, z, height, seed: 40 + i })
  }
  return out
}

/** The woods round the farm (where `treeSpots` puts them). */
const woods = (layout: FarmLayout): TreeParts[] => treeSpots(layout).map((t) => tree(t.x, t.z, t.height, t.seed))

function sections(layout: FarmLayout): Sections {
  const edges = boundary(layout)
  const hedgeEdges = edges.filter((e) => e.out === 'north' || e.out === 'west')
  // does a hedge run through this point (a fence meeting it stops short)?
  const onHedge = (x: number, z: number) =>
    hedgeEdges.some((h) => (h.axis === 'x' ? Math.abs(z - h.at) < 0.01 && x > h.from - 0.01 && x < h.to + 0.01 : Math.abs(x - h.at) < 0.01 && z > h.from - 0.01 && z < h.to + 0.01))
  const hedges: BufferGeometry[][] = []
  const fence: BufferGeometry[] = []
  const runs = { north: 0, west: 0 }
  edges.forEach((e) => {
    if (e.out === 'north' || e.out === 'west') {
      // each hedge its own seed, so the sections never repeat (the garden's own two keep the ones they always had)
      const seed = (e.out === 'north' ? 3 : 5) + 4 * runs[e.out]++
      const from = e.axis === 'z' && e.from === GARDEN.minZ ? e.from + SEP : e.from
      // the west hedge the tractor's track crosses: a gap there for its gate (src/farm/OrderYard.tsx)
      if (e.axis === 'z' && e.out === 'west' && e.from < TRACTOR.z && e.to > TRACTOR.z) {
        const half = TRACTOR.gate / 2 + 0.14
        hedges.push(flat([...hedgeRun('z', e.at, from, TRACTOR.z - half, seed), ...hedgeRun('z', e.at, TRACTOR.z + half, e.to, seed + 2)]))
        return
      }
      hedges.push(flat(hedgeRun(e.axis, e.at, from, e.to, seed)))
      return
    }
    const start = e.axis === 'x' ? onHedge(e.from, e.at) : onHedge(e.at, e.from)
    const end = e.axis === 'x' ? onHedge(e.to, e.at) : onHedge(e.at, e.to)
    const from = e.from + (start ? SEP : 0)
    const to = e.to - (end ? SEP : 0)
    // the farm gate is in the garden's south fence
    const gateL = GATE.x - GATE.width / 2
    const gateR = GATE.x + GATE.width / 2
    if (e.axis === 'x' && e.at === GARDEN.maxZ && from < gateL && to > gateR) {
      fence.push(...fenceRun('x', e.at, from, gateL), ...fenceRun('x', e.at, gateR, to))
    } else if (to - from > 0.3) fence.push(...fenceRun(e.axis, e.at, from, to))
  })
  return { hedges, fence, trees: woods(layout), edges }
}

export function build(layout: FarmLayout): Built {
  const { hedges, fence, trees, edges } = sections(layout)
  const hedge: BufferGeometry[] = []
  for (const run of hedges) for (let i = 0; i < run.length; i += HEDGE_PIECE) hedge.push(mergeGeometries(run.slice(i, i + HEDGE_PIECE))!)
  return {
    hedge,
    fence: fence.length ? mergeGeometries(flat(fence))! : null,
    wood: mergeGeometries(trees.map((t) => t.wood))!,
    crowns: trees.map((t, i) => ({ geometry: t.crown, shade: i % 3 })),
    edges,
  }
}

/** ?debug: the hedge and the crowns as they were built before the pieces, one mesh for the hedge and one for each shade
 *  of crowns, from the same sections — to show the pieces draw the same picture (tests/e2e/16-view). */
export function buildWhole(layout: FarmLayout): { hedge: BufferGeometry | null; crowns: BufferGeometry[] } {
  const { hedges, trees } = sections(layout)
  const hedge = hedges.flat()
  return {
    hedge: hedge.length ? mergeGeometries(hedge)! : null,
    crowns: [0, 1, 2].map((k) => mergeGeometries(trees.filter((_, i) => i % 3 === k).map((t) => t.crown))!),
  }
}
