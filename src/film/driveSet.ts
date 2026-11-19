import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type Material,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Sky } from 'three/addons/objects/Sky.js'
import { HOUSE } from '../data/layout'
import { COUNTRY_LANE, COUNTRY_TREES, DRIVE, GARDEN_TREE, HILLS, PLOT } from '../data/home'
import { BAYS, KERB, PARKING, PARKING_SIGN } from '../data/estate'
import { barnModel, siloModel } from '../models/buildings'
import { CAR_CABIN, CAR_LAMPS, CAR_SHAPE, putRollingCar, rollingCarParts, type RollingCarPart } from '../models/car'
import { structureParts } from '../models/structures'
import { surface } from '../lib/proceduralTextures'
import type { Parts } from '../lib/sculpt'
import { fenceRun, foliage, mulberry } from '../scene/flora'
import { NOON, TINT, skySun, tint } from '../scene/Lighting'
import { EYE, ROAD, type DriveFilm, type Moment, type SetId } from './drive'
import { drivePaint } from './drivePaint'

// The drive film's little world (./drive.ts says what happens in it): the farm's parking lot, the country road and the
// house's driveway, each a handful of draws, with the car on its rolling wheels and, for the shot from the driver's seat,
// the inside of its cabin round the windscreen: the dashboard with the clock, the wheel, the pillars, the mirror. Its
// light is the game's for the hour (src/scene/Lighting.tsx: the sun's, the sky's, the haze's colours and the sky's own
// sun, from the day's mood), its sky the same kind of sky, its ambient light the game's own environment; at night the
// headlamps light the road. Drawn on the game's own renderer by ./DriveFilm.tsx, one set at a time (the others hidden).
// Plain geometry and colours: the whole of it is a few tens of thousands of triangles in about forty draws, of which a
// shot draws a third.

/** A geometry painted one colour (vertex colours), unindexed so it merges with others. */
function paint(g: BufferGeometry, color: string | Color): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g
  const c = new Color(color)
  const n = out.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3)
  out.setAttribute('color', new Float32BufferAttribute(a, 3))
  if (out.getAttribute('uv')) out.deleteAttribute('uv')
  return out
}

const merged = (parts: BufferGeometry[]) => mergeGeometries(parts)!

/** A box of size (w, h, d) with its middle at (x, y, z), turned `turn` about y, painted. */
function block(w: number, h: number, d: number, x: number, y: number, z: number, color: string, turn = 0): BufferGeometry {
  const g = new BoxGeometry(w, h, d)
  if (turn) g.rotateY(turn)
  g.translate(x, y, z)
  return paint(g, color)
}

/** A flat rectangle on the ground (x0..x1, z0..z1) a hair over it, painted. */
function patch(x0: number, x1: number, z0: number, z1: number, y: number, color: string): BufferGeometry {
  const g = new PlaneGeometry(x1 - x0, z1 - z0)
  g.rotateX(-Math.PI / 2)
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2)
  return paint(g, color)
}

const lit = (o: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, ...o })

/** A countryside tree, light: a trunk and a crown of two or three leafy lumps (the farm's broadleaf, in a few hundred
 *  triangles), painted, its foot at (x, z). */
function tree(x: number, z: number, h: number, seed: number): { trunk: BufferGeometry; crown: BufferGeometry } {
  const r = mulberry(seed)
  const trunkH = h * 0.45
  const trunk = new CylinderGeometry(h * 0.018, h * 0.03, trunkH, 6, 1)
  trunk.translate(x, trunkH / 2, z)
  const lumps: BufferGeometry[] = []
  const shades = ['#5d7d43', '#6f8a46', '#4f6e3f']
  const shade = new Color(shades[Math.floor(r() * 3)])
  const n = 2 + Math.floor(r() * 2)
  for (let i = 0; i < n; i++) {
    const rad = h * (0.2 + r() * 0.08)
    const b = foliage(new IcosahedronGeometry(1, 1), seed * 7 + i, 0.16, 0.9)
    b.deleteAttribute('uv')
    b.scale(rad * 1.25, rad * 0.75, rad * 1.25)
    const a = (i / n) * Math.PI * 2 + r()
    const out = i === 0 ? 0 : h * 0.15
    b.translate(x + Math.cos(a) * out, trunkH + h * 0.18 + (i === 0 ? h * 0.06 : (r() - 0.5) * h * 0.1), z + Math.sin(a) * out)
    lumps.push(paint(b, shade.clone().offsetHSL(0, 0, (r() - 0.5) * 0.06)))
  }
  return { trunk: paint(trunk, '#6a5a4c'), crown: merged(lumps) }
}

/** Trees as two draws: their trunks, their crowns. */
function grove(list: [number, number, number][], seed: number, crownMat: Material, trunkMat: Material): Group {
  const made = list.map(([x, z, h], i) => tree(x, z, h, seed + i))
  const g = new Group()
  g.add(new Mesh(merged(made.map((t) => t.trunk)), trunkMat), new Mesh(merged(made.map((t) => t.crown)), crownMat))
  return g
}

/** Low hills on the horizon (x, z, radius along x and z, height, colour), one draw. */
function hills(list: readonly (readonly [number, number, number, number, number, string])[], mat: Material): Mesh {
  return new Mesh(
    merged(
      list.map(([x, z, rx, rz, h, color]) => {
        const g = new SphereGeometry(1, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2)
        g.scale(rx, h, rz)
        g.translate(x, -1.5, z)
        return paint(g, color)
      }),
    ),
    mat,
  )
}

/** A canvas for a picture drawn in the film (the clock, the signpost), as a texture. */
function canvasTexture(w: number, h: number): { ctx: CanvasRenderingContext2D; tex: CanvasTexture } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return { ctx: c.getContext('2d')!, tex }
}

/** A picture of the game's (src/ui/art.ts), loaded once. */
const pictures = new Map<string, Promise<HTMLImageElement | null>>()
export function picture(url: string): Promise<HTMLImageElement | null> {
  let p = pictures.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    pictures.set(url, p)
  }
  return p
}

/** What the film shows that changes with the drive: the hour on the dashboard (the day phase's picture and hh:mm, as
 *  the day chip has them) and the signpost (where you are going: its picture and name). */
export interface Labels {
  clock: string
  clockArt: HTMLImageElement | null
  to: string
  toArt: HTMLImageElement | null
}

/** The day's light for the film: the mood (src/farm/day.ts, moodAt) and whether the headlamps are on. */
export interface Light {
  sun: number
  warm: number
  sky: number
  night: boolean
}

export class DriveSet {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(40, 1, 0.05, 1200)
  private readonly sets: Record<SetId, Group>
  private readonly car: Parts<RollingCarPart>
  /** where the car is and its heading; in it, its body as it sits on its springs, and what rides on the body (the
   *  lamps' glow, the beams, the headlamps' light, the cabin) */
  private readonly body = new Group()
  private readonly sway = new Group()
  private readonly cabin: Group
  private readonly beams: Mesh
  private readonly headGlow: MeshBasicMaterial
  private readonly tailGlow: MeshBasicMaterial
  private readonly headlamp: SpotLight
  private readonly sun = new DirectionalLight('#ffffff', 2.5)
  private readonly hemi = new HemisphereLight('#ffffff', '#4a3d32', 0.3)
  private readonly sky = new Sky()
  private readonly fog = new FogExp2('#aab4c0', 0.0065)
  private readonly clock = canvasTexture(512, 160)
  private readonly sign = canvasTexture(512, 256)
  private readonly windows: MeshStandardMaterial
  private readonly disposables: { dispose(): void }[] = []
  private readonly root = new Object3D()

  constructor() {
    const s = this.scene
    s.fog = this.fog
    s.add(this.root)
    this.sky.scale.setScalar(900)
    const u = (this.sky.material as unknown as { uniforms: Record<string, { value: unknown }> }).uniforms
    // the game's sky (src/scene/Lighting.tsx), no clouds
    u.turbidity.value = 3
    u.rayleigh.value = 1.3
    u.mieCoefficient.value = 0.004
    u.mieDirectionalG.value = 0.85
    if (u.cloudCoverage) u.cloudCoverage.value = 0
    this.root.add(this.sky, this.hemi, this.sun, this.sun.target)

    const grass = surface('grass', 220, 220)
    this.disposables.push(grass.map, grass.normalMap, grass.roughnessMap)
    const ground = new MeshStandardMaterial({ map: grass.map, normalMap: grass.normalMap, roughness: 1, color: '#c9d4b0' })
    const flat = lit({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    const lines = lit({ roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    const solid = lit({ roughness: 0.85 })
    // (trees' crowns and trunks, and the hills: all matte)
    const crowns = lit({ roughness: 1 })
    const trunks = crowns
    const land = crowns
    this.windows = new MeshStandardMaterial({ color: '#2e3b44', roughness: 0.15, metalness: 0.2, emissive: '#ffcf8a', emissiveIntensity: 0 })
    this.disposables.push(ground, flat, lines, solid, crowns, this.windows)

    const plane = (w: number, d: number, x: number, z: number) => {
      const m = new Mesh(new PlaneGeometry(w, d), ground)
      m.rotation.x = -Math.PI / 2
      m.position.set(x, -0.02, z)
      return m
    }

    // ── the country road ──
    const road = new Group()
    {
      const half = ROAD.width / 2
      const x0 = -90
      const x1 = 420
      const parts: BufferGeometry[] = [patch(x0, x1, ROAD.z - half - 0.6, ROAD.z + half + 0.6, -0.008, '#a99a80'), patch(x0, x1, ROAD.z - half, ROAD.z + half, -0.004, '#5a5d60')]
      const marks: BufferGeometry[] = []
      // its edges, and the dashes down the middle
      for (const e of [-1, 1]) marks.push(patch(x0, x1, ROAD.z + e * (half - 0.25) - 0.06, ROAD.z + e * (half - 0.25) + 0.06, 0, '#e9e5d8'))
      for (let x = x0; x < x1; x += 9) marks.push(patch(x, x + 3, ROAD.z - 0.06, ROAD.z + 0.06, 0, '#efe6c2'))
      const way = new Mesh(merged(parts), flat)
      const paint_ = new Mesh(merged(marks), lines)
      // a post-and-rail fence along the far verge, and fields and hills beyond
      const fence: BufferGeometry[] = []
      const fz = ROAD.z - half - 4.2
      for (let x = x0; x < x1; x += 3.2) fence.push(block(0.12, 1.1, 0.12, x, 0.55, fz, '#7a6048'))
      for (const y of [0.45, 0.85]) fence.push(block(x1 - x0, 0.08, 0.05, (x0 + x1) / 2, y, fz, '#806650'))
      const fields: BufferGeometry[] = [
        patch(-20, 70, fz - 40, fz - 1, -0.012, '#b8ad62'),
        patch(70, 160, fz - 34, fz - 1, -0.012, '#93a85c'),
        patch(160, 260, fz - 44, fz - 1, -0.012, '#c4b36c'),
        patch(-10, 90, ROAD.z + half + 14, ROAD.z + half + 60, -0.012, '#a9b46b'),
        patch(120, 240, ROAD.z + half + 10, ROAD.z + half + 50, -0.012, '#bfa860'),
      ]
      const r = mulberry(7)
      const trees: [number, number, number][] = []
      for (let x = x0 + 10; x < 360; x += 9 + r() * 14) {
        const side = r() < 0.5 ? -1 : 1
        const off = side < 0 ? 7 + r() * 26 : 6.5 + r() * 30
        trees.push([x, ROAD.z + side * (half + off), 6 + r() * 4])
      }
      // a row along the far verge where the car passes (behind it, seen from beside the road), and a few near the road
      // on its right, close enough to whip past the driver's window
      for (let x = -10; x < 140; x += 7 + r() * 6) trees.push([x, ROAD.z - half - 6 - r() * 5, 6.5 + r() * 3])
      for (let x = 30; x < 120; x += 17 + r() * 8) trees.push([x, ROAD.z + half + 3 + r() * 2, 6.5 + r() * 2])
      road.add(
        plane(900, 700, 160, 0),
        way,
        paint_,
        new Mesh(merged(fence), solid),
        new Mesh(merged(fields), flat),
        grove(trees, 200, crowns, trunks),
        hills(
          [
            [60, -170, 120, 50, 22, '#6f8c52'],
            [240, -150, 110, 60, 18, '#86a061'],
            [380, -60, 90, 120, 24, '#728d55'],
            [200, 170, 140, 60, 20, '#7f9a5b'],
            [-60, 150, 110, 50, 15, '#86a061'],
            [-180, -40, 80, 120, 20, '#6f8c52'],
          ],
          land,
        ),
      )
      this.signpost = this.makeSign(solid)
      road.add(this.signpost)
    }

    // ── the farm's parking lot (src/data/estate.ts), the lane past it, the garden's fence, the market across it ──
    const lot = new Group()
    {
      const parts: BufferGeometry[] = [
        // the lane, the lot's asphalt, its bays' lines, its kerb
        patch(-90, 90, 15 - 1.3, 15 + 1.3, -0.01, '#b8aa8c'),
        patch(PARKING.x0, PARKING.x1, PARKING.z0, PARKING.z1, -0.004, '#45484b'),
      ]
      const marks: BufferGeometry[] = []
      const line = 0.08
      for (const b of BAYS) {
        marks.push(patch(b.x0, b.x0 + line, b.z0, b.z1, 0, '#eeeae0'), patch(b.x1 - line, b.x1, b.z0, b.z1, 0, '#eeeae0'), patch(b.x0, b.x1, b.z1 - line, b.z1, 0, '#eeeae0'))
      }
      const kerb = [
        block(PARKING.x1 - PARKING.x0, KERB.h, KERB.w, (PARKING.x0 + PARKING.x1) / 2, KERB.h / 2, PARKING.z0 + KERB.w / 2, '#b9b6ae'),
        block(KERB.w, KERB.h, PARKING.z1 - PARKING.z0, PARKING.x0 + KERB.w / 2, KERB.h / 2, (PARKING.z0 + PARKING.z1) / 2, '#b9b6ae'),
      ]
      // the parking sign: a post and a blue plate (its P a picture of its own)
      const sign = [block(0.07, PARKING_SIGN.y + 0.25, 0.07, PARKING_SIGN.x, (PARKING_SIGN.y + 0.25) / 2, PARKING_SIGN.z, '#8d9399')]
      // the garden's fence along the lot, and the farm's yard beyond it
      const fence = [...fenceRun('x', PARKING.z0 - 0.15, -60, 4.95), ...fenceRun('x', PARKING.z0 - 0.15, 6.25, 60)].map((g) => paint(g, '#7a6048'))
      // the gate's posts
      fence.push(block(0.16, 1.4, 0.16, 4.95, 0.7, PARKING.z0 - 0.15, '#5b4636'), block(0.16, 1.4, 0.16, 6.25, 0.7, PARKING.z0 - 0.15, '#5b4636'))
      // the market across the lane: the estate office's weatherboards, the hall's bricks (plain blocks: they stand in
      // the haze at the edge of the picture)
      const market = [
        // the estate office: its weatherboards, its navy door, its sign over it, its window
        block(2.6, 2.9, 2.4, 4.75, 1.45, 17.5, '#e9dfc8'),
        block(2.7, 0.12, 2.5, 4.75, 2.95, 17.5, '#f4efe4'),
        block(0.9, 2.1, 0.06, 4.65, 1.05, 16.28, '#22344f'),
        block(2.3, 0.5, 0.06, 4.75, 2.56, 16.28, '#2c4a6b'),
        block(0.6, 1.0, 0.05, 5.55, 1.35, 16.28, '#3a4a55'),
        // the market's hall beyond it: brick, a white band under its roof's edge, its shop window
        block(14, 4.2, 12, 13.1, 2.1, 22.3, '#a4553f'),
        block(14.2, 0.35, 12.2, 13.1, 4.25, 22.3, '#efe9dc'),
        block(5, 1.8, 0.06, 10, 1.4, 16.27, '#40525e'),
      ]
      const r = mulberry(31)
      const trees: [number, number, number][] = []
      for (let k = 0; k < 9; k++) trees.push([-40 + k * 9 + r() * 5, 4 - r() * 18, 6 + r() * 3])
      for (let k = 0; k < 5; k++) trees.push([-40 + k * 8 + r() * 4, 24 + r() * 10, 6 + r() * 3])
      lot.add(
        plane(400, 400, 0, 10),
        new Mesh(merged(parts), flat),
        new Mesh(merged(marks), lines),
        new Mesh(merged([...kerb, ...sign, ...fence, ...market]), solid),
        grove(trees, 300, crowns, trunks),
        hills(HILLS, land),
      )
      // the farm's silo and barn in the yard behind the fence (the game's own models; where the player keeps them is
      // theirs, so here they stand where the lot's camera sees them)
      const silo = structureParts(siloModel(), 'silo')
      silo.group.position.set(-6, 0, 6)
      const barn = structureParts(barnModel(), 'barn')
      barn.group.position.set(-13.5, 0, 4.5)
      barn.group.rotation.y = 0.5
      lot.add(silo.group, barn.group)
      this.disposables.push(silo, barn)
      const plate = canvasTexture(64, 64)
      plate.ctx.fillStyle = '#2b5fa8'
      plate.ctx.fillRect(0, 0, 64, 64)
      plate.ctx.fillStyle = '#ffffff'
      plate.ctx.font = '800 48px "Nunito Variable", sans-serif'
      plate.ctx.textAlign = 'center'
      plate.ctx.textBaseline = 'middle'
      plate.ctx.fillText('P', 32, 35)
      // (facing east along the lane, the way you come from the gate; its back grey)
      const face = new Mesh(new PlaneGeometry(PARKING_SIGN.half[0] * 2, PARKING_SIGN.half[1] * 2), new MeshStandardMaterial({ map: plate.tex, roughness: 0.6 }))
      face.position.set(PARKING_SIGN.x + 0.02, PARKING_SIGN.y, PARKING_SIGN.z)
      face.rotation.y = Math.PI / 2
      lot.add(face, new Mesh(block(0.03, PARKING_SIGN.half[1] * 2 + 0.02, PARKING_SIGN.half[0] * 2 + 0.02, PARKING_SIGN.x, PARKING_SIGN.y, PARKING_SIGN.z, '#9aa0a6'), solid))
      this.disposables.push(plate.tex, face.material as Material)
    }

    // ── the house on its plot (src/data/home.ts), its driveway out through the gate to the country lane ──
    const home = new Group()
    {
      const ground_: BufferGeometry[] = [
        patch(HOUSE.minX - 1.6, HOUSE.maxX + 1.6, HOUSE.minZ - 1.6, HOUSE.maxZ + 1.6, -0.012, '#9a9c98'),
        patch(DRIVE.minX, DRIVE.maxX, DRIVE.minZ, DRIVE.maxZ, -0.006, '#c9bfae'),
        patch(COUNTRY_LANE.x - COUNTRY_LANE.width / 2, COUNTRY_LANE.x + COUNTRY_LANE.width / 2, -120, 120, -0.009, '#b3a184'),
      ]
      // the house: its walls, the parapet round its flat roof, the roof, the frames round its windows (a stand-in for
      // the house, seen across the garden: its size, its colour, its windows where the game has them)
      const H = HOUSE.wallHeight
      const w = HOUSE.maxX - HOUSE.minX
      const d = HOUSE.maxZ - HOUSE.minZ
      const shell = [block(w, H, d, 0, H / 2, 0, '#ece6d8'), block(w + 0.2, 0.32, d + 0.2, 0, H + 0.1, 0, '#f4f0e6'), block(w - 0.2, 0.05, d - 0.2, 0, H + 0.22, 0, '#7d7a74')]
      // windows on the east and south walls, which the lane and the driveway see; and the front door by the drive
      const panes: BufferGeometry[] = []
      const frames: BufferGeometry[] = []
      const win = (axis: 'x' | 'z', at: number, centre: number, width: number, sill: number, top: number) => {
        const h = top - sill
        const out = Math.sign(at) * 0.02
        if (axis === 'z') {
          frames.push(block(0.06, h + 0.16, width + 0.16, at + out, sill + h / 2, centre, '#ffffff'))
          panes.push(block(0.04, h, width, at + out * 2.2, sill + h / 2, centre, '#2e3b44'))
        } else {
          frames.push(block(width + 0.16, h + 0.16, 0.06, centre, sill + h / 2, at + out, '#ffffff'))
          panes.push(block(width, h, 0.04, centre, sill + h / 2, at + out * 2.2, '#2e3b44'))
        }
      }
      win('z', HOUSE.maxX, 5.0, 1.3, 0.9, 2.2)
      win('z', HOUSE.maxX, -2.6, 1.6, 0.9, 2.2)
      win('z', HOUSE.maxX, 1.6, 1.0, 0, 2.1)
      win('x', HOUSE.maxZ, -1.2, 1.5, 0, 2.2)
      win('x', HOUSE.maxZ, 1.7, 1.4, 0.9, 2.2)
      win('x', HOUSE.maxZ, 4.6, 1.2, 0.9, 2.2)
      // the plot's fence, the gate in the east fence standing open, swung in against the fence
      const { minX, maxX, minZ, maxZ } = PLOT
      const fence = [
        ...fenceRun('x', minZ, minX, maxX),
        ...fenceRun('x', maxZ, minX, maxX),
        ...fenceRun('z', minX, minZ, maxZ),
        ...fenceRun('z', maxX, minZ, DRIVE.minZ),
        ...fenceRun('z', maxX, DRIVE.maxZ, maxZ),
      ].map((g) => paint(g, '#7a6048'))
      const gw = DRIVE.maxZ - DRIVE.minZ
      for (const s_ of [-1, 1]) fence.push(block(0.14, 1.35, 0.14, maxX, 0.675, (DRIVE.minZ + DRIVE.maxZ) / 2 + (s_ * gw) / 2, '#5b4636'))
      for (const y of [0.25, 0.45, 0.65, 0.85, 1.05]) fence.push(block(gw - 0.2, 0.09, 0.05, maxX - 0.15 - (gw - 0.2) / 2, y, DRIVE.minZ - 0.12, '#7a6048'))
      const trees = grove(
        [...COUNTRY_TREES, GARDEN_TREE].map(([x, z, h]) => [x, z, h] as [number, number, number]),
        70,
        crowns,
        trunks,
      )
      home.add(plane(400, 400, 0, 0), new Mesh(merged(ground_), flat), new Mesh(merged([...shell, ...frames, ...fence]), solid), new Mesh(merged(panes), this.windows), trees, hills(HILLS, land))
    }

    this.sets = { road, lot, home }
    for (const g of Object.values(this.sets)) this.root.add(g)

    // ── the car, its lamps' glow and beams, its headlamps' light, and the inside of its cabin ──
    this.car = rollingCarParts()
    this.body.add(this.sway)
    this.root.add(this.car.group, this.body)
    this.headGlow = new MeshBasicMaterial({ color: '#fff6dc', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
    this.tailGlow = new MeshBasicMaterial({ color: '#ff3b2a', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
    const lens = new SphereGeometry(1, 10, 6)
    for (const [list, mat] of [
      [CAR_LAMPS.head, this.headGlow],
      [CAR_LAMPS.tail, this.tailGlow],
    ] as const)
      for (const l of list) {
        const m = new Mesh(lens, mat)
        m.position.set(l.x, l.y, l.z)
        m.scale.set(l.half[0] * 1.08, l.half[1] * 1.15, l.half[2] * 1.15)
        m.renderOrder = 2
        this.sway.add(m)
      }
    // the beams in the night's haze: two long faint cones from the headlamps
    const cone = new ConeGeometry(1.2, 7, 16, 1, true)
    cone.translate(0, -3.5, 0)
    cone.rotateX(-Math.PI / 2 - 0.05)
    const beamMat = new MeshBasicMaterial({ color: '#fff1c8', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false })
    this.beams = new Mesh(merged(CAR_LAMPS.head.map((l) => cone.clone().translate(l.x, l.y, l.z + 0.05))), beamMat)
    this.beams.renderOrder = 3
    this.sway.add(this.beams)
    this.headlamp = new SpotLight('#fff1d6', 0, 60, 0.42, 0.55, 1.6)
    this.headlamp.position.set(0, 0.66, CAR_SHAPE.length / 2)
    this.headlamp.target.position.set(0, -0.6, CAR_SHAPE.length / 2 + 14)
    this.sway.add(this.headlamp, this.headlamp.target)
    this.cabin = this.makeCabin()
    this.sway.add(this.cabin)
    this.disposables.push(lens, cone, beamMat, this.headGlow, this.tailGlow, this.clock.tex, this.sign.tex, this.car)
  }

  private signpost: Group

  /** The signpost on the road's right-hand verge: a post and a board facing the oncoming car, with the destination's
   *  picture and name (drawn by `label`). */
  private makeSign(post: Material): Group {
    const g = new Group()
    const pole = new Mesh(paint(new BoxGeometry(0.12, 2.3, 0.12).translate(0, 1.15, 0), '#6f675e'), post)
    const board = new Mesh(new PlaneGeometry(2.2, 1.1), new MeshStandardMaterial({ map: this.sign.tex, roughness: 0.55 }))
    board.position.set(0, 1.75, 0.08)
    const back = new Mesh(paint(new BoxGeometry(2.28, 1.18, 0.06).translate(0, 1.75, 0.02), '#e9e2d0'), post)
    g.add(pole, back, board)
    this.disposables.push(board.material as Material, board.geometry)
    return g
  }

  /** The inside of the cabin round the driver's view: the dashboard under the windscreen, the clock's screen standing on
   *  it in front of the driver, the wheel, the pillars either side of the windscreen, the roof's lining, the mirror, the
   *  doors' tops. (The car's own body is drawn from outside only: from in here it is not there, and the world shows
   *  through its glass.) */
  private makeCabin(): Group {
    const g = new Group()
    const { screenFoot: foot, screenTop: top, halfWidth: half, roof, driver } = CAR_CABIN
    const trim = new MeshStandardMaterial({ color: '#33363a', roughness: 0.75 })
    const lining = new MeshStandardMaterial({ color: '#9a9286', roughness: 0.95 })
    const dash: BufferGeometry[] = []
    // the dashboard: from the windscreen's foot back towards the driver, its top just under the glass
    const back = EYE.z + 0.6
    dash.push(new BoxGeometry(half * 2 - 0.06, 0.34, foot.z - back + 0.04).translate(0, foot.y - 0.2, (foot.z + back) / 2))
    // under it, the footwell and the seat's front in the dark, across the cabin to the driver's knees
    dash.push(new BoxGeometry(half * 2 - 0.06, 0.3, back - EYE.z + 0.1).translate(0, foot.y - 0.21, (back + EYE.z) / 2 + 0.05))
    // the doors' tops along either side, under the side windows
    for (const sx of [-1, 1]) dash.push(new BoxGeometry(0.1, 0.07, 1.7).translate(sx * (half - 0.03), foot.y - 0.08, foot.z - 0.95))
    // the pillars either side of the windscreen, from its foot to the roof's front, leaning back with it
    const width = (y: number) => half - 0.13 * ((y - foot.y) / (top.y - foot.y)) * 0.75
    for (const sx of [-1, 1]) {
      const a = new Vector3(sx * (width(foot.y) - 0.04), foot.y - 0.03, foot.z + 0.01)
      const b = new Vector3(sx * (width(top.y) - 0.06), roof - 0.05, top.z - 0.08)
      const len = a.distanceTo(b)
      const p = new BoxGeometry(0.08, len, 0.06)
      p.rotateX(Math.atan2(b.z - a.z, b.y - a.y))
      p.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
      dash.push(p)
    }
    // the clock's screen, standing on the dashboard in front of the driver
    const screenZ = back + 0.12
    dash.push(new BoxGeometry(0.42, 0.14, 0.03).translate(driver, foot.y + 0.04, screenZ + 0.018))
    const inside = new Mesh(mergeGeometries(dash.map((d) => d.toNonIndexed()))!, trim)
    // the roof's lining, and the mirror under its front on a short stem
    const liner = new Mesh(
      mergeGeometries(
        [
          new BoxGeometry(half * 2 - 0.12, 0.03, 1.8).translate(0, roof - 0.05, top.z - 0.98),
          new BoxGeometry(0.22, 0.065, 0.03).translate(0, top.y - 0.05, top.z - 0.1),
          new BoxGeometry(0.02, 0.08, 0.02).translate(0, top.y + 0.01, top.z - 0.08),
        ].map((d) => d.toNonIndexed()),
      )!,
      lining,
    )
    // the wheel: a rim leaning back towards the driver, three spokes to its hub, low in front of the clock
    const rim = new TorusGeometry(0.17, 0.018, 8, 32)
    const hub = new CylinderGeometry(0.045, 0.05, 0.04, 12).rotateX(Math.PI / 2)
    const spokes = [Math.PI / 2, Math.PI / 2 + 2.1, Math.PI / 2 - 2.1].map((a) => new BoxGeometry(0.15, 0.028, 0.014).translate(0.075, 0, 0).rotateZ(a + Math.PI))
    const wheel = mergeGeometries([rim, hub, ...spokes].map((d) => (d.index ? d.toNonIndexed() : d)))!
    wheel.rotateX(-0.45)
    wheel.translate(driver, foot.y - 0.075, EYE.z + 0.46)
    const wheelMesh = new Mesh(wheel, trim)
    // the clock on the screen: the hour lit up, with the day's picture (src/farm/day.ts, clockFace; the day chip's)
    const face = new Mesh(new PlaneGeometry(0.39, 0.122), new MeshBasicMaterial({ map: this.clock.tex, toneMapped: false }))
    face.position.set(driver, foot.y + 0.04, screenZ - 0.001)
    face.rotation.set(0, Math.PI, 0)
    g.add(inside, liner, wheelMesh, face)
    this.disposables.push(trim, lining, inside.geometry, liner.geometry, wheel, face.geometry, face.material as Material)
    return g
  }

  /** Draws the clock and the signpost for this drive. */
  label(l: Labels) {
    {
      const { ctx, tex } = this.clock
      const W = ctx.canvas.width
      const H = ctx.canvas.height
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0d1418'
      ctx.fillRect(0, 0, W, H)
      // a soft glow behind the figures, as a lit display has
      const glow = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6)
      glow.addColorStop(0, 'rgba(255, 196, 90, 0.18)')
      glow.addColorStop(1, 'rgba(255, 196, 90, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)
      const art = H * 0.68
      if (l.clockArt) ctx.drawImage(l.clockArt, 26, (H - art) / 2, art, art)
      ctx.font = '800 118px "Nunito Variable", "Nunito", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(255, 190, 80, 0.85)'
      ctx.shadowBlur = 18
      ctx.fillStyle = '#ffe2a6'
      ctx.fillText(l.clock, l.clockArt ? W / 2 + 58 : W / 2, H / 2 + 6)
      ctx.shadowBlur = 0
      tex.needsUpdate = true
    }
    {
      const { ctx, tex } = this.sign
      const W = ctx.canvas.width
      const H = ctx.canvas.height
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#2f6b45'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#f3ead8'
      ctx.lineWidth = 10
      ctx.strokeRect(14, 14, W - 28, H - 28)
      const art = 150
      if (l.toArt) ctx.drawImage(l.toArt, 36, (H - art) / 2, art, art)
      ctx.fillStyle = '#f3ead8'
      ctx.font = '600 60px "Fredoka Variable", "Fredoka", sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(l.to, 196, H / 2 - 4, W - 196 - 30)
      // an arrow on along the road
      ctx.beginPath()
      ctx.moveTo(W - 92, H / 2 + 62)
      ctx.lineTo(W - 44, H / 2 + 62)
      ctx.lineWidth = 12
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(W - 40, H / 2 + 62)
      ctx.lineTo(W - 64, H / 2 + 44)
      ctx.lineTo(W - 64, H / 2 + 80)
      ctx.closePath()
      ctx.fill()
      tex.needsUpdate = true
    }
  }

  /** Sets the day's light: the sun's and the sky light's colour and strength, the haze, the sky's own sun — as the game
   *  has them for the hour — the house's windows lit from evening, the headlamps at night. `environment`: the game's own
   *  (the light all round, from src/scene/Lighting.tsx's probe or picture), and how strong it is at noon. */
  light(m: Light, environment: Texture | null, envNoon: number) {
    const s = this.scene
    // (at night a little darker than the game's own light, so the headlamps and the lit windows tell it)
    const dim = m.night ? 0.6 : 1
    this.sun.intensity = NOON.sun * m.sun * dim
    tint(this.sun.color, new Color(NOON.sunColor), m.warm, TINT.sun)
    this.hemi.intensity = NOON.hemi * m.sky * (environment ? 1 : 3) * dim
    tint(this.hemi.color, new Color(NOON.sky), m.warm, TINT.sky)
    this.hemi.groundColor.set(NOON.ground)
    s.environment = environment
    s.environmentIntensity = envNoon * m.sky * dim
    tint(this.fog.color, new Color(NOON.fog), m.warm, TINT.haze).multiplyScalar(m.sky * dim)
    const sunAt = skySun(m.sun, new Vector3())
    const u = (this.sky.material as unknown as { uniforms: Record<string, { value: unknown }> }).uniforms
    ;(u.sunPosition.value as Vector3).copy(sunAt)
    // the light comes from the sky's sun, but never from under a few degrees up (it lights the road, not the hills' backs)
    const dir = sunAt.clone().normalize()
    if (dir.y < 0.35) dir.setY(0.35).normalize()
    this.sun.position.copy(dir).multiplyScalar(50)
    this.sun.target.position.set(0, 0, 0)
    // the house's windows: lit from the evening on
    this.windows.emissiveIntensity = m.sun < 0.8 ? (m.night ? 1.6 : 0.6) : 0
    this.headGlow.opacity = m.night ? 1 : 0.0
    this.headlamp.intensity = m.night ? 600 : 0
    ;(this.beams.material as MeshBasicMaterial).opacity = m.night ? 0.03 : 0
    this.night = m.night
  }

  private night = false

  /** Puts the film at a moment: the shot's place shown (the others hidden), the car where it is with its wheels turned
   *  and its body on its springs, the brake lights, the cabin shown only from inside it, the camera. */
  pose(film: DriveFilm, now: Moment, aspect: number) {
    for (const [id, g] of Object.entries(this.sets)) g.visible = id === now.set
    this.signpost.position.set(film.sign, 0, ROAD.z + ROAD.width / 2 + 1.9)
    this.signpost.rotation.y = -Math.PI / 2
    const c = now.car
    this.car.begin()
    putRollingCar(this.car, c.x, c.z, c.yaw, c.roll, { pitch: c.pitch, lift: c.lift }, drivePaint)
    this.car.end()
    // what rides on the body, as the body sits (src/models/car.ts, putRollingCar)
    const r = CAR_SHAPE.wheel.r
    const th = -c.pitch
    this.body.position.set(c.x, 0, c.z)
    this.body.rotation.set(0, c.yaw + Math.PI, 0)
    this.sway.position.set(0, c.lift + r * (1 - Math.cos(th)), -r * Math.sin(th))
    this.sway.rotation.set(th, 0, 0)
    this.tailGlow.opacity = c.braking ? 1 : this.night ? 0.55 : 0
    const inCabin = film.shots[now.shot].cam.kind === 'cabin'
    this.cabin.visible = inCabin
    // the beams in the haze seen from beside the car or behind it (from inside, or in front of it, they would fill the
    // picture: the light on the road shows the way)
    const to = new Vector3(now.cam.pos.x - c.x, 0, now.cam.pos.z - c.z).normalize()
    const ahead = -Math.sin(c.yaw) * to.x - Math.cos(c.yaw) * to.z
    this.beams.visible = !inCabin && ahead < 0.5
    const cam = this.camera
    cam.aspect = aspect
    cam.fov = now.cam.fov
    cam.near = inCabin ? 0.05 : 0.2
    cam.position.set(now.cam.pos.x, now.cam.pos.y, now.cam.pos.z)
    cam.lookAt(now.cam.look.x, now.cam.look.y, now.cam.look.z)
    cam.updateProjectionMatrix()
    // the sky round the camera, wherever it is
    this.sky.position.copy(cam.position)
  }

  /** Compiles every shader the film draws with (every place shown for it), before its first frame. */
  async compile(gl: WebGLRenderer) {
    const hidden = [...Object.values(this.sets), this.cabin, this.beams].filter((o) => !o.visible)
    for (const o of hidden) o.visible = true
    try {
      await gl.compileAsync(this.scene, this.camera)
    } catch {
      /* (compiled as it draws instead) */
    } finally {
      for (const o of hidden) o.visible = false
    }
  }

  dispose() {
    this.scene.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
    for (const d of this.disposables) d.dispose()
    this.sky.material.dispose()
  }
}
