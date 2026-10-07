import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { HOUSE, ROOMS, type FloorKind } from '../data/layout'
import { surface } from '../lib/proceduralTextures'

// metres of floor covered by one texture tile
const TILE: Record<FloorKind, number> = { wood: 2.4, tile: 1.4, carpet: 1.6 }
const NORMAL: Record<FloorKind, number> = { wood: 0.7, tile: 1, carpet: 0.6 }

function RoomFloor({ id }: { id: keyof typeof ROOMS }) {
  const room = ROOMS[id]
  const { minX, maxX, minZ, maxZ } = room.bounds
  const w = maxX - minX
  const d = maxZ - minZ
  const t = TILE[room.floor]
  const tex = useMemo(() => surface(room.floor, w / t, d / t), [room.floor, w, d, t])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(minX + maxX) / 2, 0, (minZ + maxZ) / 2]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial
        map={tex.map}
        normalMap={tex.normalMap}
        normalScale={[NORMAL[room.floor], NORMAL[room.floor]]}
        roughnessMap={tex.roughnessMap}
        roughness={1}
        color={room.floorTint}
        envMapIntensity={room.floor === 'carpet' ? 0.4 : 1}
      />
    </mesh>
  )
}

export function Floors() {
  const w = HOUSE.maxX - HOUSE.minX
  const d = HOUSE.maxZ - HOUSE.minZ
  return (
    <group>
      {(Object.keys(ROOMS) as (keyof typeof ROOMS)[]).map((id) => (
        <RoomFloor key={id} id={id} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w / 2 + 0.5, 0.25, d / 2 + 0.5]} position={[0, -0.25, 0]} />
        <CuboidCollider args={[60, 0.25, 60]} position={[0, -0.27, 0]} />
      </RigidBody>
    </group>
  )
}
