import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type ShaderMaterial,
  type WebGLRenderer,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Sky } from 'three-stdlib'
import { LANE, SUN } from '../data/layout'
import { BACK, BAYS, HALL, LOT, MANAGER_SPOT, MARKET_WALKIN } from '../data/market'
import { DAY, LADDERS, MANAGER, SHOP, type DayPhase, type ProduceId } from '../farm/data'
import { treeSpots } from '../farm/landGeometry'
import { defaultLayout } from '../farm/layout'
import { managerPct } from '../farm/market'
import { MarketGoods } from '../farm/marketGoods'
import { DEFAULT_OUTFIT, type Outfit } from '../farm/outfit'
import type { Parts } from '../lib/sculpt'
import { MARKET_SCREEN, MARKET_SIGN, marketFittingsParts, walkInShellParts } from '../models/market'
import { PERSON, PersonRig, personParts } from '../models/person'
import { putSlidingDoor, slidingDoorParts } from '../models/slidingDoor'
import { surface } from '../lib/proceduralTextures'
import { tree } from '../scene/flora'
import { shotCamera, type Subject } from './camera'
import { lookOf } from './cast'
import { lineAt, shotAt, type Timeline } from './format'
import { poseRig } from './poses'
import { looksAtFarm, THINGS_AT, WILD } from './set'
import { memberAt, propAt, type MemberNow, type PropNow } from './stage'
import { speakingAt, type Speech } from './voice'

// The film's stage in three.js: the market built from the game's own models and rows (its shell, fittings, goods,
// sliding door and sign), the cast on the people engine's rigs (one crowd, one draw a part), the props, the light of
// the scene's time of day (the game's DAY table, turned as the game's Lighting.tsx turns it), and the camera of the
// shot. Round the market, the part of the world that is the same on every farm: the game's sky and haze, its lawn, the
// lane, and the woods on the market's side of the lane (no field the player buys ever moves them). The player's own
// farm lies across the lane; the films never turn to it (`looksAtFarm`, ./set.ts), so neither the lab nor the game shows
// a farm that is not theirs (the game plays it on this stage too, on its own renderer: ./StoryFilm.tsx). While a
// scene talks, the shots on people have a light of their own (a film's key and rim, `portrait`). `frame(t)` puts
// everything where the film has it at t; it keeps no state of its own between frames but what it built, so any moment
// can be drawn at once.

// ───────────────────────────── light ─────────────────────────────

/** The game's noon light and the way the day turns it (src/scene/Lighting.tsx: NOON, TINT). */
const NOON = { sun: 2.5, sunColor: '#ffd9a0', hemi: 0.24, sky: '#dfe9ff', ground: '#4a3d32', background: '#a9c4e0', fog: '#aab4c0' }
/** The game's sky (Lighting.tsx: drei's Sky, the same numbers) and its haze (the haze setting on, as it starts). */
const SKY = { distance: 900, turbidity: 3, rayleigh: 1.3, mieCoefficient: 0.004, mieDirectionalG: 0.85 }
const HAZE = 0.04
/** The sun's height in the sky you see, at noon and at its lowest (Lighting.tsx, SUN_UP and SUN_LOW). */
const SUN_UP = (Math.atan2(SUN[1], Math.hypot(SUN[0], SUN[2])) * 180) / Math.PI
const SUN_LOW = -1.2
const TINT = {
  sun: { warm: new Color('#ff8a3c'), cool: new Color('#8fa8ff'), k: [0.55, 1] },
  sky: { warm: new Color('#ffc58f'), cool: new Color('#6f86d0'), k: [0.5, 0.9] },
  haze: { warm: new Color('#e8a774'), cool: new Color('#4f5d84'), k: [0.45, 0.7] },
}
function tint(from: string, warm: number, to: (typeof TINT)['sun']) {
  const c = new Color(from)
  if (warm > 0) c.lerp(to.warm, warm * to.k[0])
  else if (warm < 0) c.lerp(to.cool, -warm * to.k[1])
  return c
}

/** The characters' light while a scene talks, by its time of day, from the scene's own sources: the key (its colour
 *  and how much light it brings to the faces, lux), the rim from behind (the same), and how far the light round them
 *  steps back (the sky's fill, the rooms' lights and the moon through the walls the camera leaves out: the faces the
 *  brightest thing in the picture). At night the desk
 *  lamp's warm key and a cold edge, as from the hall's window; by day a soft key and the low sun's warm edge. */
const PORTRAIT: Record<DayPhase, { key: string; keyLux: number; rim: string; rimLux: number; fill: number; rooms: number; sun: number }> = {
  morning: { key: '#fff0d8', keyLux: 1.8, rim: '#ffd38c', rimLux: 12, fill: 0.6, rooms: 0.8, sun: 1 },
  noon: { key: '#fff6ea', keyLux: 1.6, rim: '#fff1d6', rimLux: 10, fill: 0.65, rooms: 0.9, sun: 1 },
  evening: { key: '#ffc48a', keyLux: 2.6, rim: '#ffd6a0', rimLux: 12, fill: 0.55, rooms: 0.6, sun: 0.8 },
  night: { key: '#ffc98f', keyLux: 3.0, rim: '#9cc2ff', rimLux: 18, fill: 0.4, rooms: 0.38, sun: 0.45 },
}
/** How far the key stands from the faces it lights, how high (radians), how much wider than the faces its cone is (m),
 *  and how far past them it reaches (times its distance: the walls behind stay dark); the rim behind them, close and
 *  high, a narrow cone that ends just past the faces (it must not light the set). */
const KEY = { far: 2.3, up: 0.6, wide: 0.6, reach: 2.4 }
const RIM = { far: 1.5, up: 0.95, wide: 0.3, reach: 1.7 }

// ───────────────────────────── pictures on the set ─────────────────────────────

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return { c, g: c.getContext('2d')!, t }
}

/** The sign over the door (as src/farm/Market.tsx draws it). */
function signPicture() {
  const W = 1024
  const H = Math.round((W * MARKET_SIGN.half[1]) / MARKET_SIGN.half[0])
  const { g, t } = canvas(W, H)
  g.fillStyle = '#2c5c36'
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(243,234,216,0.45)'
  g.lineWidth = 6
  g.strokeRect(10, 10, W - 20, H - 20)
  g.fillStyle = '#f3ead8'
  g.font = `800 ${Math.round(H * 0.62)}px Inter, system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('MARKET', W / 2, H / 2 + 4)
  return t
}

/** The banner hung over the sign once the shop is sold: red, gold letters. */
function bannerPicture() {
  const { g, t } = canvas(1024, 200)
  g.fillStyle = '#b8322a'
  g.fillRect(0, 0, 1024, 200)
  g.fillStyle = '#8f2119'
  g.fillRect(0, 168, 1024, 32)
  g.strokeStyle = '#ffc93c'
  g.lineWidth = 8
  g.strokeRect(14, 14, 996, 150)
  g.fillStyle = '#ffd66b'
  g.font = '700 74px "Fredoka Variable", Fredoka, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('UNDER NEW MANAGEMENT', 512, 92)
  return t
}

/** The computer's screen: the manager's (his rate, the shop for sale) or yours (as src/farm/Market.tsx draws it). */
function drawScreen(g: CanvasRenderingContext2D, show: string, blink: boolean) {
  const W = 256
  const H = 150
  g.fillStyle = '#10232c'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#2c8540'
  g.fillRect(0, 0, W, 34)
  g.fillStyle = '#f3ead8'
  g.font = '800 24px Inter, system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.fillText(show === 'yours' ? 'YOUR SHOP' : 'MARKET', 12, 18)
  if (show === 'yours') {
    for (let k = 0; k < 5; k++) {
      g.fillStyle = '#3a4a50'
      g.fillRect(12, 44 + k * 16, W - 24, 12)
      g.fillStyle = '#6fd36a'
      g.fillRect(12, 44 + k * 16, W - 24, 12)
    }
    g.fillStyle = '#ffc93c'
    g.font = '800 22px Inter, system-ui, sans-serif'
    g.fillText('TILL 0', 12, H - 14)
    return
  }
  // his rate at its top: the shop is for sale
  g.font = '800 44px Inter, system-ui, sans-serif'
  g.fillText(`${managerPct(LADDERS.rate.levels)}%`, 16, 70)
  for (let k = 0; k < LADDERS.rate.levels; k++) {
    g.fillStyle = '#6fd36a'
    g.fillRect(16 + k * ((W - 32) / LADDERS.rate.levels), 98, (W - 32) / LADDERS.rate.levels - 6, 12)
  }
  if (blink) {
    g.fillStyle = '#ffc93c'
    g.font = '800 22px Inter, system-ui, sans-serif'
    g.fillText(`FOR SALE · ${MANAGER.shopPrice}`, 16, 132)
  }
}

/** Floor tiles for the shop and the office. */
function tiles(a: string, b: string) {
  const { g, t } = canvas(64, 64)
  g.fillStyle = a
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = b
  g.fillRect(0, 0, 32, 32)
  g.fillRect(32, 32, 32, 32)
  t.wrapS = t.wrapT = 1000 // RepeatWrapping
  return t
}

/** A soft round glow (for the case's light). */
function glowPicture() {
  const { g, t } = canvas(128, 128)
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,226,140,1)')
  r.addColorStop(0.35, 'rgba(255,196,80,0.55)')
  r.addColorStop(1, 'rgba(255,170,40,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  return t
}

// ───────────────────────────── props ─────────────────────────────

const LEATHER = new MeshStandardMaterial({ color: '#5a3322', roughness: 0.42, metalness: 0.05 })
const GOLD = new MeshStandardMaterial({ color: '#e8b440', roughness: 0.28, metalness: 0.85, emissive: '#7a4a08', emissiveIntensity: 0.25 })
const LINING = new MeshStandardMaterial({ color: '#5b1d22', roughness: 0.8 })

/** The briefcase, lying with its lid's hinge at the back (−z) and its handle and clasps at the front (+z); its origin
 *  on the bottom's middle. `lid` turns to open it; `coins` and `light` shine when it is open. */
function briefcase() {
  const group = new Group()
  const W = 0.48
  const D = 0.34
  const base = new Mesh(new RoundedBoxGeometry(W, 0.06, D, 2, 0.012), LEATHER)
  base.position.y = 0.03
  base.castShadow = true
  group.add(base)
  const inside = new Mesh(new PlaneGeometry(W - 0.04, D - 0.04), LINING)
  inside.rotation.x = -Math.PI / 2
  inside.position.y = 0.061
  group.add(inside)
  // the coins, stacked in rows inside
  const coinGeometry = new CylinderGeometry(0.021, 0.021, 0.008, 14)
  const rows = 9
  const cols = 6
  const coins = new InstancedMesh(coinGeometry, GOLD, rows * cols * 3)
  const m = new Matrix4()
  let n = 0
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < 3; k++) {
        m.makeRotationX((((i * 7 + j * 3 + k) % 5) - 2) * 0.05)
        m.setPosition(-W / 2 + 0.035 + i * ((W - 0.07) / (rows - 1)), 0.066 + k * 0.008 + ((i + j) % 2) * 0.004, -D / 2 + 0.035 + j * ((D - 0.07) / (cols - 1)))
        coins.setMatrixAt(n++, m)
      }
  group.add(coins)
  // the lid on its hinge
  const hinge = new Group()
  hinge.position.set(0, 0.06, -D / 2)
  const lid = new Mesh(new RoundedBoxGeometry(W, 0.05, D, 2, 0.012), LEATHER)
  lid.position.set(0, 0.025, D / 2)
  lid.castShadow = true
  hinge.add(lid)
  const lidLining = new Mesh(new PlaneGeometry(W - 0.04, D - 0.04), LINING)
  lidLining.rotation.x = Math.PI / 2
  lidLining.position.set(0, -0.001, D / 2)
  hinge.add(lidLining)
  group.add(hinge)
  // the handle and two clasps at the front
  const handle = new Mesh(new TorusGeometry(0.05, 0.011, 8, 16, Math.PI), LEATHER)
  handle.rotation.x = -Math.PI / 2
  handle.rotation.z = 0
  handle.position.set(0, 0.06, D / 2 + 0.004)
  handle.rotation.set(Math.PI / 2, 0, 0)
  group.add(handle)
  for (const x of [-0.15, 0.15]) {
    const clasp = new Mesh(new BoxGeometry(0.04, 0.03, 0.01), GOLD)
    clasp.position.set(x, 0.06, D / 2 + 0.004)
    group.add(clasp)
  }
  // the gold light from inside
  const light = new PointLight('#ffc45a', 0, 2.4, 2)
  light.position.set(0, 0.22, 0.12)
  group.add(light)
  const glow = new Mesh(new PlaneGeometry(0.9, 0.9), new MeshBasicMaterial({ map: glowPicture(), transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 }))
  glow.position.set(0, 0.16, 0.02)
  group.add(glow)
  // held: hanging from the hand by its handle (the handle up, the long side along the way the holder faces)
  const outer = new Group()
  outer.add(group)
  return { outer, group, hinge, light, glow, coins, handleAt: new Vector3(0, 0.06, D / 2 + 0.06) }
}

/** The manager's cardboard box: his mug and his little plant in it. Origin on its bottom's middle. */
function cardboardBox() {
  const group = new Group()
  const card = new MeshStandardMaterial({ color: '#c49a64', roughness: 0.9 })
  const W = 0.42
  const H = 0.26
  const D = 0.3
  for (const [w, h, d, x, y, z] of [
    [W, 0.01, D, 0, 0.005, 0],
    [W, H, 0.01, 0, H / 2, D / 2],
    [W, H, 0.01, 0, H / 2, -D / 2],
    [0.01, H, D, W / 2, H / 2, 0],
    [0.01, H, D, -W / 2, H / 2, 0],
  ]) {
    const side = new Mesh(new BoxGeometry(w, h, d), card)
    side.position.set(x, y, z)
    group.add(side)
  }
  // flaps open
  for (const s of [1, -1]) {
    const flap = new Mesh(new BoxGeometry(W, 0.008, 0.13), card)
    flap.position.set(0, H + 0.04, s * (D / 2 + 0.05))
    flap.rotation.x = s * 0.7
    group.add(flap)
  }
  const mug = new Mesh(new CylinderGeometry(0.045, 0.042, 0.1, 16), new MeshStandardMaterial({ color: '#f2eee8', roughness: 0.35 }))
  mug.position.set(-0.1, H + 0.0, 0)
  group.add(mug)
  const ear = new Mesh(new TorusGeometry(0.028, 0.008, 6, 12), mug.material)
  ear.position.set(-0.15, H + 0.01, 0)
  group.add(ear)
  const pot = new Mesh(new CylinderGeometry(0.05, 0.04, 0.08, 12), new MeshStandardMaterial({ color: '#b8653e', roughness: 0.8 }))
  pot.position.set(0.1, H - 0.02, 0.02)
  group.add(pot)
  const leaf = new MeshStandardMaterial({ color: '#4f8a3c', roughness: 0.7 })
  for (let i = 0; i < 4; i++) {
    const l = new Mesh(new SphereGeometry(0.04, 8, 6), leaf)
    l.scale.set(0.5, 1.4, 0.3)
    l.position.set(0.1 + Math.sin(i * 1.6) * 0.03, H + 0.07, 0.02 + Math.cos(i * 1.6) * 0.03)
    l.rotation.set(Math.cos(i * 1.6) * 0.5, 0, -Math.sin(i * 1.6) * 0.5)
    group.add(l)
  }
  return group
}

// ───────────────────────────── round the market ─────────────────────────────

/** The game's leafy and woody materials (src/farm/Land.tsx): its grass picture tinted, its veneer for bark. */
function leaf(color: string) {
  const s = surface('grass', 1, 1)
  return new MeshStandardMaterial({ color, map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: 1, normalScale: new Vector2(1.4, 1.4) })
}

/** What is round the market on every farm: the lawn (src/scene/Exterior.tsx), the lane past the gate, and the woods'
 *  trees on the market's side of the lane (src/farm/landGeometry.ts, as Land.tsx draws them: three shades of crown,
 *  the trunks), from the game's own rows and functions. */
function surroundings() {
  const group = new Group()
  const grass = surface('grass', 130, 130)
  const lawn = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ map: grass.map, normalMap: grass.normalMap, roughnessMap: grass.roughnessMap, roughness: 1 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.y = -0.03
  lawn.receiveShadow = true
  const gravel = surface('stone', 64, 1)
  const lane = new Mesh(
    new PlaneGeometry(160, LANE.width),
    new MeshStandardMaterial({ color: '#b3a184', map: gravel.map, normalMap: gravel.normalMap, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  )
  lane.rotation.x = -Math.PI / 2
  lane.position.set(0, -0.02, LANE.z)
  lane.receiveShadow = true
  group.add(lawn, lane)
  // the woods: tree i in shade i % 3, as Land.tsx colours them; only those beyond the lane, where no field is ever bought
  const spots = treeSpots(defaultLayout())
  const wood: BufferGeometry[] = []
  const crowns: BufferGeometry[][] = [[], [], []]
  spots.forEach((t, i) => {
    if (t.z < LANE.z + LANE.width / 2 + 0.5) return
    const parts = tree(t.x, t.z, t.height, t.seed)
    wood.push(parts.wood)
    crowns[i % 3].push(parts.crown)
  })
  const bark = surface('veneer', 1, 1)
  if (wood.length) group.add(new Mesh(mergeGeometries(wood)!, new MeshStandardMaterial({ color: '#6a5a4c', map: bark.map, normalMap: bark.normalMap, roughness: 0.95 })))
  ;['#5d7d43', '#6f8a46', '#4f6e3f'].forEach((color, k) => crowns[k].length && group.add(new Mesh(mergeGeometries(crowns[k])!, leaf(color))))
  return group
}

// ───────────────────────────── the stage ─────────────────────────────

/** Whether the segment from a to b passes through a box (the slab test). */
function crosses(a: Vector3, b: Vector3, box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }) {
  let t0 = 0
  let t1 = 1
  for (const [p, q, lo, hi] of [
    [a.x, b.x, box.x0, box.x1],
    [a.y, b.y, box.y0, box.y1],
    [a.z, b.z, box.z0, box.z1],
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

/** What the player's shelves fill with once the shop is theirs: the farm's own goods, a colourful run of them. */
const SHELF_GOODS: ProduceId[] = ['tomato', 'carrot', 'strawberry', 'pumpkin', 'egg', 'milk', 'lemon', 'corn', 'lettuce', 'strawberry_cake']

export interface FrameInfo {
  shot: number
  /** how much the shot has the characters' light (0..1): the picture's edges darken with it */
  portrait: number
  /** the speaker's head on the screen (px from the top left), when on it */
  speaker: { x: number; y: number } | null
  /** the camera looks across the lane at the farm (which in the lab is not the player's): never in a film */
  farm: boolean
}

const HEAD = PERSON.hipsY + PERSON.headY + 0.02
/** The head's middle above its joint (the foot of its neck), in the rig's units. */
const SKULL = new Vector3(0, -PERSON.neckY, 0)

export class FilmStage {
  readonly root = new Group()
  readonly background = new Color()
  readonly fog = new FogExp2(NOON.fog, HAZE)
  private sky = new Sky()
  private shells = new Map<string, Parts>()
  private cast: { id: string; rig: PersonRig; hipsY: number; seed: number }[] = []
  private people: Parts
  private hemi = new HemisphereLight()
  private sun = new DirectionalLight()
  /** the sky's fill and the sun at the scene's time of day, before a talking scene steps them back */
  private fill = 0
  private sunlight = 0
  private rooms: PointLight[] = []
  /** how much each room's light is on (the lights coming on: the `lights` prop) */
  private roomsOn: number[] = MARKET_WALKIN.lights.map(() => 1)
  /** the characters' light: a key and a rim (kept in the scene at no strength when off, so no shader is made again) */
  private key = new SpotLight('#ffffff', 0, 0, 0.5, 0.85, 2)
  private rim = new SpotLight('#ffffff', 0, 0, 0.4, 0.6, 2)
  private lamp = new SpotLight('#ffd9a8', 5, 6, 0.75, 0.6, 2)
  private door = MARKET_WALKIN.autoDoor!
  private leaves = slidingDoorParts(this.door)
  private fittings = marketFittingsParts()
  private goods = new MarketGoods()
  private filled = -1
  private sign: Mesh
  private banner: Mesh
  private screen: { mesh: Mesh; g: CanvasRenderingContext2D; t: CanvasTexture; last: string }
  private windowGlow: Mesh
  private case = briefcase()
  /** how open the case is (its gold light on), this frame */
  private caseGlow = 0
  private box = cardboardBox()
  private light = ''
  private head = new Vector3()
  private hand = new Vector3()
  private dir = new Vector3()

  /** `outfit`: what the player wears in it (the game's save; the lab's, the one every farm starts in) */
  constructor(
    private tl: Timeline,
    private speech: Speech[] = [],
    private outfit: Outfit = DEFAULT_OUTFIT,
  ) {
    const film = tl.film
    // the sky, the lawn, the lane and the woods; the lot's gravel, the rooms' tiles
    this.sky.scale.setScalar(SKY.distance)
    const u = (this.sky.material as ShaderMaterial).uniforms
    u.turbidity.value = SKY.turbidity
    u.rayleigh.value = SKY.rayleigh
    u.mieCoefficient.value = SKY.mieCoefficient
    u.mieDirectionalG.value = SKY.mieDirectionalG
    this.root.add(this.sky, surroundings())
    for (const r of LOT) {
      const lot = new Mesh(new PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), new MeshStandardMaterial({ color: '#b9ad97', roughness: 0.95 }))
      lot.rotation.x = -Math.PI / 2
      lot.position.set((r.x0 + r.x1) / 2, 0.004, (r.z0 + r.z1) / 2)
      lot.receiveShadow = true
      this.root.add(lot)
    }
    for (const [r, a, b] of [
      [HALL, '#e9e3d6', '#d9d1c1'],
      [BACK, '#cdbfa6', '#bdae94'],
    ] as const) {
      const map = tiles(a, b)
      map.repeat.set((r.x1 - r.x0) / 0.8, (r.z1 - r.z0) / 0.8)
      const floor = new Mesh(new PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), new MeshStandardMaterial({ map, roughness: 0.6 }))
      floor.rotation.x = -Math.PI / 2
      floor.position.set((r.x0 + r.x1) / 2, 0.012, (r.z0 + r.z1) / 2)
      floor.receiveShadow = true
      this.root.add(floor)
    }
    // the market's fittings, its goods, its sliding door
    this.root.add(this.fittings.group, this.goods.group, this.leaves.group)
    // the sign, the banner over it, the computer's screen, the shop window lit from inside
    const signMap = signPicture()
    this.sign = new Mesh(
      new PlaneGeometry(MARKET_SIGN.half[0] * 2, MARKET_SIGN.half[1] * 2),
      new MeshStandardMaterial({ map: signMap, emissiveMap: signMap, emissive: '#ffffff', emissiveIntensity: 0.1, roughness: 0.85 }),
    )
    this.sign.position.set(MARKET_SIGN.x, MARKET_SIGN.y, MARKET_SIGN.z - 0.002)
    this.sign.rotation.y = MARKET_SIGN.heading
    this.banner = new Mesh(new PlaneGeometry(3.3, 0.64), new MeshStandardMaterial({ map: bannerPicture(), roughness: 0.7, side: DoubleSide }))
    this.banner.rotation.y = MARKET_SIGN.heading
    const s = canvas(256, 150)
    const screen = new Mesh(
      new PlaneGeometry(MARKET_SCREEN.half[0] * 2, MARKET_SCREEN.half[1] * 2),
      new MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: s.t, emissiveIntensity: 0.9 }),
    )
    screen.position.set(MARKET_SCREEN.x, MARKET_SCREEN.y, MARKET_SCREEN.z)
    screen.rotation.y = MARKET_SCREEN.heading
    this.screen = { mesh: screen, g: s.g, t: s.t, last: '' }
    this.windowGlow = new Mesh(new PlaneGeometry(2.0, 1.35), new MeshBasicMaterial({ color: '#ffdca0', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }))
    this.windowGlow.position.set(9.2, 1.375, HALL.z0 - 0.17)
    this.windowGlow.rotation.y = Math.PI
    this.root.add(this.sign, this.banner, screen, this.windowGlow)
    // the cast, one crowd
    const ids = Object.keys(film.cast)
    this.people = personParts(ids.length)
    this.root.add(this.people.group)
    ids.forEach((id, i) => {
      const rig = new PersonRig(lookOf(film.cast[id].look, this.outfit))
      this.cast.push({ id, rig, hipsY: rig.hips.position.y, seed: i * 1.7 + 0.4 })
    })
    this.root.add(this.case.outer, this.box)
    // light: the sky and the ground, the sun (casting), the rooms' lights from the market's row, the desk lamp
    this.sun.position.set(12 + 10, 9 + 6, 10 + 19)
    this.sun.target.position.set(10, 0, 19)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 })
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.02
    this.root.add(this.hemi, this.sun, this.sun.target)
    for (const l of MARKET_WALKIN.lights) {
      const p = new PointLight(l.color, l.intensity, l.distance, 2)
      p.position.set(l.x, l.y, l.z)
      this.rooms.push(p)
      this.root.add(p)
    }
    this.lamp.position.set(MANAGER_SPOT.x - 0.6, 2.4, MANAGER_SPOT.z - 0.9)
    this.lamp.target.position.set(MANAGER_SPOT.x - 0.2, 0.8, MANAGER_SPOT.z - 0.5)
    this.root.add(this.lamp, this.lamp.target, this.key, this.key.target, this.rim, this.rim.target)
  }

  /** The shell without the walls left out for this camera: every wall piece between it and what it films (a film
   *  set's wild walls), and any the shot names. Each set of walls is built once and kept. */
  private shell(eye: Vector3, targets: Vector3[], named: string[]) {
    const walls = MARKET_WALKIN.walls
    const tests = named.map((o) => WILD[o]).filter(Boolean)
    // (each way stops a little short of what it films: a sign on a wall is filmed, not its wall cut away)
    const short = targets.map((p) => eye.clone().lerp(p, 0.95))
    const out = walls.flatMap((b, i) => (tests.some((t) => t(b)) || short.some((p) => crosses(eye, p, b)) ? [i] : []))
    const key = out.join(',')
    let s = this.shells.get(key)
    if (!s) {
      s = walkInShellParts({ ...MARKET_WALKIN, walls: walls.filter((_, i) => !out.includes(i)) })
      this.shells.set(key, s)
      this.root.add(s.group)
    }
    for (const [k, other] of this.shells) other.group.visible = k === key
  }

  /** The scene's time of day: the sun's, the sky's and the haze's colours and strength. */
  private dayLight(phase: string) {
    if (phase === this.light) return
    this.light = phase
    const m = DAY.phases.find((p) => p.id === phase)?.mood ?? DAY.phases[1].mood
    this.sunlight = NOON.sun * m.sun
    this.sun.color.copy(tint(NOON.sunColor, m.warm, TINT.sun))
    this.fill = 1.1 * m.sky
    this.hemi.intensity = this.fill
    this.hemi.color.copy(tint(NOON.sky, m.warm, TINT.sky))
    this.hemi.groundColor.set(NOON.ground)
    this.background.copy(tint(NOON.background, m.warm, TINT.haze).multiplyScalar(m.sky))
    this.fog.color.copy(tint(NOON.fog, m.warm, TINT.haze).multiplyScalar(m.sky))
    // the sky's own sun, lowered towards the horizon as the light goes: a sunset sky, a night sky (Lighting.tsx, DayLight)
    const k = Math.max(0, Math.min(1, (m.sun - DAY.minLight) / (1 - DAY.minLight)))
    const up = SUN_LOW + (SUN_UP - SUN_LOW) * k * k * k
    const flat = Math.hypot(SUN[0], SUN[2])
    ;((this.sky.material as ShaderMaterial).uniforms.sunPosition.value as Vector3).set(SUN[0], k >= 1 ? SUN[1] : flat * Math.tan((up * Math.PI) / 180), SUN[2])
  }

  private subject(name: string, now: Map<string, MemberNow>, props: Map<string, PropNow>, live: boolean): Subject {
    const c = this.cast.find((x) => x.id === name)
    if (c) {
      const m = now.get(name)!
      const h = (lookOf(this.tl.film.cast[name].look, this.outfit).height ?? 1) * HEAD
      if (live) c.rig.head.localToWorld(this.head.copy(SKULL))
      return { x: m.x, y: 0, z: m.z, head: live ? this.head.y + 0.02 : h, h: h + 0.15, w: 0.55, heading: m.heading, person: true }
    }
    if (name === 'case' || name === 'box') {
      const p = props.get(name)!
      const at = p.holder ? this.handOf(p.holder, now) : new Vector3(p.x, p.y, p.z)
      return { x: at.x, y: at.y + 0.08, z: at.z, head: at.y, h: 0.36, w: 0.5, heading: p.holder ? now.get(p.holder)!.heading : p.heading, person: false }
    }
    const t = THINGS_AT[name]
    return { x: t.x, y: t.y, z: t.z, head: t.y, h: t.h, w: t.w, heading: t.heading, person: false }
  }

  /** Where a holder's right hand is (on the rig as posed this frame), or near it before it is posed. */
  private handOf(id: string, now: Map<string, MemberNow>) {
    const c = this.cast.find((x) => x.id === id)!
    c.rig.root.updateMatrixWorld(true)
    this.hand.set(0, -0.33, 0.03).applyMatrix4(c.rig.elbowR.matrixWorld)
    const m = now.get(id)!
    if (Math.hypot(this.hand.x - m.x, this.hand.z - m.z) > 1.5) this.hand.set(m.x, 0.7, m.z)
    return this.hand.clone()
  }

  frame(t: number, camera: PerspectiveCamera, size: { width: number; height: number }, reduced: boolean): FrameInfo {
    const tl = this.tl
    const at = shotAt(tl, t)
    const w = tl.world(t)
    const scene = at.scene
    this.dayLight(scene.light)
    const line = lineAt(tl, t)
    // the cast, posed and drawn
    const now = new Map<string, MemberNow>()
    this.people.begin()
    for (const c of this.cast) {
      const m = memberAt(tl, c.id, w, speakingAt(this.speech, c.id, t))
      now.set(c.id, m)
      if (!m.visible) continue
      c.rig.root.position.set(m.x, 0, m.z)
      c.rig.root.rotation.y = m.heading
      poseRig(c.rig, c.hipsY, m.pose, w, c.seed)
      c.rig.write(this.people)
    }
    this.people.end()
    // the props
    const props = new Map<string, PropNow>()
    for (const id of Object.keys(tl.film.props)) props.set(id, propAt(tl, id, w))
    this.placeProps(props, now, t)
    // the sliding door opens for whoever is near it (src/scene/WalkIn.tsx: 2 m, in 0.6 s)
    const d = this.door
    // (as near as 2 m it is open; it opens over the last 0.7 m of the way, about the game's 0.6 s at a walk)
    const gap = (x: number, z: number) => Math.hypot(Math.max(d.x0 - x, 0, x - d.x1), Math.max(d.z0 - z, 0, z - d.z1))
    let open = 0
    for (const m of now.values()) if (m.visible) open = Math.max(open, Math.min(1, Math.max(0, (2.7 - gap(m.x, m.z)) / 0.7)))
    putSlidingDoor(this.leaves, d, open)
    // the camera: placed for where everyone is at the shot's end (a walk ends in the picture), looking where they are now
    const ws = tl.world(at.end - 1e-3)
    const startNow = new Map<string, MemberNow>()
    for (const c of this.cast) startNow.set(c.id, memberAt(tl, c.id, ws))
    const cam = at.shot.cam
    const on = [cam.on].flat()
    const shoulder = typeof cam.from === 'string' && tl.film.cast[cam.from] ? cam.from : null
    const lineOf = scene.line
    const view = shotCamera(cam, {
      from: on.map((n) => this.subject(n, startNow, props, false)),
      now: on.map((n) => this.subject(n, now, props, true)),
      shoulder: shoulder ? { from: this.subject(shoulder, startNow, props, false), now: this.subject(shoulder, now, props, true) } : undefined,
      line: lineOf ? [this.subject(lineOf[0], now, props, false), this.subject(lineOf[1], now, props, false)] : undefined,
      side: scene.side ?? 1,
      aspect: size.width / Math.max(1, size.height),
      u: (t - at.start) / at.shot.len,
      secs: t - at.start,
      reduced,
    })
    camera.position.copy(view.pos)
    camera.lookAt(view.look)
    const seen = [view.look, ...on.map((n) => this.subject(n, now, props, true)).map((x) => new Vector3(x.x, x.person ? x.head : x.y, x.z))]
    if (shoulder) {
      const n = this.subject(shoulder, now, props, true)
      seen.push(new Vector3(n.x, n.head, n.z))
    }
    this.shell(view.pos, seen, [...(scene.open ?? []), ...(at.shot.open ?? [])])
    if (Math.abs(camera.fov - view.fov) > 0.01) {
      camera.fov = view.fov
      camera.updateProjectionMatrix()
    }
    // the speaker's head on the screen, for the line's bubble to point at
    let speaker: FrameInfo['speaker'] = null
    if (line && now.get(line.item.who)?.visible) {
      const c = this.cast.find((x) => x.id === line.item.who)!
      c.rig.head.localToWorld(this.head.copy(SKULL))
      this.head.y += 0.12
      camera.updateMatrixWorld()
      const p = this.head.clone().project(camera)
      if (p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1) speaker = { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height }
    }
    // the characters' light, while the scene talks: on the people the shot looks at
    const talks = scene.shots.some((x) => x.say?.length)
    const faces = talks ? on.filter((n) => tl.film.cast[n] && now.get(n)?.visible).map((n) => this.subject(n, now, props, true)) : []
    // (the rim only where faces are big: in a full shot it lights more of the set than of them; the key steps back where
    // the open case's gold is the light on them)
    const near = ['extreme', 'close', 'medium'].includes(cam.size ?? 'medium')
    const portrait = this.portrait(faces, camera.position, scene.light, scene.side ?? 1, near, 1 - 0.65 * this.caseGlow)
    const p = PORTRAIT[scene.light]
    this.hemi.intensity = this.fill * (talks ? p.fill : 1)
    this.sun.intensity = this.sunlight * (talks ? p.sun : 1)
    this.rooms.forEach((r, i) => (r.intensity = MARKET_WALKIN.lights[i].intensity * this.roomsOn[i] * (talks ? p.rooms : 1)))
    camera.getWorldDirection(this.dir)
    return { shot: at.index, portrait, speaker, farm: looksAtFarm(camera.position, this.dir) }
  }

  /** The characters' light (FILM.md, the camera: light the faces): the key from in front of them on the side they turn
   *  to (short lighting: the far cheek lit, the near one in shade, the face modelled), the rim from behind against the
   *  camera (a line of light parting them from what is behind; `rim` false: none), both aimed at the faces and as strong
   *  whatever their distance. Its colours and strength are the scene's time of day's (`PORTRAIT`), the key's times
   *  `key`. Off (no faces): no light. */
  private portrait(faces: Subject[], eye: Vector3, phase: DayPhase, side: number, rim: boolean, key: number) {
    if (!faces.length) {
      this.key.intensity = 0
      this.rim.intensity = 0
      return 0
    }
    const p = PORTRAIT[phase]
    const mid = faces.reduce((v, s) => v.add(new Vector3(s.x, s.head - 0.1, s.z)), new Vector3()).multiplyScalar(1 / faces.length)
    const spread = Math.max(0, ...faces.map((s) => Math.hypot(s.x - mid.x, s.z - mid.z) * 2))
    // towards the camera on the ground, and the camera's right
    const v = new Vector3(eye.x - mid.x, 0, eye.z - mid.z).normalize()
    const right = new Vector3(v.z, 0, -v.x)
    // the side the first face turns to (facing the camera square: the scene's side)
    const turn = right.dot(new Vector3(Math.sin(faces[0].heading), 0, Math.cos(faces[0].heading)))
    const s = Math.abs(turn) > 0.2 ? Math.sign(turn) : side
    const put = (light: SpotLight, dir: Vector3, far: number, o: typeof KEY, lux: number, color: string) => {
      light.position.copy(mid).addScaledVector(dir.normalize(), far * Math.cos(o.up))
      light.position.y += far * Math.sin(o.up)
      light.target.position.copy(mid)
      light.angle = Math.min(0.9, Math.atan((spread / 2 + o.wide) / far) * (light === this.key ? 1.3 : 1))
      light.distance = far * o.reach
      light.color.set(color)
      // as bright on the faces wherever it stands: lux times the distance squared, over what its reach leaves at them
      // (three's falloff to nothing at `distance`)
      light.intensity = (lux * far * far) / (1 - o.reach ** -4) ** 2
      light.target.updateMatrixWorld()
    }
    put(
      this.key,
      v
        .clone()
        .multiplyScalar(0.6)
        .addScaledVector(right, s * 0.85),
      KEY.far + spread * 0.5,
      KEY,
      p.keyLux * key,
      p.key,
    )
    put(
      this.rim,
      v
        .clone()
        .multiplyScalar(-0.85)
        .addScaledVector(right, -s * 0.55),
      RIM.far + spread * 0.3,
      RIM,
      rim ? p.rimLux : 0,
      p.rim,
    )
    return 1
  }

  private placeProps(props: Map<string, PropNow>, now: Map<string, MemberNow>, t: number) {
    for (const [id, p] of props) {
      const kind = this.tl.film.props[id].kind
      if (kind === 'case') {
        const c = this.case
        const holder = p.holder ? now.get(p.holder) : null
        c.outer.visible = !p.holder || !!holder?.visible
        if (holder) {
          // hanging from the hand by its handle: handle up, the long side along the way they face
          const hand = this.handOf(p.holder!, now)
          c.outer.position.copy(hand)
          c.outer.rotation.set(-Math.PI / 2, holder.heading - Math.PI / 2, 0, 'YXZ')
          c.group.position.copy(c.handleAt).multiplyScalar(-1)
        } else {
          c.outer.position.set(p.x, p.y, p.z)
          c.outer.rotation.set(0, p.heading - Math.PI, 0)
          c.group.position.set(0, 0, 0)
        }
        c.hinge.rotation.x = -p.open * 1.85
        c.light.intensity = p.open * 9
        this.caseGlow = c.outer.visible ? p.open : 0
        ;(c.glow.material as MeshBasicMaterial).opacity = p.open * 0.9
        c.glow.lookAt(c.glow.getWorldPosition(new Vector3()).add(new Vector3(0, 0, 1)))
      } else if (kind === 'box') {
        const holder = p.holder ? now.get(p.holder) : null
        this.box.visible = p.holder ? !!holder?.visible : p.open > 0.5
        if (holder) {
          const f = new Vector3(Math.sin(holder.heading), 0, Math.cos(holder.heading))
          this.box.position.set(holder.x, 0.86, holder.z).addScaledVector(f, 0.34)
          this.box.rotation.set(0, holder.heading, 0)
        } else this.box.position.set(p.x, p.y, p.z)
      } else if (kind === 'banner') {
        // unrolled from the top of the sign down
        const k = Math.max(0.001, p.open)
        const top = MARKET_SIGN.y + MARKET_SIGN.half[1] + 0.07
        this.banner.visible = p.open > 0.001
        this.banner.scale.y = k
        this.banner.position.set(MARKET_SIGN.x, top - (0.64 * k) / 2, MARKET_SIGN.z - 0.035)
      } else if (kind === 'screen') {
        const blink = Math.floor(t * 2.2) % 2 === 0
        const key = `${p.show}|${blink}`
        if (key !== this.screen.last) {
          this.screen.last = key
          drawScreen(this.screen.g, p.show, blink)
          this.screen.t.needsUpdate = true
        }
      } else if (kind === 'lights') {
        // the shop's lights, switched on one after another as `open` passes each: the sign, the window, the hall
        const k = p.open
        const on = (at: number) => (k >= at ? 1 : 0)
        ;(this.sign.material as MeshStandardMaterial).emissiveIntensity = 0.06 + 1.1 * on(0.2)
        ;(this.windowGlow.material as MeshBasicMaterial).opacity = 0.04 + 0.55 * on(0.55)
        this.roomsOn[0] = 0.12 + 1.1 * on(0.9)
      } else if (kind === 'goods') {
        // the shelves filling, a place after a place, with the farm's goods (the market's own crowd of them)
        const fill = Math.floor(p.open * BAYS.length + 0.001)
        if (fill !== this.filled) {
          this.filled = fill
          this.goods.put(
            BAYS.map((_, i) => ({ good: i < fill ? SHELF_GOODS[i % SHELF_GOODS.length] : null, units: i < fill ? SHOP.units : 0, pct: SHOP.pct.start })),
            BAYS.length,
          )
        }
      }
    }
  }

  /** Compiles every shader the film draws with (the props and walls it shows later included), before its first frame:
   *  nothing stalls once it plays (in parallel where the browser can). */
  async compile(gl: WebGLRenderer, scene: Object3D, camera: PerspectiveCamera) {
    const hidden: Object3D[] = []
    this.root.traverse((o) => {
      if (!o.visible) hidden.push(o)
    })
    for (const o of hidden) o.visible = true
    try {
      await gl.compileAsync(scene, camera)
    } catch {
      /* (compiled as it draws instead) */
    } finally {
      for (const o of hidden) o.visible = false
    }
  }

  dispose() {
    // the crowds out of the game's list of those in a scene (src/lib/sculpt/parts.ts, liveParts), then every shape
    for (const p of [this.people, this.fittings, this.leaves, ...this.shells.values()]) p.dispose()
    this.root.traverse((o: Object3D) => {
      const mesh = o as Mesh
      mesh.geometry?.dispose?.()
    })
    this.goods.dispose()
  }
}
