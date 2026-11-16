import { beforeAll, describe, expect, it } from 'vitest'
import { MeshoptSimplifier } from 'meshoptimizer/simplifier'
import { SphereGeometry, TorusKnotGeometry, type BufferGeometry } from 'three'
import { SUN_SHADOW } from '../../data/layout'
import { FINEST_SHADOW_MAP } from '../profile'
import { A_DRAW, HALF_PIXEL, SHADE, SUN_TEXEL, copiesMade, copyTime, farEnough, lodReady, lodsLater, lodsOf, makeCopiesNow, sunEnough, sunLodsOf, within, worthDrawing, type Lod } from './lod'
import { loadSolids } from './solid'
import { GOODS } from '../../models/goods'
import { barnModel } from '../../models/buildings'
import { decorModel } from '../../models/decor'
import { fruitPlantModel, hangingFruit } from '../../models/fruit'
import { personParts } from '../../models/person'
import { cropParts } from '../../models/crops'

// The lighter copies of parts (lod.ts): what each copy promises — no surface moved by more than its `error` — measured
// on the game's own models; whether a copy is worth its draw, judged across the crowd; the weight that keeps light and
// colour under what the screen shows (measured on the simplifier itself); the sun's copies, held to half a texel; and a
// model built again (a map gone to again) has the very copies it had, at once, made from nothing but the same content.

beforeAll(async () => {
  await loadSolids()
  await lodReady()
})

/** The closest point of triangle abc to p, as weights of a, b, c (Ericson's). */
function closest(p: number[], a: number[], b: number[], c: number[]): number[] {
  const sub = (u: number[], v: number[]) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]]
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const ab = sub(b, a)
  const ac = sub(c, a)
  const ap = sub(p, a)
  const d1 = dot(ab, ap)
  const d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) return [1, 0, 0]
  const bp = sub(p, b)
  const d3 = dot(ab, bp)
  const d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return [0, 1, 0]
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return [1 - d1 / (d1 - d3), d1 / (d1 - d3), 0]
  const cp = sub(p, c)
  const d5 = dot(ab, cp)
  const d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return [0, 0, 1]
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return [1 - d2 / (d2 - d6), 0, d2 / (d2 - d6)]
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6))
    return [0, 1 - w, w]
  }
  const s = 1 / (va + vb + vc)
  return [1 - (vb + vc) * s, vb * s, vc * s]
}

/** How far the part's surface moved in a copy, at most: from each of its vertices to the nearest point of the copy. */
function moved(g: BufferGeometry, copy: BufferGeometry): number {
  const pos = g.getAttribute('position')
  const at = (v: number) => [pos.getX(v), pos.getY(v), pos.getZ(v)]
  const kept = copy.index!.array
  const tris: number[][][] = []
  for (let t = 0; t < kept.length; t += 3) tris.push([at(kept[t]), at(kept[t + 1]), at(kept[t + 2])])
  let most = 0
  // (every vertex of a light part; a few hundred spread over a heavy one)
  const all = [...new Set(Array.from(g.index!.array))]
  const every = Math.max(1, Math.floor(all.length / 400))
  for (let k = 0; k < all.length; k += every) {
    const v = all[k]
    const p = at(v)
    let best = Infinity
    for (const [a, b, c] of tris) {
      const [wa, wb, wc] = closest(p, a, b, c)
      const q = [0, 1, 2].map((k) => wa * a[k] + wb * b[k] + wc * c[k])
      best = Math.min(best, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]))
    }
    most = Math.max(most, best)
  }
  return most
}

/** Some of the game's parts: built in metres and at unit size, smooth and bumpy, open and closed. */
function parts(): [string, BufferGeometry][] {
  const crops = cropParts(0.01)
  const people = personParts(1)
  return [
    ['corn on the shelves', GOODS.corn().cob.shape.geometry()],
    ['an apple hanging', hangingFruit('apple').geometry()],
    ['a raspberry hanging', hangingFruit('raspberry').geometry()],
    ['a lamp', decorModel('lamp').iron.shape.geometry()],
    ['a hedge', decorModel('hedge').leaves.shape.geometry()],
    ['an apple tree', fruitPlantModel('apple-tree').wood.shape.geometry()],
    ['a strawberry plant', crops.meshes.strawberry.geometry],
    ['a head', people.meshes.head.geometry],
  ]
}

describe('far copies', () => {
  it('each moves no surface of its part by more than its error, finest first, each lighter than the last', () => {
    const report: string[] = []
    for (const [name, g] of parts()) {
      const copies = lodsOf(g)
      expect(copies.length, `${name}: copies made`).toBeGreaterThan(0)
      let last = g.index!.count / 3
      let error = 0
      for (const c of copies) {
        expect(c.triangles, name).toBeLessThan(last)
        expect(c.error, name).toBeGreaterThanOrEqual(error)
        // measured as it was made: no vertex of the part further from the copy than its error
        const d = moved(g, c.geometry)
        report.push(`${name} ${c.triangles}: ${(c.error * 1000).toFixed(1)} mm, moved ${(d * 1000).toFixed(1)}`)
        expect(d, `${name}, the copy of ${c.triangles} triangles`).toBeLessThanOrEqual(c.error + 1e-6)
        last = c.triangles
        error = c.error
        // the same vertices: only the triangles are its own
        expect(c.geometry.getAttribute('position')).toBe(g.getAttribute('position'))
      }
    }
    console.log(report.join('\n'))
  })

  it("never trusts the simplifier's estimate: a barn's walls moved thirty times what it said, so their copy says so", () => {
    const g = barnModel().walls.shape.geometry()
    const pos = g.getAttribute('position').array as Float32Array
    const idx = Uint32Array.from(g.index!.array)
    for (const c of lodsOf(g)) {
      expect(within(pos, idx, c.geometry.index!.array, c.error)).toBe(true)
      // drawn only where that is under half a pixel: past a hundred metres on a phone, for the walls' only copy
      expect(c.error).toBeGreaterThan(0.1)
    }
  })

  it('is drawn only where what it moved is under half a pixel', () => {
    // a 4 mm copy on a phone held sideways (487 high, 72° up and down: 335 pixels a metre at a metre)
    const pixels = 487 / (2 * Math.tan((36 * Math.PI) / 180))
    const at = (0.004 * pixels) / HALF_PIXEL
    expect(farEnough(0.004, 1, at * 1.01, pixels)).toBe(true)
    expect(farEnough(0.004, 1, at * 0.99, pixels)).toBe(false)
    // drawn twice the size, twice as far
    expect(farEnough(0.004, 2, at * 1.01, pixels)).toBe(false)
    expect(farEnough(0.004, 2, at * 2.02, pixels)).toBe(true)
    // inside its model (no distance): whole
    expect(farEnough(0.004, 1, 0, pixels)).toBe(false)
  })
})

describe('worth a draw, across the crowd', () => {
  const use = new Uint8Array(4)
  // an apple: whole 156 triangles, copies of 82, 32 and 16
  const APPLE = [156, 82, 32, 16]

  it('a hundred far fruits share one copy; one far fruit alone stays whole beside the near ones', () => {
    worthDrawing([4, 0, 0, 100], APPLE, 3, use)
    expect(use[3]).toBe(3)
    expect(use[0]).toBe(0)
    // one far fruit saves 140 triangles: under a draw's worth, drawn whole with the near ones
    worthDrawing([4, 0, 0, 1], APPLE, 3, use)
    expect(use[3]).toBe(0)
  })

  it('a few far ones go to the finest copy that saves a draw across them, never to a coarser one', () => {
    // 6 want the coarsest: it saves 16 each over the copy before (96 in all: not worth a draw), that one 50 each over
    // the first (300: not either), and with the 6 that want the first, the first saves 74 each over the whole (888)
    worthDrawing([10, 6, 0, 6], APPLE, 3, use)
    expect(use[3]).toBe(1)
    expect(use[2]).toBe(1)
    expect(use[1]).toBe(1)
    expect(use[0]).toBe(0)
    for (let l = 0; l < 4; l++) expect(use[l]).toBeLessThanOrEqual(l)
  })

  it('a copy all the instances in view want is drawn, worth or not: it is the only draw of the part', () => {
    worthDrawing([0, 0, 0, 2], APPLE, 3, use)
    expect(use[3]).toBe(3)
  })

  it('a draw is worth what the budget gives one: its triangles over its draws', () => {
    expect(A_DRAW).toBeGreaterThanOrEqual(250_000 / 700)
    expect(A_DRAW).toBeLessThan((2 * 250_000) / 700)
  })
})

describe('light and colour', () => {
  // a flat grid whose only detail is in its colour: a checker of squares `f` wide, `A` apart; whatever the simplifier
  // removes of it is all colour, no shape
  function checker(L: number, f: number, A: number) {
    const N = Math.round(L / (f / 2))
    const pos = new Float32Array((N + 1) * (N + 1) * 3)
    const att = new Float32Array((N + 1) * (N + 1))
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const v = j * (N + 1) + i
        pos.set([(i / N) * L, 0, (j / N) * L], v * 3)
        att[v] = A * ((Math.floor((i / N) * (L / f) + 1e-6) + Math.floor((j / N) * (L / f) + 1e-6)) % 2)
      }
    const idx: number[] = []
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i
        idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2)
      }
    return { pos, att, idx: Uint32Array.from(idx) }
  }
  /** What taking half the triangles costs, in the simplifier's error (metres). */
  const cost = (L: number, f: number, A: number) => {
    const { pos, att, idx } = checker(L, f, A)
    return MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, att, 1, [SHADE], null, Math.floor(idx.length / 6) * 3, 1, ['ErrorAbsolute'])[1]
  }

  it("a change of Δ across a stretch d weighs about SHADE·Δ·d, whatever the part's size: the rule's terms", () => {
    for (const [L, f, A] of [
      [0.25, 0.016, 0.2],
      [1, 0.016, 0.2],
      [0.25, 0.016, 0.5],
      [0.5, 0.032, 0.2],
    ]) {
      const e = cost(L, f, A)
      expect(e / (SHADE * A * f), `L ${L}, f ${f}, Δ ${A}`).toBeGreaterThan(0.4)
      expect(e / (SHADE * A * f), `L ${L}, f ${f}, Δ ${A}`).toBeLessThan(1.2)
    }
    // the same grid four times the size: the same cost (only the stretch d counts, not the part)
    expect(cost(1, 0.016, 0.2)).toBeCloseTo(cost(0.25, 0.016, 0.2), 4)
  })

  it('so where a copy is drawn its colour moves by at most half across one pixel, a tenth across five', () => {
    // drawn where error < half a pixel p: SHADE·Δ·(n·p) < p/2
    expect(SHADE * 0.5 * 1).toBeLessThanOrEqual(0.5)
    expect(SHADE * 0.1 * 5).toBeLessThanOrEqual(0.5)
  })
})

describe("the sun's copies", () => {
  it('a texel of the sun’s map, where it is finest', () => {
    expect(SUN_TEXEL).toBeCloseTo((2 * SUN_SHADOW.half) / FINEST_SHADOW_MAP, 9)
    expect(SUN_TEXEL).toBeLessThan(0.012)
  })

  it('a copy keeps a shadow to half a texel at the size it is drawn', () => {
    expect(sunEnough(SUN_TEXEL / 2, 1)).toBe(true)
    expect(sunEnough(SUN_TEXEL / 2 + 1e-6, 1)).toBe(false)
    expect(sunEnough(SUN_TEXEL / 4, 2)).toBe(true)
    expect(sunEnough(SUN_TEXEL / 2, 2)).toBe(false)
  })

  it('are made from the shape alone, across the seams of its colours and normals, each measured within its error', () => {
    // a sphere with its seam (its first and last columns of vertices share their places, with other uvs), and a knot
    for (const g of [new SphereGeometry(0.4, 64, 32), new TorusKnotGeometry(0.4, 0.1, 160, 24)]) {
      const copies = sunLodsOf(g)
      const half = copies.filter((c) => sunEnough(c.error, 1))
      expect(half.length).toBeGreaterThan(0)
      const best = half[half.length - 1]
      // far fewer triangles, the same shadow to half a texel: measured, not estimated
      expect(best.triangles).toBeLessThan((g.index!.count / 3) * 0.7)
      for (const c of copies) expect(moved(g, c.geometry)).toBeLessThanOrEqual(c.error)
    }
  })

  it("the simplifier's estimate is not trusted: a copy is measured both ways, nothing moved and nothing bridged", () => {
    // a lamp's iron: what the simplifier makes of it at half a texel moves further than that (it says less)
    const g = decorModel('lamp').iron.shape.geometry()
    const pos = g.getAttribute('position').array as Float32Array
    const idx = Uint32Array.from(g.index!.array)
    const [kept, estimate] = MeshoptSimplifier.simplify(idx, pos, 3, 0, SUN_TEXEL / 2, ['ErrorAbsolute', 'LockBorder'])
    expect(estimate).toBeLessThanOrEqual(SUN_TEXEL / 2)
    expect(within(pos, idx, kept, SUN_TEXEL / 2)).toBe(false)
    for (const c of sunLodsOf(g)) expect(within(pos, idx, c.geometry.index!.array, c.error)).toBe(true)
    // two squares a metre apart, and a "copy" that bridges them: every vertex kept, the bridge caught
    const two = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 3, 0, 0, 4, 0, 0, 4, 1, 0, 3, 1, 0])
    const apart = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]
    expect(within(two, apart, apart, 0.001)).toBe(true)
    expect(within(two, apart, [...apart, 1, 4, 7, 1, 7, 2], 0.001)).toBe(false)
  })

  it("stay well inside what the sun's shadow bias takes up (Lighting.tsx: −0.0003 of its depth range)", () => {
    const bias = 0.0003 * (SUN_SHADOW.far - SUN_SHADOW.near)
    expect(SUN_TEXEL / 2).toBeLessThan(bias / 2)
  })
})

describe('a model built again', () => {
  /** What a geometry's copies are, but for the geometry they draw: each one's triangles, error and index. */
  const what = (lods: Lod[]) => lods.map((c) => ({ triangles: c.triangles, error: c.error, index: Array.from(c.geometry.index!.array) }))

  it('has the very copies it had, at once, each drawing its own attributes — for the camera and for the sun', () => {
    // the corn's cob, built twice: the same content, two geometries
    for (const of of [lodsOf, sunLodsOf]) {
      const first = GOODS.corn().cob.shape.geometry()
      const again = GOODS.corn().cob.shape.geometry()
      expect(again).not.toBe(first)
      const had = of(first)
      expect(had.length).toBeGreaterThan(0)
      const before = { ...copyTime }
      const got = of(again)
      // nothing made: what was found for the same content, handed over
      expect(copyTime.geometries).toBe(before.geometries)
      expect(copyTime.reused).toBe(before.reused + 1)
      expect(what(got)).toEqual(what(had))
      for (const c of got) {
        expect(c.geometry.getAttribute('position')).toBe(again.getAttribute('position'))
        expect(c.geometry.getAttribute('normal')).toBe(again.getAttribute('normal'))
        expect(c.geometry.boundingSphere).toBe(again.boundingSphere)
      }
    }
  })

  it('that differs gets copies of its own: a normal for the camera (its light weighs), a vertex for both', () => {
    const base = new SphereGeometry(0.4, 64, 32)
    expect(lodsOf(base).length).toBeGreaterThan(0)
    expect(sunLodsOf(base).length).toBeGreaterThan(0)
    // one vertex's normal: the camera's copies are made again; the sun's map keeps depth only, so its copies are the same
    const lit = base.clone()
    ;(lit.getAttribute('normal').array as Float32Array)[0] += 0.5
    let before = { ...copyTime }
    lodsOf(lit)
    expect(copyTime.geometries).toBe(before.geometries + 1)
    before = { ...copyTime }
    sunLodsOf(lit)
    expect(copyTime.reused).toBe(before.reused + 1)
    // one vertex moved: both made again
    const moved = base.clone()
    ;(moved.getAttribute('position').array as Float32Array)[1] += 0.01
    moved.computeBoundingSphere()
    before = { ...copyTime }
    lodsOf(moved)
    sunLodsOf(moved)
    expect(copyTime.geometries).toBe(before.geometries + 2)
    expect(copyTime.reused).toBe(before.reused)
  })

  it('asked for in idle time, has them in its first step', async () => {
    const first = fruitPlantModel('cherry-tree').leaves.shape.geometry()
    const had = lodsOf(first)
    expect(had.length).toBeGreaterThan(0)
    const again = fruitPlantModel('cherry-tree').leaves.shape.geometry()
    let got: Lod[] | null = null
    lodsLater(again, (lods) => (got = lods))
    await copiesMade()
    expect(what(got!)).toEqual(what(had))
    // what was found for the first, handed over: the same indices, not made again
    got!.forEach((c, i) => expect(c.geometry.index).toBe(had[i].geometry.index))
  })

  it('asked for in idle time, is made at once when a test asks (`__home.copiesNow`): the same copies', () => {
    const knot = () => new TorusKnotGeometry(0.3, 0.08, 120, 16)
    let got: Lod[] | null = null
    lodsLater(knot(), (lods) => (got = lods))
    makeCopiesNow()
    expect(copyTime.pending).toBe(0)
    expect(got!.length).toBeGreaterThan(0)
    expect(what(got!)).toEqual(what(lodsOf(knot())))
  })
})
