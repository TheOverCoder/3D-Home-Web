import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { PICKUPS, type PickupDef } from '../data/layout'
import { registerInteractable } from '../lib/interaction'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { B } from './Furnishings'

export function PickupMesh({ kind }: { kind: PickupDef['kind'] }) {
  switch (kind) {
    case 'mug':
      return (
        <group>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.045, 0.04, 0.09, 20]} />
            <meshStandardMaterial color="#f1efe8" roughness={0.3} />
          </mesh>
          <mesh position={[0.05, 0, 0]} rotation={[0, 0, 0]} castShadow>
            <torusGeometry args={[0.026, 0.008, 8, 16]} />
            <meshStandardMaterial color="#f1efe8" roughness={0.3} />
          </mesh>
        </group>
      )
    case 'book':
      return (
        <group>
          <B size={[0.2, 0.035, 0.28]} color="#b4543a" roughness={0.7} radius={0.004} />
          <B size={[0.19, 0.025, 0.27]} position={[0.004, 0, 0]} color="#efe9d9" roughness={0.9} radius={0} />
        </group>
      )
    case 'gift':
      return (
        <group>
          <B size={[0.26, 0.2, 0.26]} color="#3d6a8a" roughness={0.6} radius={0.008} />
          <B size={[0.27, 0.205, 0.04]} color="#f0c75e" roughness={0.5} radius={0.004} />
          <B size={[0.04, 0.205, 0.27]} color="#f0c75e" roughness={0.5} radius={0.004} />
        </group>
      )
  }
}

const HALF: Record<PickupDef['kind'], [number, number, number]> = {
  mug: [0.05, 0.047, 0.05],
  book: [0.1, 0.02, 0.14],
  gift: [0.13, 0.1, 0.13],
}

function Pickup({ def }: { def: PickupDef }) {
  const item = useHome((s) => s.items[def.id])
  const carried = useHome((s) => s.carrying === def.id)
  const body = useRef<RapierRigidBody>(null)
  const position = useRef({ x: item.pos[0], y: item.pos[1], z: item.pos[2] })

  // The interactable follows the physics body, so a pushed or dropped item stays pickable.
  useEffect(() => {
    if (carried) return
    position.current.x = item.pos[0]
    position.current.y = item.pos[1]
    position.current.z = item.pos[2]
    return registerInteractable({
      id: def.id,
      label: `Pick up the ${def.name}`,
      position: position.current,
      radius: 1.25,
      enabled: () => useHome.getState().carrying === null,
      run: () => {
        playGesture('pickup')
        useHome.getState().pickUp(def.id)
        useHome.getState().showToast(`Picked up the ${def.name}`)
      },
    })
  }, [carried, def.id, def.name, item.rev, item.pos])

  useFrame(() => {
    const b = body.current
    if (!b || carried) return
    const t = b.translation()
    position.current.x = t.x
    position.current.y = t.y
    position.current.z = t.z
  })

  if (carried) return null
  return (
    <RigidBody
      key={item.rev}
      ref={body}
      position={item.pos}
      colliders={false}
      mass={0.4}
      friction={0.9}
      restitution={0.05}
      linearDamping={0.4}
      angularDamping={0.8}
    >
      <CuboidCollider args={HALF[def.kind]} />
      <PickupMesh kind={def.kind} />
    </RigidBody>
  )
}

export function Pickups() {
  return (
    <>
      {PICKUPS.map((def) => (
        <Pickup key={def.id} def={def} />
      ))}
    </>
  )
}
