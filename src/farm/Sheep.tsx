import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { CircleGeometry, Color, CylinderGeometry, Euler, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { debugSet } from '../lib/debug'
import { playGesture } from '../lib/gestures'
import { registerInteractable } from '../lib/interaction'
import { playerState, type Point3 } from '../lib/playerState'
import { FOLD, SHEEP, count } from './data'
import { farm, shear, sheepName, useFarm, woolliness } from './state'

// The flock: each sheep wanders the fold behind the house, nibbles the grass and now and then bleats when you are
// near. A sheep is a bundle of wool balls on four thin legs, and her fleece shows how much wool she has: round
// and fluffy when there is wool to shear, slim straight after shearing, filling out again as it grows back. The
// whole flock is three instanced draws (round parts, legs, ground shadows); each sheep rides a kinematic body
// so you bump into her, and carries her own "Shear …" interaction.

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
  return { x, z, heading: -Math.PI / 2, tx: x, tz: z, mode: 'graze', timer: 1.5 + i, phase: 0, graze: 1, fluff: woolliness(i), pos: { x, y: 0.7, z }, aim: { x, y: 0.65, z } }
}

const FULL = new Color('#f4efe3')
const SHORN = new Color('#e3d5c2')
const FACES = [0x2b2624, 0xefe6d6, 0x3a302b, 0xe9dccb] // a black face, a white one…
const LEGS = 0x2f2926
const EYE = 0x111111
const PINK = 0xd99a8f

const m4 = new Matrix4()
const v3 = new Vector3()
const q = new Quaternion()
const s3 = new Vector3()
const eul = new Euler(0, 0, 0, 'YXZ')
const col = new Color()

// wool balls around the body: x, y, z (at full fleece), radius
const PUFFS: [number, number, number, number][] = [
  [0.2, 0.7, 0.2, 0.22],
  [-0.2, 0.7, 0.2, 0.22],
  [0.2, 0.69, -0.2, 0.22],
  [-0.2, 0.69, -0.2, 0.22],
  [0, 0.86, 0, 0.24],
  [0, 0.64, -0.42, 0.23],
  [0, 0.76, 0.36, 0.22],
]

export function Sheep() {
  const sheep = useFarm(() => farm.sheep)
  const geometries = useMemo(
    () => ({
      ball: new SphereGeometry(1, 8, 6),
      stem: new CylinderGeometry(1, 0.85, 1, 6).translate(0, -0.5, 0), // hangs down from its top
      shadow: new CircleGeometry(1, 16).rotateX(-Math.PI / 2),
    }),
    [],
  )
  const ball = useRef<InstancedMesh>(null)
  const stem = useRef<InstancedMesh>(null)
  const shadow = useRef<InstancedMesh>(null)
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
    const n = { ball: 0, stem: 0, shadow: 0 }
    const put = (mesh: InstancedMesh | null, key: keyof typeof n, a: SheepAgent, lx: number, ly: number, lz: number, rx: number, sx: number, sy: number, sz: number, color: number | Color) => {
      if (!mesh) return
      const i = n[key]++
      const cos = Math.cos(a.heading)
      const sin = Math.sin(a.heading)
      v3.set(a.x + lx * cos + lz * sin, ly, a.z - lx * sin + lz * cos)
      q.setFromEuler(eul.set(rx, a.heading, 0, 'YXZ'))
      s3.set(sx, sy, sz)
      mesh.setMatrixAt(i, m4.compose(v3, q, s3))
      mesh.setColorAt(i, typeof color === 'number' ? col.setHex(color) : color)
    }

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

      const w = a.fluff
      const walking = a.mode === 'walk'
      const swing = walking ? Math.sin(a.phase) * 0.4 : 0
      const bob = walking ? Math.abs(Math.sin(a.phase)) * 0.02 : 0
      const wool = col.copy(SHORN).lerp(FULL, w)
      const woolHex = wool.getHex()
      // the body, and the fleece around it: fuller and further out the more wool there is
      put(ball.current, 'ball', a, 0, 0.64 + bob, 0, 0, 0.25 + 0.12 * w, 0.24 + 0.1 * w, 0.46 + 0.1 * w, woolHex)
      const out = 0.62 + 0.38 * w
      const size = 0.5 + 0.5 * w
      for (const [px, py, pz, r] of PUFFS) put(ball.current, 'ball', a, px * out, 0.64 + (py - 0.64) * out + bob, pz * (0.8 + 0.2 * w), 0, r * size, r * size * 0.92, r * size, woolHex)
      put(ball.current, 'ball', a, 0, 0.64 + bob, -0.5 - 0.06 * w, 0, 0.07, 0.08, 0.06, woolHex) // tail
      // the head: lowered to the grass while grazing, nodding as she chews
      const g = a.graze
      const nod = g > 0.9 ? Math.sin(t * 6 + i) * 0.012 : walking ? Math.sin(a.phase * 2) * 0.015 : 0
      const hy = 0.8 - g * 0.42 + bob + nod
      const hz = 0.56 + g * 0.12
      const face = FACES[i % FACES.length]
      put(ball.current, 'ball', a, 0, hy, hz, 0.35 + g * 0.55, 0.1, 0.12, 0.17, face)
      put(ball.current, 'ball', a, 0, hy + 0.1 - g * 0.04, hz - 0.06 - g * 0.04, 0, 0.1 + 0.03 * w, 0.07 + 0.02 * w, 0.1, woolHex) // the woolly top-knot
      for (const sx of [-1, 1]) {
        put(ball.current, 'ball', a, sx * 0.13, hy + 0.04, hz - 0.03, 0.2, 0.08, 0.025, 0.04, face === FACES[1] || face === FACES[3] ? PINK : face) // ear
        put(ball.current, 'ball', a, sx * 0.075, hy + 0.035 - g * 0.02, hz + 0.08, 0, 0.016, 0.016, 0.016, face === FACES[0] || face === FACES[2] ? 0xd8d2c8 : EYE)
      }
      // legs, swinging in pairs as she walks
      for (const [lx, lz, s] of [
        [0.14, 0.3, swing],
        [-0.14, 0.3, -swing],
        [0.14, -0.3, -swing],
        [-0.14, -0.3, swing],
      ] as [number, number, number][])
        put(stem.current, 'stem', a, lx, 0.46 + bob, lz, s, 0.035, 0.46, 0.035, LEGS)
      put(shadow.current, 'shadow', a, 0, 0.012, 0, 0, 0.4 + 0.08 * w, 1, 0.62, 0x000000)

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
    for (const [mesh, key] of [
      [ball.current, 'ball'],
      [stem.current, 'stem'],
      [shadow.current, 'shadow'],
    ] as const) {
      if (!mesh) continue
      mesh.count = n[key]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere() // the flock is culled as a whole when it is out of view (from the house's south side)
    }

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

  const mesh = (ref: typeof ball, geometry: keyof typeof geometries, max: number, shadowMat = false) => (
    <instancedMesh ref={ref} args={[geometries[geometry], undefined, max]} receiveShadow={!shadowMat}>
      {shadowMat ? <meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} /> : <meshStandardMaterial roughness={0.95} />}
    </instancedMesh>
  )

  return (
    <group name="farm-sheep">
      {mesh(ball, 'ball', SHEEP.maxSheep * 16)}
      {mesh(stem, 'stem', SHEEP.maxSheep * 4)}
      {mesh(shadow, 'shadow', SHEEP.maxSheep, true)}
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
