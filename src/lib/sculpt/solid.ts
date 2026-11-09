import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import { Shape } from './core'

// Solids: cutting closed shapes with others and joining them into one surface, with manifold-3d (a WebAssembly
// geometry engine, about 200 KB, loaded once). The kit's lofts and lathes only grow surfaces; this is what makes
// holes and clean joins:
//
//   subtract(wall, door)       a door through a wall, the mouth of an oven through its dome: the cut faces take
//                              the colours of the shape that cut them (paint the cutter soot, and the opening's
//                              sides are sooty)
//   union(dome, vault)         two overlapping shapes made one, with no faces left inside
//   intersect(a, b)            only what both hold
//
// Every shape given must be closed (no open ends: caps, `round`, or a radius of 0 at the tips — the model checks
// say where a shape is open). The colours, the pattern, the tint mask and the surface amount ride along on the
// vertices and are blended where the cut runs; sharp edges (a cap's rim, the edge of a cut) stay sharp.
//
// The engine loads asynchronously: call `loadSolids()` early (the game does it as the farm is built, the gallery
// before it shows anything) and build the models that need it once it has (`solidsReady()`). Should it fail to
// load, `subtract` and `intersect` leave the first shape as it is and `union` merges the shapes as they are — a
// model loses its hole, the game goes on.

let engine: ManifoldToplevel | null = null
let failed = false
let loading: Promise<void> | null = null

/** Loads the solid engine (once; later calls return the same promise). It never rejects: see above. */
export function loadSolids(): Promise<void> {
  loading ??= (async () => {
    try {
      const [{ default: Module }, { default: wasm }] = await Promise.all([import('manifold-3d'), import('manifold-3d/manifold.wasm?url')])
      const m = await Module({ locateFile: () => wasm })
      m.setup()
      engine = m
    } catch (e) {
      failed = true
      console.warn('[sculpt] the solid engine did not load: models are built without their cuts', e)
    }
  })()
  return loading
}

/** Has the engine loaded (or failed to, so that models can be built without it)? */
export const solidsReady = () => engine !== null || failed

// per vertex: position, normal (keeps sharp edges apart), base colour, pattern colour, pattern, tint, surface
const POS = 0
const NORMAL = 3
const PROPS = 15

function toManifold(m: ManifoldToplevel, s: Shape): Manifold {
  const n = s.count
  const normals = s.normals()
  const v = new Float32Array(n * PROPS)
  for (let k = 0; k < n; k++) {
    const o = k * PROPS
    for (let j = 0; j < 3; j++) {
      v[o + POS + j] = s.p[k * 3 + j]
      v[o + NORMAL + j] = normals[k * 3 + j]
      v[o + 6 + j] = s.c[k * 3 + j]
      v[o + 9 + j] = s.c2[k * 3 + j]
    }
    v[o + 12] = s.m[k]
    v[o + 13] = s.t[k]
    v[o + 14] = s.s[k]
  }
  // drop triangles with no area (the tips of shapes), which would leave the surface not closed
  const tri: number[] = []
  for (let k = 0; k < s.i.length; k += 3) {
    const a = s.i[k]
    const b = s.i[k + 1]
    const c = s.i[k + 2]
    if (a !== b && b !== c && a !== c) tri.push(a, b, c)
  }
  const mesh = new m.Mesh({ numProp: PROPS, vertProperties: v, triVerts: Uint32Array.from(tri) })
  // vertices at the same spot (a cap's rim and the side it closes) are one point of the solid
  mesh.merge()
  const solid = new m.Manifold(mesh)
  const status = solid.status()
  if (status !== 'NoError') {
    solid.delete()
    throw new Error(`[sculpt] a shape given to the solid engine is not closed (${status}): close its open ends first`)
  }
  return solid
}

function toShape(solid: Manifold): Shape {
  const mesh = solid.getMesh(NORMAL)
  const out = new Shape()
  const v = mesh.vertProperties
  const np = mesh.numProp
  for (let k = 0; k < v.length / np; k++) {
    const o = k * np
    out.p.push(v[o], v[o + 1], v[o + 2])
    out.c.push(v[o + 6], v[o + 7], v[o + 8])
    out.c2.push(v[o + 9], v[o + 10], v[o + 11])
    out.m.push(v[o + 12])
    out.t.push(v[o + 13])
    out.s.push(v[o + 14])
  }
  for (const k of mesh.triVerts) out.i.push(k)
  return out
}

/** Runs an operation on solids made from the shapes (`keep` hands it back any solid it makes on the way, to be
 *  freed with the rest: the engine's memory is its own, not the garbage collector's). */
function withSolids(shapes: Shape[], op: (m: ManifoldToplevel, solids: Manifold[], keep: (s: Manifold) => Manifold) => Manifold): Shape | null {
  const m = engine
  if (!m) {
    if (!failed) throw new Error('[sculpt] the solid engine is not loaded yet: await loadSolids() before building this model')
    return null
  }
  const made: Manifold[] = []
  const keep = (s: Manifold) => {
    made.push(s)
    return s
  }
  try {
    const solids = shapes.map((s) => keep(toManifold(m, s)))
    return toShape(keep(op(m, solids, keep)))
  } finally {
    for (const s of made) s.delete()
  }
}

/** The first shape with the others cut out of it. */
export function subtract(shape: Shape, ...cutters: Shape[]): Shape {
  if (!cutters.length) return shape
  return withSolids([shape, ...cutters], (m, [a, ...rest], keep) => a.subtract(rest.length === 1 ? rest[0] : keep(m.Manifold.union(rest)))) ?? shape
}

/** The shapes joined into one, with nothing left inside. */
export function union(...shapes: Shape[]): Shape {
  return withSolids(shapes, (m, solids) => m.Manifold.union(solids)) ?? new Shape().add(...shapes)
}

/** Only what both shapes hold. */
export function intersect(a: Shape, b: Shape): Shape {
  return withSolids([a, b], (_m, [x, y]) => x.intersect(y)) ?? a
}
