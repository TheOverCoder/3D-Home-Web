import { Vector3, type BufferGeometry, type Mesh, type Object3D } from 'three'

export interface TrimeshData {
  vertices: Float32Array
  indices: Uint32Array
}

/**
 * World-space triangle soup of every static mesh under `root`, ready for a Rapier trimesh collider.
 *
 * Built by hand instead of using `colliders="trimesh"`: that reads the raw attribute array, which is
 * wrong for meshopt/quantized GLB (integer positions + a dequantising node transform). Going through
 * `fromBufferAttribute` honours normalisation, and `matrixWorld` honours node transforms.
 *
 * Meshes whose name starts with "NoCollide" are skipped (windows, rugs, small decor...).
 */
export function buildTrimesh(root: Object3D): TrimeshData | null {
  root.updateWorldMatrix(true, true)
  const vertices: number[] = []
  const indices: number[] = []
  const v = new Vector3()

  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || (mesh as { isSkinnedMesh?: boolean }).isSkinnedMesh) return
    if (/^nocollide/i.test(mesh.name)) return
    const geometry: BufferGeometry = mesh.geometry
    const position = geometry.attributes.position
    if (!position) return
    const base = vertices.length / 3
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
      vertices.push(v.x, v.y, v.z)
    }
    if (geometry.index) {
      for (let i = 0; i < geometry.index.count; i++) indices.push(base + geometry.index.getX(i))
    } else {
      for (let i = 0; i < position.count; i++) indices.push(base + i)
    }
  })

  if (indices.length < 3) return null
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) }
}
