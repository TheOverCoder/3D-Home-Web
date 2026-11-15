import { useEffect, useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { HOUSE, ROOMS, type FloorKind, type RoomId } from '../data/layout'
import { farm, useFarm } from '../farm/state'
import { ROOM_IDS, floorById } from '../home/shell'
import { surface } from '../lib/proceduralTextures'

// metres of floor covered by one texture tile
const TILE: Record<FloorKind, number> = { wood: 2.4, tile: 1.4, carpet: 1.6, stone: 1.8, grass: 3 }
const NORMAL: Record<FloorKind, number> = { wood: 0.7, tile: 1, carpet: 0.6, stone: 0.8, grass: 1 }

/** A room's floor as the house's shell has it (src/home/shell.ts): its surface and its tint. */
function RoomFloor({ id, finish }: { id: RoomId; finish: string }) {
  const room = ROOMS[id]
  const floor = floorById(finish) ?? floorById('oak')!
  const { minX, maxX, minZ, maxZ } = room.bounds
  const w = maxX - minX
  const d = maxZ - minZ
  const t = TILE[floor.kind]
  const tex = useMemo(() => surface(floor.kind, w / t, d / t), [floor.kind, w, d, t])
  useEffect(() => () => [tex.map, tex.normalMap, tex.roughnessMap].forEach((x) => x.dispose()), [tex])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(minX + maxX) / 2, 0, (minZ + maxZ) / 2]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial
        map={tex.map}
        normalMap={tex.normalMap}
        normalScale={[NORMAL[floor.kind], NORMAL[floor.kind]]}
        roughnessMap={tex.roughnessMap}
        roughness={1}
        color={floor.tint}
        envMapIntensity={floor.kind === 'carpet' ? 0.4 : 1}
      />
    </mesh>
  )
}

export function Floors() {
  const floors = useFarm(() => farm.home.shell.floors)
  const w = HOUSE.maxX - HOUSE.minX
  const d = HOUSE.maxZ - HOUSE.minZ
  return (
    <group>
      {ROOM_IDS.map((id) => (
        <RoomFloor key={id} id={id} finish={floors[id]} />
      ))}
      {/* (the ground round the house is its plot's: src/scene/Exterior.tsx) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w / 2 + 0.5, 0.25, d / 2 + 0.5]} position={[0, -0.25, 0]} />
      </RigidBody>
    </group>
  )
}
