// A walk-in building from its row (src/data/buildings.ts): its shell (src/models), a fixed body with a cuboid for each
// wall and the roof, its wall pieces as hiding pieces for the drawing pass (src/lib/visibility/walls.ts), its floor and
// its lights. Everything comes from the row: a new building is a row and a model, and this draws it.
//
// The shell is one part that casts (walls, roof and parapet, and whatever stands with it: the contractor's cabin beside
// the market — src/models/market.ts), so the sun's map draws it once. Nothing inside casts: no opening faces the sun,
// so the shell already shades all of it. Its walls never fade (the camera stays inside the room your body is in, or
// outside every walk-in: src/scene/Player.tsx), so each is a hiding piece always: what stands inside is not drawn from
// outside, nor the farm from inside, unless it shows through a door. The lights are there from the start, so walking
// in compiles no shader again.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { BufferAttribute, BufferGeometry, type Group, type Object3D } from 'three'
import { bounds, type AutoDoor, type Box, type Rect, type WalkIn as WalkInDef } from '../data/buildings'
import { groundDistance } from '../lib/interaction'
import { playerState } from '../lib/playerState'
import { surface } from '../lib/proceduralTextures'
import { addWalls, type Enclosure, type WallPiece } from '../lib/visibility/walls'
import { walkInShellParts } from '../models/market'
import { FIT, putSlidingDoor, slidingDoorParts } from '../models/slidingDoor'

/** The floors' height (m): just over the ground outside, under the doors' thresholds. */
const FLOOR_Y = 0.02
/** How far a hiding piece is brought in from every edge of its box (m): it lies inside the wall as drawn, whatever the
 *  shell's surface does to the wall's faces. */
const INSET = 0.03
/** Metres of floor one texture tile covers (as the house's tiled floors: src/scene/Floors.tsx). */
const TILE = { tile: 1.4, boards: 2.4 } as const

/** A closed, opaque box as a hiding piece: the rectangle through its middle along its longer side, brought in. */
export function hidingPiece(b: Box): WallPiece {
  const alongX = b.x1 - b.x0 >= b.z1 - b.z0
  return {
    axis: alongX ? 'x' : 'z',
    at: alongX ? (b.z0 + b.z1) / 2 : (b.x0 + b.x1) / 2,
    a: (alongX ? b.x0 : b.z0) + INSET,
    b: (alongX ? b.x1 : b.z1) - INSET,
    y0: b.y0 + INSET,
    y1: b.y1 - INSET,
    box: [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1],
  }
}

/** The roof's slab over each room, as boxes. */
const roofBoxes = (def: WalkInDef): Box[] => def.rooms.map((r) => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0: def.roof.y, y1: def.roof.y + def.roof.thick }))

/** Every room's floor and every doorway's threshold as one flat mesh, its UVs in tiles (one draw). */
function floorGeometry(rects: Rect[], tile: number): BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const index: number[] = []
  for (const r of rects) {
    const k = pos.length / 3
    for (const [x, z] of [
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
    ]) {
      pos.push(x, FLOOR_Y, z)
      uv.push(x / tile, -z / tile)
    }
    // facing up
    index.push(k, k + 2, k + 1, k, k + 3, k + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute(
    'normal',
    new BufferAttribute(
      new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  )
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

const NONE: readonly Box[] = []

// ───────────────────────────── the sliding door ─────────────────────────────

/** The sliding door opens for anyone this near its doorway (m, on the ground), you or someone walking; in this long. */
const OPEN_NEAR = 2
const OPEN_SECONDS = 0.6

/** How far open each walk-in's sliding door is now (0 shut, 1 open), by its id: for the tests. */
const doorOpen = new Map<string, number>()
export const walkInDoor = (id: string) => doorOpen.get(id) ?? 0

/** A walk-in with a sliding door, as a building closed round its rooms while the door is shut (src/lib/visibility/
 *  walls.ts): its box takes in the parapet's coping, a little round it; its rooms from the floor to the roof's underside.
 *  One without such a door is never closed (its doorway is open). */
function enclosure(def: WalkInDef, shut: () => boolean): Enclosure | undefined {
  if (!def.autoDoor) return undefined
  const b = bounds(def)
  const top = Math.max(...def.walls.map((w) => w.y1), def.roof.y + def.roof.thick)
  const pad = 0.1
  return {
    outer: [b.x0 - pad, 0, b.z0 - pad, b.x1 + pad, top + pad, b.z1 + pad],
    rooms: def.rooms.map((r) => [r.x0, 0, r.z0, r.x1, def.roof.y, r.z1]),
    shut,
  }
}

/** The shut door as a hiding piece: the rectangle through both leaves' middle, across the whole opening and up to its
 *  top (the leaves reach past it into the wall and behind the lintel, and overlap in the middle: it lies inside them). */
function doorPiece(d: AutoDoor): WallPiece {
  const alongX = d.x1 - d.x0 >= d.z1 - d.z0
  const at = alongX ? (d.z0 + d.z1) / 2 : (d.x0 + d.x1) / 2
  const [a, b] = alongX ? [d.x0, d.x1] : [d.z0, d.z1]
  const t = d.thick / 2 + FIT.stagger / 2
  const h = d.height + FIT.up
  return {
    axis: alongX ? 'x' : 'z',
    at,
    a,
    b,
    y0: FIT.up,
    y1: d.height,
    box: alongX ? [a - FIT.pocket, 0, at - t, b + FIT.pocket, h, at + t] : [at - t, 0, a - FIT.pocket, at + t, h, b + FIT.pocket],
  }
}

/** Whether a group is in the scene and shown: every parent up to the root visible. */
export function shownInScene(o: Object3D | null): boolean {
  if (!o) return false
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/**
 * A walk-in building. `hiders`: closed, opaque boxes inside that hide what is behind them as the walls do (the
 * market's island has a panel down its middle: from one aisle, the far face's goods are not drawn). `walkers`: who
 * else opens its sliding door by coming near (its shoppers, its manager), besides you.
 */
export function WalkIn({ def, hiders = NONE, walkers }: { def: WalkInDef; hiders?: readonly Box[]; walkers?: () => Iterable<{ x: number; z: number }> }) {
  const root = useRef<Group>(null)
  const shell = useMemo(() => walkInShellParts(def), [def])
  useEffect(
    () => () => {
      shell.dispose()
      shell.meshes.shell.geometry.dispose()
    },
    [shell],
  )
  const floor = useMemo(() => floorGeometry([...def.rooms, ...def.doors], TILE[def.floor]), [def])
  useEffect(() => () => floor.dispose(), [floor])
  const tex = useMemo(() => surface(def.floor === 'boards' ? 'wood' : 'tile', 1, 1), [def.floor])

  // the sliding door: its leaves, and how far open it is (it opens for whoever is near, and shuts again)
  const door = def.autoDoor
  const leaves = useMemo(() => {
    if (!door) return null
    const parts = slidingDoorParts(door)
    putSlidingDoor(parts, door, 0)
    return parts
  }, [door])
  useEffect(
    () => () => {
      leaves?.dispose()
      leaves?.meshes.leaf.geometry.dispose()
    },
    [leaves],
  )
  const open = useRef(0)
  const latest = useRef(walkers)
  latest.current = walkers
  useFrame((_, rawDt) => {
    if (!door || !leaves) return
    const mid = { x: (door.x0 + door.x1) / 2, z: (door.z0 + door.z1) / 2 }
    const half = { x: (door.x1 - door.x0) / 2, z: (door.z1 - door.z0) / 2 }
    const p = playerState.position
    let near = groundDistance(p.x, p.z, mid, half) <= OPEN_NEAR
    const others = latest.current?.()
    if (!near && others) for (const w of others) if ((near = groundDistance(w.x, w.z, mid, half) <= OPEN_NEAR)) break
    const step = Math.min(rawDt, 0.1) / OPEN_SECONDS
    const now = open.current
    const next = near ? Math.min(1, now + step) : Math.max(0, now - step)
    doorOpen.set(def.id, next)
    if (next === now) return
    open.current = next
    putSlidingDoor(leaves, door, next)
  })

  // the walls (and the hiders) hide what lies wholly behind them, always: they never fade; the sliding door only while
  // it is shut (open or moving it hides nothing). Shut, the building is closed all round: from outside, all that is in
  // its rooms is hidden, whichever wall or the roof stands in the way
  useEffect(() => {
    const pieces = [...def.walls, ...hiders].map(hidingPiece)
    const shutAt = def.autoDoor ? pieces.push(doorPiece(def.autoDoor)) - 1 : -1
    return addWalls({ pieces, opaque: (i) => i !== shutAt || open.current === 0, drawn: () => shownInScene(root.current), enclosure: enclosure(def, () => open.current === 0) })
  }, [def, hiders])

  return (
    <group ref={root} name={`walk-in-${def.id}`}>
      <primitive object={shell.group} />
      {leaves && <primitive object={leaves.group} />}
      <mesh geometry={floor} receiveShadow name={`walk-in-${def.id}-floor`}>
        <meshStandardMaterial map={tex.map} normalMap={tex.normalMap} roughnessMap={tex.roughnessMap} roughness={1} color="#efe9df" />
      </mesh>
      {def.lights.map((l, i) => (
        <pointLight key={i} position={[l.x, l.y, l.z]} color={l.color} intensity={l.intensity} distance={l.distance} decay={2} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {[...def.walls, ...roofBoxes(def)].map((b, i) => (
          <CuboidCollider key={i} args={[(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2]} position={[(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2]} />
        ))}
      </RigidBody>
    </group>
  )
}
