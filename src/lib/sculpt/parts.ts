import { BufferAttribute, BufferGeometry, Color, Euler, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Material } from 'three'
import { sculptMaterial, type SculptMaterialOptions } from './material'

// Drawing a crowd of models: one instanced draw per part geometry, whatever the number of animals, people or
// plants. Each frame, for every model: `at` sets where it stands and which way it faces, then `put` places each of
// its parts — a geometry built round its own joint — at that joint, turned by the pose. Parts of every model of a
// kind share their draws, so a herd of three costs what one cow does, and a hundred plants what ten do.
//
//   const parts = new Parts({ body: { geometry, max: 8 }, leg: { geometry: legGeometry, max: 32 } })
//   <primitive object={parts.group} />
//   useFrame(() => {
//     parts.begin()
//     for (const cow of herd) {
//       parts.at(cow.x, 0, cow.z, cow.heading)
//       parts.put('body', 0, bob, 0)
//       parts.put('leg', 0.2, 0.98, 0.45, swing)
//     }
//     parts.end()
//   })

export interface PartDef {
  geometry: BufferGeometry
  /** the most of this part drawn at once */
  max: number
  /** the kit's material (with these options), or a material of its own — say, for ground shadows */
  material?: SculptMaterialOptions | Material
  castShadow?: boolean
  receiveShadow?: boolean
}

const isMaterial = (m: SculptMaterialOptions | Material | undefined): m is Material => !!m && (m as Material).isMaterial === true

export class Parts<K extends string = string> {
  readonly group = new Group()
  readonly meshes = {} as Record<K, InstancedMesh>
  private n = {} as Record<K, number>
  private keys: K[]
  private root = new Matrix4()
  private local = new Matrix4()
  private world = new Matrix4()
  private q = new Quaternion()
  private e = new Euler(0, 0, 0, 'YXZ')
  private v = new Vector3()
  private s = new Vector3()

  constructor(defs: Record<K, PartDef>, name = 'parts') {
    this.group.name = name
    this.keys = Object.keys(defs) as K[]
    for (const k of this.keys) {
      const d = defs[k]
      const mesh = new InstancedMesh(d.geometry, isMaterial(d.material) ? d.material : sculptMaterial(d.material), d.max)
      mesh.name = `${name}-${k}`
      // white instance colours from the start: the shader is built once with them, and the tint mask decides
      // where an instance's own colour shows
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(d.max * 3).fill(1), 3)
      mesh.count = 0
      mesh.castShadow = d.castShadow ?? false
      mesh.receiveShadow = d.receiveShadow ?? true
      this.meshes[k] = mesh
      this.n[k] = 0
      this.group.add(mesh)
    }
  }

  /** Starts a frame: nothing is drawn until it is put again. */
  begin() {
    for (const k of this.keys) this.n[k] = 0
    return this
  }

  /** Where the next model stands (the ground under its middle), which way it faces (radians about y; 0 looks
   *  along +z) and how big it is. */
  at(x: number, y: number, z: number, heading = 0, scale = 1) {
    this.q.setFromAxisAngle(this.v.set(0, 1, 0), heading)
    this.root.compose(this.v.set(x, y, z), this.q, this.s.set(scale, scale, scale))
    return this
  }

  /** One part of the current model: its joint at (x, y, z) in the model's frame, turned by rx, ry, rz (applied
   *  roll, then pitch, then yaw) and scaled. A colour applies where the part's tint mask allows. */
  put(part: K, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, scale: number | Vector3 = 1, color?: Color) {
    this.q.setFromEuler(this.e.set(rx, ry, rz, 'YXZ'))
    if (typeof scale === 'number') this.s.set(scale, scale, scale)
    else this.s.copy(scale)
    this.local.compose(this.v.set(x, y, z), this.q, this.s)
    return this.putMatrix(part, this.local, color)
  }

  /** A part placed by a matrix of its own, in the model's frame. */
  putMatrix(part: K, local: Matrix4, color?: Color) {
    const mesh = this.meshes[part]
    const i = this.n[part]
    if (i >= mesh.instanceMatrix.count) return this
    this.n[part] = i + 1
    mesh.setMatrixAt(i, this.world.multiplyMatrices(this.root, local))
    if (color) mesh.setColorAt(i, color)
    else if (mesh.instanceColor) mesh.instanceColor.setXYZ(i, 1, 1, 1)
    return this
  }

  /** Ends a frame: hands the new poses to the GPU, and bounds each draw so it is skipped when out of view. */
  end() {
    for (const k of this.keys) {
      const mesh = this.meshes[k]
      mesh.count = this.n[k]
      mesh.visible = mesh.count > 0
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    return this
  }

  /** How many triangles one frame of these parts draws (for budgets and the gallery). */
  triangles() {
    let t = 0
    for (const k of this.keys) {
      const g = this.meshes[k].geometry
      t += ((g.index ? g.index.count : g.attributes.position.count) / 3) * this.n[k]
    }
    return t
  }

  dispose() {
    for (const k of this.keys) this.meshes[k].dispose()
  }
}

let shadowMat: MeshBasicMaterial | null = null
let shadowGeo: BufferGeometry | null = null

/** A soft round shadow on the ground (a disc, darkest in the middle, fading out at the rim): put it at y ≈ 0.012
 *  under a model and scale it to the model's footprint (x and z: half-width and half-length). */
export function shadowPart(max: number, opacity = 0.26): PartDef {
  if (!shadowGeo) {
    const seg = 24
    const p: number[] = [0, 0, 0]
    const c: number[] = [0, 0, 0, 1]
    for (const [r, a] of [
      [0.55, 0.8],
      [1, 0],
    ])
      for (let k = 0; k < seg; k++) {
        const t = (k / seg) * Math.PI * 2
        p.push(Math.cos(t) * r, 0, Math.sin(t) * r)
        c.push(0, 0, 0, a)
      }
    const idx: number[] = []
    for (let k = 0; k < seg; k++) {
      const a = 1 + k
      const b = 1 + ((k + 1) % seg)
      idx.push(0, b, a)
      idx.push(a, b, b + seg, a, b + seg, a + seg)
    }
    shadowGeo = new BufferGeometry()
    shadowGeo.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
    shadowGeo.setAttribute('color', new BufferAttribute(new Float32Array(c), 4))
    shadowGeo.setIndex(idx)
    shadowGeo.computeBoundingSphere()
  }
  shadowMat ??= new MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, opacity, depthWrite: false })
  return { geometry: shadowGeo, max, material: shadowMat, receiveShadow: false }
}
