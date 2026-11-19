import { useEffect, useMemo } from 'react'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { MeshStandardMaterial, Vector2 } from 'three'
import { FARM_SHRUBS, HOUSE_SHRUBS } from '../data/garden'
import { LANE } from '../data/layout'
import { surface } from '../lib/proceduralTextures'
import { seasonal } from '../lib/sculpt/material'
import { StaticBatch } from '../scene/House'
import { shrubs } from '../scene/flora'

// The farm map's ground (src/scene/Maps.tsx): the lawn as far as the eye goes, the lane outside the farm gate where
// buyers come and go, the shrubs by the west boundary and the ground you walk on. The house stands on a map of its own,
// so where it stood is lawn like the rest. The boundary (a hedge, a fence) and the woods follow the land the farm owns
// (src/farm/Land.tsx); the beds, runs and trees are the farm's own (src/farm).
// The season (src/lib/sculpt/material.ts) colours the lawn and lies on it as snow, turns the shrubs' leaves and caps them;
// the lane is swept.

export function FarmGround() {
  const grass = useMemo(() => surface('grass', 260, 260), [])
  const leaves = useMemo(() => surface('grass', 1, 1), [])
  const gravel = useMemo(() => surface('stone', 64, 1), [])
  // the shrubs by the boundary, each as it always was (the ones along the house went with it)
  const bushes = useMemo(() => shrubs(HOUSE_SHRUBS.length, HOUSE_SHRUBS.length + FARM_SHRUBS.length), [])
  const mats = useMemo(
    () => ({
      lawn: seasonal(new MeshStandardMaterial({ map: grass.map, normalMap: grass.normalMap, roughnessMap: grass.roughnessMap, roughness: 1 }), { grass: true }),
      bushes: seasonal(
        new MeshStandardMaterial({ color: '#6e8a52', map: leaves.map, normalMap: leaves.normalMap, roughnessMap: leaves.roughnessMap, roughness: 1, normalScale: new Vector2(1.4, 1.4) }),
        { foliage: true },
      ),
    }),
    [grass, leaves],
  )
  useEffect(() => () => bushes.dispose(), [bushes])
  useEffect(
    () => () => {
      mats.lawn.dispose()
      mats.bushes.dispose()
    },
    [mats],
  )
  return (
    <group name="farm-ground">
      <StaticBatch>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow material={mats.lawn}>
          <planeGeometry args={[800, 800]} />
        </mesh>
        {/* the lane outside the farm gate, where buyers come and go */}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, LANE.z]} receiveShadow>
          <planeGeometry args={[160, LANE.width]} />
          <meshStandardMaterial color="#b3a184" map={gravel.map} normalMap={gravel.normalMap} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
        <mesh geometry={bushes} castShadow receiveShadow material={mats.bushes} />
      </StaticBatch>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[60, 0.25, 60]} position={[0, -0.27, 0]} />
        {FARM_SHRUBS.map(([x, z]) => (
          <CylinderCollider key={`s${x}${z}`} args={[0.6, 0.45]} position={[x, 0.6, z]} />
        ))}
      </RigidBody>
    </group>
  )
}
