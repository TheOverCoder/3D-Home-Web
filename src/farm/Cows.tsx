import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { CircleGeometry, Color, ConeGeometry, CylinderGeometry, Euler, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { debugSet } from '../lib/debug'
import { playGesture } from '../lib/gestures'
import { registerInteractable } from '../lib/interaction'
import { playerState, type Point3 } from '../lib/playerState'
import { COW, PASTURE, count } from './data'
import { cowName, farm, milkCow, useFarm } from './state'

// The herd: each cow strolls the pasture, lowers her head to graze, swishes her tail and now and then moos
// when you are near. Every part of every cow is one of four instanced draws (round parts, legs and tail,
// horns, ground shadows); each cow also rides a kinematic body, so you bump into her instead of walking
// through, and carries her own "Milk …" interaction, which follows her around.

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
  tail: number
  pos: Point3 // where to stand near to milk her (her middle)
  aim: Point3 // what to look at
}

/** The herd, for the scene and the tests. */
export const herd: CowAgent[] = []

const INNER = { minX: PASTURE.minX + 0.8, maxX: PASTURE.maxX - 0.8, minZ: PASTURE.minZ + 1.1, maxZ: PASTURE.maxZ - 1.1 }

function spot(i: number): [number, number] {
  for (let k = 0; k < 24; k++) {
    const x = INNER.minX + Math.random() * (INNER.maxX - INNER.minX)
    const z = INNER.minZ + Math.random() * (INNER.maxZ - INNER.minZ)
    if (herd.every((c, j) => j === i || Math.hypot(c.tx - x, c.tz - z) > 2.4)) return [x, z]
  }
  return [(INNER.minX + INNER.maxX) / 2, INNER.minZ + Math.random() * (INNER.maxZ - INNER.minZ)]
}

function newCow(i: number): CowAgent {
  const x = (INNER.minX + INNER.maxX) / 2
  const z = INNER.minZ + ((i + 0.5) / COW.maxCows) * (INNER.maxZ - INNER.minZ)
  return { x, z, heading: Math.PI / 2, tx: x, tz: z, mode: 'graze', timer: 2 + i, phase: 0, graze: 1, tail: Math.random() * 6, pos: { x, y: 1, z }, aim: { x, y: 0.95, z } }
}

// coat per cow: [body, patches, legs]
const COATS: [number, number, number][] = [
  [0xf1eee8, 0x1f1d1c, 0xf1eee8], // black and white
  [0xb47c4c, 0x8a5a34, 0x9a6a40], // a brown Jersey
  [0xf0ebe2, 0x8a5634, 0xf0ebe2], // white with brown patches
]
const PINK = 0xe2a69a
const DARK = 0x262220
const HORN = 0xe8dcc0

const m4 = new Matrix4()
const v3 = new Vector3()
const q = new Quaternion()
const s3 = new Vector3()
const eul = new Euler(0, 0, 0, 'YXZ')
const col = new Color()

export function Cows() {
  const cows = useFarm(() => farm.cows)
  const geometries = useMemo(
    () => ({
      ball: new SphereGeometry(1, 10, 8),
      stem: new CylinderGeometry(1, 0.85, 1, 7).translate(0, -0.5, 0), // hangs down from its top
      cone: new ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
      shadow: new CircleGeometry(1, 20).rotateX(-Math.PI / 2),
    }),
    [],
  )
  const ball = useRef<InstancedMesh>(null)
  const stem = useRef<InstancedMesh>(null)
  const cone = useRef<InstancedMesh>(null)
  const shadow = useRef<InstancedMesh>(null)
  const bodies = useRef<(RapierRigidBody | null)[]>([])
  const moo = useRef(6)
  debugSet('herd', herd)

  // one "Milk …" interaction per cow, standing where she stands
  useEffect(() => {
    while (herd.length < cows) herd.push(newCow(herd.length))
    herd.length = cows
    const offs = herd.map((c, i) =>
      registerInteractable({
        id: `farm-cow-${i}`,
        position: c.pos,
        aim: c.aim,
        radius: 2.4,
        enabled: () => (farm.milk[i] ?? 0) > 0,
        label: () => `Milk ${cowName(i)} · ${count('milk', farm.milk[i] ?? 0)}`,
        icon: { verb: 'pick', item: 'milk' },
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
    const n = { ball: 0, stem: 0, cone: 0, shadow: 0 }
    const put = (mesh: InstancedMesh | null, key: keyof typeof n, c: CowAgent, lx: number, ly: number, lz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, color: number) => {
      if (!mesh) return
      const i = n[key]++
      const cos = Math.cos(c.heading)
      const sin = Math.sin(c.heading)
      v3.set(c.x + lx * cos + lz * sin, ly, c.z - lx * sin + lz * cos)
      q.setFromEuler(eul.set(rx, c.heading + ry, rz, 'YXZ'))
      s3.set(sx, sy, sz)
      mesh.setMatrixAt(i, m4.compose(v3, q, s3))
      mesh.setColorAt(i, col.setHex(color))
    }

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
        ;[c.tx, c.tz] = spot(i)
        c.mode = 'walk'
      }
      c.x = Math.min(INNER.maxX, Math.max(INNER.minX, c.x))
      c.z = Math.min(INNER.maxZ, Math.max(INNER.minZ, c.z))
      c.graze += ((c.mode === 'graze' ? 1 : 0) - c.graze) * Math.min(1, dt * 2)
      c.tail += dt * (1.6 + Math.sin(t * 0.3 + i) * 0.6)
      c.pos.x = c.x
      c.pos.z = c.z
      c.aim.x = c.x
      c.aim.z = c.z

      const [coat, patch, legs] = COATS[i % COATS.length]
      const walking = c.mode === 'walk'
      const swing = walking ? Math.sin(c.phase) * 0.35 : 0
      const bob = walking ? Math.abs(Math.sin(c.phase)) * 0.025 : 0
      const g = c.graze
      // body and patches
      put(ball.current, 'ball', c, 0, 1.0 + bob, 0, 0, 0, 0, 0.38, 0.4, 0.82, coat)
      put(ball.current, 'ball', c, 0.28, 1.08 + bob, 0.28, 0, 0, 0, 0.13, 0.2, 0.26, patch)
      put(ball.current, 'ball', c, -0.27, 0.98 + bob, -0.26, 0, 0, 0, 0.13, 0.22, 0.3, patch)
      put(ball.current, 'ball', c, 0.04, 1.32 + bob, -0.38, 0, 0, 0, 0.22, 0.12, 0.24, patch)
      put(ball.current, 'ball', c, -0.18, 1.22 + bob, 0.48, 0, 0, 0, 0.16, 0.14, 0.2, patch)
      put(ball.current, 'ball', c, 0, 0.64 + bob, -0.3, 0, 0, 0, 0.15, 0.1, 0.16, PINK) // udder
      // neck and head: lowered to the grass while grazing
      const ny = 1.2 - g * 0.32
      const nz = 0.72 + g * 0.1
      put(ball.current, 'ball', c, 0, ny + bob, nz, 0.4 * g, 0, 0, 0.2, 0.24, 0.3 + g * 0.06, coat)
      const hy = 1.3 - g * 0.86
      const hz = 1.02 + g * 0.14
      const nod = walking ? Math.sin(c.phase * 2) * 0.03 : g > 0.9 ? Math.sin(t * 5 + i) * 0.015 : 0
      put(ball.current, 'ball', c, 0, hy + bob + nod, hz, 0.5 * g, 0, 0, 0.17, 0.19, 0.28, coat)
      put(ball.current, 'ball', c, 0, hy - 0.08 + bob + nod - g * 0.04, hz + 0.21, 0.5 * g, 0, 0, 0.14, 0.11, 0.1, PINK) // muzzle
      for (const sx of [-1, 1]) {
        put(ball.current, 'ball', c, sx * 0.12, hy + 0.06 + bob + nod, hz + 0.1, 0, 0, 0, 0.03, 0.03, 0.03, DARK) // eye
        put(ball.current, 'ball', c, sx * 0.2, hy + 0.08 + bob + nod, hz - 0.06, 0, sx * 0.3, sx * 0.3, 0.1, 0.035, 0.06, coat) // ear
        put(cone.current, 'cone', c, sx * 0.09, hy + 0.15 + bob + nod, hz - 0.08, -0.2, 0, -sx * 0.4, 0.025, 0.09, 0.025, HORN)
      }
      // legs (hanging from the hips and shoulders), hooves, tail
      const legsAt: [number, number, number][] = [
        [0.21, 0.5, swing],
        [-0.21, 0.5, -swing],
        [0.21, -0.52, -swing],
        [-0.21, -0.52, swing],
      ]
      for (const [lx, lz, a] of legsAt) {
        put(stem.current, 'stem', c, lx, 0.78 + bob, lz, a, 0, 0, 0.065, 0.74, 0.065, legs)
        put(ball.current, 'ball', c, lx, 0.78 + bob - Math.cos(a) * 0.74, lz - Math.sin(a) * 0.74, 0, 0, 0, 0.07, 0.045, 0.085, DARK)
      }
      const sway = Math.sin(c.tail) * 0.25
      put(stem.current, 'stem', c, 0, 1.24 + bob, -0.8, 0.18, 0, sway, 0.02, 0.68, 0.02, coat)
      put(ball.current, 'ball', c, Math.sin(sway) * 0.66, 0.58 + bob, -0.92, 0, 0, 0, 0.05, 0.09, 0.05, DARK) // tuft
      put(shadow.current, 'shadow', c, 0, 0.012, 0, 0, 0, 0, 0.62, 1, 1.05, 0x000000)

      // her body: a box the player bumps into
      const body = bodies.current[i]
      if (body) {
        v3.set(c.x, 0.95, c.z)
        body.setNextKinematicTranslation(v3)
        body.setNextKinematicRotation(q.setFromEuler(eul.set(0, c.heading, 0, 'YXZ')))
      }
    })
    for (const [mesh, key] of [
      [ball.current, 'ball'],
      [stem.current, 'stem'],
      [cone.current, 'cone'],
      [shadow.current, 'shadow'],
    ] as const) {
      if (!mesh) continue
      mesh.count = n[key]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

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

  const mesh = (ref: typeof ball, geometry: keyof typeof geometries, max: number, roughness: number, shadowMat = false) => (
    <instancedMesh ref={ref} args={[geometries[geometry], undefined, max]} frustumCulled={false} receiveShadow={!shadowMat}>
      {shadowMat ? <meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} /> : <meshStandardMaterial roughness={roughness} />}
    </instancedMesh>
  )

  return (
    <group name="farm-cows">
      {mesh(ball, 'ball', COW.maxCows * 20, 0.75)}
      {mesh(stem, 'stem', COW.maxCows * 5, 0.75)}
      {mesh(cone, 'cone', COW.maxCows * 2, 0.5)}
      {mesh(shadow, 'shadow', COW.maxCows, 1, true)}
      {Array.from({ length: cows }, (_, i) => (
        <RigidBody
          key={i}
          ref={(b) => {
            bodies.current[i] = b
          }}
          type="kinematicPosition"
          colliders={false}
          position={[herd[i]?.x ?? (INNER.minX + INNER.maxX) / 2, 0.95, herd[i]?.z ?? 0]}
        >
          <CuboidCollider args={[0.36, 0.55, 0.95]} />
        </RigidBody>
      ))}
    </group>
  )
}
