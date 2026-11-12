import { BufferAttribute, BufferGeometry, Color, Euler, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Material } from 'three'
import { sculptMaterial, type SculptMaterialOptions } from './material'
import { farEnough, lodReady, lodsOf } from './lod'

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

/** The part's geometry with a second instance colour of this mesh's own (a material with `tint2`: the eyes on a head).
 *  The geometry is shared by every crowd made with it, so the instanced colour goes on a geometry of the mesh's own
 *  that shares the shape's attributes (nothing is copied). */
function withColor2(g: BufferGeometry, max: number) {
  const own = new BufferGeometry()
  for (const [name, a] of Object.entries(g.attributes)) own.setAttribute(name, a)
  own.setIndex(g.index)
  own.boundingSphere = g.boundingSphere
  own.boundingBox = g.boundingBox
  const color2 = new InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3)
  own.setAttribute('instanceColor2', color2)
  return { geometry: own, color2 }
}

/** Whether a model can be seen: its box in world space (see `Parts.cull`). */
export type ModelTest = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => boolean

/** The eye a render is drawn for, for the lighter copies of far parts (src/lib/sculpt/lod.ts): where it is, and how many
 *  pixels a unit is at distance one (the drawing buffer's height over 2·tan(fov/2)). */
export interface LodView {
  x: number
  y: number
  z: number
  pixels: number
}

/** A part's lighter copy, drawn where its model is far enough for it to look the same (`farEnough`). */
interface LodMesh {
  mesh: InstancedMesh
  error: number
  color2?: InstancedBufferAttribute
}

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
  private staged = {} as Record<K, { matrices: Float32Array; colors: Float32Array; colors2?: Float32Array; model: Uint32Array; sphere: Float32Array; all: InstancedBufferAttribute }>
  /** the second instance colour of the parts whose material has one (`tint2`) */
  private color2 = {} as Partial<Record<K, InstancedBufferAttribute>>
  private boxes = new Float32Array(6 * 8)
  private shown = new Uint8Array(8)
  private drawn = new Uint8Array(8)
  /** the meshes hold only the models seen (by `cull`), not everything put */
  private compacted = false
  private drawnModels = -1
  /** the parts' lighter copies, finest first (made once the simplifier is loaded: those of no cullable part are none) */
  private lods = {} as Partial<Record<K, LodMesh[]>>
  private hasLods = false
  /** each model's distance from the eye (its box's nearest point), for the copies */
  private dist = new Float32Array(8)
  /** the copy each part instance is drawn with (0: whole), as the meshes hold them now, and as this render wants */
  private held = {} as Record<K, Uint8Array>
  private want = {} as Record<K, Uint8Array>

  constructor(defs: Record<K, PartDef>, name = 'parts', lods = true) {
    this.group.name = name
    this.keys = Object.keys(defs) as K[]
    for (const k of this.keys) {
      const d = defs[k]
      const second = !isMaterial(d.material) && d.material?.tint2 ? withColor2(d.geometry, d.max) : null
      if (second) this.color2[k] = second.color2
      const mesh = new InstancedMesh(second ? second.geometry : d.geometry, isMaterial(d.material) ? d.material : sculptMaterial(d.material), d.max)
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
        colors2: second ? new Float32Array(d.max * 3).fill(1) : undefined,
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
    for (const k of this.keys) {
      this.held[k] = new Uint8Array(defs[k].max)
      this.want[k] = new Uint8Array(defs[k].max)
    }
    this.group.addEventListener('added', () => liveParts.add(this as unknown as Parts))
    this.group.addEventListener('removed', () => liveParts.delete(this as unknown as Parts))
    // the lighter copies of the parts drawn only where seen (a caster stays whole: the sun's map is drawn from it)
    if (lods) void lodReady().then(() => this.makeLods(defs))
  }

  /** Makes each cullable part's lighter copies (src/lib/sculpt/lod.ts): a mesh each, with the part's material. */
  private makeLods(defs: Record<K, PartDef>) {
    for (const k of this.cullable) {
      const copies = lodsOf(defs[k].geometry)
      if (!copies.length) continue
      const main = this.meshes[k]
      this.lods[k] = copies.map((c, l) => {
        const second = this.color2[k] ? withColor2(c.geometry, defs[k].max) : null
        const mesh = new InstancedMesh(second ? second.geometry : c.geometry, main.material, defs[k].max)
        mesh.name = `${main.name}-lod${l + 1}`
        mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(defs[k].max * 3).fill(1), 3)
        mesh.count = 0
        mesh.visible = false
        mesh.castShadow = false
        mesh.receiveShadow = main.receiveShadow
        // a ray meets the part's own mesh, which knows every model put
        mesh.raycast = () => {}
        this.group.add(mesh)
        return { mesh, error: c.error, color2: second?.color2 }
      })
      this.hasLods = true
    }
    this.drawnModels = -1
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
   *  roll, then pitch, then yaw) and scaled. A colour applies where the part's tint mask allows (and a second one,
   *  `color2`, where its `tint2` mask does, if its material has one). */
  put(part: K, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, scale: number | Vector3 = 1, color?: Color, color2?: Color) {
    this.q.setFromEuler(this.e.set(rx, ry, rz, 'YXZ'))
    if (typeof scale === 'number') this.s.set(scale, scale, scale)
    else this.s.copy(scale)
    this.local.compose(this.v.set(x, y, z), this.q, this.s)
    return this.putMatrix(part, this.local, color, color2)
  }

  /** A part placed by a matrix of its own, in the model's frame. */
  putMatrix(part: K, local: Matrix4, color?: Color, color2?: Color) {
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
    const c2 = st.colors2
    if (c2) {
      if (color2) {
        c2[i * 3] = color2.r
        c2[i * 3 + 1] = color2.g
        c2[i * 3 + 2] = color2.b
      } else c2.fill(1, i * 3, i * 3 + 3)
    }
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
      this.copyColor2(k, n)
      mesh.count = n
      mesh.visible = n > 0
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    this.hideLods()
    this.compacted = false
    this.drawnModels = -1
    this.culledModels = 0
    this.drawnInstances = this.instances()
    return this
  }

  /** No lighter copy drawn: every part instance in its own mesh. */
  private hideLods() {
    if (!this.hasLods) return
    for (const k of this.cullable) {
      const copies = this.lods[k]
      if (!copies) continue
      for (const c of copies) {
        c.mesh.count = 0
        c.mesh.visible = false
      }
      this.held[k].fill(0, 0, this.n[k])
    }
  }

  /**
   * Draws only the models `test` passes, each tested once by its box (its parts' bounding spheres, in world space:
   * the group's place in the world now, whatever moved it); the parts of a model left out are not drawn. Parts that
   * cast a shadow stay whole: the sun's shadow map is drawn from the same meshes. `null`: every model again. Called
   * by the drawing pass (src/lib/visibility) right before a render, with that render's camera. Allocates nothing.
   *
   * `view`: the render's eye. A part drawn only where seen is then drawn with its lighter copy (src/lib/sculpt/lod.ts)
   * where its model is far enough for the copy's difference to be under half a pixel — whether or not the drawing pass
   * leaves anything out (the copies are not the pass's: the picture with the pass and without it is the same).
   */
  cull(test: ModelTest | null, view: LodView | null = null) {
    const models = this.models
    const far = this.hasLods ? view : null
    if ((test === null && far === null) || models === 0) {
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
      const seen = test === null || test(x0, y0, z0, x1, y1, z1)
      this.shown[j] = seen ? 1 : 0
      if (!seen) hidden++
      if (far) {
        // how far the eye is from the box (its nearest point; inside it: no distance, the part whole)
        const dx = Math.max(x0 - far.x, 0, far.x - x1)
        const dy = Math.max(y0 - far.y, 0, far.y - y1)
        const dz = Math.max(z0 - far.z, 0, far.z - z1)
        this.dist[j] = Math.sqrt(dx * dx + dy * dy + dz * dz)
      }
    }
    this.culledModels = hidden
    // the copy each instance is drawn with this render (0: whole)
    let copies = false
    if (far)
      for (const k of this.cullable) {
        const levels = this.lods[k]
        if (!levels) continue
        const st = this.staged[k]
        const want = this.want[k]
        const sm = st.matrices
        for (let i = 0, n = this.n[k]; i < n; i++) {
          let l = 0
          const d = this.dist[st.model[i]]
          if (d > 0) {
            // the instance's size (its largest axis), as the copy's error grows with it
            const o = i * 16
            const scale = Math.sqrt(
              Math.max(
                sm[o] * sm[o] + sm[o + 1] * sm[o + 1] + sm[o + 2] * sm[o + 2],
                sm[o + 4] * sm[o + 4] + sm[o + 5] * sm[o + 5] + sm[o + 6] * sm[o + 6],
                sm[o + 8] * sm[o + 8] + sm[o + 9] * sm[o + 9] + sm[o + 10] * sm[o + 10],
              ),
            )
            for (let c = levels.length; c >= 1; c--)
              if (farEnough(levels[c - 1].error, scale, d, far.pixels)) {
                l = c
                break
              }
          }
          want[i] = l
          if (l) copies = true
        }
      }
    if (hidden === 0 && !copies) {
      if (this.compacted) this.restore()
      return
    }
    // the same models and copies as the meshes hold already (nothing put since): nothing to hand over again
    if (this.compacted && this.drawnModels === models) {
      let same = true
      for (let j = 0; j < models && same; j++) same = this.shown[j] === this.drawn[j]
      if (same && this.hasLods)
        for (const k of this.cullable) {
          if (!this.lods[k]) continue
          const want = this.want[k]
          const held = this.held[k]
          for (let i = 0, n = this.n[k]; i < n && same; i++) same = far ? want[i] === held[i] : held[i] === 0
          if (!same) break
        }
      if (same) return
    }
    let drawn = 0
    for (const k of this.cullable) {
      const mesh = this.meshes[k]
      const st = this.staged[k]
      const n = this.n[k]
      const levels = far ? this.lods[k] : undefined
      const want = this.want[k]
      const sc2 = st.colors2
      const sm = st.matrices
      // where each copy's instances go: the part's own mesh (0), then its copies
      const targets = levels ? [{ mesh, color2: this.color2[k] }, ...levels] : [{ mesh, color2: this.color2[k] }]
      const counts = this.counts(targets.length)
      for (let i = 0; i < n; i++) {
        if (!this.shown[st.model[i]]) continue
        const l = levels ? want[i] : 0
        const t = targets[l]
        const q = counts[l]++
        const dm = t.mesh.instanceMatrix.array as Float32Array
        const dc = t.mesh.instanceColor!.array as Float32Array
        for (let c = 0, from = i * 16, to = q * 16; c < 16; c++) dm[to + c] = sm[from + c]
        dc[q * 3] = st.colors[i * 3]
        dc[q * 3 + 1] = st.colors[i * 3 + 1]
        dc[q * 3 + 2] = st.colors[i * 3 + 2]
        const dc2 = t.color2?.array as Float32Array | undefined
        if (sc2 && dc2) {
          dc2[q * 3] = sc2[i * 3]
          dc2[q * 3 + 1] = sc2[i * 3 + 1]
          dc2[q * 3 + 2] = sc2[i * 3 + 2]
        }
      }
      for (let l = 0; l < targets.length; l++) {
        const t = targets[l]
        // the part's own mesh stays visible as `end` set it (a ray still meets every model put): a draw of no instances
        // is skipped; a copy is shown only while it holds some, and bounded as the part's mesh is (round every model)
        t.mesh.count = counts[l]
        if (l > 0) {
          t.mesh.visible = counts[l] > 0
          t.mesh.boundingSphere = mesh.boundingSphere
        }
        t.mesh.instanceMatrix.needsUpdate = true
        t.mesh.instanceColor!.needsUpdate = true
        if (t.color2) t.color2.needsUpdate = true
        drawn += counts[l]
      }
      if (this.lods[k]) {
        const held = this.held[k]
        for (let i = 0; i < n; i++) held[i] = levels ? want[i] : 0
        if (!levels)
          for (const c of this.lods[k]!) {
            c.mesh.count = 0
            c.mesh.visible = false
          }
      }
    }
    for (const k of this.keys) if (this.meshes[k].castShadow) drawn += this.n[k]
    this.drawnInstances = drawn
    for (let j = 0; j < models; j++) this.drawn[j] = this.shown[j]
    this.drawnModels = models
    this.compacted = true
  }

  /** A few counters, reused (nothing allocated in a render). */
  private counters = new Int32Array(4)
  private counts(n: number) {
    if (this.counters.length < n) this.counters = new Int32Array(n)
    this.counters.fill(0)
    return this.counters
  }

  /** Every model put, drawn again. */
  private restore() {
    for (const k of this.cullable) {
      const mesh = this.meshes[k]
      const st = this.staged[k]
      const n = this.n[k]
      copy(st.matrices, mesh.instanceMatrix.array as Float32Array, n * 16)
      copy(st.colors, mesh.instanceColor!.array as Float32Array, n * 3)
      this.copyColor2(k, n)
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
    }
    this.hideLods()
    this.compacted = false
    this.drawnModels = -1
    this.drawnInstances = this.instances()
  }

  /** Hands a part's second instance colours (those put) to its mesh, if its material has them. */
  private copyColor2(k: K, n: number) {
    const a2 = this.color2[k]
    const c2 = this.staged[k].colors2
    if (!a2 || !c2) return
    copy(c2, a2.array as Float32Array, n * 3)
    a2.needsUpdate = true
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
    for (const k of this.cullable) for (const c of this.lods[k] ?? []) c.mesh.dispose()
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
