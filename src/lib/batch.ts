import { Float32BufferAttribute, Matrix4, Mesh, Vector3, type BufferGeometry, type Material, type MeshStandardMaterial, type Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Draw-call diet. The placeholder rooms are hundreds of small meshes; every one costs CPU time in the colour
// pass, the sun-shadow pass and the AO pass. Merging the ones that never move, grouped by identical look and by
// quarter of the house, turns ~700 draws into a few dozen without changing a pixel.

const tmp = new Matrix4()
const centre = new Vector3()

function signature(m: MeshStandardMaterial): string {
  const id = (t: { uuid: string } | null) => t?.uuid ?? ''
  return [
    m.color.getHexString(),
    m.emissive.getHexString(),
    m.emissiveIntensity,
    m.roughness,
    m.metalness,
    m.envMapIntensity,
    id(m.map),
    id(m.normalMap),
    id(m.roughnessMap),
    m.normalScale.x,
    m.side,
    m.polygonOffset ? `${m.polygonOffsetFactor}/${m.polygonOffsetUnits}` : '',
    m.flatShading ? 'flat' : '',
  ].join('|')
}

function underNoBatch(o: Object3D, root: Object3D): boolean {
  for (let p: Object3D | null = o; p && p !== root.parent; p = p.parent) if (p.userData.noBatch) return true
  return false
}

interface Bucket {
  material: Material
  cast: boolean
  receive: boolean
  geometries: BufferGeometry[]
}

export interface Batch {
  /** Show the merged meshes (originals hidden) or the originals (merged hidden). */
  setMerged(on: boolean): void
  dispose(): void
}

/**
 * Merges every static, opaque `MeshStandardMaterial` mesh under `root` into a handful of meshes. The originals
 * stay in the tree, so React keeps owning them; `setMerged(false)` swaps them back in (the walls need that for
 * the see-through dollhouse view). Merged meshes get their own material copies, so anything that animates the
 * originals' materials cannot leak into them.
 * Anything under a group with `userData.noBatch` is left alone (replaceable models, things that move).
 */
export function batchStatic(root: Object3D): Batch {
  root.updateWorldMatrix(true, true)
  const toLocal = root.matrixWorld.clone().invert()
  const buckets = new Map<string, Bucket>()
  const hidden: Mesh[] = []

  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !mesh.visible || underNoBatch(o, root)) return
    const material = mesh.material
    if (Array.isArray(material) || (material as MeshStandardMaterial).type !== 'MeshStandardMaterial') return
    const m = material as MeshStandardMaterial
    if (m.transparent || m.opacity < 1 || m.alphaMap || m.vertexColors) return
    if ((mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh || (mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return
    const pos = mesh.geometry.getAttribute('position')
    if (!pos) return

    tmp.multiplyMatrices(toLocal, mesh.matrixWorld)
    if (tmp.determinant() <= 0) return // mirrored: winding would flip

    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    if (!g.getAttribute('uv')) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(pos.count * 2), 2))
    g.applyMatrix4(tmp)
    g.groups = []

    g.computeBoundingBox()
    const c = g.boundingBox!.getCenter(centre)
    const cell = `${c.x < 0 ? 'w' : 'e'}${c.z < 0 ? 'n' : 's'}`
    const key = `${cell}#${signature(m)}#${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`
    let bucket = buckets.get(key)
    if (!bucket) buckets.set(key, (bucket = { material: m, cast: mesh.castShadow, receive: mesh.receiveShadow, geometries: [] }))
    bucket.geometries.push(g)
    hidden.push(mesh)
  })

  const made: Mesh[] = []
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geometries, false)
    for (const g of b.geometries) g.dispose()
    if (!merged) continue
    const mesh = new Mesh(merged, b.material.clone())
    mesh.castShadow = b.cast
    mesh.receiveShadow = b.receive
    mesh.name = 'static-batch'
    mesh.matrixAutoUpdate = false
    root.add(mesh)
    made.push(mesh)
  }
  const setMerged = (on: boolean) => {
    for (const m of made) m.visible = on
    for (const m of hidden) m.visible = !on
  }
  setMerged(true)

  return {
    setMerged,
    dispose() {
      for (const m of made) {
        root.remove(m)
        m.geometry.dispose()
        ;(m.material as Material).dispose()
      }
      for (const m of hidden) m.visible = true
    },
  }
}
