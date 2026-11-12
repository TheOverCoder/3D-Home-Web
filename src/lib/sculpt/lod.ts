import { BufferAttribute, BufferGeometry } from 'three'
import { MeshoptSimplifier } from 'meshoptimizer/simplifier'

// Lighter copies of a part for when it is far (the budget engine; CLAUDE.md, "Quality first"): the same vertices and
// every attribute shared — colour, tint masks, normals — only fewer triangles, made by meshoptimizer's simplifier
// (MIT). Each copy knows how far any surface of it moved (`error`, in the part's own units), and a copy is drawn only
// where that is under half a pixel on the screen (`farEnough`): detail the screen cannot show is not drawn, and
// nothing a player can see changes. Up close the part is always drawn whole.

/** A lighter copy of a part's geometry. */
export interface Lod {
  geometry: BufferGeometry
  /** how far any surface moved, at most, in the part's own units */
  error: number
  triangles: number
}

/** Parts lighter than this are drawn as they are: a draw of their own would cost more than they could save. */
export const LOD_SMALLEST = 400
/** The copies made of each part, each the most it may move (in metres: the parts are built in metres, about their
 *  joint): a fine one for the middle distance, a coarse one for far away. A copy that saves too little is not kept. */
const STEPS = [
  { error: 0.0015, keep: 0.5 },
  { error: 0.008, keep: 0.15 },
]
/** A copy must save at least this share of the triangles to be worth a draw of its own. */
const WORTH = 0.3
/** Under this many pixels on the screen, a surface moved is not seen. */
export const HALF_PIXEL = 0.5

let ready: Promise<void> | null = null
/** The simplifier, loaded once (its WebAssembly is inside the module). */
export const lodReady = () => (ready ??= MeshoptSimplifier.ready)

const cache = new WeakMap<BufferGeometry, Lod[]>()

/** The lighter copies of a geometry, finest first (none for a light one): made once, then kept. Call after
 *  `lodReady()` has resolved. */
export function lodsOf(g: BufferGeometry): Lod[] {
  const known = cache.get(g)
  if (known) return known
  const out = make(g)
  cache.set(g, out)
  return out
}

function make(g: BufferGeometry): Lod[] {
  const pos = g.getAttribute('position')
  const index = g.index
  if (!index || !pos || pos.itemSize !== 3 || 'isInterleavedBufferAttribute' in pos) return []
  const triangles = index.count / 3
  if (triangles < LOD_SMALLEST) return []
  const positions = pos.array instanceof Float32Array ? pos.array : Float32Array.from(pos.array as ArrayLike<number>)
  const indices = Uint32Array.from(index.array as ArrayLike<number>)
  // the shading kept too, not only the shape: a vertex's normal and colour weigh in the error (a normal turned by 0.1,
  // about 6°, or a colour off by a tenth, counts as SHADE metres moved), so a bumpy part (the corn's kernels) is
  // simplified only as far as its light and colour stay as they were
  const { attributes, stride, weights } = shading(g, pos.count)
  const out: Lod[] = []
  let last = triangles
  for (const step of STEPS) {
    const target = Math.max(3, Math.floor((indices.length * step.keep) / 3) * 3)
    // the error is in the part's own units (metres), and the open edges (a leaf's rim) stay where they are
    const [kept, error] = attributes
      ? MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, stride, weights, null, target, step.error, ['ErrorAbsolute', 'LockBorder'])
      : MeshoptSimplifier.simplify(indices, positions, 3, target, step.error, ['ErrorAbsolute', 'LockBorder'])
    const n = kept.length / 3
    if (n > last * (1 - WORTH) || n === 0) continue
    const lod = new BufferGeometry()
    for (const [name, a] of Object.entries(g.attributes)) lod.setAttribute(name, a)
    lod.setIndex(new BufferAttribute(kept, 1))
    lod.boundingSphere = g.boundingSphere
    lod.boundingBox = g.boundingBox
    out.push({ geometry: lod, error, triangles: n })
    last = n
  }
  return out
}

/** How much a change of a tenth in a normal's or a colour's component weighs, in metres of the error. */
const SHADE = 0.01

/** A part's normals and colours side by side for the simplifier, and how much each weighs (none: positions only). */
function shading(g: BufferGeometry, n: number): { attributes: Float32Array | null; stride: number; weights: number[] } {
  const parts = ['normal', 'color'].map((name) => g.getAttribute(name)).filter((a): a is BufferAttribute => !!a && !('isInterleavedBufferAttribute' in a))
  if (!parts.length) return { attributes: null, stride: 0, weights: [] }
  const stride = parts.reduce((t, a) => t + Math.min(3, a.itemSize), 0)
  const attributes = new Float32Array(n * stride)
  let o = 0
  for (const a of parts) {
    const size = Math.min(3, a.itemSize)
    for (let v = 0; v < n; v++) for (let c = 0; c < size; c++) attributes[v * stride + o + c] = a.array[v * a.itemSize + c]
    o += size
  }
  return { attributes, stride, weights: Array.from({ length: stride }, () => SHADE / 0.1) }
}

/** Whether a copy that moved surfaces by `error` (scaled by `scale`) is under half a pixel at `distance`, for a view
 *  of `pixels` pixels a unit at distance one (the drawing buffer's height over 2·tan(fov/2)). */
export const farEnough = (error: number, scale: number, distance: number, pixels: number) => distance > 0 && (error * scale * pixels) / distance < HALF_PIXEL
