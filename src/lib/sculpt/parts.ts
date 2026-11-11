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

/** Whether a model can be seen: its box in world space (see `Parts.cull`). */
export type ModelTest = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => boolean

/** Every crowd whose group is in a scene now (added to a parent and not removed since): the drawing pass culls these. */
export const liveParts = new Set<Parts>()

const IDENTITY = new Matrix4().elements

/** The first `n` numbers of one array into another (no view made, nothing allocated). */
function copy(from: Float32Array, to: Float32Array, n: number) {
  for (let i = 0; i < n; i++) to[i] = from[i]
}

export class Parts<K extends string = string> {
  readonly group = new Group()
  readonly meshes = {} as Record<K, InstancedMesh>
  /** When set, every part put is also written down here (its name and matrix): the model checks use it. */
  record?: { name: K; matrix: Matrix4 }[]
  /** models put this frame (each `at` starts one), the ones the last `cull` left out, and the part instances it drew */
  models = 0
  culledModels = 0
  drawnInstances = 0
  private n = {} as Record<K, number>
  private keys: K[]
  /** the parts drawn only where their model is seen: those that cast no shadow (the sun's map keeps every caster) */
  private cullable: K[]
  private root = new Matrix4()
  private local = new Matrix4()
  private world = new Matrix4()
  private q = new Quaternion()
  private e = new Euler(0, 0, 0, 'YXZ')
  private v = new Vector3()
  private s = new Vector3()
  // Everything put this frame, as it was put, whatever is drawn: each part instance's matrix and colour, and the model
  // it belongs to; each model's box in the group's frame (min x y z, max x y z), grown by its parts' bounding spheres.
  private staged = {} as Record<K, { matrices: Float32Array; colors: Float32Array; model: Uint32Array; sphere: Float32Array; all: InstancedBufferAttribute }>
  private boxes = new Float32Array(6 * 8)
  private shown = new Uint8Array(8)
  private drawn = new Uint8Array(8)
  /** the meshes hold only the models seen (by `cull`), not everything put */
  private compacted = false
  private drawnModels = -1

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
      const g = d.geometry
      if (!g.boundingSphere) g.computeBoundingSphere()
      const b = g.boundingSphere!
      const matrices = new Float32Array(d.max * 16)
      this.staged[k] = {
        matrices,
        colors: new Float32Array(d.max * 3).fill(1),
        model: new Uint32Array(d.max),
        sphere: new Float32Array([b.center.x, b.center.y, b.center.z, b.radius]),
        all: new InstancedBufferAttribute(matrices, 16),
      }
      // a ray meets every model put, drawn or not (the view leaves some out; their order changes with it)
      mesh.raycast = (raycaster, hits) => {
        if (!this.compacted) return InstancedMesh.prototype.raycast.call(mesh, raycaster, hits)
        const drawn = mesh.instanceMatrix
        const count = mesh.count
        mesh.instanceMatrix = this.staged[k].all
        mesh.count = this.n[k]
        try {
          InstancedMesh.prototype.raycast.call(mesh, raycaster, hits)
        } finally {
          mesh.instanceMatrix = drawn
          mesh.count = count
        }
      }
    }
    this.cullable = this.keys.filter((k) => !this.meshes[k].castShadow)
    this.group.addEventListener('added', () => liveParts.add(this as unknown as Parts))
    this.group.addEventListener('removed', () => liveParts.delete(this as unknown as Parts))
  }

  /** Starts a frame: nothing is drawn until it is put again. */
  begin() {
    for (const k of this.keys) this.n[k] = 0
    this.models = 0
    return this
  }

  /** Where the next model stands (the ground under its middle), which way it faces (radians about y; 0 looks
   *  along +z) and how big it is. Each `at` starts a model: the view draws a model whole, or not at all. */
  at(x: number, y: number, z: number, heading = 0, scale = 1) {
    this.q.setFromAxisAngle(this.v.set(0, 1, 0), heading)
    this.root.compose(this.v.set(x, y, z), this.q, this.s.set(scale, scale, scale))
    this.startModel()
    return this
  }

  private startModel() {
    const j = this.models++
    if (j >= this.shown.length) {
      // more models than ever before: room for twice as many (only while a crowd grows)
      const boxes = new Float32Array(this.boxes.length * 2)
      boxes.set(this.boxes)
      this.boxes = boxes
      this.shown = new Uint8Array(this.shown.length * 2)
      this.drawn = new Uint8Array(this.drawn.length * 2)
      this.drawnModels = -1
    }
    const o = j * 6
    this.boxes[o] = this.boxes[o + 1] = this.boxes[o + 2] = Infinity
    this.boxes[o + 3] = this.boxes[o + 4] = this.boxes[o + 5] = -Infinity
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
    this.world.multiplyMatrices(this.root, local)
    // the checks see every part put, drawn or not (more than `max` are not drawn)
    this.record?.push({ name: part, matrix: this.world.clone() })
    if (i >= mesh.instanceMatrix.count) return this
    if (this.models === 0) this.startModel() // parts put before any `at`: one model
    this.n[part] = i + 1
    const st = this.staged[part]
    const m = this.world.elements
    st.matrices.set(m, i * 16)
    if (color) {
      st.colors[i * 3] = color.r
      st.colors[i * 3 + 1] = color.g
      st.colors[i * 3 + 2] = color.b
    } else st.colors.fill(1, i * 3, i * 3 + 3)
    const j = this.models - 1
    st.model[i] = j
    // the model's box grows by this part's bounding sphere, where it is put
    const sp = st.sphere
    const cx = m[0] * sp[0] + m[4] * sp[1] + m[8] * sp[2] + m[12]
    const cy = m[1] * sp[0] + m[5] * sp[1] + m[9] * sp[2] + m[13]
    const cz = m[2] * sp[0] + m[6] * sp[1] + m[10] * sp[2] + m[14]
    const r = sp[3] * Math.sqrt(Math.max(m[0] * m[0] + m[1] * m[1] + m[2] * m[2], m[4] * m[4] + m[5] * m[5] + m[6] * m[6], m[8] * m[8] + m[9] * m[9] + m[10] * m[10]))
    const b = this.boxes
    const o = j * 6
    if (cx - r < b[o]) b[o] = cx - r
    if (cy - r < b[o + 1]) b[o + 1] = cy - r
    if (cz - r < b[o + 2]) b[o + 2] = cz - r
    if (cx + r > b[o + 3]) b[o + 3] = cx + r
    if (cy + r > b[o + 4]) b[o + 4] = cy + r
    if (cz + r > b[o + 5]) b[o + 5] = cz + r
    return this
  }

  /** Ends a frame: hands the new poses to the GPU (every model put), and bounds each draw so it is skipped when out
   *  of view. The drawing pass may then leave out the models nobody can see (`cull`), render by render. */
  end() {
    for (const k of this.keys) {
      const mesh = this.meshes[k]
      const st = this.staged[k]
      const n = this.n[k]
      copy(st.matrices, mesh.instanceMatrix.array as Float32Array, n * 16)
      copy(st.colors, mesh.instanceColor!.array as Float32Array, n * 3)
      mesh.count = n
      mesh.visible = n > 0
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    this.compacted = false
    this.drawnModels = -1
    this.culledModels = 0
    this.drawnInstances = this.instances()
    return this
  }

  /**
   * Draws only the models `test` passes, each tested once by its box (its parts' bounding spheres, in world space:
   * the group's place in the world now, whatever moved it); the parts of a model left out are not drawn. Parts that
   * cast a shadow stay whole: the sun's shadow map is drawn from the same meshes. `null`: every model again. Called
   * by the drawing pass (src/lib/visibility) right before a render, with that render's camera. Allocates nothing.
   */
  cull(test: ModelTest | null) {
    const models = this.models
    if (test === null || models === 0) {
      if (this.compacted) this.restore()
      this.culledModels = 0
      return
    }
    const G = this.group.matrixWorld.elements
    let moved = false
    for (let i = 0; i < 16 && !moved; i++) moved = G[i] !== IDENTITY[i]
    const b = this.boxes
    let hidden = 0
    for (let j = 0; j < models; j++) {
      const o = j * 6
      let x0 = b[o]
      let y0 = b[o + 1]
      let z0 = b[o + 2]
      let x1 = b[o + 3]
      let y1 = b[o + 4]
      let z1 = b[o + 5]
      if (x0 > x1) {
        // a model with no parts put
        this.shown[j] = 0
        continue
      }
      if (moved) {
        // the box round the turned box, in the world
        const cx = (x0 + x1) / 2
        const cy = (y0 + y1) / 2
        const cz = (z0 + z1) / 2
        const hx = (x1 - x0) / 2
        const hy = (y1 - y0) / 2
        const hz = (z1 - z0) / 2
        const wx = G[0] * cx + G[4] * cy + G[8] * cz + G[12]
        const wy = G[1] * cx + G[5] * cy + G[9] * cz + G[13]
        const wz = G[2] * cx + G[6] * cy + G[10] * cz + G[14]
        const ex = Math.abs(G[0]) * hx + Math.abs(G[4]) * hy + Math.abs(G[8]) * hz
        const ey = Math.abs(G[1]) * hx + Math.abs(G[5]) * hy + Math.abs(G[9]) * hz
        const ez = Math.abs(G[2]) * hx + Math.abs(G[6]) * hy + Math.abs(G[10]) * hz
        x0 = wx - ex
        x1 = wx + ex
        y0 = wy - ey
        y1 = wy + ey
        z0 = wz - ez
        z1 = wz + ez
      }
      const seen = test(x0, y0, z0, x1, y1, z1)
      this.shown[j] = seen ? 1 : 0
      if (!seen) hidden++
    }
    this.culledModels = hidden
    if (hidden === 0) {
      if (this.compacted) this.restore()
      return
    }
    // the same models as the meshes hold already (nothing put since): nothing to hand over again
    if (this.compacted && this.drawnModels === models) {
      let same = true
      for (let j = 0; j < models && same; j++) same = this.shown[j] === this.drawn[j]
      if (same) return
    }
    let drawn = 0
    for (const k of this.cullable) {
      const mesh = this.meshes[k]
      const st = this.staged[k]
      const n = this.n[k]
      const dm = mesh.instanceMatrix.array as Float32Array
      const dc = mesh.instanceColor!.array as Float32Array
      let q = 0
      for (let i = 0; i < n; i++) {
        if (!this.shown[st.model[i]]) continue
        const sm = st.matrices
        for (let c = 0, from = i * 16, to = q * 16; c < 16; c++) dm[to + c] = sm[from + c]
        dc[q * 3] = st.colors[i * 3]
        dc[q * 3 + 1] = st.colors[i * 3 + 1]
        dc[q * 3 + 2] = st.colors[i * 3 + 2]
        q++
      }
      // left visible as `end` set it (a ray still meets every model put): a draw of no instances is skipped by the pass
      mesh.count = q
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
      drawn += q
    }
    for (const k of this.keys) if (this.meshes[k].castShadow) drawn += this.n[k]
    this.drawnInstances = drawn
    for (let j = 0; j < models; j++) this.drawn[j] = this.shown[j]
    this.drawnModels = models
    this.compacted = true
  }

  /** Every model put, drawn again. */
  private restore() {
    for (const k of this.cullable) {
      const mesh = this.meshes[k]
      const st = this.staged[k]
      const n = this.n[k]
      copy(st.matrices, mesh.instanceMatrix.array as Float32Array, n * 16)
      copy(st.colors, mesh.instanceColor!.array as Float32Array, n * 3)
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
    }
    this.compacted = false
    this.drawnModels = -1
    this.drawnInstances = this.instances()
  }

  /** How many part instances were put this frame (drawn or not). */
  instances() {
    let n = 0
    for (const k of this.keys) n += this.n[k]
    return n
  }

  /** How many triangles one frame of these parts draws, every model put (for budgets and the gallery). */
  triangles() {
    let t = 0
    for (const k of this.keys) {
      const g = this.meshes[k].geometry
      t += ((g.index ? g.index.count : g.attributes.position.count) / 3) * this.n[k]
    }
    return t
  }

  dispose() {
    liveParts.delete(this as unknown as Parts)
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
