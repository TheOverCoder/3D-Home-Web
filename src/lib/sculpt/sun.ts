import { LightShadow, Mesh, type BufferGeometry, type Frustum, type InstancedMesh, type Material, type Object3D, type SkinnedMesh } from 'three'
import { lodLoaded, lodReady, sunEnough, sunLodsOf } from './lod'

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
  m.castShadow = true
  m.receiveShadow = false
  m.frustumCulled = true
  m.raycast = () => {}
  m.userData.shadowOnly = true
  m.intersectsFrustum = function (this: T, f: Frustum) {
    if (!shadowFrustums.has(f)) return false
    if (whole && copy) this.geometry = sunCopies.on ? copy : whole
    // three's own test (and the drawing pass's, which hooks it: src/lib/visibility)
    return Mesh.prototype.intersectsFrustum.call(this, f)
  }
  return m
}

/** Whether a mesh's sun copy would cast exactly what it does, but for its shape: one material, no cut-outs, nothing moved
 *  in the shader, no groups (a copy's triangles are not in a group's ranges). */
function plain(m: Mesh): boolean {
  const g = m.geometry
  if ((m as InstancedMesh).isInstancedMesh || (m as SkinnedMesh).isSkinnedMesh || Array.isArray(m.material) || g.groups.length > 0 || g.morphAttributes.position) return false
  const mat = m.material as Material & { alphaMap?: unknown; displacementMap?: unknown }
  return !mat.alphaMap && !mat.displacementMap && !(mat.alphaTest > 0) && !mat.transparent
}

/**
 * Casts the meshes under `root` (a model loaded from a file: a piece of furniture) into the sun's map from their lighter
 * copies: each that casts gets a child drawn only into shadow maps, with the coarsest copy that keeps its shadow to the
 * texel at the size it stands (`sunEnough`), and stops casting itself. Call with `root` not yet scaled by a parent
 * (its own scale counts); once the simplifier has loaded if it has not yet.
 */
export function castFromCopies(root: Object3D) {
  if (!lodLoaded()) {
    void lodReady().then(() => castFromCopies(root))
    return
  }
  root.updateWorldMatrix(true, true)
  const meshes: Mesh[] = []
  root.traverse((o) => {
    const m = o as Mesh
    if (m.isMesh && m.castShadow && !m.userData.shadowOnly && plain(m)) meshes.push(m)
  })
  for (const m of meshes) {
    const scale = m.matrixWorld.getMaxScaleOnAxis()
    const copies = sunLodsOf(m.geometry)
    let copy = null
    for (const c of copies) if (sunEnough(c.error, scale)) copy = c
    if (!copy) continue
    const caster = shadowOnly(new Mesh(copy.geometry, m.material), m.geometry, copy.geometry)
    caster.name = `${m.name}-sun`
    m.castShadow = false
    m.add(caster)
  }
}
