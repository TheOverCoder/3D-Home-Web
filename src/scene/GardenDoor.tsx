import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { BoxGeometry, DoubleSide, MathUtils, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { doorSound, placeSound } from '../audio/sound'
import { GARDEN_DOOR as D } from '../data/layout'
import { debugSet } from '../lib/debug'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'

const LEAF_W = D.width / 2 - 0.03 // two leaves, overlapping a little in the middle
const LEAF_H = D.top - 0.06
const LEAF_T = 0.035
const RAIL = 0.045
const OPEN_NEAR = 2.6 // opens when you come this close…
const CLOSE_FAR = 3.3 // …and closes once you are this far away again

/** Exposed for the tests and the camera: 0 shut … 1 fully open. */
export const gardenDoor = { open: 0 }

const target = new Vector3()

/**
 * The glass garden door in the living room's south wall: two leaves that slide apart into the wall (pocket
 * doors) as you walk up to it, inside or out, and close behind you. Each leaf rides a kinematic body, so a
 * closing leaf pushes rather than clips.
 */
export function GardenDoor() {
  const left = useRef<RapierRigidBody>(null)
  const right = useRef<RapierRigidBody>(null)
  const wanted = useRef(false)
  debugSet('gardenDoor', gardenDoor)

  const frame = useMemo(() => {
    const parts = [
      new BoxGeometry(LEAF_W, RAIL, LEAF_T + 0.01).translate(0, LEAF_H / 2 - RAIL / 2, 0),
      new BoxGeometry(LEAF_W, RAIL * 1.6, LEAF_T + 0.01).translate(0, -LEAF_H / 2 + RAIL * 0.8, 0),
      new BoxGeometry(RAIL, LEAF_H, LEAF_T + 0.01).translate(-LEAF_W / 2 + RAIL / 2, 0, 0),
      new BoxGeometry(RAIL, LEAF_H, LEAF_T + 0.01).translate(LEAF_W / 2 - RAIL / 2, 0, 0),
      // a pull bar on each face
      new BoxGeometry(0.025, 0.42, 0.03).translate(LEAF_W / 2 - 0.09, 0, LEAF_T / 2 + 0.02),
      new BoxGeometry(0.025, 0.42, 0.03).translate(LEAF_W / 2 - 0.09, 0, -LEAF_T / 2 - 0.02),
    ]
    return mergeGeometries(parts.map((g) => g.toNonIndexed()))!
  }, [])

  useFrame((_, dt) => {
    const p = playerState.position
    const d = Math.hypot(p.x - D.centre, p.z - D.at)
    const playing = useHome.getState().phase === 'playing'
    const before = wanted.current
    if (playing && d < OPEN_NEAR) wanted.current = true
    else if (!playing || d > CLOSE_FAR) wanted.current = false
    if (wanted.current !== before) {
      const { pan, near } = placeSound(D.centre, D.at)
      doorSound(wanted.current, pan, near)
    }
    gardenDoor.open = MathUtils.damp(gardenDoor.open, wanted.current ? 1 : 0, 8, dt)
    if (gardenDoor.open < 1e-3 && !wanted.current) gardenDoor.open = 0
    const slide = gardenDoor.open * (LEAF_W - 0.02)
    for (const [body, side] of [
      [left.current, -1],
      [right.current, 1],
    ] as const) {
      if (!body) continue
      target.set(D.centre + side * (LEAF_W / 2 - 0.015 + slide), LEAF_H / 2 + 0.012, D.at)
      body.setNextKinematicTranslation(target)
    }
  })

  const leaf = (side: -1 | 1, ref: typeof left) => (
    <RigidBody
      ref={ref}
      type="kinematicPosition"
      colliders={false}
      position={[D.centre + side * (LEAF_W / 2 - 0.015), LEAF_H / 2 + 0.012, D.at]}
    >
      <CuboidCollider args={[LEAF_W / 2, LEAF_H / 2, LEAF_T / 2]} />
      <group rotation={[0, side < 0 ? 0 : Math.PI, 0]}>
        <mesh geometry={frame} castShadow receiveShadow>
          <meshStandardMaterial color="#34383c" roughness={0.38} metalness={0.7} />
        </mesh>
      </group>
      <mesh>
        <boxGeometry args={[LEAF_W - RAIL * 2, LEAF_H - RAIL * 2.6, 0.012]} />
        <meshStandardMaterial color="#cfe3f2" roughness={0.04} metalness={0} envMapIntensity={1.6} transparent opacity={0.16} depthWrite={false} side={DoubleSide} />
      </mesh>
    </RigidBody>
  )

  return (
    <group>
      {leaf(-1, left)}
      {leaf(1, right)}
    </group>
  )
}
