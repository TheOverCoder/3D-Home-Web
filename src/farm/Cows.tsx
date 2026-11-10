import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { Euler, Quaternion, Vector3 } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { debugSet } from '../lib/debug'
import { playGesture } from '../lib/gestures'
import { registerInteractable } from '../lib/interaction'
import { cowParts, putCow } from '../models/cow'
import { playerState, type Point3 } from '../lib/playerState'
import { COW, PASTURE, count } from './data'
import { shownPlacement } from './edit'
import { carry, rectToWorld, samePlacement, toWorld, turnOf, type Placement } from './layout'
import { cowName, farm, milkCow, useFarm } from './state'

// The herd: each cow strolls the pasture, lowers her head to graze, swishes her tail and now and then moos
// when you are near. The cows themselves are sculpted models (src/models/cow.ts), one instanced draw per part
// and coat for the whole herd; each cow also rides a kinematic body, so you bump into her instead of walking
// through, and carries her own "Milk …" interaction, which follows her around. The herd lives in the world's
// coordinates; when the pasture is moved (the edit mode), the cows are carried along with it.

export interface CowAgent {
  x: number
  z: number
  heading: number
  tx: number
  tz: number
  mode: 'walk' | 'graze' | 'idle'
  timer: number
  phase: number
  graze: number // 0 head up … 1 head on the grass
  stride: number // 0 standing … 1 walking (eased, so the legs settle instead of snapping still)
  tail: number
  pos: Point3 // where to stand near to milk her (her middle)
  aim: Point3 // what to look at
}

/** The herd, for the scene and the tests. */
export const herd: CowAgent[] = []

/** Where the cows roam: the pasture, in its own frame, less a strip along the fence. */
const INNER = { minX: PASTURE.minX + 0.8, maxX: PASTURE.maxX - 0.8, minZ: PASTURE.minZ + 1.1, maxZ: PASTURE.maxZ - 1.1 }

function spot(i: number, pasture: Placement): [number, number] {
  for (let k = 0; k < 24; k++) {
    const [x, z] = toWorld(pasture, INNER.minX + Math.random() * (INNER.maxX - INNER.minX), INNER.minZ + Math.random() * (INNER.maxZ - INNER.minZ))
    if (herd.every((c, j) => j === i || Math.hypot(c.tx - x, c.tz - z) > 2.4)) return [x, z]
  }
  return toWorld(pasture, (INNER.minX + INNER.maxX) / 2, INNER.minZ + Math.random() * (INNER.maxZ - INNER.minZ))
}

function newCow(i: number, pasture: Placement): CowAgent {
  const [x, z] = toWorld(pasture, (INNER.minX + INNER.maxX) / 2, INNER.minZ + ((i + 0.5) / COW.maxCows) * (INNER.maxZ - INNER.minZ))
  const heading = Math.PI / 2 + turnOf(pasture)
  return { x, z, heading, tx: x, tz: z, mode: 'graze', timer: 2 + i, phase: 0, graze: 1, stride: 0, tail: Math.random() * 6, pos: { x, y: 1, z }, aim: { x, y: 0.95, z } }
}

const v3 = new Vector3()
const q = new Quaternion()
const eul = new Euler(0, 0, 0, 'YXZ')

export function Cows() {
  const cows = useFarm(() => farm.cows)
  // every coat can be worn by every cow (the herd is small): one draw per part and coat
  const parts = useMemo(() => cowParts(COW.maxCows), [])
  useEffect(() => () => parts.dispose(), [parts])
  const bodies = useRef<(RapierRigidBody | null)[]>([])
  const moo = useRef(6)
  const frame = useRef<Placement>(shownPlacement('cows'))
  debugSet('herd', herd)

  // one "Milk …" interaction per cow, standing where she stands
  useEffect(() => {
    while (herd.length < cows) herd.push(newCow(herd.length, frame.current))
    herd.length = cows
    const offs = herd.map((c, i) =>
      registerInteractable({
        id: `farm-cow-${i}`,
        position: c.pos,
        aim: c.aim,
        radius: 2.4,
        enabled: () => (farm.milk[i] ?? 0) > 0,
        ready: () => ((farm.milk[i] ?? 0) >= COW.max ? { item: 'milk', count: farm.milk[i] } : null),
        label: () => `Milk ${cowName(i)} · ${count('milk', farm.milk[i] ?? 0)}`,
        icon: () => ({ verb: 'pick', item: 'milk', count: farm.milk[i] ?? 0 }),
        run: () => {
          milkCow(i)
          playGesture('interact')
          c.mode = 'idle'
          c.timer = 3
          const { pan, near } = placeSound(c.x, c.z)
          farmSound('milk', pan, near)
        },
      }),
    )
    return () => offs.forEach((off) => off())
  }, [cows])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = state.clock.elapsedTime
    const pasture = shownPlacement('cows')
    // the pasture was moved: the herd comes along, each cow where she was in it
    if (!samePlacement(pasture, frame.current)) {
      const turned = turnOf(pasture) - turnOf(frame.current)
      for (const c of herd) {
        ;[c.x, c.z] = carry(frame.current, pasture, c.x, c.z)
        ;[c.tx, c.tz] = carry(frame.current, pasture, c.tx, c.tz)
        c.heading += turned
      }
    }
    frame.current = pasture
    const inner = rectToWorld(pasture, INNER)
    parts.begin()
    herd.forEach((c, i) => {
      // behaviour: stroll, graze, stand
      c.timer -= dt
      if (c.mode === 'walk') {
        const dx = c.tx - c.x
        const dz = c.tz - c.z
        const d = Math.hypot(dx, dz)
        const want = Math.atan2(dx, dz)
        c.heading += Math.atan2(Math.sin(want - c.heading), Math.cos(want - c.heading)) * Math.min(1, dt * 1.6)
        const step = 0.45 * dt
        if (d <= step + 0.05) {
          c.mode = Math.random() < 0.75 ? 'graze' : 'idle'
          c.timer = c.mode === 'graze' ? 4 + Math.random() * 6 : 2 + Math.random() * 3
        } else {
          // ease off while turning, so she does not slide sideways
          const facing = Math.cos(want - c.heading)
          const v = step * Math.max(0.15, facing)
          c.x += Math.sin(c.heading) * v
          c.z += Math.cos(c.heading) * v
          c.phase += v * 5.5
        }
      } else if (c.timer <= 0) {
        ;[c.tx, c.tz] = spot(i, pasture)
        c.mode = 'walk'
      }
      c.x = Math.min(inner.maxX, Math.max(inner.minX, c.x))
      c.z = Math.min(inner.maxZ, Math.max(inner.minZ, c.z))
      c.graze += ((c.mode === 'graze' ? 1 : 0) - c.graze) * Math.min(1, dt * 2)
      c.tail += dt * (1.6 + Math.sin(t * 0.3 + i) * 0.6)
      c.pos.x = c.x
      c.pos.z = c.z
      c.aim.x = c.x
      c.aim.z = c.z

      c.stride += ((c.mode === 'walk' ? 1 : 0) - c.stride) * Math.min(1, dt * 4)
      putCow(parts, i, c.x, c.z, c.heading, { phase: c.phase, stride: c.stride, graze: c.graze, tail: c.tail, chew: t * 5 + i, look: c.mode === 'idle' ? Math.sin(t * 0.4 + i * 2) * 0.35 : 0 })

      // her body: a box the player bumps into
      const body = bodies.current[i]
      if (body) {
        v3.set(c.x, 0.95, c.z)
        // a cow put somewhere else in one go (a test, a long pause) is placed there, not swept across the pasture
        const at = body.translation()
        if (Math.hypot(at.x - c.x, at.z - c.z) > 0.6) body.setTranslation(v3, true)
        body.setNextKinematicTranslation(v3)
        body.setNextKinematicRotation(q.setFromEuler(eul.set(0, c.heading, 0, 'YXZ')))
      }
    })
    parts.end()

    // the odd moo, if you are near enough to hear it
    moo.current -= dt
    if (moo.current <= 0 && herd.length) {
      moo.current = 9 + Math.random() * 14
      const c = herd[Math.floor(Math.random() * herd.length)]
      const p = playerState.position
      if (Math.hypot(p.x - c.x, p.z - c.z) < 16) {
        const { pan, near } = placeSound(c.x, c.z)
        farmSound('moo', pan, near)
      }
    }
  })

  const start = rectToWorld(frame.current, INNER)
  return (
    <group name="farm-cows">
      <primitive object={parts.group} />
      {Array.from({ length: cows }, (_, i) => (
        <RigidBody
          key={i}
          ref={(b) => {
            bodies.current[i] = b
          }}
          type="kinematicPosition"
          colliders={false}
          position={[herd[i]?.x ?? (start.minX + start.maxX) / 2, 0.95, herd[i]?.z ?? (start.minZ + start.maxZ) / 2]}
        >
          <CuboidCollider args={[0.36, 0.55, 0.95]} />
        </RigidBody>
      ))}
    </group>
  )
}
