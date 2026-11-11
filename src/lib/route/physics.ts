import type { RapierContext, RapierRigidBody } from '@react-three/rapier'
import { DOOR, GARDEN_DOOR, insideHouse } from '../../data/layout'
import { BODY } from '../playerState'
import { makeGrid, type Grid } from './grid'

// Where the body can stand, asked of the physics world itself (src/lib/route): for a cell's middle, does a capsule the
// size of the player's, standing there, touch anything that never moves — the house's walls (open at the doorways and
// the garden door), the furniture, the fences, pens, beds, buildings, the hedge and the trees? Things that move are
// left out (the animals, the tractor, things you can pick up, the garden door's leaves that slide open as you come, and
// your own body). The kitchen's door moves too, but only when you open or shut it: it is put back where the game has it
// (shut, a wall across its doorway; open, its leaf standing in the bedroom).

type World = RapierContext['world']
type Rapier = RapierContext['rapier']

/** A cell's side, metres. */
export const CELL = 0.25
/** The body as it is tried: the player's capsule, 2 cm wider all round (room to brush past an edge, not catch on it). */
export const PROBE_RADIUS = BODY.radius + 0.02
// as tall as the player's: its top and its bottom (floating over the floor) where the player's are
const HALF = BODY.half + BODY.radius - PROBE_RADIUS
const Y = BODY.half + BODY.radius + BODY.float
/** Cells a side of a block: a block with nothing in it is worked out with one question instead of 64. */
const BLOCK = 8
const IDENT = { x: 0, y: 0, z: 0, w: 1 }

/** The land the grid covers: its bounds, and whether a point is on it (the farm's own land, not the woods round it). */
export interface Area {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  on: (x: number, z: number) => boolean
}

export interface PhysicsGrid extends Grid {
  /** questions asked of the physics world, and how long they took (ms) */
  stats: { blocks: number; empty: number; capsules: number; ms: number }
}

/**
 * The grid over `area` (cells CELL across), each cell worked out from the physics world the first time a search asks
 * about it. A cell is free when the player's capsule (a little wider) stands there touching no fixed collider and not
 * the kitchen's door as it is (`doorShut`), and its middle is on the land. Each block of 8 × 8 cells first asks once
 * for a box round all their capsules: when nothing is there, all of them are free at once.
 */
export function physicsGrid(world: World, rapier: Rapier, area: Area, doorShut: boolean): PhysicsGrid {
  const flags = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const capsule = new rapier.Capsule(HALF, PROBE_RADIUS)
  const leaf = new rapier.Cuboid(DOOR.width / 2, DOOR.height / 2, DOOR.thickness / 2)
  // the leaf turns about the hinge (Door.tsx): shut along the wall, open a quarter turn into the bedroom
  const a = doorShut ? 0 : -DOOR.openAngle
  const leafAt = { x: DOOR.hinge[0] + (Math.cos(a) * DOOR.width) / 2, y: DOOR.hinge[1] + DOOR.height / 2, z: DOOR.hinge[2] - (Math.sin(a) * DOOR.width) / 2 }
  const leafRot = { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }
  const at = { x: 0, y: Y, z: 0 }
  const stats = { blocks: 0, empty: 0, capsules: 0, ms: 0 }
  // per block: 0 not asked yet, 1 nothing there, 2 something there (ask cell by cell)
  let blocks: Uint8Array
  let bw = 0
  const grid = makeGrid(area.minX, area.minZ, area.maxX, area.maxZ, CELL, (x, z) => {
    if (!area.on(x, z)) return false
    const t0 = performance.now()
    const i = Math.floor((x - area.minX) / CELL)
    const j = Math.floor((z - area.minZ) / CELL)
    const b = Math.floor(j / BLOCK) * bw + Math.floor(i / BLOCK)
    if (!blocks[b]) blocks[b] = emptyBlock(Math.floor(i / BLOCK), Math.floor(j / BLOCK)) ? 1 : 2
    let free = blocks[b] === 1
    if (!free) {
      stats.capsules++
      at.x = x
      at.z = z
      free = !world.intersectionWithShape(at, IDENT, capsule, flags) && !capsule.intersectsShape(at, IDENT, leaf, leafAt, leafRot)
    }
    stats.ms += performance.now() - t0
    return free
  }) as PhysicsGrid
  grid.stats = stats
  bw = Math.ceil(grid.w / BLOCK)
  blocks = new Uint8Array(bw * Math.ceil(grid.h / BLOCK))

  /** Nothing fixed touches a box holding every capsule of the block. */
  function emptyBlock(bi: number, bj: number) {
    stats.blocks++
    const i0 = bi * BLOCK
    const j0 = bj * BLOCK
    const i1 = Math.min(grid.w, i0 + BLOCK)
    const j1 = Math.min(grid.h, j0 + BLOCK)
    const half = { x: ((i1 - i0 - 1) * CELL) / 2 + PROBE_RADIUS, y: HALF + PROBE_RADIUS, z: ((j1 - j0 - 1) * CELL) / 2 + PROBE_RADIUS }
    const box = new rapier.Cuboid(half.x, half.y, half.z)
    const mid = { x: area.minX + ((i0 + i1) / 2) * CELL, y: Y, z: area.minZ + ((j0 + j1) / 2) * CELL }
    const empty = !world.intersectionWithShape(mid, IDENT, box, flags) && !box.intersectsShape(mid, IDENT, leaf, leafAt, leafRot)
    if (empty) stats.empty++
    return empty
  }
  return grid
}

const mix = (h: number, v: number) => Math.imul(h ^ (Math.round(v) | 0), 16777619)

/**
 * A number that changes whenever anything fixed in the physics world does: a collider added, taken away, moved or
 * turned (a place moved in the edit mode, a field bought and its hedge moved out, a piece of furniture moved, a bed
 * built), or the kitchen's door opened or shut. The grid is made again when it changes.
 */
export function staticSignature(world: World, doorShut: boolean): number {
  let h = doorShut ? 1 : 2
  world.forEachCollider((c) => {
    if (c.isSensor()) return
    const b = c.parent()
    if (b && !b.isFixed()) return
    const t = c.translation()
    const r = c.rotation()
    h = mix(h, c.handle)
    h = mix(h, t.x * 1000)
    h = mix(h, t.y * 1000)
    h = mix(h, t.z * 1000)
    h = mix(h, r.y * 1e4)
    h = mix(h, r.w * 1e4)
  })
  return h
}

/**
 * The cells within `radius` of (x, z) where something that moves stands now (an animal, the tractor, a thing put down),
 * for planning again round what held you up. Not indoors, nor at the garden door: there only the doors move, and they
 * open as you come (the kitchen's is in the grid itself).
 */
export function movingBlocked(world: World, rapier: Rapier, grid: Grid, x: number, z: number, radius: number, body: RapierRigidBody | null | undefined): Set<number> {
  const flags = rapier.QueryFilterFlags.EXCLUDE_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const capsule = new rapier.Capsule(HALF, PROBE_RADIUS)
  const out = new Set<number>()
  const at = { x: 0, y: Y, z: 0 }
  const r = Math.ceil(radius / grid.cell)
  const ci = Math.floor((x - grid.x0) / grid.cell)
  const cj = Math.floor((z - grid.z0) / grid.cell)
  for (let j = Math.max(0, cj - r); j <= Math.min(grid.h - 1, cj + r); j++)
    for (let i = Math.max(0, ci - r); i <= Math.min(grid.w - 1, ci + r); i++) {
      at.x = grid.x0 + (i + 0.5) * grid.cell
      at.z = grid.z0 + (j + 0.5) * grid.cell
      if (Math.hypot(at.x - x, at.z - z) > radius || insideHouse(at.x, at.z, 0.6)) continue
      if (Math.abs(at.x - GARDEN_DOOR.centre) < GARDEN_DOOR.width && Math.abs(at.z - GARDEN_DOOR.at) < 1.2) continue
      if (world.intersectionWithShape(at, IDENT, capsule, flags, undefined, undefined, body ?? undefined)) out.add(j * grid.w + i)
    }
  return out
}
