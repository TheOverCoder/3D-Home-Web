import { BufferAttribute, Group, Mesh, type BufferGeometry } from 'three'
import { checkPieces, describeIssue, sculptMaterial, type CheckOptions, type V3 } from '../../src/lib/sculpt'
import { structurePieces, type Structure, type StructurePart } from '../../src/models/structures'

// What the 3D designer's boards share for a model made with the kit (src/lib/sculpt): a structure (one shape per
// material, src/models/structures.ts) drawn as meshes in the lab, its triangles counted, and the kit's own checks run on
// it (loose pieces, holes that show, floating or sunk), as src/models/checks.ts runs them on the game's models.

/** A part of a proposal: a structure's part, and how its normals are softened (a tree's crown shaded as one ball). */
export interface LabPart extends StructurePart {
  /** the normals bent towards the ones of an ellipsoid round `centre` with these `radii`, by `k` (0 none, 1 all) */
  soft?: { centre: V3; radii: V3; k: number }
}
export type LabModel<K extends string = string> = Record<K, LabPart>

/** The triangles a model draws (every part once). */
export const trianglesOf = (s: Structure | LabModel) => Object.values(s).reduce((n, p) => n + p.shape.triangles(), 0)

/** Bends a geometry's normals towards an ellipsoid's: lumps of leaves light as one crown, not as many small balls. */
function soften(g: BufferGeometry, soft: NonNullable<LabPart['soft']>) {
  const p = g.getAttribute('position')
  const n = g.getAttribute('normal')
  const out = new Float32Array(n.count * 3)
  const [cx, cy, cz] = soft.centre
  const [rx, ry, rz] = soft.radii
  for (let i = 0; i < n.count; i++) {
    let ex = (p.getX(i) - cx) / (rx * rx)
    let ey = (p.getY(i) - cy) / (ry * ry)
    let ez = (p.getZ(i) - cz) / (rz * rz)
    const el = Math.hypot(ex, ey, ez) || 1
    ex /= el
    ey /= el
    ez /= el
    let x = n.getX(i) + (ex - n.getX(i)) * soft.k
    let y = n.getY(i) + (ey - n.getY(i)) * soft.k
    let z = n.getZ(i) + (ez - n.getZ(i)) * soft.k
    const l = Math.hypot(x, y, z) || 1
    x /= l
    y /= l
    z /= l
    out[i * 3] = x
    out[i * 3 + 1] = y
    out[i * 3 + 2] = z
  }
  g.setAttribute('normal', new BufferAttribute(out, 3))
}

/** A model as meshes, one per part, in its own frame (the ground under its middle at the origin). */
export function modelGroup(s: Structure | LabModel, name: string): Group {
  const group = new Group()
  group.name = name
  for (const [k, part] of Object.entries(s) as [string, LabPart][]) {
    const g = part.shape.geometry()
    if (part.soft) soften(g, part.soft)
    const mesh = new Mesh(g, sculptMaterial(part.material))
    mesh.name = `${name}-${k}`
    mesh.castShadow = part.castShadow ?? true
    mesh.receiveShadow = part.receiveShadow ?? true
    group.add(mesh)
  }
  return group
}

/** The parts drawn from both sides (leaves, ribbons, straw): their edges are open by design. */
const openParts = (s: Structure | LabModel) => Object.entries(s).flatMap(([k, p]) => (p.material?.doubleSided ? [k] : []))

/** The kit's checks on a model standing on the ground: what they find, in words (none: it holds together and stands). */
export function checkModel(name: string, s: Structure | LabModel, o: CheckOptions = {}): string[] {
  return checkPieces(name, structurePieces(s), { ground: 0, open: openParts(s), ...o }).map(describeIssue)
}
