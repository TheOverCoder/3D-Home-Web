import { BoxGeometry, BufferAttribute, Box3, Group, Matrix4, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type BufferGeometry, type Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Parts, smoothstep, type PartDef } from '../lib/sculpt'
import { chickenParts, putChicken } from '../models/chicken'
import { cowParts, putCow } from '../models/cow'
import { decorModel, SECTION_HALF } from '../models/decor'
import { GOODS } from '../models/goods'
import { putSheep, sheepParts } from '../models/sheep'
import { partGeometry } from '../models/structures'
import { GOODS_PART, nestSpots, toolProp, type ToolLook, type ToolProp as ToolModel, type ToolStyle } from '../models/tools'
import type { ToolKind } from './format'
import { PEN, PEN_TOOL } from './set'
import type { MemberNow, PropNow } from './stage'

// The pen of the animal tools' films (plans/animal-tools.md §4), as a film set: the farm's own fence sections round it
// (src/models/decor.ts, one crowd), its gate standing open into it, the film's herd from the game's own animals (their
// crowds and poses: src/models/chicken.ts, cow.ts, sheep.ts) grazing, pecking and looking about when they are not walking
// to a mark, and the props of every tool's film: the crate the contractor carries in both hands (its sides fall away as
// it opens), the tool itself as the 3D designer made it (src/models/tools.ts, in the style the film is given: its pieces
// rising into place one after another), one of its pieces alone (the pail kicked over, the shears in a hand), and the
// hens' old nest box. Like the market's walls, a fence section between the camera and what it films may be left out of
// a shot (a film set's wild walls): decided once for the whole shot (./stage3d.ts), never frame by frame.

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
/** A hen sitting in a nest is drawn this big (the nests are a hen's size: she settles into the straw, her legs in it). */
const SITTING = 0.75

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

/** The herd's crowd as an animal's put sees it, but up off the ground by `lift`, `scale` times its size, and (a cow)
 *  with her right hind leg thrown back by `kick` radians and her tail up: the game's own models and poses, moved. */
function moved(parts: Parts, lift: number, scale: number, kick: number): Parts {
  // (the right hind leg is the hind part on her right, −x; the tail goes up as it kicks)
  const thrown = (k: string, x: number) => (!kick ? 0 : k.startsWith('tail') ? -0.8 * kick : k.startsWith('hind') && x < 0 ? kick : 0)
  const put = (k: string, x: number, y: number, z: number, rx = 0, ...rest: unknown[]) => (parts.put as (...a: unknown[]) => void)(k, x, y, z, rx + thrown(k, x), ...rest)
  const at = (x: number, y: number, z: number, heading = 0, s = 1) => parts.at(x, y + lift, z, heading, s * scale)
  return { at, put } as unknown as Parts
}

/** How far a cow's kick is thrown back, `s` seconds after it began: out fast, back slower. */
const kickAt = (s: number) => 1.25 * (s < 0.12 ? Math.sin((s / 0.12) * (Math.PI / 2)) : Math.max(0, 1 - (s - 0.12) / 0.4))

// ───────────────────────────── the props ─────────────────────────────

const WOOD = new MeshStandardMaterial({ color: '#b98a55', roughness: 0.85 })
const WOOD_DARK = new MeshStandardMaterial({ color: '#7a5634', roughness: 0.9 })
const STRAW = new MeshStandardMaterial({ color: '#d9c18a', roughness: 1 })

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
      shapes.push(shape.index ? shape.toNonIndexed() : shape)
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

/** The crate's size: a little narrower than the carry's hands are apart, so they hold it by its sides. */
export const CRATE = { w: 0.56, d: 0.42, h: 0.42 }

/** The crate: slatted boards round a floor, its lid on its back side; its origin on the floor's middle, its front +z.
 *  As it opens its sides fall flat outwards, the lid with the back. */
function crateModel() {
  const { w: W, d: D, h: H } = CRATE
  const group = new Group()
  group.add(box(W, 0.03, D, WOOD_DARK, 0, 0.015, 0))
  const panel = (w: number) => {
    const p = new Group()
    for (const y of [0.065, 0.2, 0.335]) p.add(box(w, 0.1, 0.02, WOOD, 0, y, 0))
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
  for (const x of [-0.18, 0, 0.18]) lid.add(box(0.17, 0.02, D, WOOD, x, 0.01, D / 2))
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

/** The hens' old nest box, as the farm draws it (src/farm/Places.tsx): a wooden box on a post, straw in it, its
 *  origin at the post's foot, its open side +z. */
function oldNestModel() {
  const g = new Group()
  g.add(box(0.4, 0.03, 0.44, WOOD, 0, 0.615, 0))
  g.add(box(0.4, 0.2, 0.03, WOOD, 0, 0.7, -0.22))
  g.add(box(0.03, 0.12, 0.44, WOOD, -0.2, 0.66, 0))
  g.add(box(0.03, 0.12, 0.44, WOOD, 0.2, 0.66, 0))
  g.add(box(0.06, 0.6, 0.06, WOOD_DARK, 0, 0.3, -0.12))
  const straw = new Mesh(new SphereGeometry(0.17, 10, 6), STRAW)
  straw.scale.set(1.05, 0.2, 1.1)
  straw.position.set(0, 0.635, 0)
  g.add(straw)
  return bake(g)
}

const LOOKS: Record<ToolKind, ToolLook> = { hens: 'nests', cows: 'pail', sheep: 'shears' }

/** The tool, as the game will draw it, in the film's style: its pieces rising one after another (`open`), what waits
 *  in it (the milk, the wool: its goods part, shown while there are any; the eggs on its nests), its frame for the
 *  camera (the model's own box). */
interface ToolNow {
  model: ToolModel
  /** the goods piece (the milk, the wool), and its size full */
  goods: Group | null
  /** where the eggs lie on its nests (the model's frame), drawn by `eggs` */
  slots: Vector3[]
  eggs: Parts | null
  keys: string[]
  /** the model's box in its own frame */
  bounds: Box3
}

/** One piece of a tool alone (the pail, the shears): its group moved so the piece's foot is its origin. */
interface PieceNow {
  model: ToolModel
  root: Group
  /** how tall and wide it is, and its middle's height over its foot */
  h: number
  w: number
}

// ───────────────────────────── the pen ─────────────────────────────

const m4 = new Matrix4()
const v = new Vector3()

export class PenSet {
  readonly group = new Group()
  private sections = sections()
  /** the fence sections left out of this shot ('-': not drawn yet) */
  private hidden = '-'
  private fence: Parts
  private herd: Parts
  private crates = new Map<string, ReturnType<typeof crateModel>>()
  private tools = new Map<string, ToolNow>()
  private pieces = new Map<string, PieceNow>()
  private nests = new Map<string, { root: Group; eggs: Parts; keys: string[] }>()
  /** the coop's nests in the world, where a hen sits in each (the film's style) */
  private seats: Vector3[] = []

  constructor(
    readonly kind: ToolKind,
    props: Record<string, { kind: string; piece?: string }>,
    animals: number,
    readonly style: ToolStyle = 'a',
  ) {
    const model = decorModel('fence')
    const defs: Record<string, PartDef> = {}
    for (const k of Object.keys(model)) defs[k] = { geometry: partGeometry(model[k]), max: this.sections.length, material: model[k].material, castShadow: true, receiveShadow: true }
    this.fence = new Parts(defs, 'film-pen-fence')
    // every coat or face its own: the herd's whole crowd is small
    this.herd = kind === 'hens' ? chickenParts(Math.max(6, animals)) : kind === 'cows' ? cowParts(2) : sheepParts(Math.max(4, animals))
    this.group.add(this.fence.group, this.herd.group)
    const look = LOOKS[kind]
    const eggParts = (n: number, name: string) => {
      const egg = GOODS.egg()
      const keys = Object.keys(egg)
      const d: Record<string, PartDef> = {}
      for (const k of keys) d[k] = { geometry: egg[k].shape.geometry(), max: n, material: egg[k].material, castShadow: true }
      return { parts: new Parts(d, name), keys }
    }
    for (const [id, p] of Object.entries(props)) {
      if (p.kind === 'crate') {
        const c = crateModel()
        this.crates.set(id, c)
        this.group.add(c.group)
      } else if (p.kind === 'tool') {
        const m = toolProp(look, style)
        // (its pieces come up out of the crate, set down in front of it)
        for (const piece of m.pieces) piece.from = [0, -0.35, 0.95]
        m.open(1)
        const bounds = new Box3().setFromObject(m.group)
        const goods = m.pieces.find((x) => x.group.children.some((c) => c.name.endsWith(`-${GOODS_PART}`)))?.group ?? null
        // the eggs on the nests' fronts (half again their size: they are what the shot is about, on a phone)
        const slots = look === 'nests' ? nestSpots(style).map(([x, y, z]) => new Vector3(x, y, z + 0.08)) : []
        const e = slots.length ? eggParts(slots.length, `film-tool-eggs`) : null
        this.tools.set(id, { model: m, goods, slots, eggs: e?.parts ?? null, keys: e?.keys ?? [], bounds })
        this.group.add(m.group)
        if (e) this.group.add(e.parts.group)
        // where a hen sits in each nest: on its straw, a little back from the eggs
        if (look === 'nests') this.seats = nestSpots(style).map(([x, y, z]) => this.toWorld(x, y - 0.05, z - 0.03))
      } else if (p.kind === 'piece') {
        const m = toolProp(look, style)
        m.open(1)
        const piece = m.pieces.find((x) => x.id === p.piece) ?? m.pieces[m.pieces.length - 1]
        for (const x of m.pieces) x.group.visible = x === piece
        // the piece's foot at the origin
        const b = new Box3().setFromObject(piece.group)
        const root = new Group()
        m.group.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2)
        root.add(m.group)
        this.pieces.set(id, { model: m, root, h: b.max.y - b.min.y, w: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) })
        this.group.add(root)
      } else if (p.kind === 'nestbox') {
        const root = oldNestModel()
        const e = eggParts(3, 'film-old-nest-eggs')
        this.nests.set(id, { root, eggs: e.parts, keys: e.keys })
        this.group.add(root, e.parts.group)
      }
    }
    this.fences([])
  }

  /** A point of the tool's model frame in the world (the tool at its place, its front to the lane). */
  private toWorld(x: number, y: number, z: number) {
    const c = Math.cos(PEN_TOOL.heading)
    const s = Math.sin(PEN_TOOL.heading)
    return new Vector3(PEN_TOOL.x + x * c + z * s, y, PEN_TOOL.z - x * s + z * c)
  }

  /** The fence sections between the camera at `eye` and the points it films, and any right at the lens (a post a hand
   *  from it would fill a side of the picture), when the camera is low enough for them to be in its way. */
  inTheWay(eye: Vector3, seen: Vector3[]) {
    const out: number[] = []
    this.sections.forEach((s, i) => {
      // (each way stops a little short of what it films: what stands in the fence is filmed, not its fence cut away)
      if (seen.some((p) => through(eye, eye.clone().lerp(p, 0.92), s))) out.push(i)
      else if (eye.y < 1.6 && Math.hypot(Math.max(s.x0 - eye.x, 0, eye.x - s.x1), Math.max(s.z0 - eye.z, 0, eye.z - s.z1)) < 0.9) out.push(i)
    })
    return out
  }

  /** The fence, but the sections given (a shot's: the same from its first frame to its last). */
  fences(hidden: number[]) {
    const key = hidden.join(',')
    if (key === this.hidden) return
    this.hidden = key
    this.fence.begin()
    this.sections.forEach((s, i) => {
      if (hidden.includes(i)) return
      this.fence.at(s.x, 0, s.z, s.heading)
      for (const k of Object.keys(this.fence.meshes)) this.fence.put(k, 0, 0, 0)
    })
    this.fence.end()
  }

  /** The herd where the film has them at world time `w`: walking where they walk (a hop up into a nest), and between
   *  walks grazing (pecking), looking about, or looking up (`surprise`: alert, head up, still), head hung (`slump`), a
   *  kick (`kick`: a cow's hind leg); a hen in a nest sits in its straw; frozen where a freeze holds them. */
  animals(list: Animal[], now: Map<string, MemberNow>, w: number) {
    const parts = this.herd
    const legs = BODY[this.kind].legs / STRIDE
    parts.begin()
    for (const a of list) {
      const m = now.get(a.id)
      if (!m?.visible) continue
      const p = m.pose
      const t = p.frozenAt ?? w
      const was = (q: string) => (p.pose === q ? p.blend : p.was === q ? 1 - p.blend : 0)
      const alert = was('surprise')
      const sad = was('slump')
      const calm = (1 - alert) * (1 - p.walk) * (1 - sad)
      // head down about half the time, each at her own time
      const graze = calm * smoothstep(0.05, 0.55, Math.sin(t * 0.45 + a.seed * 1.7)) + sad * 0.55
      const look = calm * (1 - graze) * Math.sin(t * 0.5 + a.seed * 2) * 0.35
      const phase = p.phase * legs
      // a hen up in a nest (not mid-hop): settled in the straw of the nearest of the style's nests
      let lift = m.y
      let scale = 1
      if (this.kind === 'hens' && m.y > 0.3 && p.walk === 0 && this.seats.length) {
        const seat = this.seats.reduce((b, s) => (Math.hypot(s.x - m.x, s.z - m.z) < Math.hypot(b.x - m.x, b.z - m.z) ? s : b))
        if (Math.hypot(seat.x - m.x, seat.z - m.z) < 0.2) {
          lift = seat.y
          scale = SITTING
        }
      }
      const kick = p.pose === 'kick' ? kickAt(p.since) : p.was === 'kick' ? kickAt(p.wasSince) : 0
      const put = lift || scale !== 1 || kick ? moved(parts, lift, scale, kick) : parts
      if (this.kind === 'hens')
        putChicken(put, a.n === 0, Math.max(0, a.n - 1), m.x, m.z, m.heading, { phase, stride: p.walk, peck: scale !== 1 ? 0 : graze * Math.max(0, Math.sin(t * 9 + a.seed)), look: look * 2 })
      else if (this.kind === 'cows') putCow(put, a.n, m.x, m.z, m.heading, { phase, stride: p.walk, graze: kick ? 0 : graze, tail: t * 1.6 + a.seed, chew: t * 5 + a.seed, look: kick ? 0.6 : look })
      else putSheep(put, a.n, m.x, m.z, m.heading, { phase, stride: p.walk, graze, wool: m.wool, chew: t * 6 + a.seed, look })
    }
    parts.end()
  }

  /** The crate, the tool, a piece, the nest box this frame. `hands`: a holder's two hands in the world (the crate is
   *  carried between them, the pail and the shears in the right one), `head` the top of their head. */
  props(id: string, p: PropNow, now: Map<string, MemberNow>, hands: (who: string) => [Vector3, Vector3], head: (who: string) => Vector3) {
    const crate = this.crates.get(id)
    if (crate) {
      const holder = p.holder ? now.get(p.holder) : null
      if (holder && p.holder) {
        // between the hands, at the middle of its sides
        const [l, r] = hands(p.holder)
        crate.group.position.copy(l).add(r).multiplyScalar(0.5)
        crate.group.position.y -= CRATE.h / 2
        crate.group.rotation.set(0, holder.heading, 0)
      } else {
        crate.group.position.set(p.x, p.y, p.z)
        crate.group.rotation.set(0, p.heading, 0)
      }
      const there = crate.open(p.open)
      crate.group.visible = there && (p.holder ? !!holder?.visible : true)
      return
    }
    const piece = this.pieces.get(id)
    if (piece) {
      const holder = p.holder ? now.get(p.holder) : null
      piece.root.visible = p.holder ? !!holder?.visible : true
      piece.root.rotation.set(0, 0, 0)
      if (holder && p.holder) {
        if (p.show === 'head') {
          // upside down on their head, its rim over their eyes
          piece.root.position.copy(head(p.holder))
          piece.root.position.y += piece.h - 0.13
          piece.root.rotation.set(Math.PI, -holder.heading, 0)
        } else {
          // hanging from the right hand
          piece.root.position.copy(hands(p.holder)[1])
          piece.root.position.y -= piece.h * 0.85
          piece.root.rotation.set(0, holder.heading, 0)
        }
      } else if (p.fly) {
        piece.root.position.set(p.x, p.y, p.z)
        piece.root.rotation.set(p.fly.spin, p.heading, p.fly.spin * 0.4)
      } else if (p.show === 'tipped') {
        // on its side on the ground
        piece.root.position.set(p.x, piece.w / 2, p.z)
        piece.root.rotation.set(0, p.heading, Math.PI / 2 - 0.1)
      } else {
        piece.root.position.set(p.x, p.y, p.z)
        piece.root.rotation.set(0, p.heading, 0)
      }
      return
    }
    const nest = this.nests.get(id)
    if (nest) {
      nest.root.position.set(p.x, 0, p.z)
      nest.root.rotation.set(0, p.heading, 0)
      nest.root.updateMatrixWorld(true)
      const n = Math.max(0, Math.floor(Number(p.show) || 0))
      nest.eggs.begin()
      for (let i = 0; i < Math.min(3, n); i++) {
        v.set(-0.08 + i * 0.08, 0.66, 0.08 - (i % 2) * 0.06).applyMatrix4(nest.root.matrixWorld)
        nest.eggs.at(v.x, v.y, v.z, p.heading + i, 1.4)
        for (const k of nest.keys) nest.eggs.put(k, 0, 0, 0)
      }
      nest.eggs.end()
      return
    }
    const tool = this.tools.get(id)
    if (!tool) return
    const m = tool.model
    m.group.position.set(p.x, p.y, p.z)
    m.group.rotation.set(0, p.heading, 0)
    m.open(p.open)
    // what is in it: a number of goods (the milk and the wool: its goods part, as full as the herd's three make it)
    const n = Math.max(0, Math.floor(Number(p.show) || 0))
    if (tool.goods) tool.goods.visible = tool.goods.visible && n > 0
    if (tool.eggs) {
      m.group.updateMatrixWorld(true)
      tool.eggs.begin()
      for (let i = 0; i < Math.min(n, tool.slots.length); i++) {
        // (an egg in a nest still rising waits for it)
        if (p.open < 0.999) continue
        v.copy(tool.slots[i]).applyMatrix4(m4.copy(m.group.matrixWorld))
        tool.eggs.at(v.x, v.y, v.z, p.heading + 0.4 * (i % 2 ? 1 : -1), 1.5)
        for (const k of tool.keys) tool.eggs.put(k, 0, 0, 0)
      }
      tool.eggs.end()
    }
  }

  /** A prop as the camera frames it (world): its middle, height and width; null if it is not the pen's. */
  frameOf(id: string, p: PropNow, now: Map<string, MemberNow>) {
    if (this.crates.has(id)) {
      const holder = p.holder ? now.get(p.holder) : null
      const at = holder ? new Vector3(holder.x + Math.sin(holder.heading) * 0.36, 1.0 - CRATE.h / 2, holder.z + Math.cos(holder.heading) * 0.36) : new Vector3(p.x, p.y, p.z)
      return { x: at.x, y: at.y + CRATE.h / 2, z: at.z, h: CRATE.h + 0.08, w: CRATE.w, heading: holder ? holder.heading : p.heading }
    }
    const piece = this.pieces.get(id)
    if (piece) {
      const holder = p.holder ? now.get(p.holder) : null
      if (holder) return { x: holder.x, y: p.show === 'head' ? 1.7 : 0.9, z: holder.z, h: piece.h + 0.2, w: piece.w + 0.2, heading: holder.heading }
      return { x: p.x, y: p.y + piece.h / 2, z: p.z, h: piece.h + 0.1, w: piece.w + 0.1, heading: p.heading }
    }
    if (this.nests.has(id)) return { x: p.x, y: 0.55, z: p.z, h: 0.75, w: 0.55, heading: p.heading }
    const tool = this.tools.get(id)
    if (!tool) return null
    const b = tool.bounds
    const c = Math.cos(p.heading)
    const s = Math.sin(p.heading)
    const fx = (b.min.x + b.max.x) / 2
    const fz = (b.min.z + b.max.z) / 2
    // the frame's middle turned with the tool (+z its front)
    return { x: p.x + fx * c + fz * s, y: (b.min.y + b.max.y) / 2, z: p.z - fx * s + fz * c, h: b.max.y - b.min.y, w: b.max.x - b.min.x, heading: p.heading }
  }

  dispose() {
    for (const p of [this.fence, this.herd, ...[...this.tools.values()].flatMap((t) => (t.eggs ? [t.eggs] : [])), ...[...this.nests.values()].map((n) => n.eggs)]) p.dispose()
    for (const t of this.tools.values()) t.model.dispose()
    for (const t of this.pieces.values()) t.model.dispose()
    this.group.traverse((o) => (o as Mesh).geometry?.dispose?.())
  }
}
