import { useEffect, useMemo } from 'react'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { BufferGeometry, Color, Float32BufferAttribute, MeshStandardMaterial, PlaneGeometry, SphereGeometry, Vector2 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { HOUSE_SHRUBS } from '../data/garden'
import { COUNTRY_LANE, COUNTRY_TREES, DRIVE, FIELDS, GARDEN_TREE, HILLS, PLOT } from '../data/home'
import { HOUSE } from '../data/layout'
import { surface } from '../lib/proceduralTextures'
import { B } from './Furnishings'
import { fenceRun, shrubs, tree } from './flora'

// The house's own plot, the home map round it (src/data/home.ts): the lawn, a paved apron along the walls with the
// shrubs by them, a gravel driveway where the car stands out to a gate in the east fence, a slatted timber fence round
// it all, a tree in the corner, and the country lane beyond the gate. All of it static: <House /> merges it into a
// handful of draws. Round it a quiet countryside (`Countryside`), drawn far off and light.

const FENCE = '#7a6048'
const WOOD_DARK = '#5b4636'

/** The fence round the plot as one geometry: every side but the gate's opening in the east fence. */
function fenceGeometry(): BufferGeometry {
  const { minX, maxX, minZ, maxZ } = PLOT
  const runs = [
    ...fenceRun('x', minZ, minX, maxX),
    ...fenceRun('x', maxZ, minX, maxX),
    ...fenceRun('z', minX, minZ, maxZ),
    ...fenceRun('z', maxX, minZ, DRIVE.minZ),
    ...fenceRun('z', maxX, DRIVE.maxZ, maxZ),
  ]
  return mergeGeometries(runs.map((g) => (g.index ? g.toNonIndexed() : g)))!
}

/** A wall's collider along a side of the plot (2.4 m tall: nobody jumps the fence), just outside its line. */
function Side({ axis, at, from, to, out }: { axis: 'x' | 'z'; at: number; from: number; to: number; out: number }) {
  const half = (to - from) / 2 + 0.05
  const mid = (from + to) / 2
  return axis === 'x' ? <CuboidCollider args={[half, 1.2, 0.1]} position={[mid, 1.2, at + 0.05 * out]} /> : <CuboidCollider args={[0.1, 1.2, half]} position={[at + 0.05 * out, 1.2, mid]} />
}

/** The gate across the driveway in the east fence, shut: two posts and a five-barred leaf. */
function Gate() {
  const w = DRIVE.maxZ - DRIVE.minZ
  const mid = (DRIVE.minZ + DRIVE.maxZ) / 2
  return (
    <group position={[PLOT.maxX, 0, mid]}>
      {[-1, 1].map((s) => (
        <B key={s} size={[0.14, 1.35, 0.14]} position={[0, 0.675, (s * w) / 2]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0.01} />
      ))}
      {[0.25, 0.45, 0.65, 0.85, 1.05].map((y) => (
        <B key={y} size={[0.05, 0.09, w - 0.2]} position={[0, y, 0]} color={FENCE} mat="veneer" tile={0.9} radius={0.008} />
      ))}
      <B size={[0.05, 0.09, Math.hypot(w - 0.3, 0.8)]} position={[0, 0.65, 0]} rotation={[Math.atan2(0.8, w - 0.3), 0, 0]} color={FENCE} mat="veneer" tile={0.9} radius={0.008} />
    </group>
  )
}

/** The plot round the house: drawn (merged by <House />) and solid. */
export function Exterior() {
  const grass = useMemo(() => surface('grass', 260, 260), [])
  const leaves = useMemo(() => surface('grass', 1, 1), [])
  const gravel = useMemo(() => surface('stone', 64, 1), [])
  const drive = useMemo(() => surface('gravel', (DRIVE.maxX - DRIVE.minX) / 1.6, (DRIVE.maxZ - DRIVE.minZ) / 1.6), [])
  const bark = useMemo(() => surface('veneer', 1, 1), [])
  // the shrubs along the walls, each as it always was
  const bushes = useMemo(() => shrubs(0, HOUSE_SHRUBS.length), [])
  const fence = useMemo(fenceGeometry, [])
  const corner = useMemo(() => tree(GARDEN_TREE[0], GARDEN_TREE[1], GARDEN_TREE[2], 61), [])
  useEffect(
    () => () => {
      for (const g of [bushes, fence, corner.wood, corner.crown]) g.dispose()
    },
    [bushes, fence, corner],
  )
  const w = HOUSE.maxX - HOUSE.minX + 3.2
  const d = HOUSE.maxZ - HOUSE.minZ + 3.2
  const lane = 300
  return (
    <group>
      {/* The lawn and the apron run on under the house, a few centimetres below its floors. Hidden there, but over so
          large a plane the depth the renderer works out can come out a hair nearer than the floor's at a low angle,
          and the grass shows through: the drawing pass (src/lib/visibility) draws them always, so nothing changes. */}
      <group userData={{ cell: 'always' }}>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow>
          <planeGeometry args={[800, 800]} />
          <meshStandardMaterial map={grass.map} normalMap={grass.normalMap} roughnessMap={grass.roughnessMap} roughness={1} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.015, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#9a9c98" roughness={0.95} />
        </mesh>
      </group>
      {/* the driveway, gravel from beside the house through the gate to the lane */}
      <mesh rotation-x={-Math.PI / 2} position={[(DRIVE.minX + DRIVE.maxX) / 2, -0.012, (DRIVE.minZ + DRIVE.maxZ) / 2]} receiveShadow>
        <planeGeometry args={[DRIVE.maxX - DRIVE.minX, DRIVE.maxZ - DRIVE.minZ]} />
        <meshStandardMaterial color="#c9bfae" map={drive.map} normalMap={drive.normalMap} roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      {/* the country lane outside the gate */}
      <mesh rotation-x={-Math.PI / 2} position={[COUNTRY_LANE.x, -0.02, 0]} receiveShadow>
        <planeGeometry args={[COUNTRY_LANE.width, lane]} />
        <meshStandardMaterial color="#b3a184" map={gravel.map} normalMap={gravel.normalMap} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh geometry={bushes} castShadow receiveShadow>
        <meshStandardMaterial color="#6e8a52" map={leaves.map} normalMap={leaves.normalMap} roughnessMap={leaves.roughnessMap} roughness={1} normalScale={[1.4, 1.4]} />
      </mesh>
      <mesh geometry={fence} castShadow receiveShadow>
        <meshStandardMaterial color={FENCE} map={bark.map} normalMap={bark.normalMap} roughness={0.85} />
      </mesh>
      <Gate />
      {/* the corner tree, like the farm's: no shadow (the sun is low in the south-east and must keep reaching the
          windows) */}
      <mesh geometry={corner.wood}>
        <meshStandardMaterial color="#6a5a4c" map={bark.map} normalMap={bark.normalMap} roughness={0.95} />
      </mesh>
      <mesh geometry={corner.crown}>
        <meshStandardMaterial color="#6f8a46" map={leaves.map} normalMap={leaves.normalMap} roughnessMap={leaves.roughnessMap} roughness={1} normalScale={[1.4, 1.4]} />
      </mesh>
    </group>
  )
}

/** What is solid round the house: the ground, the fence (the gate shut), the shrubs and the corner tree. */
export function ExteriorColliders() {
  const { minX, maxX, minZ, maxZ } = PLOT
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[40, 0.25, 40]} position={[0, -0.27, 0]} />
      <Side axis="x" at={minZ} from={minX} to={maxX} out={-1} />
      <Side axis="x" at={maxZ} from={minX} to={maxX} out={1} />
      <Side axis="z" at={minX} from={minZ} to={maxZ} out={-1} />
      <Side axis="z" at={maxX} from={minZ} to={maxZ} out={1} />
      {HOUSE_SHRUBS.map(([x, z]) => (
        <CylinderCollider key={`s${x}${z}`} args={[0.6, 0.45]} position={[x, 0.6, z]} />
      ))}
      <CylinderCollider args={[1.2, 0.32]} position={[GARDEN_TREE[0], 1.2, GARDEN_TREE[1]]} />
    </RigidBody>
  )
}

/** Vertex colours for a geometry, all one colour. */
function paint(g: BufferGeometry, color: string): BufferGeometry {
  const c = new Color(color)
  const n = g.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new Float32BufferAttribute(a, 3))
  return g
}

/**
 * The countryside round the plot, seen over the fence and from the windows: a few trees (each its own mesh, so the
 * drawing pass leaves out those not in view; their trunks together), fields and low hills on the horizon (each all one
 * mesh: a few thousand triangles at most). Nothing here throws a shadow, and nothing is solid: you never get there.
 */
export function Countryside() {
  const built = useMemo(() => {
    const trees = COUNTRY_TREES.map(([x, z, h], i) => tree(x, z, h, 70 + i, 1))
    const wood = mergeGeometries(trees.map((t) => t.wood))!
    const hills = mergeGeometries(
      HILLS.map(([x, z, rx, rz, h, color]) => {
        const g = new SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2)
        g.scale(rx, h, rz)
        g.translate(x, -1.5, z)
        return paint(g.toNonIndexed(), color)
      }),
    )!
    const fields = mergeGeometries(
      FIELDS.map(([x, z, fw, fd, turn, color]) => {
        const g = new PlaneGeometry(fw, fd)
        g.rotateX(-Math.PI / 2)
        g.rotateY(turn)
        g.translate(x, -0.022, z)
        return paint(g.toNonIndexed(), color)
      }),
    )!
    return { crowns: trees.map((t) => t.crown), wood, hills, fields }
  }, [])
  const mats = useMemo(() => {
    const leaves = surface('grass', 1, 1)
    const bark = surface('veneer', 1, 1)
    const crown = (color: string) =>
      new MeshStandardMaterial({ color, map: leaves.map, normalMap: leaves.normalMap, roughnessMap: leaves.roughnessMap, roughness: 1, normalScale: new Vector2(1.4, 1.4) })
    return {
      shades: ['#5d7d43', '#6f8a46', '#4f6e3f'].map(crown),
      wood: new MeshStandardMaterial({ color: '#6a5a4c', map: bark.map, normalMap: bark.normalMap, roughness: 0.95 }),
      land: new MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      // the fields lie on the lawn: drawn over it
      fields: new MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      maps: [leaves.map, leaves.normalMap, leaves.roughnessMap, bark.map, bark.normalMap, bark.roughnessMap],
    }
  }, [])
  useEffect(
    () => () => {
      for (const g of [...built.crowns, built.wood, built.hills, built.fields]) g.dispose()
      for (const m of [...mats.shades, mats.wood, mats.land, mats.fields]) m.dispose()
      for (const t of mats.maps) t.dispose()
    },
    [built, mats],
  )
  return (
    <group name="countryside">
      {built.crowns.map((g, i) => (
        <mesh key={i} name="country-tree" geometry={g} material={mats.shades[i % 3]} />
      ))}
      <mesh geometry={built.wood} material={mats.wood} />
      <mesh geometry={built.fields} material={mats.fields} receiveShadow />
      <mesh geometry={built.hills} material={mats.land} />
    </group>
  )
}
