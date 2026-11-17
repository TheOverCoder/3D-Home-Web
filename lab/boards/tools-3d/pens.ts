import { BoxGeometry, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial, Vector2, type BufferGeometry, type Object3D } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { COOP, FOLD, HAY_RACK, NEST, PASTURE, RUN, TROUGH } from '../../../src/farm/data'
import { alongBoundary, defaultLayout, PLACES, toWorld, turnOf, type PlaceId } from '../../../src/farm/layout'
import { boxProject } from '../../../src/lib/boxProject'
import { material } from '../../../src/lib/proceduralTextures'
import { coopModel, troughModel } from '../../../src/models/structures'
import { modelGroup } from '../../three/model'

// The three pens as the game draws them on a new farm (src/farm/Places.tsx: the hen run with its coop and nest box, the
// cows' pasture with its trough and hay rack, the sheep fold with its lean-to and trough), from the game's own numbers
// (src/farm/data.ts) and models; their boxes as its `B` makes them (src/scene/Furnishings.tsx: a rounded box, or a plain
// one for the thin ones, the veneer's grain projected on it). Each stands where a new farm has it.

const WOOD = '#8a6440'
const WOOD_DARK = '#5e4630'

type V3 = [number, number, number]

const veneer = () => material('veneer')

/** One of the game's boxes (`B`): a rounded box (a plain one when its radius is under 8 mm), grain projected on it. */
function b(size: V3, position: V3, color: string, o: { radius?: number; mat?: boolean; tile?: number; rotation?: V3; roughness?: number } = {}): Mesh {
  const radius = o.radius ?? 0.015
  const r = Math.min(radius, Math.min(...size) / 2 - 1e-3)
  let g: BufferGeometry = r < 0.008 ? new BoxGeometry(...size) : new RoundedBoxGeometry(size[0], size[1], size[2], 2, r)
  const set = o.mat ? veneer() : null
  if (set) g = boxProject(g, o.tile ?? 0.6, position[0] * 3.1 + position[2] * 1.7)
  const m = new Mesh(
    g,
    new MeshStandardMaterial({
      color,
      roughness: o.roughness ?? 0.8,
      map: set?.map ?? null,
      normalMap: set?.normalMap ?? null,
      roughnessMap: set?.roughnessMap ?? null,
      normalScale: new Vector2(1, 1),
    }),
  )
  m.position.set(...position)
  if (o.rotation) m.rotation.set(...o.rotation)
  m.castShadow = m.receiveShadow = true
  return m
}

/** A place's group where a new farm has it; its children in its own frame. */
function placed(id: PlaceId): Group {
  const p = PLACES[id].home
  const g = new Group()
  g.name = `place-${id}`
  g.position.set(p.x, 0, p.z)
  g.rotation.y = turnOf(p)
  return g
}

/** A run of fence from (x0, z0) to (x1, z1): posts every so far, rails at the heights given. */
function fenceRun(
  g: Group,
  [x0, z0, x1, z1]: [number, number, number, number],
  o: { every: number; post: V3; rails: number[]; rail: [number, number]; mat?: boolean; ends: boolean; radius: [number, number] },
) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const n = Math.max(1, o.ends ? Math.round(len / o.every) : Math.ceil(len / o.every))
  for (let i = 0; i <= (o.ends ? n : n - 1); i++) {
    const t = i / n
    g.add(b(o.post, [x0 + (x1 - x0) * t, o.post[1] / 2, z0 + (z1 - z0) * t], WOOD_DARK, { mat: o.mat, tile: 0.9, radius: o.radius[0] }))
  }
  const alongX = Math.abs(x1 - x0) > 0.01
  for (const y of o.rails) g.add(b(alongX ? [len, o.rail[0], o.rail[1]] : [o.rail[1], o.rail[0], len], [(x0 + x1) / 2, y, (z0 + z1) / 2], WOOD, { mat: o.mat, tile: 0.9, radius: o.radius[1] }))
}

/** The hen run: its fence, the hen house, and (today) the nest box poking out of its west fence. */
export function henRun(o: { nestBox: boolean }): Group {
  const g = placed('hens')
  const sides: [number, number, number, number][] = [
    [RUN.minX, RUN.minZ, RUN.maxX, RUN.minZ],
    [RUN.maxX, RUN.minZ, RUN.maxX, RUN.maxZ],
    [RUN.maxX, RUN.maxZ, RUN.minX, RUN.maxZ],
    [RUN.minX, RUN.maxZ, RUN.minX, RUN.minZ],
  ]
  for (const side of sides) fenceRun(g, side, { every: 1.15, post: [0.07, 0.95, 0.07], rails: [0.25, 0.55, 0.85], rail: [0.05, 0.025], ends: false, radius: [0.006, 0.004] })
  const coop = modelGroup(coopModel(), 'coop')
  coop.position.set(COOP.x, 0, COOP.z)
  g.add(coop)
  if (o.nestBox) {
    const nest = new Group()
    nest.position.set(NEST.x, 0, NEST.z)
    nest.add(
      b([0.4, 0.03, 0.44], [0, 0.615, 0], WOOD, { radius: 0.004 }),
      b([0.4, 0.2, 0.03], [0, 0.7, -0.22], WOOD, { radius: 0.004 }),
      b([0.4, 0.2, 0.03], [0, 0.7, 0.22], WOOD, { radius: 0.004 }),
      b([0.03, 0.12, 0.44], [-0.2, 0.66, 0], WOOD, { radius: 0.004 }),
      b([0.36, 0.02, 0.4], [0, 0.635, 0], '#d9c18a', { radius: 0, roughness: 1 }),
      b([0.06, 0.6, 0.06], [-0.17, 0.3, 0], WOOD_DARK, { radius: 0.006 }),
    )
    g.add(nest)
  }
  return g
}

/** The cows' pasture: its fence (not along a side the land's hedge closes), the gate open, the trough and the hay rack. */
export function pasture(): Group {
  const g = placed('cows')
  const p = PLACES.cows.home
  const { minX, maxX, minZ, maxZ, gateZ, gateWidth } = PASTURE
  const sides: [number, number, number, number][] = [
    [minX, minZ, maxX, minZ],
    [minX, maxZ, maxX, maxZ],
    [maxX, minZ, maxX, maxZ],
  ]
  const open = sides.filter(([x0, z0, x1, z1]) => !alongBoundary(defaultLayout(), toWorld(p, x0, z0), toWorld(p, x1, z1)))
  const runs: [number, number, number, number][] = [...open, [minX, minZ, minX, gateZ - gateWidth / 2], [minX, gateZ + gateWidth / 2, minX, maxZ]]
  for (const run of runs) fenceRun(g, run, { every: 1.4, post: [0.09, 1.1, 0.09], rails: [0.45, 0.9], rail: [0.08, 0.04], mat: true, ends: true, radius: [0.01, 0.006] })
  const gate = new Group()
  gate.position.set(minX, 0, gateZ + gateWidth / 2)
  gate.rotation.y = -1.25
  for (const y of [0.3, 0.75]) gate.add(b([0.04, 0.09, gateWidth - 0.1], [0.03, y, -(gateWidth - 0.1) / 2], WOOD, { radius: 0.006 }))
  gate.add(b([0.04, 0.95, 0.07], [0.03, 0.5, -gateWidth + 0.12], WOOD, { radius: 0.006 }))
  g.add(gate)
  const trough = modelGroup(troughModel(1.7, 0.55, 0.4), 'trough')
  trough.position.set(TROUGH.x, 0, TROUGH.z)
  g.add(trough)
  const rack = new Group()
  rack.position.set(HAY_RACK.x, 0, HAY_RACK.z)
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) rack.add(b([0.06, 1.0, 0.06], [sx * 0.25, 0.5, sz * 0.5], WOOD_DARK, { radius: 0.006 }))
  rack.add(b([0.56, 0.05, 1.06], [0, 0.98, 0], WOOD, { radius: 0.006 }))
  const hay = new Mesh(new IcosahedronGeometry(1, 1), new MeshStandardMaterial({ color: '#d6b660', roughness: 1 }))
  hay.position.set(0, 0.62, 0)
  hay.scale.set(0.26, 0.3, 0.5)
  hay.castShadow = hay.receiveShadow = true
  rack.add(hay)
  g.add(rack)
  return g
}

/** The sheep fold: its fence with the gate open in the south side, the lean-to in its north-west corner, the trough. */
export function fold(): Group {
  const g = placed('sheep')
  const { minX, maxX, minZ, maxZ, gateX, gateWidth } = FOLD
  const runs: [number, number, number, number][] = [
    [minX, minZ, maxX, minZ],
    [minX, minZ, minX, maxZ],
    [maxX, minZ, maxX, maxZ],
    [minX, maxZ, gateX - gateWidth / 2, maxZ],
    [gateX + gateWidth / 2, maxZ, maxX, maxZ],
  ]
  for (const run of runs) fenceRun(g, run, { every: 1.3, post: [0.08, 0.95, 0.08], rails: [0.35, 0.75], rail: [0.07, 0.035], mat: true, ends: true, radius: [0, 0] })
  const gate = new Group()
  gate.position.set(gateX - gateWidth / 2, 0, maxZ)
  gate.rotation.y = 1.2
  for (const y of [0.28, 0.68]) gate.add(b([gateWidth - 0.1, 0.08, 0.035], [(gateWidth - 0.1) / 2, y, -0.02], WOOD, { radius: 0 }))
  gate.add(b([0.06, 0.85, 0.035], [gateWidth - 0.12, 0.45, -0.02], WOOD, { radius: 0 }))
  g.add(gate)
  const shelter = new Group()
  shelter.position.set(minX + 0.15, 0, minZ + 0.12)
  for (const x of [0.05, 1.1, 2.15]) shelter.add(b([0.09, 1.5, 0.09], [x, 0.75, 1.25], WOOD_DARK, { mat: true, tile: 0.9, radius: 0 }))
  shelter.add(b([2.25, 1.75, 0.06], [1.1, 0.875, 0.04], '#7b5a3c', { mat: true, tile: 0.7, radius: 0 }))
  shelter.add(b([2.45, 0.06, 1.55], [1.1, 1.62, 0.66], '#5d4a3a', { mat: true, tile: 0.6, radius: 0, rotation: [0.2, 0, 0] }))
  const straw = new Mesh(new IcosahedronGeometry(1, 1), new MeshStandardMaterial({ color: '#d8bd6a', roughness: 1 }))
  straw.position.set(0.9, 0.12, 0.6)
  straw.scale.set(0.75, 0.16, 0.45)
  straw.receiveShadow = true
  shelter.add(straw)
  g.add(shelter)
  const trough = modelGroup(troughModel(1.1, 0.45, 0.34), 'trough')
  trough.position.set(FOLD.maxX - 0.75, 0, FOLD.minZ + 0.55)
  trough.rotation.y = Math.PI / 2
  g.add(trough)
  return g
}

/** A thing put in a place's frame (a tool at its fence): where it stands in the world. */
export function inPlace(id: PlaceId, thing: Object3D, at: V3, turn: number): Object3D {
  const g = placed(id)
  thing.position.set(...at)
  thing.rotation.y = turn
  g.add(thing)
  return g
}
