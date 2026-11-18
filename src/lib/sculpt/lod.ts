import { BufferAttribute, BufferGeometry, type InstancedBufferAttribute, type InterleavedBufferAttribute } from 'three'
import { MeshoptSimplifier } from 'meshoptimizer/simplifier'
import { SUN_SHADOW } from '../../data/layout'
import { FINEST_SHADOW_MAP } from '../profile'

// Lighter copies of a part (the budget engine; CLAUDE.md, "Quality first"): the same vertices and every attribute
// shared — colour, tint masks, normals — only fewer triangles, made by meshoptimizer's simplifier (MIT). Each copy
// knows how far any surface of it moved (`error`, in the part's own units): measured against the whole part both ways
// (`within`), as the simplifier's own estimate can run short of it.
//
// For the camera, a copy is drawn only where that is under half a pixel on the screen (`farEnough`): detail the screen
// cannot show is not drawn, and nothing a player can see changes. Up close the part is always drawn whole. A copy is
// one instanced draw shared by every instance of its part that is far enough for it, so whether it is worth a draw is
// judged across the crowd, render by render (`worthDrawing`): a hundred fruits of 150 triangles each are worth a copy,
// a single one is not.
//
// For the sun, a caster may be drawn into its shadow map from a copy that moved no surface by more than half a texel of
// that map (`sunEnough`): its shape only (depth is all the map keeps), and chosen by the sun alone — the map is kept
// between frames while nothing in it moves, so what is drawn into it never changes with the camera.

/** A lighter copy of a part's geometry. */
export interface Lod {
  geometry: BufferGeometry
  /** how far any surface moved, at most, in the part's own units */
  error: number
  triangles: number
}

/** Parts lighter than this get no copies at all: whatever a copy would save on each of them, it would need hundreds of
 *  them far off to be worth its draw. */
export const LOD_SMALLEST = 32
/** A draw is worth about this many triangles (the budget: 250k triangles and 700 draws, tests/e2e/05): a copy is drawn
 *  only where, across the instances it draws, it saves at least this many. */
export const A_DRAW = 400
/** The copies made of each part for the camera, each the most it may move as a share of the part's own size (its
 *  bounding sphere's radius), finest first: from nearly whole, for the middle distance, to a few triangles for far away.
 *  A share and not metres, as parts are built in metres (a fence, a head) or at unit size and drawn smaller (a tomato,
 *  a cob): every part gets the whole range whatever its units. Each copy is made from the whole part, never from the
 *  copy before. */
export const STEPS = [0.002, 0.005, 0.012, 0.03, 0.08, 0.13, 0.2, 0.32, 0.5]
/** A copy must save at least this share of the triangles of the copy before it to be kept (a draw of its own). */
const WORTH = 0.3
/** Under this many pixels on the screen, a surface moved is not seen. */
export const HALF_PIXEL = 0.5
/**
 * How much a change in a normal's or a colour's component weighs against moving a surface, in the simplifier's error:
 * a change of Δ across a stretch d of the surface weighs as much as moving it SHADE·Δ·d (meshoptimizer's attribute
 * metric, measured in lod.test.ts). A copy is drawn only where its error is under half a pixel, so where it is drawn its
 * light and colour move by Δ across n pixels only where SHADE·Δ·n < ½: by at most half across a single pixel, a tenth
 * across five — what the screen cannot show (tests/e2e/27 holds it to the pixel).
 */
export const SHADE = 1

let ready: Promise<void> | null = null
/** The simplifier, loaded once (its WebAssembly is inside the module). */
export const lodReady = () => (ready ??= MeshoptSimplifier.ready)
let loaded = false
void lodReady().then(() => (loaded = true))
/** Whether the simplifier has loaded (copies can be made now). */
export const lodLoaded = () => loaded

/** The copies for the camera ('far') or for the sun's map ('sun'). */
type Kind = 'far' | 'sun'

/** Each geometry's copies, as handed out: its own geometries, drawing its own attributes. */
const cache: Record<Kind, WeakMap<BufferGeometry, Lod[]>> = { far: new WeakMap(), sun: new WeakMap() }

/** What a making found for one copy: the triangles it keeps (one index, shared by the copies of every geometry made from
 *  the same content), how far it moved, and how many triangles. */
interface Found {
  index: BufferAttribute
  error: number
  triangles: number
}

/**
 * What the makings found, by what they read (`contentOf`: the shape, and for the camera's copies its light and colour,
 * hashed): a model built again — each visit to a map builds its crowds anew, the market's goods are built again when
 * their casting is switched — gets its copies at once, the very ones it had, with nothing made again. The models are a
 * fixed set, so this stays small (both maps, the farm at its fullest: about 300,000 indices); it is bounded all the
 * same (`FOUND_MOST` indices, the longest unused let go first).
 */
const found = new Map<string, Found[]>()
const FOUND_MOST = 2_000_000

function remember(key: string, f: Found[]) {
  found.set(key, f)
  for (const c of f) copyTime.indices += c.index.count
  for (const [k, old] of found) {
    if (copyTime.indices <= FOUND_MOST || k === key) break
    found.delete(k)
    for (const c of old) copyTime.indices -= c.index.count
  }
}

function recall(key: string): Found[] | undefined {
  const f = found.get(key)
  if (f) {
    // the last used goes last: the first to be let go is the longest unused
    found.delete(key)
    found.set(key, f)
  }
  return f
}

/** Copies being made, and the time spent making them since the page loaded (ms), of how many geometries, how many
 *  geometries had them at once from what was found before (`reused`), and the indices of all that was found, kept
 *  (`__home.copies` with ?debug). They are made a step at a time in the page's idle time (`later`), never while a map
 *  loads: until its copies are made a part is drawn whole. */
export const copyTime = { ms: 0, geometries: 0, reused: 0, pending: 0, indices: 0 }

/** The lighter copies of a geometry for the camera, finest first (none for a light one), made now: once, then kept.
 *  Call after `lodReady()` has resolved. */
export function lodsOf(g: BufferGeometry): Lod[] {
  return cache.far.get(g) ?? finish(g, 'far')
}

/** The same, made a step at a time in idle time (`later`); `then` gets them once made (at once if they are known). */
export function lodsLater(g: BufferGeometry, then: (lods: Lod[]) => void) {
  const known = cache.far.get(g)
  if (known) then(known)
  else later(g, 'far', then)
}

/** What a making reads of a geometry (`read`), and the key of what it finds (`contentOf`). */
interface Content {
  positions: Float32Array
  indices: Uint32Array
  triangles: number
  /** the shading weighed with the shape (the camera's copies only) */
  attributes: Float32Array | null
  stride: number
  radius: number
  key: string
}

/** Everything a making of `kind` reads of `g`, and its key: none where it makes nothing (no index, too light). */
function read(g: BufferGeometry, kind: Kind): Content | null {
  const src = source(g)
  if (!src || src.triangles < LOD_SMALLEST) return null
  // the shading kept too, not only the shape: a vertex's normal and colours weigh in the error (SHADE), so a bumpy or
  // patterned part (the corn's kernels) is simplified only as far as its light and colour stay as they were (the sun's
  // map keeps depth only: the shape alone)
  const { attributes, stride } = kind === 'far' ? shading(g, src.positions.length / 3) : { attributes: null, stride: 0 }
  if (!g.boundingSphere) g.computeBoundingSphere()
  const radius = g.boundingSphere!.radius
  return { ...src, attributes, stride, radius, key: contentOf(kind, src.positions, src.indices, attributes, stride, radius) }
}

/** The key of what a making finds: its kind and every number it reads — the lengths, the part's size, and two
 *  independent 32-bit hashes (FNV-1a and murmur3) of every word of the positions, the indices and the shading. */
function contentOf(kind: Kind, positions: Float32Array, indices: Uint32Array, attributes: Float32Array | null, stride: number, radius: number): string {
  let a = 0x811c9dc5
  let b = 0x9747b28c
  for (const array of attributes ? [positions, indices, attributes] : [positions, indices]) {
    const words = new Uint32Array(array.buffer, array.byteOffset, array.length)
    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      a = Math.imul(a ^ w, 0x01000193)
      let k = Math.imul(w, 0xcc9e2d51)
      k = Math.imul((k << 15) | (k >>> 17), 0x1b873593)
      b ^= k
      b = (Math.imul((b << 13) | (b >>> 19), 5) + 0xe6546b64) | 0
    }
  }
  b ^= b >>> 16
  b = Math.imul(b, 0x85ebca6b)
  b ^= b >>> 13
  b = Math.imul(b, 0xc2b2ae35)
  b ^= b >>> 16
  return `${kind} ${positions.length} ${indices.length} ${attributes?.length ?? 0} ${stride} ${radius} ${(a >>> 0).toString(36)} ${(b >>> 0).toString(36)}`
}

/** The geometry's positions and indices as the simplifier takes them (none: it cannot be simplified). */
function source(g: BufferGeometry) {
  const pos = g.getAttribute('position')
  const index = g.index
  if (!index || !pos || pos.itemSize !== 3) return null
  let positions: Float32Array
  if (pos.array instanceof Float32Array && !pos.normalized && !('isInterleavedBufferAttribute' in pos)) positions = pos.array
  else {
    // quantized or interleaved (a model file's): read as three reads it
    positions = new Float32Array(pos.count * 3)
    for (let v = 0; v < pos.count; v++) {
      positions[v * 3] = pos.getX(v)
      positions[v * 3 + 1] = pos.getY(v)
      positions[v * 3 + 2] = pos.getZ(v)
    }
  }
  return { positions, indices: Uint32Array.from(index.array as ArrayLike<number>), triangles: index.count / 3 }
}

/** A copy of `g` drawing `kept`: every attribute shared, only the index its own. */
function copyOf(g: BufferGeometry, kept: BufferAttribute): BufferGeometry {
  const lod = new BufferGeometry()
  for (const [name, a] of Object.entries(g.attributes)) lod.setAttribute(name, a)
  lod.setIndex(kept)
  if (!g.boundingSphere) g.computeBoundingSphere()
  if (!g.boundingBox) g.computeBoundingBox()
  lod.boundingSphere = g.boundingSphere
  lod.boundingBox = g.boundingBox
  return lod
}

/** The copies of `g` from what a making found (for it, or for a geometry of the same content). */
const copiesOf = (g: BufferGeometry, f: Found[]): Lod[] => f.map((c) => ({ geometry: copyOf(g, c.index), error: c.error, triangles: c.triangles }))

function* make(c: Content): Generator<void, Found[]> {
  const { positions, indices, triangles, attributes, stride, radius } = c
  const weights = Array.from({ length: stride }, () => SHADE)
  const out: Found[] = []
  let last = triangles
  let floor = 0
  for (const share of STEPS) {
    // the error in the part's own units, and the open edges (a leaf's rim) stay where they are
    const [kept, estimate] = attributes
      ? MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, stride, weights, null, 0, share * radius, ['ErrorAbsolute', 'LockBorder'])
      : MeshoptSimplifier.simplify(indices, positions, 3, 0, share * radius, ['ErrorAbsolute', 'LockBorder'])
    const n = kept.length / 3
    if (n > last * (1 - WORTH) || n === 0) continue
    // the simplifier's estimate can run short of how far the shape really moved (a barn's flat walls: thirty times):
    // measured, the copy's error is the least of a few times the estimate that it keeps to both ways (none: not kept),
    // and never less than a finer copy's (a copy is drawn wherever a coarser one may be)
    const error = MEASURED.map((k) => Math.max(estimate * k, floor)).find((r) => within(positions, indices, kept, r))
    yield
    if (error === undefined) continue
    out.push({ index: new BufferAttribute(kept, 1), error, triangles: n })
    last = n
    floor = error
  }
  return out
}

/** How far past the simplifier's own estimate a far copy may be measured to have moved and still be kept (its error is
 *  then what was measured). */
const MEASURED = [1, 1.5, 2, 3, 4]

/** Everything a part's vertices carry but where they are, side by side for the simplifier (none: positions only): its
 *  normals, and all that makes its colour — the kit's two colours, the mask between them (`pattern`: the kernels on a
 *  cob, the seeds on a berry), the instance colour's mask (`tint`), the surface's amount — each light or colour. */
function shading(g: BufferGeometry, n: number): { attributes: Float32Array | null; stride: number } {
  // (per vertex only: an instance's own attribute, a mesh's second instance colour, is not the part's; a model loaded
  // from a file keeps its normals interleaved with padding, read as three reads them)
  const perVertex = (a: BufferAttribute | InterleavedBufferAttribute) =>
    'isInterleavedBufferAttribute' in a ? !('isInstancedInterleavedBuffer' in a.data) : !(a as InstancedBufferAttribute).isInstancedBufferAttribute
  const parts = Object.entries(g.attributes)
    .filter(([name, a]) => name !== 'position' && perVertex(a) && a.count === n)
    .map(([, a]) => a)
  if (!parts.length) return { attributes: null, stride: 0 }
  const stride = parts.reduce((t, a) => t + Math.min(4, a.itemSize), 0)
  const attributes = new Float32Array(n * stride)
  let o = 0
  for (const a of parts) {
    const size = Math.min(4, a.itemSize)
    for (let v = 0; v < n; v++) for (let c = 0; c < size; c++) attributes[v * stride + o + c] = a.getComponent(v, c)
    o += size
  }
  return { attributes, stride }
}

/** Whether a copy that moved surfaces by `error` (scaled by `scale`) is under half a pixel at `distance`, for a view
 *  of `pixels` pixels a unit at distance one (the drawing buffer's height over 2·tan(fov/2)). */
export const farEnough = (error: number, scale: number, distance: number, pixels: number) => distance > 0 && (error * scale * pixels) / distance < HALF_PIXEL

/** An eye a render is drawn for: where it is, and how many pixels a unit is at distance one. */
export interface FarEye {
  x: number
  y: number
  z: number
  pixels: number
}

/** The eye of the render being drawn now, for the lighter copies of a model loaded from a file (src/lib/sculpt/sun.ts,
 *  `farFromCopies`): the crowds' eye (src/lib/visibility/pass.ts), set as the game's camera begins a render with the
 *  copies on, and none in any other render. */
export const farEye: { view: FarEye | null } = { view: null }

/** The coarsest of a loaded model's copies (finest first) under half a pixel for `eye`, for a mesh whose bounding sphere
 *  (`center`, `radius`: in the world) and largest scale are given: its surface is nowhere nearer the eye than the sphere
 *  is. -1: none (the mesh whole). */
export function farCopy(copies: readonly { error: number }[], scale: number, x: number, y: number, z: number, radius: number, eye: FarEye): number {
  const d = Math.hypot(x - eye.x, y - eye.y, z - eye.z) - radius
  for (let c = copies.length - 1; c >= 0; c--) if (farEnough(copies[c].error, scale, d, eye.pixels)) return c
  return -1
}

/**
 * Which copy the instances of a part are drawn with this render, judged across the crowd. `wanted[l]`: how many in
 * view may be drawn with copy l at the coarsest (0: the part whole; each also looks the same with any finer copy);
 * `triangles[l]`: what one instance draws with copy l. A copy is a draw of its own shared by all its instances, so it
 * is drawn only where it saves at least A_DRAW triangles over drawing them with the next finer copy — or where
 * nothing finer is wanted at all, so that it is the part's only draw. Those it does not take go to the next finer one.
 * `use[l]` is set to the copy the instances wanting l are drawn with (≤ l: never coarser than what they may be).
 */
export function worthDrawing(wanted: ArrayLike<number>, triangles: ArrayLike<number>, levels: number, use: Uint8Array) {
  // the instances wanting a finer copy than the one looked at
  let finer = 0
  for (let l = 0; l < levels; l++) finer += wanted[l]
  // the instances carried down from coarser copies not drawn, and the coarsest copy whose instances are carried
  let carried = 0
  let top = levels
  for (let l = levels; l >= 1; l--) {
    const count = wanted[l] + carried
    if (count > 0 && (finer === 0 || count * (triangles[l - 1] - triangles[l]) >= A_DRAW)) {
      for (let m = l; m <= top; m++) use[m] = l
      carried = 0
      top = l - 1
    } else carried = count
    finer -= wanted[l - 1]
  }
  for (let m = 0; m <= top; m++) use[m] = 0
}

// ───────────────────────────── the sun's copies ─────────────────────────────

/** A texel of the sun's shadow map, in metres, where it is finest: the sun's shadow camera sees ±SUN_SHADOW.half
 *  (src/scene/Lighting.tsx), drawn with the most texels any device and tier give it (src/lib/profile.ts). */
export const SUN_TEXEL = (2 * SUN_SHADOW.half) / FINEST_SHADOW_MAP
/** The copies made of each caster for the sun, each the most it may move in its own units: half a texel for a part
 *  drawn at its own size, a half and a quarter of that for parts drawn twice and four times as big. */
const SUN_STEPS = [1, 0.5, 0.25].map((k) => (SUN_TEXEL / 2) * k).reverse()

/**
 * The lighter copies of a geometry for the sun's map, finest first: its shape only — where two vertices share a place
 * (a seam in the colours or the normals) they are one for it, as depth is all the map keeps — and its open edges where
 * they are. The simplifier's own estimate of how far a shape moved runs short when only the shape counts (measured: a
 * lamp's iron moved twice what it said), so each copy is measured against the whole part both ways (`within`) and kept
 * only if it holds: its `error` is what was measured, not estimated. Made once, then kept; call after `lodReady()`.
 */
export function sunLodsOf(g: BufferGeometry): Lod[] {
  return cache.sun.get(g) ?? finish(g, 'sun')
}

/** The same, made a step at a time in idle time (`later`); `then` gets them once made (at once if they are known). */
export function sunLodsLater(g: BufferGeometry, then: (lods: Lod[]) => void) {
  const known = cache.sun.get(g)
  if (known) then(known)
  else later(g, 'sun', then)
}

function* makeSun(c: Content): Generator<void, Found[]> {
  const out: Found[] = []
  const { positions, triangles } = c
  const remap = MeshoptSimplifier.generatePositionRemap(positions, 3)
  const indices = c.indices.map((v) => remap[v])
  let last = triangles
  for (const step of SUN_STEPS) {
    // the coarsest the simplifier makes that holds to the step, measured: asked for the step, then for less
    let found: Uint32Array | null = null
    for (const ask of [1, 0.5, 0.25]) {
      const [kept] = MeshoptSimplifier.simplify(indices, positions, 3, 0, step * ask, ['ErrorAbsolute', 'LockBorder'])
      if (kept.length / 3 > last * (1 - WORTH)) break
      const holds = within(positions, c.indices, kept, step)
      yield
      if (holds) {
        found = kept
        break
      }
    }
    if (!found || found.length === 0) continue
    out.push({ index: new BufferAttribute(found, 1), error: step, triangles: found.length / 3 })
    last = found.length / 3
  }
  return out
}

// ───────────────────────────── made in idle time ─────────────────────────────

/** A geometry whose copies of one kind are asked for: its content read and its making started once it comes to the
 *  front of the queue (null until then: nothing is read while a map loads). */
interface Job {
  g: BufferGeometry
  kind: Kind
  done: ((lods: Lod[]) => void)[]
  key: string
  making: Generator<void, Found[]> | null
}
/** The geometries whose copies are being made, a step at a time, in turn. */
const queue: Job[] = []
/** The most a slice of idle time is used for (ms) when the page gives no deadline of its own. */
const SLICE = 6
let pumping = false
/** Held while a map loads (src/scene/ViewPass.tsx): the copies are made once it can be played, never on its way. */
let held = false
const waiting: (() => void)[] = []

/** Holds the making of copies (while a map loads), or lets it go on. */
export function holdCopies(on: boolean) {
  held = on
  if (!on) pump()
}

/** The first step of a making: reads the geometry. Nothing to make (too light, no index): no copies. Its content seen
 *  before: what was found then (`reused`). Else the making, from what it read. */
function start(g: BufferGeometry, kind: Kind): { found: Found[]; reused: boolean } | { key: string; making: Generator<void, Found[]> } {
  const c = read(g, kind)
  if (!c) return { found: [], reused: false }
  const known = recall(c.key)
  if (known) return { found: known, reused: true }
  return { key: c.key, making: kind === 'far' ? make(c) : makeSun(c) }
}

/** Hands a geometry its copies, from what was found (`reused`: found for another geometry of the same content). */
function settle(g: BufferGeometry, kind: Kind, f: Found[], reused: boolean): Lod[] {
  const lods = copiesOf(g, f)
  cache[kind].set(g, lods)
  if (reused) copyTime.reused++
  else copyTime.geometries++
  return lods
}

/** Makes a geometry's copies now, to the end (or has them from what was found before). */
function finish(g: BufferGeometry, kind: Kind): Lod[] {
  const t0 = performance.now()
  const s = start(g, kind)
  if ('found' in s) {
    copyTime.ms += performance.now() - t0
    return settle(g, kind, s.found, s.reused)
  }
  let step = s.making.next()
  while (!step.done) step = s.making.next()
  remember(s.key, step.value)
  copyTime.ms += performance.now() - t0
  return settle(g, kind, step.value, false)
}

/** Queues a making for idle time (one geometry's twice asked for is made once). */
function later(g: BufferGeometry, kind: Kind, then: (lods: Lod[]) => void) {
  const same = queue.find((q) => q.g === g && q.kind === kind)
  if (same) {
    same.done.push(then)
    return
  }
  queue.push({ g, kind, done: [then], key: '', making: null })
  copyTime.pending = queue.length
  pump()
}

/** The job at the front of the queue is done: its geometry gets its copies, and those who asked. */
function complete(job: Job, f: Found[], reused: boolean) {
  queue.shift()
  const lods = settle(job.g, job.kind, f, reused)
  for (const then of job.done) then(lods)
}

/** One step of the making at the front of the queue. */
function step() {
  const job = queue[0]
  if (!job.making) {
    // its first step: what it reads, and what was found for that before (a model built again: its copies at once)
    const s = start(job.g, job.kind)
    if ('found' in s) complete(job, s.found, s.reused)
    else {
      job.key = s.key
      job.making = s.making
    }
    return
  }
  const next = job.making.next()
  if (next.done) {
    remember(job.key, next.value)
    complete(job, next.value, false)
  }
}

/** Steps until the queue is empty, or until `until` (performance.now()). */
function work(until: number) {
  const t0 = performance.now()
  while (queue.length) {
    step()
    if (performance.now() >= until) break
  }
  copyTime.ms += performance.now() - t0
  copyTime.pending = queue.length
  if (!queue.length) waiting.splice(0).forEach((resolve) => resolve())
}

function pump() {
  if (pumping || held || !queue.length) return
  pumping = true
  const run = (deadline?: IdleDeadline) => {
    pumping = false
    if (held) return
    work(performance.now() + (deadline && !deadline.didTimeout ? Math.max(1, deadline.timeRemaining()) : SLICE))
    pump()
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 100 })
  else setTimeout(run, 0)
}

/** Resolves once every copy asked for is made (for tests). */
export const copiesMade = () => (queue.length ? new Promise<void>((resolve) => waiting.push(resolve)) : Promise.resolve())

/** Makes every copy asked for now, unless a map is loading (for tests, `__home.copiesNow` with ?debug: the same copies the
 *  idle time would make, without waiting for it — a page drawn in software at a few frames a second has little). */
export function makeCopiesNow() {
  if (!held) work(Infinity)
}

/** Whether a copy keeps to `r` of its whole both ways: every vertex of the whole within `r` of the copy's surface, and
 *  every triangle of the copy (its middle and the middles of its edges) within `r` of the whole's — nothing moved
 *  further, nothing bridged that was not there. */
export function within(positions: ArrayLike<number>, whole: ArrayLike<number>, copy: ArrayLike<number>, r: number): boolean {
  const used = new Set<number>()
  for (let i = 0; i < whole.length; i++) used.add(whole[i])
  const fromWhole = new Float64Array(used.size * 3)
  let k = 0
  for (const v of used) {
    fromWhole[k++] = positions[v * 3]
    fromWhole[k++] = positions[v * 3 + 1]
    fromWhole[k++] = positions[v * 3 + 2]
  }
  const fromCopy = new Float64Array((copy.length / 3) * 12)
  k = 0
  for (let t = 0; t < copy.length; t += 3) {
    const a = copy[t] * 3
    const b = copy[t + 1] * 3
    const c = copy[t + 2] * 3
    for (let i = 0; i < 3; i++) {
      fromCopy[k + i] = (positions[a + i] + positions[b + i] + positions[c + i]) / 3
      fromCopy[k + 3 + i] = (positions[a + i] + positions[b + i]) / 2
      fromCopy[k + 6 + i] = (positions[b + i] + positions[c + i]) / 2
      fromCopy[k + 9 + i] = (positions[c + i] + positions[a + i]) / 2
    }
    k += 12
  }
  return allNear(positions, fromWhole, copy, r) && allNear(positions, fromCopy, whole, r)
}

/** Whether every point is within `r` of one of the triangles (an index list over `positions`): the triangles in a grid
 *  of cells, each point tested against those of its own cell. */
function allNear(positions: ArrayLike<number>, points: Float64Array, tris: ArrayLike<number>, r: number): boolean {
  if (points.length === 0) return true
  let x0 = Infinity
  let y0 = Infinity
  let z0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  let z1 = -Infinity
  for (let i = 0; i < points.length; i += 3) {
    x0 = Math.min(x0, points[i])
    y0 = Math.min(y0, points[i + 1])
    z0 = Math.min(z0, points[i + 2])
    x1 = Math.max(x1, points[i])
    y1 = Math.max(y1, points[i + 1])
    z1 = Math.max(z1, points[i + 2])
  }
  const size = Math.max(2 * r, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 48)
  const nx = Math.floor((x1 - x0) / size) + 1
  const ny = Math.floor((y1 - y0) / size) + 1
  const nz = Math.floor((z1 - z0) / size) + 1
  const cells = new Map<number, number[]>()
  const cell = (v: number, lo: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor((v - lo) / size)))
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3
    const b = tris[t + 1] * 3
    const c = tris[t + 2] * 3
    const lo = [0, 1, 2].map((i) => Math.min(positions[a + i], positions[b + i], positions[c + i]) - r)
    const hi = [0, 1, 2].map((i) => Math.max(positions[a + i], positions[b + i], positions[c + i]) + r)
    if (hi[0] < x0 || lo[0] > x1 || hi[1] < y0 || lo[1] > y1 || hi[2] < z0 || lo[2] > z1) continue
    for (let ix = cell(lo[0], x0, nx); ix <= cell(hi[0], x0, nx); ix++)
      for (let iy = cell(lo[1], y0, ny); iy <= cell(hi[1], y0, ny); iy++)
        for (let iz = cell(lo[2], z0, nz); iz <= cell(hi[2], z0, nz); iz++) {
          const key = (ix * ny + iy) * nz + iz
          const list = cells.get(key)
          if (list) list.push(t)
          else cells.set(key, [t])
        }
  }
  const r2 = r * r
  for (let i = 0; i < points.length; i += 3) {
    const px = points[i]
    const py = points[i + 1]
    const pz = points[i + 2]
    const list = cells.get((cell(px, x0, nx) * ny + cell(py, y0, ny)) * nz + cell(pz, z0, nz))
    let near = false
    for (let j = 0; list && j < list.length && !near; j++) {
      const t = list[j]
      near = squaredDistance(px, py, pz, positions, tris[t] * 3, tris[t + 1] * 3, tris[t + 2] * 3) <= r2
    }
    if (!near) return false
  }
  return true
}

/** The squared distance from a point to a triangle (Ericson's closest point on a triangle). */
function squaredDistance(px: number, py: number, pz: number, P: ArrayLike<number>, a: number, b: number, c: number): number {
  const ax = P[a]
  const ay = P[a + 1]
  const az = P[a + 2]
  const abx = P[b] - ax
  const aby = P[b + 1] - ay
  const abz = P[b + 2] - az
  const acx = P[c] - ax
  const acy = P[c + 1] - ay
  const acz = P[c + 2] - az
  const apx = px - ax
  const apy = py - ay
  const apz = pz - az
  const d1 = abx * apx + aby * apy + abz * apz
  const d2 = acx * apx + acy * apy + acz * apz
  let v = 0
  let w = 0
  if (d1 <= 0 && d2 <= 0) {
    // a
  } else {
    const bpx = px - P[b]
    const bpy = py - P[b + 1]
    const bpz = pz - P[b + 2]
    const d3 = abx * bpx + aby * bpy + abz * bpz
    const d4 = acx * bpx + acy * bpy + acz * bpz
    const cpx = px - P[c]
    const cpy = py - P[c + 1]
    const cpz = pz - P[c + 2]
    const d5 = abx * cpx + aby * cpy + abz * cpz
    const d6 = acx * cpx + acy * cpy + acz * cpz
    const vc = d1 * d4 - d3 * d2
    const vb = d5 * d2 - d1 * d6
    const va = d3 * d6 - d5 * d4
    if (d3 >= 0 && d4 <= d3) v = 1
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) v = d1 / (d1 - d3)
    else if (d6 >= 0 && d5 <= d6) w = 1
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) w = d2 / (d2 - d6)
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      w = (d4 - d3) / (d4 - d3 + (d5 - d6))
      v = 1 - w
    } else {
      const s = 1 / (va + vb + vc)
      v = vb * s
      w = vc * s
    }
  }
  const qx = ax + abx * v + acx * w - px
  const qy = ay + aby * v + acy * w - py
  const qz = az + abz * v + acz * w - pz
  return qx * qx + qy * qy + qz * qz
}

/** Whether a copy that moved surfaces by `error` (scaled by `scale`) stays inside half a texel of the sun's map: its
 *  shadow is the same, to the texel (and well inside what the shadow's bias takes up: Lighting.tsx). */
export const sunEnough = (error: number, scale: number) => error * scale <= SUN_TEXEL / 2
