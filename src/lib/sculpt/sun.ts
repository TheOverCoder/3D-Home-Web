import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  FrontSide,
  LightShadow,
  Matrix4,
  Mesh,
  Vector3,
  type BatchedMesh,
  type Frustum,
  type InstancedMesh,
  type Material,
  type Object3D,
  type Side,
  type SkinnedMesh,
} from 'three'
import { farCopy, farEye, lodLoaded, lodReady, lodsLater, sunEnough, sunLodsLater } from './lod'

// Casters drawn into the sun's shadow map from lighter copies (lod.ts: `sunLodsOf`, `sunEnough`): a mesh of their own,
// drawn only into shadow maps and never by a camera, holds the copy, while the mesh seen keeps every triangle and no
// longer casts. A light's shadow pass tests each caster against that light's own frustum (`shadow.getFrustum()`), so
// such a mesh tells it from a camera's and says no to every camera — in any scene, with the drawing pass or without.
// The copy is chosen by the sun's map alone, once, so the map kept between frames (Lighting.tsx) stays a full redraw's.

/** Every shadow map's frustum (each light's own), as three asks for it before drawing the map. */
const shadowFrustums = new WeakSet<Frustum>()
const shadowProto = LightShadow.prototype as unknown as { getFrustum: (this: LightShadow, ...args: unknown[]) => Frustum }
const getFrustum = shadowProto.getFrustum
shadowProto.getFrustum = function (this: LightShadow, ...args: unknown[]) {
  const f = getFrustum.apply(this, args)
  shadowFrustums.add(f)
  return f
}

/** The switch for every caster's copy at once: off, each is drawn into the map whole again (`__home.view.sunLod`, for
 *  tests/e2e/27: the frame with the copies and without). */
export const sunCopies = { on: true }

/** Makes `m` a mesh drawn only into shadow maps (every camera's frustum test says no; a ray meets nothing). With `whole`
 *  and `copy`, it is drawn from the copy, or whole while the copies are switched off. */
export function shadowOnly<T extends Mesh>(m: T, whole?: BufferGeometry, copy?: BufferGeometry): T {
  // (one that `castAsOne` took casts through its one mesh, whenever it is made again)
  m.castShadow = !m.userData.castInto
  m.receiveShadow = false
  m.frustumCulled = true
  m.raycast = () => {}
  m.userData.shadowOnly = true
  if (whole) m.userData.sunWhole = whole
  m.intersectsFrustum = function (this: T, f: Frustum) {
    if (!shadowFrustums.has(f)) return false
    if (whole && copy) this.geometry = sunCopies.on ? copy : whole
    // three's own test (and the drawing pass's, which hooks it: src/lib/visibility)
    return Mesh.prototype.intersectsFrustum.call(this, f)
  }
  return m
}

// ───────────────────────────── far copies of a loaded model ─────────────────────────────

/** Whether a mesh can be drawn from a far copy: one material and no groups (a copy's triangles are not in a group's
 *  ranges), nothing skinned, morphed or instanced. */
function copyable(m: Mesh): boolean {
  const g = m.geometry
  return !(m as InstancedMesh).isInstancedMesh && !(m as SkinnedMesh).isSkinnedMesh && !Array.isArray(m.material) && g.groups.length === 0 && !g.morphAttributes.position && !!g.index
}

const centre = new Vector3()

/**
 * Draws the meshes under `root` (a model loaded from a file: a piece of furniture) for the game's camera from their
 * lighter copies where they are far enough (lod.ts: the crowds' rule, `farEnough`, for the same eye: `farEye`): render
 * by render, the coarsest copy whose difference is under half a pixel; up close the mesh whole. A copy is the mesh's one
 * draw with fewer triangles, so any far enough is worth drawing. Every other render, the sun's map and a ray get the
 * mesh whole; a mesh that casts itself is drawn whole (the sun's map is chosen by the sun alone: `castAsOne`). Its
 * copies are made in idle time once the simplifier has loaded (until then: whole), once a geometry, shared by every
 * piece of its kind.
 */
export function farFromCopies(root: Object3D) {
  if (!lodLoaded()) {
    void lodReady().then(() => farFromCopies(root))
    return
  }
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || m.userData.shadowOnly || m.userData.farCopies || !copyable(m)) return
    m.userData.farCopies = true
    const whole = m.geometry
    // what it casts is its whole shape, whatever a camera last drew it from (castAsOne, taking it in later)
    m.userData.sunWhole = whole
    lodsLater(whole, (copies) => {
      if (!copies.length || m.geometry !== whole) return
      if (!whole.boundingSphere) whole.computeBoundingSphere()
      const sphere = whole.boundingSphere!
      m.intersectsFrustum = function (this: Mesh, f: Frustum) {
        const eye = shadowFrustums.has(f) || this.castShadow ? null : farEye.view
        let c = -1
        if (eye) {
          const e = this.matrixWorld.elements
          const scale = Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10]))
          centre.copy(sphere.center).applyMatrix4(this.matrixWorld)
          c = farCopy(copies, scale, centre.x, centre.y, centre.z, sphere.radius * scale, eye)
        }
        this.geometry = c < 0 ? whole : copies[c].geometry
        return Mesh.prototype.intersectsFrustum.call(this, f)
      }
      // a ray meets the mesh whole
      m.raycast = function (this: Mesh, ...args: Parameters<Mesh['raycast']>) {
        const drawn = this.geometry
        this.geometry = whole
        try {
          Mesh.prototype.raycast.apply(this, args)
        } finally {
          this.geometry = drawn
        }
      }
    })
  })
}

// ───────────────────────────── one sun mesh for many ─────────────────────────────

/** The side of a material's triangles a shadow map draws: three's own rule (the side turned away from the light for a
 *  one-sided material, both for a two-sided one), unless the material names its own. */
const SHADOW_SIDE: Record<Side, Side> = { [FrontSide]: BackSide, [BackSide]: FrontSide, [DoubleSide]: DoubleSide }
export const shadowSideOf = (m: Material): Side => m.shadowSide ?? SHADOW_SIDE[m.side]

/** Whether a material draws into a shadow map by its shape and its side alone (three's depth material takes nothing
 *  else from it that could differ): nothing cut out, moved in the shader or clipped, and as plain as a sun copy's. Two
 *  such materials drawing the same side draw the same texels for the same triangles. */
export function byShape(mat: Material): boolean {
  const m = mat as Material & { alphaMap?: unknown; displacementMap?: unknown; wireframe?: boolean }
  return mat.visible && !m.wireframe && !m.alphaMap && !m.displacementMap && !(mat.alphaTest > 0) && !mat.alphaToCoverage && !mat.transparent && !mat.clippingPlanes?.length
}

/** Whether a mesh is drawn into a shadow map by its shape and its materials' sides alone, whole: what castAsOne can take
 *  in. (A skinned body, a shape morphed or cut out, a depth material of its own, part of its shape drawn: no.) */
function takeable(m: Mesh): boolean {
  const g = m.geometry
  if ((m as SkinnedMesh).isSkinnedMesh || (m as unknown as BatchedMesh).isBatchedMesh || g.morphAttributes.position || m.customDepthMaterial) return false
  if (!(m.layers.mask & 1) || g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return false
  return (Array.isArray(m.material) ? m.material : [m.material]).every(byShape)
}

/** A crowd's sun meshes of one part (src/lib/sculpt/parts.ts): side by side under its group, drawn only into shadow
 *  maps, sharing one shape's vertices (a lighter copy keeps its part's: lod.ts) — the part whole and its copies. */
function kindOf(m: Mesh): Mesh[] {
  const pos = m.geometry.attributes.position
  return (m.parent?.children ?? []).filter((o) => (o as Mesh).isMesh && o.userData.shadowOnly && (o as Mesh).geometry.attributes.position === pos) as Mesh[]
}

/** The shape a caster casts whole: its own, or for a mesh drawn only into shadow maps from a lighter copy, the whole one
 *  it was copied from (`shadowOnly`'s `whole`; a crowd's own sun meshes: the one of its kind with every triangle). */
function wholeShape(m: Mesh): BufferGeometry {
  const whole = m.userData.sunWhole as BufferGeometry | undefined
  if (whole) return whole
  if (!m.userData.shadowOnly) return m.geometry
  let best = m.geometry
  for (const k of kindOf(m)) if ((k.geometry.index?.count ?? 0) > (best.index?.count ?? 0)) best = k.geometry
  return best
}

/** A run of a caster's triangles (in its index, or its vertices' order when it has none) and the material it is drawn
 *  with. */
interface Run {
  start: number
  count: number
  material: Material
}
/** A caster as castAsOne takes it in: the shape it casts whole, its runs, where each of its instances stands in the
 *  root's frame, and whether that turns it inside out (a mirror: three winds its triangles back for it). */
interface Taken {
  shape: BufferGeometry
  runs: Run[]
  places: Matrix4[]
  mirrored: boolean
}

/** What castAsOne makes: the one mesh, and `release()`, which takes it away and lets what it took in cast again. */
export type CastAsOne = Mesh & { release(): void }

const at = new Vector3()

/**
 * Every caster under `root` drawn into the sun's map by one mesh of its own, drawn only into shadow maps — one draw for
 * a building's walls and roof, a cabin and a sign together, where each would be a draw — and each of them no longer
 * casting. Taken in is what casts there now, as it stands: a mesh; an instanced one at each of its instances; a mesh drawn
 * into the map from a lighter copy (its whole shape); a crowd's sun meshes (src/lib/sculpt/parts.ts: every model put,
 * whole; a copy for the sun the crowd makes later casts nothing either). Not taken in, and casting on its own as before:
 * what is hidden now, and what is not drawn into a shadow map by its shape and side alone (`takeable`).
 *
 * The map holds the same shadow: each triangle is drawn as three draws it, from the side it does, where it stood (to a
 * float's precision, far inside the shadow's bias). The one mesh draws the side most of its triangles are drawn from: a
 * two-sided caster's triangles are in it both ways round, one drawn from the other side wound the other way. Then, in idle time, it is drawn from its coarsest copy for the sun that keeps
 * its shadow to half a texel at the root's size (lod.ts: `sunLodsOf`, `sunEnough`). For what stands still: call it once
 * what is under `root` is built and in its place (after a crowd's first `end`), and `release()` it before that changes
 * or goes. Nothing casting under `root`: a mesh that casts nothing, not added.
 */
export function castAsOne(root: Object3D): CastAsOne {
  root.updateWorldMatrix(true, true)
  const toRoot = new Matrix4().copy(root.matrixWorld).invert()
  const taken: Taken[] = []
  const casters = new Set<Mesh>()
  root.traverseVisible((o) => {
    const m = o as Mesh
    const im = m as InstancedMesh
    if (!m.isMesh || !m.castShadow || m.userData.sunOne || !takeable(m) || (im.isInstancedMesh && im.count === 0)) return
    const shape = wholeShape(m)
    const all = shape.index ? shape.index.count : shape.attributes.position.count
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    const runs = (
      Array.isArray(m.material)
        ? shape.groups.map((gr) => ({ start: gr.start, count: Math.min(gr.count, all - gr.start), material: mats[gr.materialIndex ?? 0] }))
        : [{ start: 0, count: all, material: m.material }]
    )
      .map((r) => ({ ...r, count: r.count - (r.count % 3) }))
      .filter((r) => r.material && r.count > 0)
    const base = new Matrix4().multiplyMatrices(toRoot, m.matrixWorld)
    const places = im.isInstancedMesh ? Array.from({ length: im.count }, (_, i) => im.getMatrixAt(i, new Matrix4()).premultiply(base)) : [base]
    taken.push({ shape, runs, places, mirrored: base.determinant() < 0 })
    casters.add(m)
    // a crowd's sun meshes: the part's others too (whole or copies, they hold its models between them)
    if (m.userData.shadowOnly && im.isInstancedMesh) for (const k of kindOf(m)) casters.add(k)
  })

  // the side the one mesh is drawn from: the one-sided side with the most triangles, else both
  const tally: Record<Side, number> = { [FrontSide]: 0, [BackSide]: 0, [DoubleSide]: 0 }
  for (const t of taken) for (const r of t.runs) tally[shadowSideOf(r.material)] += (r.count / 3) * t.places.length
  const side: Side = tally[FrontSide] + tally[BackSide] === 0 ? DoubleSide : tally[FrontSide] > tally[BackSide] ? FrontSide : BackSide
  const material = taken.flatMap((t) => t.runs).find((r) => shadowSideOf(r.material) === side)?.material
  const twice = (r: Run) => side !== DoubleSide && shadowSideOf(r.material) === DoubleSide

  // the shape: every caster's vertices in the root's frame, instance by instance, its triangles wound for that side
  let vertices = 0
  let triangles = 0
  for (const t of taken) {
    vertices += t.shape.attributes.position.count * t.places.length
    for (const r of t.runs) triangles += (r.count / 3) * t.places.length * (twice(r) ? 2 : 1)
  }
  const positions = new Float32Array(vertices * 3)
  const indices = vertices > 65535 ? new Uint32Array(triangles * 3) : new Uint16Array(triangles * 3)
  let pv = 0
  let pi = 0
  for (const t of taken) {
    const pos = t.shape.attributes.position
    const index = t.shape.index
    for (const place of t.places) {
      const first = pv
      for (let i = 0; i < pos.count; i++, pv++) {
        at.fromBufferAttribute(pos, i).applyMatrix4(place)
        positions[pv * 3] = at.x
        positions[pv * 3 + 1] = at.y
        positions[pv * 3 + 2] = at.z
      }
      for (const r of t.runs) {
        const own = shadowSideOf(r.material)
        const both = twice(r)
        // wound the other way round: drawn from the other side than the one mesh is, or turned inside out by its place
        const turn = (side !== DoubleSide && own !== DoubleSide && own !== side) !== t.mirrored
        for (let k = r.start; k < r.start + r.count; k += 3) {
          const a = first + (index ? index.getX(k) : k)
          const b = first + (index ? index.getX(k + 1) : k + 1)
          const c = first + (index ? index.getX(k + 2) : k + 2)
          if (both || !turn) {
            indices[pi++] = a
            indices[pi++] = b
            indices[pi++] = c
          }
          if (both || turn) {
            indices[pi++] = a
            indices[pi++] = c
            indices[pi++] = b
          }
        }
      }
    }
  }
  const whole = new BufferGeometry()
  whole.setAttribute('position', new BufferAttribute(positions, 3))
  whole.setIndex(new BufferAttribute(indices, 1))
  whole.computeBoundingBox()
  whole.computeBoundingSphere()

  const one = shadowOnly(new Mesh(whole, material)) as CastAsOne
  one.name = `${root.name || 'cast'}-sun-one`
  one.userData.sunOne = true
  const casts = !!material && triangles > 0
  one.castShadow = casts

  // what it took in casts no more, and a crowd's copy for the sun made later neither
  const was = new Map<Mesh, boolean>()
  const take = (m: Mesh) => {
    if (!was.has(m)) was.set(m, m.castShadow)
    m.castShadow = false
    m.userData.castInto = one
  }
  for (const m of casters) take(m)
  const guards = new Map<Object3D, (e: { child: Object3D }) => void>()
  for (const m of casters) {
    const parent = m.parent
    if (!m.userData.shadowOnly || !parent || guards.has(parent)) continue
    const kinds = new Set([...casters].filter((c) => c.parent === parent && c.userData.shadowOnly).map((c) => c.geometry.attributes.position))
    const added = ({ child }: { child: Object3D }) => {
      const c = child as Mesh
      if (c.isMesh && c.userData.shadowOnly && kinds.has(c.geometry.attributes.position)) take(c)
    }
    parent.addEventListener('childadded', added)
    guards.set(parent, added)
  }
  if (casts) root.add(one)

  // its copy for the sun, made in idle time once the simplifier has loaded: the coarsest that keeps its shadow to half
  // a texel at the root's size
  let gone = false
  let copy: BufferGeometry | null = null
  const scale = root.matrixWorld.getMaxScaleOnAxis()
  if (casts)
    void lodReady().then(() =>
      sunLodsLater(whole, (copies) => {
        let best = null
        for (const c of copies) if (sunEnough(c.error, scale)) best = c
        if (gone || !best) return
        copy = best.geometry
        one.geometry = copy
        shadowOnly(one, whole, copy)
      }),
    )

  one.release = () => {
    if (gone) return
    gone = true
    one.removeFromParent()
    for (const [parent, added] of guards) parent.removeEventListener('childadded', added)
    for (const [m, cast] of was) {
      delete m.userData.castInto
      m.castShadow = cast
    }
    one.geometry = whole
    whole.dispose()
    copy?.dispose()
  }
  return one
}
