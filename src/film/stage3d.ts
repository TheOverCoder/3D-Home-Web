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
  type Scene,
  type ShaderMaterial,
  type Texture,
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
import { isAnimal, lookOf } from './cast'
import { lineAt, shotAt, WORLD_FX, type ShotAt, type Size, type Timeline, type WorldFx } from './format'
import { bodyOf, PenSet, type Animal } from './pen'
import { Sparks, type Burst } from './sparks'
import { poseRig } from './poses'
import { looksAtFarm, PEN_GROVE, PEN_MIDDLE, THINGS_AT, WILD } from './set'
import { memberAt, propAt, type MemberNow, type PropNow } from './stage'
import { speakingAt, type Speech } from './voice'

// The film's stage in three.js: the market built from the game's own models and rows (its shell, fittings, goods,
// sliding door and sign) when the film plays there, the pen (./pen.ts: the farm's fence sections, the film's herd from
// the game's own animals, the crate and the tool) when it plays there, the cast on the people engine's rigs (one crowd,
// one draw a part), the props, the light of the scene's time of day (the game's DAY table, turned as the game's
// Lighting.tsx turns it), and the camera of the shot. Round the market, the part of the world that is the same on every farm: the game's sky and haze, its lawn, the
// lane, and the woods on the market's side of the lane (no field the player buys ever moves them). The player's own
// farm lies across the lane; the films never turn to it (`looksAtFarm`, ./set.ts), so neither the lab nor the game shows
// a farm that is not theirs (the game plays it on this stage too, on its own renderer: ./StoryFilm.tsx). While a
// scene talks, the shots on people have a light of their own (a film's key and rim, `portrait`). `frame(t)` puts
// everything where the film has it at t; it keeps no state of its own between frames but what it built, so any moment
// can be drawn at once. What a shot needs of the set is decided once for the whole shot, from where its camera stands at
// its start, middle and end: the walls and fence sections left out of it, and outdoors where the sun stands (cheated round
// the subjects as a film's crew does: a wide shot lit from over the camera's shoulder, a near one from behind them, the
// key on their faces) — so nothing comes and goes while a shot runs.

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

/** The sun's height over the horizon in each time of day when a shot outdoors places it (degrees). */
const SUN_HIGH: Record<DayPhase, number> = { morning: 26, noon: 46, evening: 17, night: 34 }
/** Where the sun stands for each size of shot outdoors: degrees round the subjects from the camera (0 behind the camera,
 *  180 behind them) — a wide shot lit from over the camera's shoulder (the place reads), a full one from the side, a
 *  near one from behind (a line of light round them; the key lights their faces). */
const SUN_ROUND: Record<Size, number> = { wide: 50, full: 105, medium: 140, close: 145, extreme: 145 }
/** Half the sun's shadow box round a shot's subjects (m): the nearer the shot, the sharper its shadows. */
const SHADOW_BOX: Record<Size, number> = { extreme: 5, close: 5, medium: 6, full: 8, wide: 14 }

/** What a shot needs of the set, the same from its first frame to its last: the market's walls and the pen's fence
 *  sections left out (between its camera and what it films), and outdoors where the sun stands. */
interface ShotSet {
  walls: number[]
  fence: number[]
  sun: { at: Vector3; from: Vector3; box: number } | null
}

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
 *  the trunks), from the game's own rows and functions; and `grove`, more of the same trees (the pen's, behind it). */
function surroundings(grove: readonly (readonly [number, number, number, number])[] = []) {
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
  grove.forEach(([x, z, height, seed], i) => {
    const parts = tree(x, z, height, seed)
    wood.push(parts.wood)
    crowns[(i + 1) % 3].push(parts.crown)
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
  /** the shot's first subject on the screen (px from the top left): where an iris closes */
  focus: { x: number; y: number } | null
  /** the scene's time of day (the picture's grade) */
  light: DayPhase
  /** the camera looks across the lane at the farm (which in the lab is not the player's): never in a film */
  farm: boolean
  /** someone (not filmed) standing between the camera and the shot's first subject, hiding it: never in a film */
  blocked: string | null
}

const HEAD = PERSON.hipsY + PERSON.headY + 0.02
/** The head's middle above its joint (the foot of its neck), in the rig's units. */
const SKULL = new Vector3(0, -PERSON.neckY, 0)

/** Where the sun is aimed while a scene plays in each place (its shadow's box round it), and how far it stands off. */
const SUN_AT = { market: { x: 10, z: 19 }, pen: PEN_MIDDLE }
const SUN_OFF = [12, 15, 10] as const

export class FilmStage {
  readonly root = new Group()
  readonly background = new Color()
  readonly fog = new FogExp2(NOON.fog, HAZE)
  private sky = new Sky()
  private shells = new Map<string, Parts>()
  private cast: { id: string; rig: PersonRig; hipsY: number; seed: number }[] = []
  /** the film's herd, in the pen (null: the film has no pen) */
  private pen: PenSet | null = null
  private animals: Animal[] = []
  /** the market's set (null: the film never plays there): its shell's pieces, its fittings, its goods, its door */
  private market: Group | null = null
  private people: Parts
  private hemi = new HemisphereLight()
  private sun = new DirectionalLight()
  /** the light all round (the game's own environment: its metals have a sky to show), how strong at noon, and the scene
   *  it lights (null: none, the sky's fill makes up for it) */
  private env: { scene: Scene | null; texture: Texture | null; noon: number } = { scene: null, texture: null, noon: 0 }
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
  private leaves: ReturnType<typeof slidingDoorParts> | null = null
  private fittings: Parts | null = null
  private goods: MarketGoods | null = null
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
  private dir = new Vector3()
  /** each shot's set (by shot and screen shape), worked out at its first frame */
  private sets = new Map<string, ShotSet>()
  /** the world's effects and the air's motes */
  private sparks = new Sparks()

  /** `outfit`: what the player wears in it (the game's save; the lab's, the one every farm starts in) */
  constructor(
    private tl: Timeline,
    private speech: Speech[] = [],
    private outfit: Outfit = DEFAULT_OUTFIT,
  ) {
    const film = tl.film
    const places = new Set(film.scenes.map((x) => x.place))
    // the sky, the lawn, the lane and the woods (and the pen's grove); the lot's gravel, the rooms' tiles
    this.sky.scale.setScalar(SKY.distance)
    const u = (this.sky.material as ShaderMaterial).uniforms
    u.turbidity.value = SKY.turbidity
    u.rayleigh.value = SKY.rayleigh
    u.mieCoefficient.value = SKY.mieCoefficient
    u.mieDirectionalG.value = SKY.mieDirectionalG
    this.root.add(this.sky, surroundings(places.has('pen') ? PEN_GROVE : []))
    // the market, only for a film that plays in it (everything of it under one group)
    const market = new Group()
    if (places.has('market')) {
      this.market = market
      this.root.add(market)
      this.leaves = slidingDoorParts(this.door)
      this.fittings = marketFittingsParts()
      this.goods = new MarketGoods()
    }
    for (const r of LOT) {
      const lot = new Mesh(new PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), new MeshStandardMaterial({ color: '#b9ad97', roughness: 0.95 }))
      lot.rotation.x = -Math.PI / 2
      lot.position.set((r.x0 + r.x1) / 2, 0.004, (r.z0 + r.z1) / 2)
      lot.receiveShadow = true
      market.add(lot)
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
      market.add(floor)
    }
    // the market's fittings, its goods, its sliding door
    if (this.fittings && this.goods && this.leaves) market.add(this.fittings.group, this.goods.group, this.leaves.group)
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
    market.add(this.sign, this.banner, screen, this.windowGlow)
    // the cast, one crowd; the animals in the pen's herd
    const ids = Object.keys(film.cast)
    const people = ids.filter((id) => !isAnimal(film.cast[id].look))
    this.people = personParts(Math.max(1, people.length))
    this.root.add(this.people.group)
    ids.forEach((id, i) => {
      const look = film.cast[id].look
      if (isAnimal(look)) return void this.animals.push({ id, n: look.herd, seed: i * 1.7 + 0.4 })
      const rig = new PersonRig(lookOf(look, this.outfit))
      this.cast.push({ id, rig, hipsY: rig.hips.position.y, seed: i * 1.7 + 0.4 })
    })
    if (film.herd && places.has('pen')) {
      this.pen = new PenSet(film.herd, film.props, this.animals.length, film.style ?? 'a')
      this.root.add(this.pen.group)
    }
    this.root.add(this.sparks.crowd, this.sparks.motes)
    market.add(this.case.outer, this.box)
    // light: the sky and the ground, the sun (casting), the rooms' lights from the market's row, the desk lamp
    this.aimSun(film.scenes[0]?.place ?? 'market')
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
      market.add(p)
    }
    this.lamp.position.set(MANAGER_SPOT.x - 0.6, 2.4, MANAGER_SPOT.z - 0.9)
    this.lamp.target.position.set(MANAGER_SPOT.x - 0.2, 0.8, MANAGER_SPOT.z - 0.5)
    market.add(this.lamp, this.lamp.target)
    this.root.add(this.key, this.key.target, this.rim, this.rim.target)
  }

  /** The sun over a place: aimed at its middle, its shadow's box round it. */
  private aimSun(place: keyof typeof SUN_AT) {
    const at = SUN_AT[place]
    if (this.sun.target.position.x === at.x && this.sun.target.position.z === at.z) return
    this.sun.position.set(at.x + SUN_OFF[0], SUN_OFF[1], at.z + SUN_OFF[2])
    this.sun.target.position.set(at.x, 0, at.z)
    this.sun.target.updateMatrixWorld()
  }

  /** The walls left out for a camera: every wall piece between it and what it films (a film set's wild walls), and any
   *  the shot names. */
  private wallsOut(eye: Vector3, targets: Vector3[], named: string[]) {
    const walls = MARKET_WALKIN.walls
    const tests = named.map((o) => WILD[o]).filter(Boolean)
    // (each way stops a little short of what it films: a sign on a wall is filmed, not its wall cut away)
    const short = targets.map((p) => eye.clone().lerp(p, 0.95))
    return walls.flatMap((b, i) => (tests.some((t) => t(b)) || short.some((p) => crosses(eye, p, b)) ? [i] : []))
  }

  /** The shell without the walls given. Each set of walls is built once and kept. */
  private shell(out: number[]) {
    const walls = MARKET_WALKIN.walls
    const key = out.join(',')
    let s = this.shells.get(key)
    if (!s) {
      s = walkInShellParts({ ...MARKET_WALKIN, walls: walls.filter((_, i) => !out.includes(i)) })
      this.shells.set(key, s)
      this.root.add(s.group)
    }
    for (const [k, other] of this.shells) other.group.visible = k === key
  }

  /** The light all round the film, as the game has it (src/scene/Lighting.tsx: its environment and how strong it is at
   *  noon), in the scene the film is drawn in; the day turns it down as it turns down the sky. */
  environment(scene: Scene, texture: Texture | null, noon: number) {
    this.env = { scene, texture, noon }
    this.light = ''
  }

  /** The scene's time of day: the sun's, the sky's and the haze's colours and strength. */
  private dayLight(phase: string) {
    if (phase === this.light) return
    this.light = phase
    const m = DAY.phases.find((p) => p.id === phase)?.mood ?? DAY.phases[1].mood
    this.sunlight = NOON.sun * m.sun
    this.sun.color.copy(tint(NOON.sunColor, m.warm, TINT.sun))
    // (with the environment's light all round, the sky's fill is half what it is without)
    this.fill = (this.env.texture ? 0.55 : 1.1) * m.sky
    if (this.env.scene) {
      this.env.scene.environment = this.env.texture
      this.env.scene.environmentIntensity = this.env.noon * m.sky
    }
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
    const a = this.animals.find((x) => x.id === name)
    if (a && this.pen) {
      const m = now.get(name)!
      const b = bodyOf(this.pen.kind, a.n)
      return { x: m.x, y: b.y + m.y, z: m.z, head: b.y + m.y, h: b.h, w: b.w, long: b.long, heading: m.heading, person: false, animal: true }
    }
    const pen = this.pen && props.has(name) ? this.pen.frameOf(name, props.get(name)!, now) : null
    if (pen) return { ...pen, head: pen.y, person: false }
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
    return this.handsOf(id, now)[1]
  }

  /** A holder's two hands (left, right) as posed this frame. */
  private handsOf(id: string, now: Map<string, MemberNow>): [Vector3, Vector3] {
    const c = this.cast.find((x) => x.id === id)
    const m = now.get(id)
    if (!c || !m) return [new Vector3(), new Vector3()]
    c.rig.root.updateMatrixWorld(true)
    const l = new Vector3(0, -0.33, 0.03).applyMatrix4(c.rig.elbowL.matrixWorld)
    const r = new Vector3(0, -0.33, 0.03).applyMatrix4(c.rig.elbowR.matrixWorld)
    for (const h of [l, r]) if (Math.hypot(h.x - m.x, h.z - m.z) > 1.5) h.set(m.x, 0.7, m.z)
    return [l, r]
  }

  /** The top of a cast member's head as posed this frame. */
  private headOf(id: string) {
    const c = this.cast.find((x) => x.id === id)
    if (!c) return new Vector3()
    c.rig.root.updateMatrixWorld(true)
    return c.rig.head.localToWorld(new Vector3(0, -PERSON.neckY + 0.14, 0))
  }

  /** Where the camera stands at film time t, and the points it films, found from where everyone is (not as posed: any
   *  moment of a shot can be asked for, the rigs stay as they are). */
  private viewOf(t: number, size: { width: number; height: number }, reduced: boolean) {
    const tl = this.tl
    const at = shotAt(tl, t)
    const w = tl.world(t)
    const ws = tl.world(at.end - 1e-3)
    const now = new Map<string, MemberNow>()
    const end = new Map<string, MemberNow>()
    for (const c of [...this.cast, ...this.animals]) {
      now.set(c.id, memberAt(tl, c.id, w))
      end.set(c.id, memberAt(tl, c.id, ws))
    }
    const props = new Map<string, PropNow>()
    for (const id of Object.keys(tl.film.props)) props.set(id, propAt(tl, id, w))
    const cam = at.shot.cam
    const on = [cam.on].flat()
    const shoulder = typeof cam.from === 'string' && tl.film.cast[cam.from] ? cam.from : null
    const lineOf = at.scene.line
    const view = shotCamera(cam, {
      from: on.map((n) => this.subject(n, end, props, false)),
      now: on.map((n) => this.subject(n, now, props, false)),
      shoulder: shoulder ? { from: this.subject(shoulder, end, props, false), now: this.subject(shoulder, now, props, false) } : undefined,
      line: lineOf ? [this.subject(lineOf[0], now, props, false), this.subject(lineOf[1], now, props, false)] : undefined,
      side: at.scene.side ?? 1,
      south: at.scene.place === 'pen',
      aspect: size.width / Math.max(1, size.height),
      u: (t - at.start) / at.shot.len,
      secs: t - at.start,
      reduced,
    })
    const seen = [view.look, ...on.map((n) => this.subject(n, now, props, false)).map((x) => new Vector3(x.x, x.person ? x.head : x.y, x.z))]
    if (shoulder) {
      const n = this.subject(shoulder, now, props, false)
      seen.push(new Vector3(n.x, n.head, n.z))
    }
    return { view, seen }
  }

  /** What a shot needs of the set (`ShotSet`), worked out from its camera at its start, middle and end. */
  private shotSet(at: ShotAt, size: { width: number; height: number }, reduced: boolean): ShotSet {
    const key = `${at.index}|${(size.width / Math.max(1, size.height)).toFixed(2)}|${reduced}`
    let set = this.sets.get(key)
    if (set) return set
    const walls = new Set<number>()
    const fence = new Set<number>()
    const named = [...(at.scene.open ?? []), ...(at.shot.open ?? [])]
    let mid: ReturnType<FilmStage['viewOf']> | null = null
    for (const k of [0.02, 0.5, 0.98]) {
      const v = this.viewOf(at.start + at.shot.len * k, size, reduced)
      if (k === 0.5) mid = v
      if (this.market) for (const i of this.wallsOut(v.view.pos, v.seen, named)) walls.add(i)
      if (this.pen) for (const i of this.pen.inTheWay(v.view.pos, v.seen)) fence.add(i)
    }
    // outdoors (the pen, or a camera outside the market's rooms), the sun round the subjects for the shot's size
    let sun: ShotSet['sun'] = null
    const eye = mid!.view.pos
    const inside = [HALL, BACK].some((r) => eye.x > r.x0 && eye.x < r.x1 && eye.z > r.z0 && eye.z < r.z1)
    if (at.scene.place === 'pen' || !inside) {
      const look = mid!.view.look
      const toward = new Vector3(eye.x - look.x, 0, eye.z - look.z).normalize()
      const sz = at.shot.cam.size ?? 'medium'
      const a = ((at.scene.side ?? 1) * SUN_ROUND[sz] * Math.PI) / 180
      const flat = new Vector3(toward.x * Math.cos(a) + toward.z * Math.sin(a), 0, -toward.x * Math.sin(a) + toward.z * Math.cos(a))
      const up = (SUN_HIGH[at.scene.light] * Math.PI) / 180
      sun = { at: new Vector3(look.x, 0, look.z), from: flat.multiplyScalar(Math.cos(up)).setY(Math.sin(up)), box: SHADOW_BOX[sz] }
    }
    set = { walls: [...walls].sort((x, y) => x - y), fence: [...fence].sort((x, y) => x - y), sun }
    this.sets.set(key, set)
    return set
  }

  /** The sun for a shot: outdoors where the shot places it (its shadow's box round the subjects), else over the place. */
  private placeSun(set: ShotSet, place: keyof typeof SUN_AT) {
    const cam = this.sun.shadow.camera
    if (!set.sun) {
      this.aimSun(place)
      if (cam.right !== 14) {
        Object.assign(cam, { left: -14, right: 14, top: 14, bottom: -14 })
        cam.updateProjectionMatrix()
      }
      return
    }
    const { at, from, box } = set.sun
    this.sun.position.copy(at).addScaledVector(from, 24)
    this.sun.target.position.copy(at)
    this.sun.target.updateMatrixWorld()
    if (cam.right !== box) {
      Object.assign(cam, { left: -box, right: box, top: box, bottom: -box })
      cam.updateProjectionMatrix()
    }
  }

  /** The world's effects going on at film time t: each where it happened (stars round a head, following it). */
  private bursts(t: number): Burst[] {
    const tl = this.tl
    const out: Burst[] = []
    tl.fx.forEach((f, i) => {
      const fx = f.item.fx as WorldFx
      if (!WORLD_FX.includes(fx) || !f.item.on || t < f.t || t > f.t + 2.4) return
      const w0 = tl.world(f.t)
      const place = this.placeOf(f.item.on, fx === 'stars' ? tl.world(t) : w0)
      if (place) out.push({ fx, age: tl.world(t) - w0, at: place.at, mid: place.mid, seed: i + 1 })
    })
    return out
  }

  /** Where a cast member, a prop or a thing is at world time w: its foot, and its middle's (a person: their head's)
   *  height over it. */
  private placeOf(id: string, w: number): { at: Vector3; mid: number } | null {
    const tl = this.tl
    if (tl.film.cast[id]) {
      const m = memberAt(tl, id, w)
      const a = this.animals.find((x) => x.id === id)
      const mid = a && this.pen ? bodyOf(this.pen.kind, a.n).y : (lookOf(tl.film.cast[id].look, this.outfit).height ?? 1) * (HEAD - 0.1)
      return { at: new Vector3(m.x, m.y, m.z), mid }
    }
    if (tl.film.props[id]) {
      const p = propAt(tl, id, w)
      const now = new Map<string, MemberNow>()
      if (p.holder) now.set(p.holder, memberAt(tl, p.holder, w))
      const f = this.pen?.frameOf(id, p, now)
      if (f) return { at: new Vector3(f.x, 0, f.z), mid: f.y }
      return { at: new Vector3(p.x, p.y, p.z), mid: 0.3 }
    }
    const t = THINGS_AT[id]
    return t ? { at: new Vector3(t.x, 0, t.z), mid: t.y } : null
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
    for (const a of this.animals) now.set(a.id, memberAt(tl, a.id, w))
    this.pen?.animals(this.animals, now, w)
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
    if (this.leaves) putSlidingDoor(this.leaves, d, open)
    // the camera: placed for where everyone is at the shot's end (a walk ends in the picture), looking where they are now
    const ws = tl.world(at.end - 1e-3)
    const startNow = new Map<string, MemberNow>()
    for (const c of [...this.cast, ...this.animals]) startNow.set(c.id, memberAt(tl, c.id, ws))
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
      south: scene.place === 'pen',
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
    // the shot's set: the walls and fence sections out of its way, the sun where it stands (the same all through it)
    const set = this.shotSet(at, size, reduced)
    if (this.market) this.shell(set.walls)
    this.pen?.fences(set.fence)
    this.placeSun(set, scene.place)
    // the world's effects, and outdoors by day the air's motes round what the shot looks at
    camera.updateMatrixWorld()
    const day = scene.light !== 'night' && !!set.sun
    this.sparks.draw(this.bursts(t), camera, day ? view.look : null, day ? 1 : 0, w)
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
    // the subjects' light: a key on whoever (and whatever) the shot is on, a rim behind them in a near shot; a wide shot
    // is the sun's and the sky's alone. (the rim only where faces are big: in a full shot it lights more of the set than
    // of them; the key steps back where the open case's gold is the light on them)
    const sized = cam.size ?? 'medium'
    const lit = sized === 'wide' ? [] : on.filter((n) => (tl.film.cast[n] ? now.get(n)?.visible : true)).map((n) => this.subject(n, now, props, true))
    const near = ['extreme', 'close', 'medium'].includes(sized)
    const keyed = this.portrait(lit, camera.position, scene.light, scene.side ?? 1, near, 1 - 0.65 * this.caseGlow)
    const p = PORTRAIT[scene.light]
    // (the light round them steps back while they are keyed: outdoors the sky's fill a little, the sun not at all — it is
    // their rim; indoors as the portrait has it)
    const out = !!set.sun
    this.hemi.intensity = this.fill * (keyed ? (out ? 0.8 : p.fill) : 1)
    this.sun.intensity = this.sunlight * (keyed && !out ? p.sun : 1)
    this.rooms.forEach((r, i) => (r.intensity = MARKET_WALKIN.lights[i].intensity * this.roomsOn[i] * (keyed ? p.rooms : 1)))
    camera.getWorldDirection(this.dir)
    // the first subject on the screen (an iris closes on it)
    let focus: FrameInfo['focus'] = null
    if (on.length) {
      const f = this.subject(on[0], now, props, true)
      const q = new Vector3(f.x, f.person ? f.head - 0.1 : f.y, f.z).project(camera)
      if (q.z < 1) focus = { x: ((q.x + 1) / 2) * size.width, y: ((1 - q.y) / 2) * size.height }
    }
    return { shot: at.index, portrait: keyed ? 1 : 0.55, speaker, focus, light: scene.light, farm: looksAtFarm(camera.position, this.dir), blocked: this.blocking(on, now, props, camera.position) }
  }

  /** Who of the cast not filmed stands across the line from the camera to the first subject's middle (their body as an
   *  upright cylinder), hiding it. */
  private blocking(on: string[], now: Map<string, MemberNow>, props: Map<string, PropNow>, eye: Vector3) {
    // (a place framed wide is not hidden by whoever crosses it)
    if (!on.length || THINGS_AT[on[0]]) return null
    const s = this.subject(on[0], now, props, false)
    const to = new Vector3(s.x, s.person ? s.head - 0.25 : s.y, s.z)
    for (const [id, m] of now) {
      if (on.includes(id) || !m.visible) continue
      const a = this.animals.find((x) => x.id === id)
      const body = a && this.pen ? bodyOf(this.pen.kind, a.n) : null
      const r = body ? body.w / 2 : 0.22
      const top = body ? body.h : 1.7
      // the nearest point of the line to their middle, on the ground; and the line's height there
      const dx = to.x - eye.x
      const dz = to.z - eye.z
      const k = Math.max(0, Math.min(1, ((m.x - eye.x) * dx + (m.z - eye.z) * dz) / (dx * dx + dz * dz || 1)))
      if (k < 0.05 || k > 0.92) continue
      const y = eye.y + (to.y - eye.y) * k
      if (Math.hypot(eye.x + dx * k - m.x, eye.z + dz * k - m.z) < r * 0.8 && y < top + m.y && y > m.y) return this.tl.film.cast[id].name
    }
    return null
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
      if (kind === 'crate' || kind === 'tool' || kind === 'piece' || kind === 'nestbox')
        this.pen?.props(
          id,
          p,
          now,
          (who) => this.handsOf(who, now),
          (who) => this.headOf(who),
        )
      else if (kind === 'case') {
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
        if (fill !== this.filled && this.goods) {
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
    for (const p of [this.people, this.fittings, this.leaves, ...this.shells.values()]) p?.dispose()
    this.pen?.dispose()
    this.sparks.dispose()
    this.root.traverse((o: Object3D) => {
      const mesh = o as Mesh
      mesh.geometry?.dispose?.()
    })
    this.goods?.dispose()
  }
}
