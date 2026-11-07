import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, ConeGeometry, CylinderGeometry, Euler, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { playerState } from '../lib/playerState'
import { COOP, EGG, RUN } from './data'
import { farm } from './state'

// The hens (and a rooster): each wanders the run on its own — strolls to a spot, pecks at the ground, stands about — and the
// odd one clucks when you are near. All of them together are three instanced draws (bodies and heads, beaks
// and tails, legs).

interface Hen {
  x: number
  z: number
  heading: number
  tx: number
  tz: number
  mode: 'walk' | 'peck' | 'idle'
  timer: number
  phase: number
  peck: number
}

const COLORS = [0xf3efe6, 0xa8653a, 0x3a3433, 0xd9a441]
const COOP_HALF = { x: 0.8, z: 0.65 } // keep out from under the coop

function randomSpot(): [number, number] {
  for (let i = 0; i < 20; i++) {
    const x = RUN.minX + 0.35 + Math.random() * (RUN.maxX - RUN.minX - 0.7)
    const z = RUN.minZ + 0.35 + Math.random() * (RUN.maxZ - RUN.minZ - 0.7)
    if (Math.abs(x - COOP.x) > COOP_HALF.x || Math.abs(z - COOP.z) > COOP_HALF.z) return [x, z]
  }
  return [(RUN.minX + RUN.maxX) / 2, RUN.maxZ - 0.6]
}

const newHen = (): Hen => {
  const [x, z] = randomSpot()
  return { x, z, heading: Math.random() * Math.PI * 2, tx: x, tz: z, mode: 'idle', timer: Math.random() * 2, phase: 0, peck: 0 }
}

const m4 = new Matrix4()
const v3 = new Vector3()
const q = new Quaternion()
const s3 = new Vector3()
const e = new Euler(0, 0, 0, 'YXZ')
const c = new Color()

export function Chickens() {
  const geometries = useMemo(
    () => ({
      ball: new SphereGeometry(1, 9, 7),
      cone: new ConeGeometry(1, 1, 8).translate(0, 0.5, 0),
      leg: new CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0),
    }),
    [],
  )
  const hens = useRef<Hen[]>([])
  const rooster = useRef<Hen>(newHen())
  const crow = useRef(8)
  const ball = useRef<InstancedMesh>(null)
  const cone = useRef<InstancedMesh>(null)
  const leg = useRef<InstancedMesh>(null)
  const cluck = useRef(4)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    while (hens.current.length < farm.hens) hens.current.push(newHen())
    hens.current.length = Math.min(hens.current.length, EGG.maxHens)
    const counts = { ball: 0, cone: 0, leg: 0 }
    let k = 1 // the rooster is a size bigger
    const put = (mesh: InstancedMesh | null, key: keyof typeof counts, h: Hen, lx: number, ly: number, lz: number, rx: number, ry: number, sx: number, sy: number, sz: number, color: number) => {
      if (!mesh) return
      const i = counts[key]++
      const cos = Math.cos(h.heading)
      const sin = Math.sin(h.heading)
      v3.set(h.x + (lx * cos + lz * sin) * k, ly * k, h.z + (-lx * sin + lz * cos) * k)
      q.setFromEuler(e.set(rx, h.heading + ry, 0, 'YXZ'))
      s3.set(sx * k, sy * k, sz * k)
      mesh.setMatrixAt(i, m4.compose(v3, q, s3))
      mesh.setColorAt(i, c.setHex(color))
    }

    ;[rooster.current, ...hens.current].forEach((h, n) => {
      const isRooster = n === 0
      k = isRooster ? 1.3 : 1
      // behaviour
      h.timer -= dt
      if (h.mode === 'walk') {
        const dx = h.tx - h.x
        const dz = h.tz - h.z
        const d = Math.hypot(dx, dz)
        const want = Math.atan2(dx, dz)
        h.heading += Math.atan2(Math.sin(want - h.heading), Math.cos(want - h.heading)) * Math.min(1, dt * 6)
        const step = 0.32 * dt
        if (d <= step) {
          h.mode = Math.random() < 0.6 ? 'peck' : 'idle'
          h.timer = 1 + Math.random() * 2.2
        } else {
          h.x += (dx / d) * step
          h.z += (dz / d) * step
          h.phase += dt * 11
        }
      } else if (h.timer <= 0) {
        ;[h.tx, h.tz] = randomSpot()
        h.mode = 'walk'
      }
      h.peck = h.mode === 'peck' ? Math.max(0, Math.sin(h.timer * 9)) : Math.max(0, h.peck - dt * 4)

      // body: hens in their colours; the rooster red-brown with a golden neck, a tall comb and a dark green tail
      const color = isRooster ? 0x8a3b1f : COLORS[(n - 1) % COLORS.length]
      const neck = isRooster ? 0xd9902a : color
      const bob = h.mode === 'walk' ? Math.abs(Math.sin(h.phase)) * 0.012 : 0
      const lean = h.peck * 0.5
      put(ball.current, 'ball', h, 0, 0.2 + bob, 0, -lean * 0.3, 0, 0.11, 0.1, 0.15, color)
      if (isRooster) {
        put(cone.current, 'cone', h, 0, 0.24 + bob, -0.1, -0.55, 0, 0.05, 0.2, 0.04, 0x1f3a2c)
        put(cone.current, 'cone', h, 0, 0.22 + bob, -0.12, -0.95, 0, 0.045, 0.18, 0.035, 0x18241c)
      } else put(cone.current, 'cone', h, 0, 0.22 + bob, -0.1, -0.85, 0, 0.065, 0.13, 0.045, color) // tail
      // head: dips forward and down to peck
      const hy = 0.34 - h.peck * 0.2 + bob
      const hz = 0.11 + h.peck * 0.08
      put(ball.current, 'ball', h, 0, hy, hz, 0, 0, 0.052, 0.055, 0.058, neck)
      put(ball.current, 'ball', h, 0, hy + 0.055, hz - 0.005, 0, 0, isRooster ? 0.016 : 0.012, isRooster ? 0.05 : 0.03, isRooster ? 0.06 : 0.04, 0xcf2f2a) // comb
      put(ball.current, 'ball', h, 0, hy - 0.035, hz + 0.04, 0, 0, 0.012, 0.022, 0.012, 0xcf2f2a) // wattle
      put(cone.current, 'cone', h, 0, hy - 0.005, hz + 0.045, Math.PI / 2, 0, 0.013, 0.035, 0.013, 0xe8b23a) // beak
      put(ball.current, 'ball', h, 0.036, hy + 0.012, hz + 0.03, 0, 0, 0.009, 0.009, 0.009, 0x151515)
      put(ball.current, 'ball', h, -0.036, hy + 0.012, hz + 0.03, 0, 0, 0.009, 0.009, 0.009, 0x151515)
      const swing = h.mode === 'walk' ? Math.sin(h.phase) * 0.45 : 0
      put(leg.current, 'leg', h, 0.035, 0, 0, swing, 0, 0.007, 0.13, 0.007, 0xe0a030)
      put(leg.current, 'leg', h, -0.035, 0, 0, -swing, 0, 0.007, 0.13, 0.007, 0xe0a030)
    })
    // the rooster crows now and then — loud enough to hear across the garden
    crow.current -= dt
    if (crow.current <= 0) {
      crow.current = 25 + Math.random() * 30
      const p = playerState.position
      const r = rooster.current
      if (Math.hypot(p.x - r.x, p.z - r.z) < 22) {
        const { pan, near } = placeSound(r.x, r.z)
        farmSound('crow', pan, Math.max(0.35, near))
      }
    }
    for (const [mesh, key] of [
      [ball.current, 'ball'],
      [cone.current, 'cone'],
      [leg.current, 'leg'],
    ] as const) {
      if (!mesh) continue
      mesh.count = counts[key]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    // now and then a cluck, if you are close enough to hear it
    cluck.current -= dt
    if (cluck.current <= 0) {
      cluck.current = 3 + Math.random() * 7
      const p = playerState.position
      const h = hens.current[Math.floor(Math.random() * hens.current.length)]
      if (h && Math.hypot(p.x - h.x, p.z - h.z) < 9) {
        const { pan, near } = placeSound(h.x, h.z)
        farmSound('cluck', pan, near)
      }
    }
  })

  const mesh = (ref: typeof ball, geometry: keyof typeof geometries, max: number, roughness: number) => (
    <instancedMesh ref={ref} args={[geometries[geometry], undefined, max]} frustumCulled={false} receiveShadow>
      <meshStandardMaterial roughness={roughness} />
    </instancedMesh>
  )

  return (
    <group name="farm-hens">
      {mesh(ball, 'ball', (EGG.maxHens + 1) * 6, 0.8)}
      {mesh(cone, 'cone', (EGG.maxHens + 1) * 2 + 1, 0.6)}
      {mesh(leg, 'leg', (EGG.maxHens + 1) * 2, 0.6)}
    </group>
  )
}
