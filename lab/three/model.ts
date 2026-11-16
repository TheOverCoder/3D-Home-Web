import { Group, Mesh } from 'three'
import { checkPieces, describeIssue, sculptMaterial, type CheckOptions } from '../../src/lib/sculpt'
import { partGeometry, structurePieces, type Structure, type StructurePart } from '../../src/models/structures'

// What the 3D designer's boards share for a model made with the kit (src/lib/sculpt): a structure (one shape per
// material, src/models/structures.ts) drawn as meshes in the lab, its triangles counted, and the kit's own checks run on
// it (loose pieces, holes that show, floating or sunk), as src/models/checks.ts runs them on the game's models.

/** A part of a proposal: a structure's part (its normals softened where it asks: a tree's crown shaded as one ball). */
export type LabPart = StructurePart
export type LabModel<K extends string = string> = Record<K, LabPart>

/** The triangles a model draws (every part once). */
export const trianglesOf = (s: Structure | LabModel) => Object.values(s).reduce((n, p) => n + p.shape.triangles(), 0)

/** A model as meshes, one per part, in its own frame (the ground under its middle at the origin). */
export function modelGroup(s: Structure | LabModel, name: string): Group {
  const group = new Group()
  group.name = name
  for (const [k, part] of Object.entries(s) as [string, LabPart][]) {
    const mesh = new Mesh(partGeometry(part), sculptMaterial(part.material))
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
