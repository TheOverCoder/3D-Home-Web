import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, Vector3, type BufferAttribute, type Material, type MeshStandardMaterial, type Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createContext } from 'react'
import { byShape, shadowOnly, shadowSideOf } from './sculpt/sun'

// Draw-call diet. The placeholder rooms are hundreds of small meshes; every one costs CPU time in the colour
// pass, the sun-shadow pass and the AO pass. Merging the ones that never move, grouped by identical look and by
// quarter of the house, turns ~700 draws into a few dozen without changing a pixel. Where the drawing pass leaves
// nothing out of the sun's map by room (the farm: src/lib/visibility), what casts is drawn into it merged further
// (`sunAsOne`): the map keeps depth only, so one mesh for each quarter (and drawing-pass cell) and side drawn, whatever
// its looks — a shed of a dozen colours is one draw there, not a dozen — drawn only into shadow maps
// (src/lib/sculpt/sun.ts), with the same triangles, so not a texel changes.

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
  /** the quarter of the root it lies in */
  quarter: string
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
 * `sunAsOne`: what casts is drawn into the sun's map by one mesh a quarter, cell and side (above).
 */
export function batchStatic(root: Object3D, { sunAsOne = false }: { sunAsOne?: boolean } = {}): Batch {
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
    if (!bucket) buckets.set(key, (bucket = { material: m, cast: mesh.castShadow, receive: mesh.receiveShadow, cell: tag, quarter: cell, geometries: [], parts: [] }))
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
  const addRange = (part: string, geometry: BufferGeometry, from: number, to: number) => {
    const list = ranges.get(part) ?? []
    list.push({ geometry, from, to })
    ranges.set(part, list)
  }
  // the merged meshes that cast and are drawn into the sun's map by their shape and side alone, by quarter, cell and
  // the side drawn: each such group is drawn there by one mesh of its own
  const sunGroups = new Map<string, { material: Material; cell: string; pieces: { geometry: BufferGeometry; parts: { part: string; from: number; to: number }[] }[] }>()
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geometries, false)
    // where each part's triangles are in the merged positions (vertices from, to)
    let start = 0
    const inside: { part: string; from: number; to: number }[] = []
    b.geometries.forEach((g, i) => {
      const count = g.getAttribute('position').count
      const part = b.parts[i]
      if (merged && part) {
        addRange(part, merged, start, start + count)
        inside.push({ part, from: start, to: start + count })
      }
      start += count
    })
    for (const g of b.geometries) g.dispose()
    if (!merged) continue
    const material = b.material.clone()
    const mesh = new Mesh(merged, material)
    const sun = sunAsOne && b.cast && byShape(material)
    mesh.castShadow = b.cast && !sun
    // (it casts through its quarter's sun mesh)
    if (sun) mesh.userData.sunAsOne = true
    mesh.receiveShadow = b.receive
    mesh.name = 'static-batch'
    if (b.cell) mesh.userData.cell = b.cell
    mesh.matrixAutoUpdate = false
    root.add(mesh)
    made.push(mesh)
    if (!sun) continue
    const key = `${b.quarter}#${b.cell}#${shadowSideOf(material)}`
    const group = sunGroups.get(key) ?? { material, cell: b.cell, pieces: [] }
    group.pieces.push({ geometry: merged, parts: inside })
    sunGroups.set(key, group)
  }
  // each group's triangles one after another, exactly as merged (a part's taken out of the sun's mesh with it: `fold`)
  const suns: Mesh[] = []
  for (const s of sunGroups.values()) {
    const total = s.pieces.reduce((n, p) => n + p.geometry.getAttribute('position').count, 0)
    const positions = new Float32Array(total * 3)
    const geometry = new BufferGeometry()
    let offset = 0
    for (const p of s.pieces) {
      const pos = p.geometry.getAttribute('position')
      for (let v = 0; v < pos.count; v++) {
        positions[(offset + v) * 3] = pos.getX(v)
        positions[(offset + v) * 3 + 1] = pos.getY(v)
        positions[(offset + v) * 3 + 2] = pos.getZ(v)
      }
      for (const r of p.parts) addRange(r.part, geometry, offset + r.from, offset + r.to)
      offset += pos.count
    }
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const sun = shadowOnly(new Mesh(geometry, s.material))
    sun.name = 'static-batch-sun'
    if (s.cell) sun.userData.cell = s.cell
    sun.matrixAutoUpdate = false
    root.add(sun)
    suns.push(sun)
  }
  let showMerged = true
  const excluded = new Set<string>()
  const setMerged = (on: boolean) => {
    showMerged = on
    for (const m of made) m.visible = on
    for (const m of suns) m.visible = on
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
      // (their materials are the merged meshes')
      for (const m of suns) {
        root.remove(m)
        m.geometry.dispose()
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
