import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { HOUSE, ROOMS, type FloorKind } from '../data/layout'
import { floorTexture } from '../lib/proceduralTextures'

const SURFACE: Record<FloorKind, { roughness: number; metalness: number; tile: number }> = {
  wood: { roughness: 0.55, metalness: 0, tile: 2.4 },
  tile: { roughness: 0.28, metalness: 0.02, tile: 1.4 },
  carpet: { roughness: 1, metalness: 0, tile: 1.6 },
}

function RoomFloor({ id }: { id: keyof typeof ROOMS }) {
  const room = ROOMS[id]
  const { minX, maxX, minZ, maxZ } = room.bounds
  const w = maxX - minX
  const d = maxZ - minZ
  const s = SURFACE[room.floor]
  const map = useMemo(() => floorTexture(room.floor, w / s.tile, d / s.tile), [room.floor, w, d, s.tile])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(minX + maxX) / 2, 0, (minZ + maxZ) / 2]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={map} color={room.floorTint} roughness={s.roughness} metalness={s.metalness} />
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
      {/* the yard around the house */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#222a30" roughness={1} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w / 2 + 0.5, 0.25, d / 2 + 0.5]} position={[0, -0.25, 0]} />
        <CuboidCollider args={[40, 0.25, 40]} position={[0, -0.27, 0]} />
      </RigidBody>
    </group>
  )
}
