import { useEffect, useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SHRUB_SPOTS } from '../data/garden'
import { GARDEN, GATE, LANE } from '../data/layout'
import { surface } from '../lib/proceduralTextures'
import { fenceRun, hedgeRun, mulberry, tree, type TreeParts } from '../scene/flora'
import { boundary, ownedRects, type Edge, type FarmLayout, type ParcelId } from './layout'
import { farm, useFarm } from './state'

// The land the farm owns, drawn round its edge: a clipped hedge along the sides that face north and west, a
// slatted timber fence along those that face south and east (the sunny side, so it throws no shade into the rooms),
// with the farm gate in the garden's south fence; and the woods beyond. Buying a field moves all of it out round
// the new land: the woods step back so the field is open ground.

const SEP = 0.5 // a fence stops this short of a hedge it runs into

interface Built {
  hedge: BufferGeometry | null
  fence: BufferGeometry | null
  wood: BufferGeometry
  crowns: BufferGeometry[]
  edges: Edge[]
}

const flat = (gs: BufferGeometry[]) => gs.map((g) => (g.index ? g.toNonIndexed() : g))

/** The woods round the farm: a loose ring of broadleaf trees. One standing on land the farm owns has stepped back
 *  (outwards, away from the house) until it stands clear of it. */
function woods(layout: FarmLayout): TreeParts[] {
  const r = mulberry(9)
  // the same seed once laid out the shrubs: skip what it gave them, so the woods stand where they always have
  for (let i = 0; i < SHRUB_SPOTS.length; i++) r()
  const rects = ownedRects(layout)
  const onLand = (x: number, z: number) => rects.some((o) => x > o.minX - 3.5 && x < o.maxX + 3.5 && z > o.minZ - 3.5 && z < o.maxZ + 3.5)
  const out: TreeParts[] = []
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + (r() - 0.5) * 0.35
    let radius = 19 + r() * 9
    const height = 6 + r() * 4
    while (onLand(Math.cos(angle) * radius, Math.sin(angle) * radius) && radius < 80) radius += 1
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    // keep the lane outside the farm gate clear: those trees step back from it
    const onLane = Math.abs(z - LANE.z) < 3.2
    out.push(tree(x, onLane ? LANE.z + 5.5 + (i % 3) : z, height, 40 + i))
  }
  return out
}

function build(layout: FarmLayout): Built {
  const edges = boundary(layout)
  const hedges = edges.filter((e) => e.out === 'north' || e.out === 'west')
  // does a hedge run through this point (a fence meeting it stops short)?
  const onHedge = (x: number, z: number) =>
    hedges.some((h) => (h.axis === 'x' ? Math.abs(z - h.at) < 0.01 && x > h.from - 0.01 && x < h.to + 0.01 : Math.abs(x - h.at) < 0.01 && z > h.from - 0.01 && z < h.to + 0.01))
  const hedge: BufferGeometry[] = []
  const fence: BufferGeometry[] = []
  const runs = { north: 0, west: 0 }
  edges.forEach((e) => {
    if (e.out === 'north' || e.out === 'west') {
      // each hedge its own seed, so the sections never repeat (the garden's own two keep the ones they always had)
      const seed = (e.out === 'north' ? 3 : 5) + 4 * runs[e.out]++
      hedge.push(...hedgeRun(e.axis, e.at, e.axis === 'z' && e.from === GARDEN.minZ ? e.from + SEP : e.from, e.to, seed))
      return
    }
    const start = e.axis === 'x' ? onHedge(e.from, e.at) : onHedge(e.at, e.from)
    const end = e.axis === 'x' ? onHedge(e.to, e.at) : onHedge(e.at, e.to)
    const from = e.from + (start ? SEP : 0)
    const to = e.to - (end ? SEP : 0)
    // the farm gate is in the garden's south fence
    const gateL = GATE.x - GATE.width / 2
    const gateR = GATE.x + GATE.width / 2
    if (e.axis === 'x' && e.at === GARDEN.maxZ && from < gateL && to > gateR) {
      fence.push(...fenceRun('x', e.at, from, gateL), ...fenceRun('x', e.at, gateR, to))
    } else if (to - from > 0.3) fence.push(...fenceRun(e.axis, e.at, from, to))
  })
  const trees = woods(layout)
  return {
    hedge: hedge.length ? mergeGeometries(flat(hedge))! : null,
    fence: fence.length ? mergeGeometries(flat(fence))! : null,
    wood: mergeGeometries(trees.map((t) => t.wood))!,
    // three shades of green, every third tree in each
    crowns: [0, 1, 2].map((k) => mergeGeometries(trees.filter((_, i) => i % 3 === k).map((t) => t.crown))!),
    edges,
  }
}

function Boundary({ layout }: { layout: FarmLayout }) {
  const built = useMemo(() => build(layout), [layout])
  useEffect(
    () => () => {
      for (const g of [built.hedge, built.fence, built.wood, ...built.crowns]) g?.dispose()
    },
    [built],
  )
  const leaves = useMemo(() => surface('grass', 1, 1), [])
  const bark = useMemo(() => surface('veneer', 1, 1), [])
  const leafProps = { map: leaves.map, normalMap: leaves.normalMap, roughnessMap: leaves.roughnessMap, roughness: 1, normalScale: [1.4, 1.4] as [number, number] }
  return (
    <group name="farm-land">
      {built.hedge && (
        <mesh geometry={built.hedge} castShadow receiveShadow>
          <meshStandardMaterial color="#5f7a4a" {...leafProps} />
        </mesh>
      )}
      {built.fence && (
        <mesh geometry={built.fence} castShadow receiveShadow>
          <meshStandardMaterial color="#7a6048" map={bark.map} normalMap={bark.normalMap} roughness={0.85} />
        </mesh>
      )}
      {/* the woods throw no shadow: the sun is low in the south-east and must keep reaching the windows */}
      <mesh geometry={built.wood}>
        <meshStandardMaterial color="#6a5a4c" map={bark.map} normalMap={bark.normalMap} roughness={0.95} />
      </mesh>
      {built.crowns.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={['#5d7d43', '#6f8a46', '#4f6e3f'][i]} {...leafProps} />
        </mesh>
      ))}
      {/* the boundary is solid all round (you sell over the gate, you do not walk out of it) */}
      <RigidBody type="fixed" colliders={false}>
        {built.edges.map((e, i) => {
          const hedge = e.out === 'north' || e.out === 'west'
          const half = (e.to - e.from) / 2 + 0.05
          const depth = hedge ? 0.5 : 0.1
          // a fence's collider sits just outside its line
          const shift = hedge ? 0 : e.out === 'south' || e.out === 'east' ? 0.05 : -0.05
          const mid = (e.from + e.to) / 2
          return e.axis === 'x' ? (
            <CuboidCollider key={i} args={[half, 1.2, depth]} position={[mid, 1.2, e.at + shift]} />
          ) : (
            <CuboidCollider key={i} args={[depth, 1.2, half]} position={[e.at + shift, 1.2, mid]} />
          )
        })}
      </RigidBody>
    </group>
  )
}

/** The farm's boundary and the woods, made again whenever a field is bought. */
export function Land() {
  const key = useFarm(() => farm.layout.land.join(','))
  const land = useMemo(() => key.split(',').filter(Boolean) as ParcelId[], [key])
  const layout = useMemo<FarmLayout>(() => ({ places: farm.layout.places, land }), [land])
  return <Boundary key={key} layout={layout} />
}
