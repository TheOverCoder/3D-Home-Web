import {
  BoxGeometry,
  BufferAttribute,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Parts, smoothstep, type PartDef } from '../lib/sculpt'
import { chickenParts, putChicken } from '../models/chicken'
import { cowParts, putCow } from '../models/cow'
import { decorModel, SECTION_HALF } from '../models/decor'
import { GOODS } from '../models/goods'
import { putSheep, sheepParts } from '../models/sheep'
import { partGeometry } from '../models/structures'
import type { ToolKind } from './format'
import { PEN } from './set'
import type { MemberNow, PropNow } from './stage'

// The pen of the animal tools' films (plans/animal-tools.md §4), as a film set: the farm's own fence sections round it
// (src/models/decor.ts, one crowd), its gate standing open into it, the film's herd from the game's own animals (their
// crowds and poses: src/models/chicken.ts, cow.ts, sheep.ts) grazing, pecking and looking about when they are not walking
// to a mark, and the two props every tool's film has: the crate the contractor brings (its sides fall away as it opens)
// and the tool itself (its pieces rising into place). The tool's look is a stand-in made of plain shapes until the 3D
// designer's model is chosen (lab board `tools-3d`): it is all in `toolModel`, so that model drops in there and every
// film follows. Like the market's walls, a fence section between the camera and what it films is left out of that
// frame (a film set's wild walls), never one behind.

// ───────────────────────────── the fence ─────────────────────────────

interface Section {
  x: number
  z: number
  heading: number
  /** its box on the ground, for the camera's way through it */
  x0: number
  x1: number
  z0: number
  z1: number
}

/** The fence's sections round the pen, 2 m each, their pickets facing out; the gate's gap left in the north side, and
 *  the gate itself standing open into the pen from its west post. */
function sections(): Section[] {
  const out: Section[] = []
  const side = (x0: number, z0: number, x1: number, z1: number, heading: number, gap?: (x: number) => boolean) => {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / (SECTION_HALF * 2))
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n
      const x = x0 + (x1 - x0) * k
      const z = z0 + (z1 - z0) * k
      if (gap?.(x)) continue
      const alongX = Math.abs(x1 - x0) > 0.01
      out.push({ x, z, heading, x0: x - (alongX ? 1 : 0.08), x1: x + (alongX ? 1 : 0.08), z0: z - (alongX ? 0.08 : 1), z1: z + (alongX ? 0.08 : 1) })
    }
  }
  side(PEN.x0, PEN.z0, PEN.x1, PEN.z0, Math.PI, (x) => x > PEN.gate.x0 && x < PEN.gate.x1)
  side(PEN.x0, PEN.z1, PEN.x1, PEN.z1, 0)
  side(PEN.x0, PEN.z0, PEN.x0, PEN.z1, -Math.PI / 2)
  side(PEN.x1, PEN.z0, PEN.x1, PEN.z1, Math.PI / 2)
  // the gate: a section hung on the gap's west post, swung 75° in
  const swing = (75 * Math.PI) / 180
  const dx = Math.cos(swing)
  const dz = Math.sin(swing)
  const gx = PEN.gate.x0 + dx * SECTION_HALF
  const gz = PEN.z0 + dz * SECTION_HALF
  out.push({ x: gx, z: gz, heading: Math.atan2(-dz, dx), x0: Math.min(PEN.gate.x0, gx + dx) - 0.08, x1: Math.max(PEN.gate.x0, gx + dx) + 0.08, z0: PEN.z0 - 0.08, z1: gz + dz + 0.08 })
  return out
}

/** Whether the segment from a to b passes through a section's box (up to its pickets' tops). */
function through(a: Vector3, b: Vector3, s: Section) {
  let t0 = 0
  let t1 = 1
  for (const [p, q, lo, hi] of [
    [a.x, b.x, s.x0, s.x1],
    [a.y, b.y, 0, 0.95],
    [a.z, b.z, s.z0, s.z1],
  ]) {
    const d = q - p
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false
      continue
    }
    let u0 = (lo - p) / d
    let u1 = (hi - p) / d
    if (u0 > u1) [u0, u1] = [u1, u0]
    t0 = Math.max(t0, u0)
    t1 = Math.min(t1, u1)
    if (t0 > t1) return false
  }
  return true
}

// ───────────────────────────── the herd ─────────────────────────────

/** Each herd's body for the camera (m: height, width across, length along her heading, her middle's height) and her
 *  legs' cycles a metre (as src/farm/wander.ts walks them: Chickens.tsx, Cows.tsx, Sheep.tsx). */
export const BODY: Record<ToolKind, { h: number; w: number; long: number; y: number; legs: number }> = {
  hens: { h: 0.42, w: 0.24, long: 0.4, y: 0.22, legs: 11 / 0.32 },
  cows: { h: 1.45, w: 0.8, long: 2.05, y: 0.8, legs: 5.5 },
  sheep: { h: 0.92, w: 0.6, long: 1.2, y: 0.5, legs: 9 },
}
/** The rooster is this much bigger than a hen (src/models/chicken.ts). */
const ROOSTER = 1.28
/** The stage's stride: its walks' phase a metre (./stage.ts). */
const STRIDE = 5.2

export interface Animal {
  id: string
  /** which of the herd (the hens: 0 the rooster, then the hens; the cows by coat; the sheep by face) */
  n: number
  seed: number
}

/** An animal's size for the camera. */
export function bodyOf(kind: ToolKind, n: number) {
  const b = BODY[kind]
  const k = kind === 'hens' && n === 0 ? ROOSTER : 1
  return { h: b.h * k, w: b.w * k, long: b.long * k, y: b.y * k }
}

// ───────────────────────────── the props ─────────────────────────────

const WOOD = new MeshStandardMaterial({ color: '#b98a55', roughness: 0.85 })
const WOOD_DARK = new MeshStandardMaterial({ color: '#7a5634', roughness: 0.9 })
const RED = new MeshStandardMaterial({ color: '#b5523a', roughness: 0.8 })
const TRIM = new MeshStandardMaterial({ color: '#e9e2d2', roughness: 0.75 })
const STRAW = new MeshStandardMaterial({ color: '#d9c18a', roughness: 1 })
// (no reflections to show on the set: metals are mostly their own colour)
const ZINC = new MeshStandardMaterial({ color: '#c9d0d4', roughness: 0.4, metalness: 0.15 })
const IRON = new MeshStandardMaterial({ color: '#4a4a4f', roughness: 0.55, metalness: 0.2 })
const MILK = new MeshStandardMaterial({ color: '#f6f3ea', roughness: 0.25 })
const WICKER = new MeshStandardMaterial({ color: '#b08a52', roughness: 0.95 })
const STEEL = new MeshStandardMaterial({ color: '#dfe4e8', roughness: 0.3, metalness: 0.2 })
const HANDLE = new MeshStandardMaterial({ color: '#c0392b', roughness: 0.55 })

const box = (w: number, h: number, d: number, m: MeshStandardMaterial, x = 0, y = 0, z = 0) => {
  const mesh = new Mesh(new BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const bakedMaterials = new Map<string, MeshStandardMaterial>()

/** A group's plain meshes made one mesh, each one's colour painted into its vertices: one draw where there were a box's
 *  each (what is marked `keep`, moving on its own, stays as it is). */
function bake<T extends Object3D>(g: T): T {
  g.updateMatrixWorld(true)
  const inv = new Matrix4().copy(g.matrixWorld).invert()
  const shapes: BufferGeometry[] = []
  const done: Mesh[] = []
  let first: MeshStandardMaterial | null = null
  const walk = (o: Object3D) => {
    if (o !== g && o.userData.keep) return
    const mesh = o as Mesh
    if (mesh.isMesh) {
      const material = mesh.material as MeshStandardMaterial
      first ??= material
      const shape = mesh.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(inv, mesh.matrixWorld))
      const n = shape.getAttribute('position').count
      const colour = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) material.color.toArray(colour, i * 3)
      shape.setAttribute('color', new BufferAttribute(colour, 3))
      shapes.push(shape)
      done.push(mesh)
    }
    for (const c of o.children) walk(c)
  }
  walk(g)
  if (!shapes.length || !first) return g
  for (const m of done) m.removeFromParent()
  const f = first as MeshStandardMaterial
  const key = `${f.roughness}|${f.metalness}`
  let material = bakedMaterials.get(key)
  if (!material) bakedMaterials.set(key, (material = new MeshStandardMaterial({ vertexColors: true, roughness: f.roughness, metalness: f.metalness })))
  const one = new Mesh(mergeGeometries(shapes)!, material)
  one.castShadow = true
  one.receiveShadow = true
  g.add(one)
  return g
}

/** The crate: slatted boards round a floor, its lid on its back side; its origin on the floor's middle, its front +z.
 *  As it opens its sides fall flat outwards, the lid with the back. */
function crateModel() {
  const W = 0.62
  const D = 0.46
  const H = 0.46
  const group = new Group()
  group.add(box(W, 0.03, D, WOOD_DARK, 0, 0.015, 0))
  const panel = (w: number) => {
    const p = new Group()
    for (const y of [0.07, 0.22, 0.37]) p.add(box(w, 0.11, 0.02, WOOD, 0, y, 0))
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) p.add(box(0.06, H - 0.02, 0.025, WOOD_DARK, x, H / 2, 0.012))
    return bake(p)
  }
  // each side on a hinge along its foot: (where, its turn, which way it falls)
  const hinges: { g: Group; axis: 'x' | 'z'; sign: number }[] = []
  for (const [x, z, turn, axis, sign] of [
    [0, D / 2, 0, 'x', 1],
    [0, -D / 2, Math.PI, 'x', -1],
    [W / 2, 0, Math.PI / 2, 'z', -1],
    [-W / 2, 0, -Math.PI / 2, 'z', 1],
  ] as const) {
    const g = new Group()
    g.position.set(x, 0.03, z)
    const p = panel(axis === 'x' ? W : D)
    p.rotation.y = turn
    g.add(p)
    group.add(g)
    hinges.push({ g, axis, sign })
  }
  // the lid, on the back's top
  const lid = new Group()
  lid.position.set(0, H - 0.02, 0)
  for (const x of [-0.2, 0, 0.2]) lid.add(box(0.19, 0.02, D, WOOD, x, 0.01, D / 2))
  hinges[1].g.children[0].add(bake(lid))
  return {
    group,
    /** opened to k (0..1): its sides fall flat by 0.6, and then it shrinks away to nothing (the tool rises from it) */
    open(k: number) {
      const a = (Math.PI / 2) * smoothstep(0, 0.6, k)
      for (const h of hinges) {
        if (h.axis === 'x') h.g.rotation.x = h.sign * a
        else h.g.rotation.z = h.sign * a
      }
      lid.rotation.x = -1.2 * smoothstep(0, 0.4, k)
      const left = 1 - smoothstep(0.6, 1, k)
      group.scale.setScalar(Math.max(0.001, left))
      return left > 0.001
    },
  }
}

/** A tool's look: its pieces (each rising into place in turn as it opens), what it holds, its size for the camera. */
interface ToolModel {
  root: Group
  pieces: Object3D[]
  /** where each good in it goes (in the root's frame), and how big the good is drawn there */
  slots: Vector3[]
  good: 'egg' | 'milk' | 'wool'
  goodScale: number
  /** the camera's frame of it: its middle (in the root's frame), its height and width */
  frame: { at: Vector3; h: number; w: number }
  /** the milk's height in the bucket (0..1) */
  level?: (k: number) => void
  /** the bucket alone, before it hangs on the post: standing, or knocked over in its spilt milk */
  alone?: (how: 'ground' | 'tipped' | null) => void
}

/** The tool of each herd, as a stand-in until the 3D designer's model is chosen: in the frame of the gate's east post
 *  (its foot the origin, +z out of the pen towards the lane, +x to the viewer's right). The coop: six red nests in a
 *  row along the fence, east of the post, each with its straw (the first one is the hens' old nest); the bucket: an
 *  iron arm on the post and a zinc pail hanging from it; the shears: a wicker basket by the post and the shears on it. */
function toolModel(kind: ToolKind): ToolModel {
  const root = new Group()
  const pieces: Object3D[] = []
  const slots: Vector3[] = []
  if (kind === 'hens') {
    // each nest a red box on the ground against the fence, open to the front, a hen's height inside, its roof sloping
    // to the front, straw on its floor, and a tray in front where her eggs roll out (a roll-away nest: they are taken
    // from outside)
    for (let k = 0; k < 6; k++) {
      const nest = new Group()
      nest.position.set(-(0.27 + k * 0.31), 0, 0.28)
      nest.add(box(0.3, 0.03, 0.52, WOOD_DARK, 0, 0.015, 0))
      nest.add(box(0.3, 0.5, 0.02, RED, 0, 0.25, -0.25))
      for (const x of [-0.145, 0.145]) nest.add(box(0.02, 0.5, 0.52, RED, x, 0.25, 0))
      nest.add(box(0.3, 0.025, 0.14, TRIM, 0, 0.045, 0.32))
      nest.add(box(0.3, 0.03, 0.02, TRIM, 0, 0.07, 0.39))
      const straw = new Mesh(new SphereGeometry(0.13, 10, 6), STRAW)
      straw.scale.set(1.05, 0.22, 1.7)
      straw.position.set(0, 0.03, -0.02)
      straw.receiveShadow = true
      nest.add(straw)
      const roof = box(0.32, 0.03, 0.6, RED, 0, 0.52, 0.03)
      roof.rotation.x = 0.2
      nest.add(roof)
      root.add(bake(nest))
      pieces.push(nest)
      // (the eggs on the tray)
      slots.push(new Vector3(nest.position.x, 0.058, 0.6))
    }
    const ridge = box(1.9, 0.045, 0.07, TRIM, -1.045, 0.58, 0.07)
    root.add(ridge)
    pieces.push(ridge)
    // (the eggs a little bigger than life: they are what the shot is about, on a phone)
    return { root, pieces, slots, good: 'egg', goodScale: 1.5, frame: { at: new Vector3(-1.05, 0.3, 0.33), h: 0.62, w: 2.0 } }
  }
  if (kind === 'cows') {
    const arm = new Group()
    arm.add(box(0.035, 0.035, 0.26, IRON, 0, 0.93, 0.13))
    const hook = new Mesh(new TorusGeometry(0.03, 0.007, 6, 12, Math.PI * 1.4), IRON)
    hook.position.set(0, 0.9, 0.24)
    hook.rotation.y = Math.PI / 2
    arm.add(hook)
    root.add(bake(arm))
    pieces.push(arm)
    // the pail: its foot's middle at its origin; open at the top
    const pail = new Group()
    const body = new Mesh(new CylinderGeometry(0.15, 0.12, 0.3, 20, 1, true), ZINC)
    body.material = ZINC
    body.position.y = 0.15
    body.castShadow = true
    pail.add(body)
    const floor = new Mesh(new CircleGeometry(0.12, 20), ZINC)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0.01
    pail.add(floor)
    const rim = new Mesh(new TorusGeometry(0.15, 0.012, 6, 24), ZINC)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.3
    pail.add(rim)
    const handle = new Mesh(new TorusGeometry(0.15, 0.007, 6, 20, Math.PI), IRON)
    handle.position.y = 0.3
    pail.add(handle)
    const milk = new Mesh(new CircleGeometry(0.135, 20), MILK)
    milk.rotation.x = -Math.PI / 2
    milk.visible = false
    milk.userData.keep = true
    pail.add(milk)
    bake(pail)
    // the spilt milk, when it is knocked over
    const puddle = new Mesh(new CircleGeometry(0.3, 18), MILK)
    puddle.rotation.x = -Math.PI / 2
    puddle.scale.set(1.3, 0.8, 1)
    puddle.position.set(0.32, 0.006, 0.05)
    puddle.visible = false
    const hang = new Group()
    hang.position.set(0, 0.6, 0.24)
    hang.add(pail)
    root.add(hang, puddle)
    pieces.push(hang)
    return {
      root,
      pieces,
      slots,
      good: 'milk',
      goodScale: 1,
      frame: { at: new Vector3(0, 0.62, 0.15), h: 1.05, w: 0.6 },
      level(k) {
        milk.visible = k > 0
        milk.position.y = 0.03 + 0.24 * Math.min(1, k)
        milk.scale.setScalar(0.85 + 0.15 * Math.min(1, k))
      },
      alone(how) {
        arm.visible = how === null
        puddle.visible = how === 'tipped'
        hang.position.set(how === null ? 0 : 0, how === null ? 0.6 : how === 'tipped' ? 0.12 : 0, how === null ? 0.24 : 0)
        hang.rotation.set(0, 0, how === 'tipped' ? -Math.PI / 2 + 0.08 : 0)
        hang.scale.setScalar(1)
      },
    }
  }
  const basket = new Group()
  basket.position.set(-0.5, 0, 0.42)
  const weave = new Mesh(new CylinderGeometry(0.25, 0.19, 0.3, 18, 3, true), WICKER)
  weave.position.y = 0.15
  weave.castShadow = true
  basket.add(weave)
  const bottom = new Mesh(new CircleGeometry(0.19, 18), WICKER)
  bottom.rotation.x = -Math.PI / 2
  bottom.position.y = 0.01
  basket.add(bottom)
  const lip = new Mesh(new TorusGeometry(0.25, 0.018, 6, 24), WOOD_DARK)
  lip.rotation.x = Math.PI / 2
  lip.position.y = 0.3
  basket.add(lip)
  for (const s of [-1, 1]) {
    const ear = new Mesh(new TorusGeometry(0.05, 0.012, 6, 12, Math.PI), WOOD_DARK)
    ear.position.set(s * 0.25, 0.3, 0)
    ear.rotation.y = Math.PI / 2
    basket.add(ear)
  }
  root.add(bake(basket))
  pieces.push(basket)
  // the shears on a peg on the post: two blades crossed at the pivot, their red grips below
  const shears = new Group()
  shears.position.set(0, 0.8, 0.08)
  shears.add(box(0.03, 0.03, 0.08, IRON, 0, 0.12, -0.03))
  for (const s of [-1, 1]) {
    const half = new Group()
    half.rotation.z = s * 0.22
    half.add(box(0.035, 0.2, 0.01, STEEL, 0, 0.1, 0))
    const grip = new Mesh(new TorusGeometry(0.04, 0.012, 6, 14), HANDLE)
    grip.position.set(0, -0.06, 0)
    half.add(grip)
    shears.add(half)
  }
  root.add(bake(shears))
  pieces.push(shears)
  for (const [x, y, z] of [
    [-0.07, 0.1, -0.06],
    [0.08, 0.1, -0.03],
    [0, 0.1, 0.08],
    [0, 0.26, 0],
  ])
    slots.push(new Vector3(basket.position.x + x, y, basket.position.z + z))
  return { root, pieces, slots, good: 'wool', goodScale: 0.82, frame: { at: new Vector3(-0.25, 0.45, 0.25), h: 1.05, w: 1.1 } }
}

/** The pieces of a tool rise into place in turn as it opens (0..1): from under the ground, small, with a little
 *  overshoot as each lands. */
function rise(pieces: Object3D[], rest: Vector3[], open: number) {
  const n = pieces.length
  pieces.forEach((p, i) => {
    const k = Math.max(0, Math.min(1, open * n - i))
    const c = 1.7
    const e = k <= 0 ? 0 : 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2
    p.visible = k > 0
    p.position.set(rest[i].x, rest[i].y - (1 - e) * 0.5, rest[i].z)
    p.scale.setScalar(0.35 + 0.65 * e)
  })
}

interface ToolProp {
  model: ToolModel
  rest: Vector3[]
  goods: Parts
  keys: string[]
}

// ───────────────────────────── the pen ─────────────────────────────

const hold = new Vector3()
const m4 = new Matrix4()

export class PenSet {
  readonly group = new Group()
  private sections = sections()
  private fence: Parts
  private herd: Parts
  private crates = new Map<string, ReturnType<typeof crateModel>>()
  private tools = new Map<string, ToolProp>()

  constructor(
    readonly kind: ToolKind,
    props: Record<string, { kind: string }>,
    animals: number,
  ) {
    const model = decorModel('fence')
    const defs: Record<string, PartDef> = {}
    for (const k of Object.keys(model)) defs[k] = { geometry: partGeometry(model[k]), max: this.sections.length, material: model[k].material, castShadow: true, receiveShadow: true }
    this.fence = new Parts(defs, 'film-pen-fence')
    // every coat or face its own: the herd's whole crowd is small
    this.herd = kind === 'hens' ? chickenParts(Math.max(6, animals)) : kind === 'cows' ? cowParts(2) : sheepParts(Math.max(4, animals))
    this.group.add(this.fence.group, this.herd.group)
    for (const [id, p] of Object.entries(props)) {
      if (p.kind === 'crate') {
        const c = crateModel()
        this.crates.set(id, c)
        this.group.add(c.group)
      } else if (p.kind === 'tool') {
        const m = toolModel(kind)
        const good = GOODS[m.good]()
        const keys = Object.keys(good)
        const gdefs: Record<string, PartDef> = {}
        for (const k of keys) gdefs[k] = { geometry: good[k].shape.geometry(), max: Math.max(1, m.slots.length), material: good[k].material, castShadow: true }
        const goods = new Parts(gdefs, `film-tool-${m.good}`)
        this.tools.set(id, { model: m, rest: m.pieces.map((x) => x.position.clone()), goods, keys })
        this.group.add(m.root, goods.group)
      }
    }
    this.fences(null, [])
  }

  /** The fence, but the sections between the camera at `eye` and the points it films, and any right at the lens (a post
   *  a hand from it would fill a side of the picture), when the camera is low enough for them to be in its way (none:
   *  all of it). */
  fences(eye: Vector3 | null, seen: Vector3[]) {
    this.fence.begin()
    for (const s of this.sections) {
      // (each way stops a little short of what it films: what stands in the fence is filmed, not its fence cut away)
      if (eye && seen.some((p) => through(eye, eye.clone().lerp(p, 0.92), s))) continue
      if (eye && eye.y < 1.6 && Math.hypot(Math.max(s.x0 - eye.x, 0, eye.x - s.x1), Math.max(s.z0 - eye.z, 0, eye.z - s.z1)) < 0.9) continue
      this.fence.at(s.x, 0, s.z, s.heading)
      for (const k of Object.keys(this.fence.meshes)) this.fence.put(k, 0, 0, 0)
    }
    this.fence.end()
  }

  /** The herd where the film has them at world time `w`: walking where they walk, and between walks grazing (pecking),
   *  looking about, or looking up (`surprise`: alert, head up, still); frozen where a freeze holds them. */
  animals(list: Animal[], now: Map<string, MemberNow>, w: number) {
    const parts = this.herd
    const legs = BODY[this.kind].legs / STRIDE
    parts.begin()
    for (const a of list) {
      const m = now.get(a.id)
      if (!m?.visible) continue
      const p = m.pose
      const t = p.frozenAt ?? w
      const alert = p.pose === 'surprise' ? p.blend : p.was === 'surprise' ? 1 - p.blend : 0
      const calm = (1 - alert) * (1 - p.walk)
      // head down about half the time, each at her own time
      const graze = calm * smoothstep(0.05, 0.55, Math.sin(t * 0.45 + a.seed * 1.7))
      const look = calm * (1 - graze) * Math.sin(t * 0.5 + a.seed * 2) * 0.35
      const phase = p.phase * legs
      if (this.kind === 'hens') putChicken(parts, a.n === 0, Math.max(0, a.n - 1), m.x, m.z, m.heading, { phase, stride: p.walk, peck: graze * Math.max(0, Math.sin(t * 9 + a.seed)), look: look * 2 })
      else if (this.kind === 'cows') putCow(parts, a.n, m.x, m.z, m.heading, { phase, stride: p.walk, graze, tail: t * 1.6 + a.seed, chew: t * 5 + a.seed, look })
      else putSheep(parts, a.n, m.x, m.z, m.heading, { phase, stride: p.walk, graze, wool: 1, chew: t * 6 + a.seed, look })
    }
    parts.end()
  }

  /** Where a held crate goes: in front of its holder, in both arms (the `box` pose), as the manager's box. */
  private held(holder: MemberNow) {
    const f = new Vector3(Math.sin(holder.heading), 0, Math.cos(holder.heading))
    return hold.set(holder.x, 0.66, holder.z).addScaledVector(f, 0.4)
  }

  /** The crate and the tool props this frame. */
  props(id: string, p: PropNow, now: Map<string, MemberNow>) {
    const crate = this.crates.get(id)
    if (crate) {
      const holder = p.holder ? now.get(p.holder) : null
      if (holder) {
        crate.group.position.copy(this.held(holder))
        crate.group.rotation.set(0, holder.heading, 0)
      } else {
        crate.group.position.set(p.x, p.y, p.z)
        crate.group.rotation.set(0, p.heading, 0)
      }
      const there = crate.open(p.open)
      crate.group.visible = there && (p.holder ? !!holder?.visible : true)
      return
    }
    const tool = this.tools.get(id)
    if (!tool) return
    const m = tool.model
    m.root.position.set(p.x, p.y, p.z)
    m.root.rotation.set(0, p.heading, 0)
    const alone = p.show === 'ground' || p.show === 'tipped' ? p.show : null
    rise(m.pieces, tool.rest, alone ? 1 : p.open)
    m.alone?.(alone)
    // what is in it: a number of goods (the milk: how full the pail is of the herd's three)
    const n = alone ? 0 : Math.max(0, Math.floor(Number(p.show) || 0))
    m.level?.(alone === 'tipped' ? 0 : n / 3)
    m.root.updateMatrixWorld(true)
    tool.goods.begin()
    if (m.good !== 'milk')
      for (let i = 0; i < Math.min(n, m.slots.length); i++) {
        // (a good in a piece still rising waits for it)
        const piece = m.good === 'egg' ? m.pieces[i] : m.pieces[0]
        if (!piece.visible) continue
        const at = m.slots[i].clone().applyMatrix4(m4.copy(m.root.matrixWorld))
        tool.goods.at(at.x, at.y, at.z, p.heading + 0.4 * (i % 2 ? 1 : -1), m.goodScale)
        for (const k of tool.keys) tool.goods.put(k, 0, 0, 0)
      }
    tool.goods.end()
  }

  /** A prop as the camera frames it (world): its middle, height and width; null if it is not the pen's. */
  frameOf(id: string, p: PropNow, now: Map<string, MemberNow>) {
    if (this.crates.has(id)) {
      const holder = p.holder ? now.get(p.holder) : null
      const at = holder ? this.held(holder).clone() : new Vector3(p.x, p.y, p.z)
      return { x: at.x, y: at.y + 0.23, z: at.z, h: 0.5, w: 0.62, heading: holder ? holder.heading : p.heading }
    }
    const tool = this.tools.get(id)
    if (!tool) return null
    const alone = p.show === 'ground' || p.show === 'tipped'
    const f = alone ? { at: new Vector3(0, 0.15, 0), h: 0.4, w: 0.45 } : tool.model.frame
    const c = Math.cos(p.heading)
    const s = Math.sin(p.heading)
    // the frame's middle turned with the tool (+z its front)
    return { x: p.x + f.at.x * c + f.at.z * s, y: f.at.y, z: p.z - f.at.x * s + f.at.z * c, h: f.h, w: f.w, heading: p.heading }
  }

  dispose() {
    for (const p of [this.fence, this.herd, ...[...this.tools.values()].map((t) => t.goods)]) p.dispose()
    this.group.traverse((o) => (o as Mesh).geometry?.dispose?.())
  }
}
