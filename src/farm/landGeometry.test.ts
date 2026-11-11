import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { WALK_INS, bounds, type Rect as Area } from '../data/buildings'
import { GARDEN, GATE } from '../data/layout'
import { CABIN, LOT } from '../data/market'
import { WOODS_CLEAR, build, buildWhole, treeSpots } from './landGeometry'
import { PARCEL_IDS, defaultLayout, lotEdges, ownedRects, reachRects, type FarmLayout, type ParcelId } from './layout'

// The hedge and the woods' crowns in pieces (src/farm/Land.tsx draws them): the pieces hold exactly the vertices of the
// one mesh each that was drawn before, in its order, and each is a few metres across. The picture itself is compared in
// the browser (tests/e2e/16-view).

const layouts: [string, FarmLayout][] = [
  ["today's farm", defaultLayout()],
  ['the north and east meadows bought', { ...defaultLayout(), land: ['north', 'east'] as ParcelId[] }],
  ['all the land', { ...defaultLayout(), land: [...PARCEL_IDS] }],
]

/** Each attribute's numbers, the geometries' one after another. */
function joined(gs: BufferGeometry[]) {
  const out: Record<string, Float32Array> = {}
  for (const name of Object.keys(gs[0].attributes)) {
    const parts = gs.map((g) => g.getAttribute(name).array as Float32Array)
    const all = new Float32Array(parts.reduce((n, a) => n + a.length, 0))
    let at = 0
    for (const a of parts) {
      all.set(a, at)
      at += a.length
    }
    out[name] = all
  }
  for (const g of gs) expect(g.index, 'triangles one by one, without an index').toBeNull()
  return out
}

/** The same attributes, number for number (how many numbers differ in each, and their lengths). */
function same(a: Record<string, Float32Array>, b: Record<string, Float32Array>) {
  expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort())
  for (const name of Object.keys(a)) {
    expect(a[name].length, name).toBe(b[name].length)
    let differ = 0
    for (let i = 0; i < a[name].length; i++) if (!Object.is(a[name][i], b[name][i])) differ++
    expect(differ, `${name}: numbers that differ`).toBe(0)
  }
}

const across = (g: BufferGeometry) => {
  g.computeBoundingBox()
  const b = g.boundingBox!
  return Math.max(b.max.x - b.min.x, b.max.z - b.min.z)
}

describe('the land in pieces', () => {
  for (const [name, layout] of layouts)
    it(`${name}: the pieces are the one mesh, in its order, a few metres each`, () => {
      const pieces = build(layout)
      const whole = buildWhole(layout)
      // the hedge: its pieces one after another are the single mesh, number for number
      expect(pieces.hedge.length).toBeGreaterThan(4)
      same(joined(pieces.hedge), joined([whole.hedge!]))
      // the crowns: each shade's trees in turn are that shade's mesh
      expect(pieces.crowns.length).toBe(14)
      for (let k = 0; k < 3; k++) same(joined(pieces.crowns.filter((c) => c.shade === k).map((c) => c.geometry)), joined([whole.crowns[k]]))
      // a few metres across: two sections of hedge (7.5 m at most), a tree's crown
      for (const g of pieces.hedge) expect(across(g)).toBeLessThan(7.5)
      for (const c of pieces.crowns) expect(across(c.geometry)).toBeLessThan(9)
    })

  it('made the same every time (from their seeds)', () => {
    const a = build(defaultLayout())
    const b = build(defaultLayout())
    same(joined(a.hedge), joined(b.hedge))
    same(joined(a.crowns.map((c) => c.geometry)), joined(b.crowns.map((c) => c.geometry)))
  })
})

// Beyond the gate: the lot across the lane, the walk-in buildings and the contractor's cabin (src/data/market.ts,
// src/data/buildings.ts) — the woods stand clear of them, invisible walls close the lot where nothing else does
// (src/farm/Land.tsx), and the ground you can be on holds all of it (the camera, the safety net, walking to a mark).

const away = (r: Area, x: number, z: number) => Math.hypot(Math.max(0, r.x0 - x, x - r.x1), Math.max(0, r.z0 - z, z - r.z1))
const inArea = (r: Area, x: number, z: number, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m
const buildings: Area[] = [...WALK_INS.map(bounds), CABIN]

describe('beyond the gate', () => {
  for (const [name, layout] of layouts) {
    it(`${name}: no tree of the woods within ${WOODS_CLEAR} m of a walk-in building or the cabin`, () => {
      const spots = treeSpots(layout)
      expect(spots.length).toBe(14)
      for (const t of spots) for (const b of buildings) expect(away(b, t.x, t.z), `the tree at (${t.x.toFixed(1)}, ${t.z.toFixed(1)})`).toBeGreaterThanOrEqual(WOODS_CLEAR)
    })

    it(`${name}: the lot's edge is closed all round, but for the gate and the doorways`, () => {
      const walls = lotEdges(layout)
      const owned = ownedRects(layout)
      const lot: Area[] = LOT.map((r) => r)
      // what stands on the edge: a walk-in's walls on the ground and its doorways (its ways in), the cabin
      const standing: Area[] = [...WALK_INS.flatMap((w) => [...w.walls.filter((b) => b.y0 < 0.5), ...w.doors]), CABIN]
      const onWall = (x: number, z: number) =>
        walls.some((e) => (e.axis === 'x' ? Math.abs(z - e.at) < 1e-6 && x >= e.from - 1e-6 && x <= e.to + 1e-6 : Math.abs(x - e.at) < 1e-6 && z >= e.from - 1e-6 && z <= e.to + 1e-6))
      let open = 0
      for (const r of lot)
        for (const [nx, nz] of [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ]) {
          const n = Math.round(((nx ? r.z1 - r.z0 : r.x1 - r.x0) / 0.1) | 0)
          for (let k = 0; k <= n; k++) {
            // a point on this side, and just outside it
            const x = nx ? (nx < 0 ? r.x0 : r.x1) : r.x0 + ((r.x1 - r.x0) * k) / n
            const z = nz ? (nz < 0 ? r.z0 : r.z1) : r.z0 + ((r.z1 - r.z0) * k) / n
            const ox = x + nx * 0.02
            const oz = z + nz * 0.02
            if (lot.some((o) => inArea(o, ox, oz))) continue // inside the lot still
            const closed =
              onWall(x, z) ||
              standing.some((b) => inArea(b, x, z, 0.06)) ||
              // your own land beyond: its fence closes it, the gate open in it
              owned.some((o) => ox >= o.minX && ox <= o.maxX && oz >= o.minZ && oz <= o.maxZ)
            if (!closed) open++
          }
        }
      expect(open, 'points of the lot edge with nothing closing them').toBe(0)
      // the ways in stay open: no invisible wall across the garden's gate or a walk-in's doorway
      for (const e of walls) {
        if (e.axis === 'x' && Math.abs(e.at - GARDEN.maxZ) < 0.06) expect(e.to <= GATE.x - GATE.width / 2 || e.from >= GATE.x + GATE.width / 2).toBe(true)
        for (const d of WALK_INS.flatMap((w) => w.doors)) {
          const crosses = e.axis === 'x' ? e.at > d.z0 - 0.06 && e.at < d.z1 + 0.06 && e.from < d.x1 && e.to > d.x0 : e.at > d.x0 - 0.06 && e.at < d.x1 + 0.06 && e.from < d.z1 && e.to > d.z0
          expect(crosses, 'a wall across a doorway').toBe(false)
        }
      }
    })

    it(`${name}: the ground you can be on holds the lot, every walk-in's rooms and doorways, and the cabin's corner`, () => {
      const reach = reachRects(layout)
      const on = (x: number, z: number) => reach.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
      const areas: Area[] = [...LOT, ...WALK_INS.flatMap((w) => [...w.rooms, ...w.doors])]
      for (const a of areas)
        for (let i = 0; i <= 10; i++)
          for (let j = 0; j <= 10; j++) {
            const x = a.x0 + ((a.x1 - a.x0) * i) / 10
            const z = a.z0 + ((a.z1 - a.z0) * j) / 10
            expect(on(x, z), `(${x.toFixed(2)}, ${z.toFixed(2)})`).toBe(true)
          }
    })
  }
})
