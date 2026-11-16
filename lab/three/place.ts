import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector2, type BufferGeometry, type Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CORNER_TREES } from '../../src/data/garden'
import { GARDEN, GATE, LANE } from '../../src/data/layout'
import { MARKET_WALKIN } from '../../src/data/market'
import { BED, BEDS, PATH_X, SHED } from '../../src/farm/data'
import { build, treeSpots } from '../../src/farm/landGeometry'
import { defaultLayout, PLACES } from '../../src/farm/layout'
import { boxProject } from '../../src/lib/boxProject'
import { material, surface } from '../../src/lib/proceduralTextures'
import { loadSolids } from '../../src/lib/sculpt'
import { walkInShellModel } from '../../src/models/market'
import { lemonTreeModel } from '../../src/models/structures'
import { bigTreeModel } from '../../src/models/trees'
import { tree } from '../../src/scene/flora'
import { modelGroup } from './model'

// The farm round a 3D proposal, as a player sees it, built from the game's own data and models: the lawn, the lane,
// the hedge and the fence round the garden and the woods beyond it (src/farm/landGeometry.ts, as Land.tsx draws them;
// the trees src/models/trees.ts), the three big trees in the garden's corners and the lemon tree (src/farm/Places.tsx),
// the beds and the path at the garden door, the shed (src/farm/Garden.tsx: the same sizes and materials, its boxes
// plain), and the market's shell across the lane (src/models/market.ts). Not the house, the animals or the machines: a
// board looks at the farm where they are not in view. A board can give the trees of its own (the woods' board: the
// ones before), so only they change.

/** One of the big trees: in the woods round the farm, or one of the three in the garden's corners. */
export interface TreeSpot {
  x: number
  z: number
  height: number
  seed: number
  /** its place in the woods (0…13), or in the corners (0…2) */
  index: number
  corner: boolean
}

export interface PlaceOptions {
  /** the big trees, made by this instead of the game's own */
  trees?: (spot: TreeSpot) => Object3D
  /** the beds, the path and the shed by the garden door */
  yard?: boolean
  /** the market across the lane */
  market?: boolean
}

/** The leafy materials of the game's hedge (Land.tsx), and of its big trees before src/models/trees.ts: its grass
 *  picture, tinted. */
function leaf(color: string) {
  const s = surface('grass', 1, 1)
  return new MeshStandardMaterial({ color, map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: 1, normalScale: new Vector2(1.4, 1.4) })
}
function bark(color: string, roughness = 0.95) {
  const s = surface('veneer', 1, 1)
  return new MeshStandardMaterial({ color, map: s.map, normalMap: s.normalMap, roughness })
}

/** The three shades of crown the big trees had before src/models/trees.ts (tree i in shade i % 3). */
export const CROWN_SHADES = ['#5d7d43', '#6f8a46', '#4f6e3f']

/** One of the game's big trees as it is (src/models/trees.ts, as Land.tsx and Places.tsx draw it: it throws no shadow
 *  and takes none). */
export function gameTree(s: TreeSpot): Object3D {
  const g = modelGroup(bigTreeModel(s), `tree-${s.corner ? 'corner' : 'woods'}-${s.index}`)
  g.traverse((x) => (x.castShadow = x.receiveShadow = false))
  g.position.set(s.x, 0, s.z)
  return g
}

/** One of the big trees as they were before (src/scene/flora.ts `tree`, with Land.tsx's materials then). */
export function formerTree(s: TreeSpot): Object3D {
  const parts = tree(0, 0, s.height, s.seed)
  const g = new Group()
  g.add(new Mesh(parts.wood, bark('#6a5a4c')), new Mesh(parts.crown, leaf(CROWN_SHADES[s.index % 3])))
  g.position.set(s.x, 0, s.z)
  return g
}

/** The triangles of one of the big trees as they were before (its crown and its wood). */
export function formerTriangles(s: TreeSpot) {
  const parts = tree(0, 0, s.height, s.seed)
  const n = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3
  return n(parts.crown) + n(parts.wood)
}

/** Every big tree of the farm as it starts: the woods' fourteen and the three in the corners. */
export function treeSpotsAll(): TreeSpot[] {
  const woods = treeSpots(defaultLayout()).map((t, index) => ({ ...t, index, corner: false }))
  // the corner trees' seeds and heights (Places.tsx: tree(0, 0, height, 21 + index))
  const corners = CORNER_TREES.map(([x, z, height], index) => ({ x, z, height, seed: 21 + index, index, corner: true }))
  return [...woods, ...corners]
}

/** A sign board's picture (as Garden.tsx draws the beds' price boards). */
function signTexture(lines: string[], bg = '#f3ead8', fg = '#3b2a1c') {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const c = canvas.getContext('2d')!
  c.fillStyle = bg
  c.fillRect(0, 0, 512, 256)
  c.strokeStyle = 'rgba(60,40,20,0.35)'
  c.lineWidth = 10
  c.strokeRect(8, 8, 496, 240)
  c.fillStyle = fg
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  lines.forEach((line, i) => {
    c.font = `${i === 0 ? 800 : 600} ${i === 0 ? 77 : 46}px Inter, system-ui, sans-serif`
    c.fillText(line, 256, 256 * (0.38 + i * 0.32))
  })
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

const WOOD = '#8a6440'
const WOOD_DARK = '#5e4630'

/** The beds as a new farm has them (four built, two staked out, the east three for sale), the path and the shed. */
function yard(): Group {
  const g = new Group()
  const { w, d, h } = BED
  const veneer = material('veneer')
  const frameMat = new MeshStandardMaterial({ color: WOOD, map: veneer.map, normalMap: veneer.normalMap, roughnessMap: veneer.roughnessMap, roughness: 0.85 })
  const frame = boxProject(
    mergeGeometries(
      [
        new BoxGeometry(w + 0.1, h, 0.05).translate(0, h / 2, d / 2 + 0.025),
        new BoxGeometry(w + 0.1, h, 0.05).translate(0, h / 2, -d / 2 - 0.025),
        new BoxGeometry(0.05, h, d).translate(w / 2 + 0.025, h / 2, 0),
        new BoxGeometry(0.05, h, d).translate(-w / 2 - 0.025, h / 2, 0),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => new BoxGeometry(0.075, h + 0.05, 0.075).translate(sx * (w / 2 + 0.03), (h + 0.05) / 2, sz * (d / 2 + 0.03)))),
      ].map((x) => x.toNonIndexed()),
    )!,
    0.8,
    0,
  )
  const soilTex = surface('soil', w / 0.55, d / 0.55)
  const soil = new MeshStandardMaterial({ map: soilTex.map, normalMap: soilTex.normalMap, roughnessMap: soilTex.roughnessMap, normalScale: new Vector2(1.4, 1.4), roughness: 1 })
  const stakes = mergeGeometries(
    [
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => new BoxGeometry(0.03, 0.42, 0.03).translate((sx * w) / 2, 0.21, (sz * d) / 2))),
      ...[-1, 1].map((sz) => new BoxGeometry(w, 0.006, 0.006).translate(0, 0.34, (sz * d) / 2)),
      ...[-1, 1].map((sx) => new BoxGeometry(0.006, 0.006, d).translate((sx * w) / 2, 0.34, 0)),
    ].map((x) => x.toNonIndexed()),
  )!
  const stakeMat = new MeshStandardMaterial({ color: '#c9ad86', roughness: 0.9 })
  const post = new MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8 })
  const newBed = signTexture(['NEW BED', '30 coins'])
  const expand = signTexture(['EXPAND', '60 coins'], '#2f3a2c', '#f3ead8')
  for (const b of BEDS.filter((x) => x.expansion !== 'west')) {
    const bed = new Group()
    bed.position.set(b.x, 0, b.z)
    if (b.price === 0 && !b.expansion) {
      const f = new Mesh(frame, frameMat)
      f.castShadow = f.receiveShadow = true
      const s = new Mesh(new BoxGeometry(w, h - 0.05, d), soil)
      s.position.y = (h - 0.05) / 2
      s.receiveShadow = true
      bed.add(f, s)
    } else {
      const s = new Mesh(stakes, stakeMat)
      s.castShadow = true
      bed.add(s)
      const sign = b.expansion ? (b.index === 6 ? expand : null) : newBed
      if (sign) {
        const p = new Mesh(new BoxGeometry(0.05, 0.8, 0.05), post)
        p.position.set(-b.side * (w / 2 - 0.25), 0.4, -d / 2 - 0.08)
        const board = new Mesh(new BoxGeometry(0.5, 0.25, 0.02), new MeshStandardMaterial({ map: sign, roughness: 0.85 }))
        board.position.set(-b.side * (w / 2 - 0.25), 0.72, -d / 2 - 0.05)
        bed.add(p, board)
      }
    }
    g.add(bed)
  }
  // gravel down the middle of the beds from the door, and along the fence to the gate
  const pathLen = GARDEN.maxZ - 0.1 - 7.6
  const cross = GATE.x + 0.7 - PATH_X
  const gravel = (rx: number, ry: number) => {
    const t = surface('gravel', rx, ry)
    return new MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  }
  const path = new Mesh(new PlaneGeometry(1.25, pathLen), gravel(1.25 / 1.6, pathLen / 1.6))
  path.rotation.x = -Math.PI / 2
  path.position.set(PATH_X, -0.012, 7.6 + pathLen / 2)
  const along = new Mesh(new PlaneGeometry(cross - 0.625, 0.85), gravel((cross - 0.625) / 1.6, 0.85 / 1.6))
  along.rotation.x = -Math.PI / 2
  along.position.set(PATH_X + 0.625 + (cross - 0.625) / 2, -0.011, 12.45)
  path.receiveShadow = along.receiveShadow = true
  g.add(path, along)
  // stepping stones across the lawn to the lemon tree and the shed
  const stone = new MeshStandardMaterial({ color: '#b5afa4', roughness: 0.9 })
  ;[
    [-3.95, 10.25],
    [-4.75, 10.75],
    [-5.55, 11.25],
    [-6.75, 11.35],
    [-7.55, 11.15],
  ].forEach(([x, z], i) => {
    const m = new Mesh(new CylinderGeometry(0.27 + (i % 2) * 0.04, 0.29, 0.04, 7), stone)
    m.position.set(x, -0.004, z)
    m.rotation.y = i * 1.3
    m.receiveShadow = true
    g.add(m)
  })
  // the shed: plank walls, the door ajar towards the beds, a sloping roof (its sizes from Garden.tsx)
  const shed = new Group()
  shed.position.set(SHED.x, 0, SHED.z)
  const sw = 1.8
  const sd = 1.4
  const sh = 2.0
  const plank = (size: [number, number, number], at: [number, number, number], color: string, ry = 0, rz = 0) => {
    const geo = boxProject(new BoxGeometry(...size), 0.9, at[0] * 3.1 + at[2] * 1.7)
    const m = new Mesh(geo, new MeshStandardMaterial({ color, map: veneer.map, normalMap: veneer.normalMap, roughnessMap: veneer.roughnessMap, roughness: 0.8 }))
    m.position.set(...at)
    m.rotation.set(0, ry, rz)
    m.castShadow = m.receiveShadow = true
    shed.add(m)
  }
  plank([sw, 0.08, sd], [0, 0.04, 0], WOOD_DARK)
  plank([sw, sh, 0.06], [0, sh / 2, -sd / 2], '#7a5a3c')
  plank([sw, sh, 0.06], [0, sh / 2, sd / 2], '#7a5a3c')
  plank([0.06, sh, sd], [-sw / 2, sh / 2, 0], '#7a5a3c')
  plank([0.06, sh, 0.35], [sw / 2, sh / 2, -sd / 2 + 0.175], '#7a5a3c')
  plank([0.06, sh, 0.35], [sw / 2, sh / 2, sd / 2 - 0.175], '#7a5a3c')
  plank([0.06, 0.2, 0.7], [sw / 2, sh - 0.1, 0], '#7a5a3c')
  plank([0.04, 1.75, 0.68], [sw / 2 + 0.2, 0.9, -0.22], '#4f6a4a', 0.55)
  const roof = new Mesh(new BoxGeometry(sw + 0.3, 0.06, sd + 0.36), new MeshStandardMaterial({ color: '#3b3f42', roughness: 0.6 }))
  roof.position.set(0, sh + 0.1, 0)
  roof.rotation.z = 0.16
  roof.castShadow = true
  const barrel = new Mesh(new CylinderGeometry(0.28, 0.25, 0.84, 18), new MeshStandardMaterial({ color: '#4a6f8a', roughness: 0.55 }))
  barrel.position.set(0.95, 0.42, -1.05)
  barrel.castShadow = true
  shed.add(roof, barrel)
  g.add(shed)
  return g
}

/** The farm round a proposal (built after the solid engine is in: the market's windows are cut with it). */
export async function farmPlace(o: PlaceOptions = {}): Promise<Group> {
  await loadSolids()
  const root = new Group()
  root.name = 'farm-place'
  // the lawn and the lane (src/scene/Exterior.tsx)
  const grass = surface('grass', 260, 260)
  const lawn = new Mesh(new PlaneGeometry(800, 800), new MeshStandardMaterial({ map: grass.map, normalMap: grass.normalMap, roughnessMap: grass.roughnessMap, roughness: 1 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.y = -0.03
  lawn.receiveShadow = true
  const stones = surface('stone', 64, 1)
  const lane = new Mesh(
    new PlaneGeometry(160, LANE.width),
    new MeshStandardMaterial({ color: '#b3a184', map: stones.map, normalMap: stones.normalMap, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  )
  lane.rotation.x = -Math.PI / 2
  lane.position.set(0, -0.02, LANE.z)
  lane.receiveShadow = true
  root.add(lawn, lane)
  // the hedge and the fence round the garden (Land.tsx), and the woods: the game's own, or the board's
  const land = build(defaultLayout())
  const hedge = leaf('#5f7a4a')
  for (const geo of land.hedge) {
    const m = new Mesh(geo, hedge)
    m.castShadow = m.receiveShadow = true
    root.add(m)
  }
  if (land.fence) {
    const f = new Mesh(land.fence, bark('#7a6048', 0.85))
    f.castShadow = f.receiveShadow = true
    root.add(f)
  }
  const make = o.trees ?? gameTree
  // (the woods and the big trees throw no shadow in the game: the sun must keep reaching the windows)
  for (const spot of treeSpotsAll()) {
    const t = make(spot)
    t.traverse((x) => (x.castShadow = false))
    root.add(t)
  }
  // the lemon tree where it starts
  const lemon = modelGroup(lemonTreeModel(), 'lemon-tree')
  lemon.position.set(PLACES.lemon.home.x, 0, PLACES.lemon.home.z)
  root.add(lemon)
  if (o.yard) root.add(yard())
  if (o.market) root.add(modelGroup(walkInShellModel(MARKET_WALKIN), 'market'))
  return root
}
