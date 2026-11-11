import { Float32BufferAttribute, Matrix4, Mesh, Vector3, type BufferAttribute, type BufferGeometry, type Material, type MeshStandardMaterial, type Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createContext } from 'react'

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

/** What the drawing pass makes of a mesh (src/lib/visibility: `userData.cell`, 'always' or 'outside'), when a group
 *  inside the batch says so: it travels with the geometry into its merged mesh. */
function cellUnder(o: Object3D, root: Object3D): string {
  for (let p: Object3D | null = o; p && p !== root; p = p.parent) if (typeof p.userData.cell === 'string') return p.userData.cell
  return ''
}

/** The part a mesh belongs to (`userData.part`: a piece of furniture and what stands on it, a stretch of wall), which
 *  can be drawn on its own instead of merged, if any. */
function partUnder(o: Object3D, root: Object3D): string {
  for (let p: Object3D | null = o; p && p !== root; p = p.parent) if (typeof p.userData.part === 'string') return p.userData.part
  return ''
}

interface Bucket {
  material: Material
  cast: boolean
  receive: boolean
  cell: string
  geometries: BufferGeometry[]
  /** each geometry's part (or '') */
  parts: string[]
}

export interface Batch {
  /** Show the merged meshes (originals hidden) or the originals (merged hidden). */
  setMerged(on: boolean): void
  /** Draws these parts (`userData.part`) on their own, as they are now, and the rest merged: their triangles in the
   *  merged meshes are folded to a point (nothing drawn) and their own meshes shown — cheap: only the parts that
   *  change are touched. */
  exclude(parts: ReadonlySet<string>): void
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
  // each part's own meshes, and where its triangles are in the merged meshes
  const ownMeshes = new Map<string, Mesh[]>()
  const ranges = new Map<string, { geometry: BufferGeometry; from: number; to: number; copy?: Float32Array }[]>()

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
    const tag = cellUnder(mesh, root)
    const key = `${cell}#${signature(m)}#${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}${tag ? `#${tag}` : ''}`
    let bucket = buckets.get(key)
    if (!bucket) buckets.set(key, (bucket = { material: m, cast: mesh.castShadow, receive: mesh.receiveShadow, cell: tag, geometries: [], parts: [] }))
    bucket.geometries.push(g)
    const part = partUnder(mesh, root)
    bucket.parts.push(part)
    hidden.push(mesh)
    if (part) {
      const own = ownMeshes.get(part)
      if (own) own.push(mesh)
      else ownMeshes.set(part, [mesh])
    }
  })

  const made: Mesh[] = []
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geometries, false)
    // where each part's triangles are in the merged positions (vertices from, to)
    let start = 0
    b.geometries.forEach((g, i) => {
      const count = g.getAttribute('position').count
      const part = b.parts[i]
      if (merged && part) {
        const list = ranges.get(part) ?? []
        list.push({ geometry: merged, from: start, to: start + count })
        ranges.set(part, list)
      }
      start += count
    })
    for (const g of b.geometries) g.dispose()
    if (!merged) continue
    const mesh = new Mesh(merged, b.material.clone())
    mesh.castShadow = b.cast
    mesh.receiveShadow = b.receive
    mesh.name = 'static-batch'
    if (b.cell) mesh.userData.cell = b.cell
    mesh.matrixAutoUpdate = false
    root.add(mesh)
    made.push(mesh)
  }
  let showMerged = true
  const excluded = new Set<string>()
  const setMerged = (on: boolean) => {
    showMerged = on
    for (const m of made) m.visible = on
    for (const m of hidden) m.visible = !on
    if (on) for (const part of excluded) for (const m of ownMeshes.get(part) ?? []) m.visible = true
  }
  setMerged(true)

  // a part taken out of the merged meshes: its vertices all at one point (no triangle left to draw), put back from a
  // copy of its positions as they were merged
  const fold = (part: string, out: boolean) => {
    for (const r of ranges.get(part) ?? []) {
      const pos = r.geometry.getAttribute('position') as BufferAttribute
      const a = pos.array as Float32Array
      r.copy ??= a.slice(r.from * 3, r.to * 3)
      if (out) a.fill(0, r.from * 3, r.to * 3)
      else a.set(r.copy, r.from * 3)
      pos.addUpdateRange(r.from * 3, (r.to - r.from) * 3)
      pos.needsUpdate = true
    }
    for (const m of ownMeshes.get(part) ?? []) m.visible = out || !showMerged
  }

  return {
    setMerged,
    exclude(parts) {
      for (const part of excluded)
        if (!parts.has(part)) {
          excluded.delete(part)
          fold(part, false)
        }
      for (const part of parts)
        if (!excluded.has(part) && (ranges.has(part) || ownMeshes.has(part))) {
          excluded.add(part)
          fold(part, true)
        }
    },
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

/** The merged meshes of a StaticBatch, for the parts inside it drawn on their own now and then (a wall while it fades:
 *  Walls.tsx) */
export interface BatchHandle {
  batch: Batch | null
  exclude: ReadonlySet<string>
}
export const BatchContext = createContext<BatchHandle | null>(null)
