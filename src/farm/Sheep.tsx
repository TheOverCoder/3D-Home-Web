import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { Euler, Quaternion, Vector3 } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { debugSet } from '../lib/debug'
import { playGesture } from '../lib/gestures'
import { registerInteractable } from '../lib/interaction'
import { putSheep, sheepParts } from '../models/sheep'
import { playerState, type Point3 } from '../lib/playerState'
import { FOLD, SHEEP, count } from './data'
import { farm, shear, sheepName, useFarm, woolliness } from './state'

// The flock: each sheep wanders the fold behind the house, nibbles the grass and now and then bleats when you are
// near. Her fleece shows how much wool she has: round and woolly when there is wool to shear, slim and shorn
// straight after shearing, filling out again as it grows back. The sheep are sculpted models
// (src/models/sheep.ts), one instanced draw per part for the whole flock; each rides a kinematic body so you
// bump into her, and carries her own "Shear …" interaction.

export interface SheepAgent {
  x: number
  z: number
  heading: number
  tx: number
  tz: number
  mode: 'walk' | 'graze' | 'idle'
  timer: number
  phase: number
  graze: number
  stride: number // 0 standing … 1 walking, eased
  fluff: number // shown woolliness, eased towards the real one (the fleece comes off with a little shrink)
  pos: Point3
  aim: Point3
}

/** The flock, for the scene and the tests. */
export const flock: SheepAgent[] = []

const INNER = { minX: FOLD.minX + 0.6, maxX: FOLD.maxX - 0.6, minZ: FOLD.minZ + 0.6, maxZ: FOLD.maxZ - 0.6 }
const SHELTER = { maxX: FOLD.minX + 2.3, maxZ: FOLD.minZ + 1.4 } // the lean-to in the north-west corner

const free = (x: number, z: number) => !(x < SHELTER.maxX && z < SHELTER.maxZ) && !(x > FOLD.maxX - 1.6 && z < FOLD.minZ + 1.1) // not into the lean-to or the trough

function spot(i: number): [number, number] {
  for (let k = 0; k < 24; k++) {
    const x = INNER.minX + Math.random() * (INNER.maxX - INNER.minX)
    const z = INNER.minZ + Math.random() * (INNER.maxZ - INNER.minZ)
    if (free(x, z) && flock.every((s, j) => j === i || Math.hypot(s.tx - x, s.tz - z) > 1.4)) return [x, z]
  }
  return [(INNER.minX + INNER.maxX) / 2 + 1, (INNER.minZ + INNER.maxZ) / 2]
}

function newSheep(i: number): SheepAgent {
  const x = INNER.maxX - 0.8 - i * 1.6
  const z = (INNER.minZ + INNER.maxZ) / 2 + (i % 2 ? 0.6 : -0.4)
  return { x, z, heading: -Math.PI / 2, tx: x, tz: z, mode: 'graze', timer: 1.5 + i, phase: 0, graze: 1, stride: 0, fluff: woolliness(i), pos: { x, y: 0.7, z }, aim: { x, y: 0.65, z } }
}

const v3 = new Vector3()
const q = new Quaternion()
const eul = new Euler(0, 0, 0, 'YXZ')

export function Sheep() {
  const sheep = useFarm(() => farm.sheep)
  const parts = useMemo(() => sheepParts(SHEEP.maxSheep), [])
  useEffect(() => () => parts.dispose(), [parts])
  const bodies = useRef<(RapierRigidBody | null)[]>([])
  const baa = useRef(5)
  debugSet('flock', flock)

  // one "Shear …" interaction per sheep, standing where she stands
  useEffect(() => {
    while (flock.length < sheep) flock.push(newSheep(flock.length))
    flock.length = sheep
    const offs = flock.map((a, i) =>
      registerInteractable({
        id: `farm-sheep-${i}`,
        position: a.pos,
        aim: a.aim,
        radius: 2.1,
        enabled: () => (farm.wool[i] ?? 0) > 0,
        label: () => `Shear ${sheepName(i)} · ${count('wool', farm.wool[i] ?? 0)}`,
        icon: { verb: 'shear', item: 'wool' },
        run: () => {
          shear(i)
          playGesture('interact')
          a.mode = 'idle'
          a.timer = 2.5
          const { pan, near } = placeSound(a.x, a.z)
          farmSound('shear', pan, near)
        },
      }),
    )
    return () => offs.forEach((off) => off())
  }, [sheep])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = state.clock.elapsedTime
    parts.begin()
    flock.forEach((a, i) => {
      // behaviour: amble, graze, stand about
      a.timer -= dt
      if (a.mode === 'walk') {
        const dx = a.tx - a.x
        const dz = a.tz - a.z
        const d = Math.hypot(dx, dz)
        const want = Math.atan2(dx, dz)
        a.heading += Math.atan2(Math.sin(want - a.heading), Math.cos(want - a.heading)) * Math.min(1, dt * 2.4)
        const step = 0.38 * dt
        if (d <= step + 0.04) {
          a.mode = Math.random() < 0.7 ? 'graze' : 'idle'
          a.timer = a.mode === 'graze' ? 3 + Math.random() * 5 : 1.5 + Math.random() * 2.5
        } else {
          const v = step * Math.max(0.2, Math.cos(want - a.heading))
          a.x += Math.sin(a.heading) * v
          a.z += Math.cos(a.heading) * v
          a.phase += v * 9
        }
      } else if (a.timer <= 0) {
        ;[a.tx, a.tz] = spot(i)
        a.mode = 'walk'
      }
      a.x = Math.min(INNER.maxX, Math.max(INNER.minX, a.x))
      a.z = Math.min(INNER.maxZ, Math.max(INNER.minZ, a.z))
      a.graze += ((a.mode === 'graze' ? 1 : 0) - a.graze) * Math.min(1, dt * 2.5)
      a.fluff += (woolliness(i) - a.fluff) * Math.min(1, dt * 3)
      a.pos.x = a.aim.x = a.x
      a.pos.z = a.aim.z = a.z

      a.stride += ((a.mode === 'walk' ? 1 : 0) - a.stride) * Math.min(1, dt * 5)
      putSheep(parts, i, a.x, a.z, a.heading, { phase: a.phase, stride: a.stride, graze: a.graze, wool: a.fluff, chew: t * 6 + i, look: a.mode === 'idle' ? Math.sin(t * 0.5 + i * 2) * 0.4 : 0 })

      // her body: a box the player bumps into
      const body = bodies.current[i]
      if (body) {
        v3.set(a.x, 0.45, a.z)
        // a sheep put somewhere else in one go (a test, a long pause) is placed there, not swept across the fold:
        // a kinematic body that jumps metres in one step hits whatever is in the way at hundreds of metres a second
        const at = body.translation()
        if (Math.hypot(at.x - a.x, at.z - a.z) > 0.6) body.setTranslation(v3, true)
        body.setNextKinematicTranslation(v3)
        body.setNextKinematicRotation(q.setFromEuler(eul.set(0, a.heading, 0, 'YXZ')))
      }
    })
    parts.end()

    // the odd bleat, if you are near enough to hear it
    baa.current -= dt
    if (baa.current <= 0 && flock.length) {
      baa.current = 7 + Math.random() * 12
      const a = flock[Math.floor(Math.random() * flock.length)]
      const p = playerState.position
      if (Math.hypot(p.x - a.x, p.z - a.z) < 14) {
        const { pan, near } = placeSound(a.x, a.z)
        farmSound('baa', pan, near)
      }
    }
  })

  return (
    <group name="farm-sheep">
      <primitive object={parts.group} />
      {Array.from({ length: sheep }, (_, i) => (
        <RigidBody
          key={i}
          ref={(b) => {
            bodies.current[i] = b
          }}
          type="kinematicPosition"
          colliders={false}
          position={[flock[i]?.x ?? (INNER.minX + INNER.maxX) / 2, 0.45, flock[i]?.z ?? (INNER.minZ + INNER.maxZ) / 2]}
        >
          <CuboidCollider args={[0.28, 0.4, 0.55]} />
        </RigidBody>
      ))}
    </group>
  )
}
