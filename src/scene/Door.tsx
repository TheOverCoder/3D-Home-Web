import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { MathUtils, Quaternion, Vector3 } from 'three'
import { DOOR } from '../data/layout'
import { useInteractable } from '../lib/interaction'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { B } from './Furnishings'

const axis = new Vector3(0, 1, 0)
const quat = new Quaternion()

/** Hinged door in the kitchen/bedroom doorway: swings on a kinematic body so the player is pushed, not clipped. */
export function Door() {
  const body = useRef<RapierRigidBody>(null)
  const angle = useRef(0)
  const open = useHome((s) => s.doors[DOOR.id])
  const toggleDoor = useHome((s) => s.toggleDoor)

  useFrame((_, dt) => {
    const b = body.current
    if (!b) return
    const target = useHome.getState().doors[DOOR.id] ? -DOOR.openAngle : 0
    angle.current = MathUtils.damp(angle.current, target, 5, dt)
    quat.setFromAxisAngle(axis, angle.current)
    b.setNextKinematicRotation(quat)
  })

  const [hx, , hz] = DOOR.hinge
  useInteractable({
    id: DOOR.id,
    label: open ? 'Close the door' : 'Open the door',
    position: [hx + DOOR.width / 2, 1.0, hz],
    aim: [hx + DOOR.width / 2, 1.1, hz],
    radius: 1.7,
    run: () => {
      playGesture('interact')
      toggleDoor(DOOR.id)
    },
  })

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={DOOR.hinge}>
      <CuboidCollider
        args={[DOOR.width / 2, DOOR.height / 2, DOOR.thickness / 2]}
        position={[DOOR.width / 2, DOOR.height / 2, 0]}
      />
      <B size={[DOOR.width - 0.02, DOOR.height - 0.02, DOOR.thickness]} position={[DOOR.width / 2, DOOR.height / 2, 0]} color="#8a6a4c" roughness={0.55} radius={0.008} />
      <B size={[0.12, 0.03, 0.1]} position={[DOOR.width - 0.12, 1.0, 0]} color="#c9ccce" metalness={0.9} roughness={0.25} radius={0.008} />
    </RigidBody>
  )
}
