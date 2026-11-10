import { useEffect, useMemo, type ReactNode } from 'react'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { farmSound, placeSound } from '../audio/sound'
import { CORNER_TREES } from '../data/garden'
import { playGesture } from '../lib/gestures'
import { useInteractable } from '../lib/interaction'
import { surface } from '../lib/proceduralTextures'
import { B } from '../scene/Furnishings'
import { StaticBatch } from '../scene/House'
import { tree } from '../scene/flora'
import { coopModel, lemonTreeModel, structureParts, troughModel, type Structure } from '../models/structures'
import { COOP, EGG, FOLD, HAY_RACK, LEMON_TREE, NEST, PASTURE, RUN, TROUGH, count } from './data'
import { usePlacement, useShownPlacement } from './edit'
import { alongBoundary, toWorld, turnOf, type PlaceId, type Placement } from './layout'
import { collectEggs, farm, pickLemons, useFarm } from './state'

// The farm's movable places — the hen run with its coop, the cows' pasture, the sheep fold, the lemon tree and the
// three big trees — each drawn in its own frame inside a group that stands where the layout puts it (or where the
// edit mode is dragging it). Their colliders and interactions follow where they stand.

export const WOOD = '#8a6440'
export const WOOD_DARK = '#5e4630'

/** Draws a place where it stands (or is being dragged); its children are in its own frame. */
function Placed({ id, children }: { id: PlaceId; children: ReactNode }) {
  const p = useShownPlacement(id)
  return (
    <group name={`place-${id}`} position={[p.x, 0, p.z]} rotation-y={turnOf(p)}>
      {children}
    </group>
  )
}

type V3 = [number, number, number]
interface Box {
  half: V3
  at: V3
}
interface Post {
  half: number
  radius: number
  at: V3
}

/** A place's solid parts, given in its own frame, put into the world where it stands (made again when it moves). */
function Body({ id, boxes = [], posts = [] }: { id: PlaceId; boxes?: Box[]; posts?: Post[] }) {
  const p = usePlacement(id)
  const a = turnOf(p)
  const w = (at: V3): V3 => {
    const [x, z] = toWorld(p, at[0], at[2])
    return [x, at[1], z]
  }
  return (
    <RigidBody key={`${p.x}|${p.z}|${p.rot}`} type="fixed" colliders={false}>
      {boxes.map((b, i) => (
        <CuboidCollider key={i} args={b.half} position={w(b.at)} rotation={[0, a, 0]} />
      ))}
      {posts.map((c, i) => (
        <CylinderCollider key={`c${i}`} args={[c.half, c.radius]} position={w(c.at)} />
      ))}
    </RigidBody>
  )
}

/** Where a point of a place's own frame is in the world, where the place stands. */
const world = (p: Placement, x: number, y: number, z: number): V3 => {
  const [wx, wz] = toWorld(p, x, z)
  return [wx, y, wz]
}

/** A building or fitting sculpted with the kit (src/models/structures.ts), in its place's frame. */
function Sculpted({ make, name, position = [0, 0, 0], turn = 0 }: { make: () => Structure; name: string; position?: V3; turn?: number }) {
  const parts = useMemo(() => structureParts(make(), name), [make, name])
  useEffect(() => () => parts.dispose(), [parts])
  return <primitive object={parts.group} position={position} rotation-y={turn} />
}

const pastureTrough = () => troughModel(1.7, 0.55, 0.4)
const foldTrough = () => troughModel(1.1, 0.45, 0.34)

// ───────────────────────────── the hen run ─────────────────────────────

function HenRun() {
  const fence = useMemo(() => {
    const out: ReactNode[] = []
    const sides: [number, number, number, number][] = [
      [RUN.minX, RUN.minZ, RUN.maxX, RUN.minZ],
      [RUN.maxX, RUN.minZ, RUN.maxX, RUN.maxZ],
      [RUN.maxX, RUN.maxZ, RUN.minX, RUN.maxZ],
      [RUN.minX, RUN.maxZ, RUN.minX, RUN.minZ],
    ]
    sides.forEach(([x0, z0, x1, z1], k) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.ceil(len / 1.15)
      for (let i = 0; i < n; i++) {
        const t = i / n
        out.push(<B key={`p${k}-${i}`} size={[0.07, 0.95, 0.07]} position={[x0 + (x1 - x0) * t, 0.475, z0 + (z1 - z0) * t]} color={WOOD_DARK} radius={0.006} />)
      }
      const alongX = Math.abs(x1 - x0) > 0.01
      for (const y of [0.25, 0.55, 0.85]) {
        out.push(<B key={`r${k}-${y}`} size={alongX ? [len, 0.05, 0.025] : [0.025, 0.05, len]} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} color={WOOD} radius={0.004} />)
      }
    })
    return out
  }, [])
  return (
    <Placed id="hens">
      {/* the coop: a hen house on legs in the run (sculpted), its nest box poking out through the fence */}
      <Sculpted make={coopModel} name="coop" position={[COOP.x, 0, COOP.z]} />
      <StaticBatch>
        <group position={[NEST.x, 0, NEST.z]}>
          <B size={[0.4, 0.03, 0.44]} position={[0, 0.615, 0]} color={WOOD} radius={0.004} />
          <B size={[0.4, 0.2, 0.03]} position={[0, 0.7, -0.22]} color={WOOD} radius={0.004} />
          <B size={[0.4, 0.2, 0.03]} position={[0, 0.7, 0.22]} color={WOOD} radius={0.004} />
          <B size={[0.03, 0.12, 0.44]} position={[-0.2, 0.66, 0]} color={WOOD} radius={0.004} />
          <B size={[0.36, 0.02, 0.4]} position={[0, 0.635, 0]} color="#d9c18a" roughness={1} radius={0} />
          <B size={[0.06, 0.6, 0.06]} position={[-0.17, 0.3, 0]} color={WOOD_DARK} radius={0.006} />
        </group>
        {fence}
      </StaticBatch>
    </Placed>
  )
}

function HenRunBody() {
  const midX = (RUN.minX + RUN.maxX) / 2
  const midZ = (RUN.minZ + RUN.maxZ) / 2
  const hx = (RUN.maxX - RUN.minX) / 2
  const hz = (RUN.maxZ - RUN.minZ) / 2
  return (
    <Body
      id="hens"
      boxes={[
        { half: [hx, 0.55, 0.05], at: [midX, 0.55, RUN.minZ] },
        { half: [hx, 0.55, 0.05], at: [midX, 0.55, RUN.maxZ] },
        { half: [0.05, 0.55, hz], at: [RUN.minX, 0.55, midZ] },
        { half: [0.05, 0.55, hz], at: [RUN.maxX, 0.55, midZ] },
        // the nest box outside the west fence
        { half: [0.22, 0.4, 0.24], at: [NEST.x, 0.4, NEST.z] },
      ]}
    />
  )
}

function Nest() {
  const p = usePlacement('hens')
  const stand = world(p, NEST.x - 0.45, 0.9, NEST.z)
  const box = world(p, NEST.x, 0.66, NEST.z)
  useInteractable({
    id: 'farm-nest',
    position: stand,
    aim: box,
    radius: 2.2,
    enabled: () => farm.eggs > 0,
    ready: () => (farm.eggs >= EGG.max ? { item: 'egg', count: farm.eggs } : null),
    label: () => `Collect ${count('egg', farm.eggs)}`,
    icon: () => ({ verb: 'pick', item: 'egg', count: farm.eggs }),
    run: () => {
      collectEggs()
      playGesture('interact')
      const { pan, near } = placeSound(box[0], box[2])
      farmSound('cluck', pan, near)
    },
  })
  return null
}

// ───────────────────────────── the cows' pasture ─────────────────────────────

/** The pasture's sides (its own frame); a side the land's hedge or fence already closes gets no fence of its own. */
type Side = 'north' | 'south' | 'east'
const PASTURE_SIDES: Record<Side, [number, number, number, number]> = {
  north: [PASTURE.minX, PASTURE.minZ, PASTURE.maxX, PASTURE.minZ],
  south: [PASTURE.minX, PASTURE.maxZ, PASTURE.maxX, PASTURE.maxZ],
  east: [PASTURE.maxX, PASTURE.minZ, PASTURE.maxX, PASTURE.maxZ],
}

function useOpenSides(): Side[] {
  const p = usePlacement('cows')
  const land = useFarm(() => farm.layout.land.join(','))
  return useMemo(
    () =>
      (Object.keys(PASTURE_SIDES) as Side[]).filter((s) => {
        const [x0, z0, x1, z1] = PASTURE_SIDES[s]
        return !alongBoundary(farm.layout, toWorld(p, x0, z0), toWorld(p, x1, z1))
      }),
    // the land is read from the farm; its key is what changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, land],
  )
}

function Pasture({ sides }: { sides: Side[] }) {
  const fence = useMemo(() => {
    const { minX, maxZ, minZ, gateZ, gateWidth } = PASTURE
    const out: ReactNode[] = []
    const runs: [number, number, number, number][] = [...sides.map((s) => PASTURE_SIDES[s]), [minX, minZ, minX, gateZ - gateWidth / 2], [minX, gateZ + gateWidth / 2, minX, maxZ]]
    runs.forEach(([x0, z0, x1, z1], k) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 1.4))
      for (let i = 0; i <= n; i++) {
        const t = i / n
        out.push(<B key={`pp${k}-${i}`} size={[0.09, 1.1, 0.09]} position={[x0 + (x1 - x0) * t, 0.55, z0 + (z1 - z0) * t]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0.01} />)
      }
      const alongX = Math.abs(x1 - x0) > 0.01
      for (const y of [0.45, 0.9]) {
        out.push(<B key={`pr${k}-${y}`} size={alongX ? [len, 0.08, 0.04] : [0.04, 0.08, len]} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} color={WOOD} mat="veneer" tile={0.9} radius={0.006} />)
      }
    })
    // the gate stands open, swung into the pasture
    out.push(
      <group key="pgate" position={[minX, 0, gateZ + gateWidth / 2]} rotation={[0, -1.25, 0]}>
        {[0.3, 0.75].map((y) => (
          <B key={y} size={[0.04, 0.09, gateWidth - 0.1]} position={[0.03, y, -(gateWidth - 0.1) / 2]} color={WOOD} radius={0.006} />
        ))}
        <B size={[0.04, 0.95, 0.07]} position={[0.03, 0.5, -gateWidth + 0.12]} color={WOOD} radius={0.006} />
      </group>,
    )
    return out
  }, [sides])
  return (
    <>
      <Sculpted make={pastureTrough} name="trough" position={[TROUGH.x, 0, TROUGH.z]} />
      <StaticBatch>
        {fence}
        {/* a hay rack along the east side (the water trough beside it is sculpted, below) */}
        <group position={[HAY_RACK.x, 0, HAY_RACK.z]}>
          {[-1, 1].flatMap((sz) => [-1, 1].map((sx) => <B key={`${sx}${sz}`} size={[0.06, 1.0, 0.06]} position={[sx * 0.25, 0.5, sz * 0.5]} color={WOOD_DARK} radius={0.006} />))}
          <B size={[0.56, 0.05, 1.06]} position={[0, 0.98, 0]} color={WOOD} radius={0.006} />
          <mesh position={[0, 0.62, 0]} scale={[0.26, 0.3, 0.5]} castShadow receiveShadow>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#d6b660" roughness={1} />
          </mesh>
        </group>
      </StaticBatch>
    </>
  )
}

function PastureBody({ sides }: { sides: Side[] }) {
  const { minX, maxX, minZ, maxZ, gateZ, gateWidth } = PASTURE
  const midX = (minX + maxX) / 2
  const boxes: Box[] = [
    { half: [0.06, 0.6, (gateZ - gateWidth / 2 - minZ) / 2], at: [minX, 0.6, (minZ + gateZ - gateWidth / 2) / 2] },
    { half: [0.06, 0.6, (maxZ - gateZ - gateWidth / 2) / 2], at: [minX, 0.6, (maxZ + gateZ + gateWidth / 2) / 2] },
    { half: [0.3, 0.25, 0.86], at: [TROUGH.x, 0.25, TROUGH.z] },
    { half: [0.3, 0.5, 0.55], at: [HAY_RACK.x, 0.5, HAY_RACK.z] },
  ]
  if (sides.includes('north')) boxes.push({ half: [(maxX - minX) / 2, 0.6, 0.06], at: [midX, 0.6, minZ] })
  if (sides.includes('south')) boxes.push({ half: [(maxX - minX) / 2, 0.6, 0.06], at: [midX, 0.6, maxZ] })
  if (sides.includes('east')) boxes.push({ half: [0.06, 0.6, (maxZ - minZ) / 2], at: [maxX, 0.6, (minZ + maxZ) / 2] })
  return <Body id="cows" boxes={boxes} />
}

function CowPasture() {
  const sides = useOpenSides()
  const key = sides.join(',')
  return (
    <>
      <Placed id="cows">
        <Pasture key={key} sides={sides} />
      </Placed>
      <PastureBody sides={sides} />
    </>
  )
}

// ───────────────────────────── the sheep fold ─────────────────────────────

function Fold() {
  const parts = useMemo(() => {
    const { minX, maxX, minZ, maxZ, gateX, gateWidth } = FOLD
    const out: ReactNode[] = []
    const runs: [number, number, number, number][] = [
      [minX, minZ, maxX, minZ],
      [minX, minZ, minX, maxZ],
      [maxX, minZ, maxX, maxZ],
      [minX, maxZ, gateX - gateWidth / 2, maxZ],
      [gateX + gateWidth / 2, maxZ, maxX, maxZ],
    ]
    runs.forEach(([x0, z0, x1, z1], k) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 1.3))
      for (let i = 0; i <= n; i++) {
        const t = i / n
        out.push(<B key={`fp${k}-${i}`} size={[0.08, 0.95, 0.08]} position={[x0 + (x1 - x0) * t, 0.475, z0 + (z1 - z0) * t]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0} />)
      }
      const alongX = Math.abs(x1 - x0) > 0.01
      for (const y of [0.35, 0.75]) {
        out.push(<B key={`fr${k}-${y}`} size={alongX ? [len, 0.07, 0.035] : [0.035, 0.07, len]} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} color={WOOD} mat="veneer" tile={0.9} radius={0} />)
      }
    })
    out.push(
      <group key="fgate" position={[gateX - gateWidth / 2, 0, maxZ]} rotation={[0, 1.2, 0]}>
        {[0.28, 0.68].map((y) => (
          <B key={y} size={[gateWidth - 0.1, 0.08, 0.035]} position={[(gateWidth - 0.1) / 2, y, -0.02]} color={WOOD} radius={0} />
        ))}
        <B size={[0.06, 0.85, 0.035]} position={[gateWidth - 0.12, 0.45, -0.02]} color={WOOD} radius={0} />
      </group>,
    )
    // the lean-to in the north-west corner: three posts, a back wall of boards and a sloping roof
    out.push(
      <group key="shelter" position={[minX + 0.15, 0, minZ + 0.12]}>
        {[0.05, 1.1, 2.15].map((x) => (
          <B key={x} size={[0.09, 1.5, 0.09]} position={[x, 0.75, 1.25]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0} />
        ))}
        <B size={[2.25, 1.75, 0.06]} position={[1.1, 0.875, 0.04]} color="#7b5a3c" mat="veneer" tile={0.7} radius={0} />
        <B size={[2.45, 0.06, 1.55]} position={[1.1, 1.62, 0.66]} rotation={[0.2, 0, 0]} color="#5d4a3a" mat="veneer" tile={0.6} radius={0} />
        <mesh position={[0.9, 0.12, 0.6]} scale={[0.75, 0.16, 0.45]} receiveShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#d8bd6a" roughness={1} />
        </mesh>
      </group>,
    )
    return out
  }, [])
  return (
    <Placed id="sheep">
      <StaticBatch>{parts}</StaticBatch>
      {/* a trough in the north-east corner, along the fence */}
      <Sculpted make={foldTrough} name="trough" position={[FOLD.maxX - 0.75, 0, FOLD.minZ + 0.55]} turn={Math.PI / 2} />
    </Placed>
  )
}

function FoldBody() {
  const { minX, maxX, minZ, maxZ, gateX, gateWidth } = FOLD
  return (
    <Body
      id="sheep"
      boxes={[
        { half: [(maxX - minX) / 2, 0.5, 0.05], at: [(minX + maxX) / 2, 0.5, minZ] },
        { half: [0.05, 0.5, (maxZ - minZ) / 2], at: [minX, 0.5, (minZ + maxZ) / 2] },
        { half: [0.05, 0.5, (maxZ - minZ) / 2], at: [maxX, 0.5, (minZ + maxZ) / 2] },
        { half: [(gateX - gateWidth / 2 - minX) / 2, 0.5, 0.05], at: [(minX + gateX - gateWidth / 2) / 2, 0.5, maxZ] },
        { half: [(maxX - gateX - gateWidth / 2) / 2, 0.5, 0.05], at: [(maxX + gateX + gateWidth / 2) / 2, 0.5, maxZ] },
        // the lean-to's back wall, and the trough
        { half: [1.15, 0.9, 0.08], at: [minX + 1.25, 0.9, minZ + 0.16] },
        { half: [0.6, 0.18, 0.25], at: [maxX - 0.75, 0.18, minZ + 0.55] },
      ]}
    />
  )
}

// ───────────────────────────── trees ─────────────────────────────

function LemonTree() {
  const p = usePlacement('lemon')
  useInteractable({
    id: 'farm-lemon-tree',
    position: world(p, 0, 1.0, 0),
    aim: world(p, 0, 1.6, 0),
    radius: 2.6,
    enabled: () => farm.lemons > 0,
    ready: () => (farm.lemons >= LEMON_TREE.max ? { item: 'lemon', count: farm.lemons } : null),
    label: () => `Pick ${count('lemon', farm.lemons)}`,
    icon: () => ({ verb: 'pick', item: 'lemon', count: farm.lemons }),
    run: () => {
      pickLemons()
      playGesture('interact')
      const { pan, near } = placeSound(p.x, p.z)
      farmSound('harvest', pan, near)
    },
  })
  return (
    <>
      {/* sculpted with the kit (src/models/structures.ts); the lemons hang from it (Plants.tsx) */}
      <Placed id="lemon">
        <Sculpted make={lemonTreeModel} name="lemon-tree" />
      </Placed>
      <Body id="lemon" posts={[{ half: 0.9, radius: 0.17, at: [0, 0.9, 0] }]} />
    </>
  )
}

const CROWN_COLOURS = ['#5d7d43', '#6f8a46', '#4f6e3f']

/** One of the three big trees that start in the garden's corners. Like the woods, they throw no shadow: the sun is
 *  low in the south-east and must keep reaching the windows. */
function BigTree({ index }: { index: number }) {
  const id = `tree${index}` as PlaceId
  const [, , height] = CORNER_TREES[index]
  const parts = useMemo(() => tree(0, 0, height, 21 + index), [height, index])
  useEffect(
    () => () => {
      parts.wood.dispose()
      parts.crown.dispose()
    },
    [parts],
  )
  const leaves = useMemo(() => surface('grass', 1, 1), [])
  const bark = useMemo(() => surface('veneer', 1, 1), [])
  return (
    <>
      <Placed id={id}>
        <mesh geometry={parts.wood}>
          <meshStandardMaterial color="#6a5a4c" map={bark.map} normalMap={bark.normalMap} roughness={0.95} />
        </mesh>
        <mesh geometry={parts.crown}>
          <meshStandardMaterial color={CROWN_COLOURS[index % 3]} map={leaves.map} normalMap={leaves.normalMap} roughnessMap={leaves.roughnessMap} roughness={1} normalScale={[1.4, 1.4]} />
        </mesh>
      </Placed>
      <Body id={id} posts={[{ half: 1.2, radius: 0.32, at: [0, 1.2, 0] }]} />
    </>
  )
}

/** Every movable place, with its colliders and what you can do there. */
export function Places() {
  return (
    <>
      <HenRun />
      <HenRunBody />
      <Nest />
      <CowPasture />
      <Fold />
      <FoldBody />
      <LemonTree />
      {CORNER_TREES.map((_, i) => (
        <BigTree key={i} index={i} />
      ))}
    </>
  )
}
