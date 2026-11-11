import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { build, buildWhole } from './landGeometry'
import { PARCEL_IDS, defaultLayout, type FarmLayout, type ParcelId } from './layout'

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
