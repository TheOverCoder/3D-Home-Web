import { useMemo } from 'react'
import { type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SHRUB_SPOTS } from '../data/garden'
import { HOUSE, LANE } from '../data/layout'
import { surface } from '../lib/proceduralTextures'
import { mulberry, shrub } from './flora'

// Round the house: the lawn, a paved apron along the walls, the lane outside the farm gate and shrubs along the
// house. All of it is static, so <House /> merges it into a handful of draws. The garden's boundary (a hedge to
// the north and west, a slatted timber fence to the south and east) and the woods beyond it follow the land the
// farm owns, so they are drawn by the farm (src/farm/Land.tsx); the farm itself (beds, runs, trees) is src/farm.

/** Lawn, a paved apron around the house, and the lane where buyers come and go. */
export function Exterior() {
  const grass = useMemo(() => surface('grass', 260, 260), [])
  const leaves = useMemo(() => surface('grass', 1, 1), [])
  const gravel = useMemo(() => surface('stone', 64, 1), [])
  const shrubs = useMemo(() => {
    // a border along the walls, never right in front of a window sill, and a few by the boundary
    const r = mulberry(9)
    const bushes: BufferGeometry[] = SHRUB_SPOTS.map(([x, z], i) => shrub(x, z, 0.55 + r() * 0.35, 100 + i))
    return mergeGeometries(bushes.map((g) => (g.index ? g.toNonIndexed() : g)))!
  }, [])
  const w = HOUSE.maxX - HOUSE.minX + 3.2
  const d = HOUSE.maxZ - HOUSE.minZ + 3.2
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
      {/* the lane outside the farm gate, where buyers come and go */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, LANE.z]} receiveShadow>
        <planeGeometry args={[160, LANE.width]} />
        <meshStandardMaterial color="#b3a184" map={gravel.map} normalMap={gravel.normalMap} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh geometry={shrubs} castShadow receiveShadow>
        <meshStandardMaterial color="#6e8a52" map={leaves.map} normalMap={leaves.normalMap} roughnessMap={leaves.roughnessMap} roughness={1} normalScale={[1.4, 1.4]} />
      </mesh>
    </group>
  )
}
