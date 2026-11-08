import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { farmSound, placeSound } from '../audio/sound'
import { playerState } from '../lib/playerState'
import { chickenParts, putChicken } from '../models/chicken'
import { COOP, EGG, RUN } from './data'
import { farm } from './state'

// The hens (and a rooster): each wanders the run on its own — strolls to a spot, pecks at the ground, stands about — and the
// odd one clucks when you are near. They are sculpted models (src/models/chicken.ts): one instanced draw per part
// for all the hens, and the rooster's own.

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
  stride: number
  look: number
}

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
  return { x, z, heading: Math.random() * Math.PI * 2, tx: x, tz: z, mode: 'idle', timer: Math.random() * 2, phase: 0, peck: 0, stride: 0, look: 0 }
}

export function Chickens() {
  const parts = useMemo(() => chickenParts(EGG.maxHens), [])
  useEffect(() => () => parts.dispose(), [parts])
  const hens = useRef<Hen[]>([])
  const rooster = useRef<Hen>(newHen())
  const crow = useRef(8)
  const cluck = useRef(4)

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = state.clock.elapsedTime
    while (hens.current.length < farm.hens) hens.current.push(newHen())
    hens.current.length = Math.min(hens.current.length, EGG.maxHens)
    parts.begin()
    ;[rooster.current, ...hens.current].forEach((h, n) => {
      const isRooster = n === 0
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

      h.stride += ((h.mode === 'walk' ? 1 : 0) - h.stride) * Math.min(1, dt * 8)
      // a glance about now and then while standing
      h.look += ((h.mode === 'idle' ? Math.sin(t * 0.9 + n * 3) * 0.7 : 0) - h.look) * Math.min(1, dt * 6)
      putChicken(parts, isRooster, n - 1, h.x, h.z, h.heading, { phase: h.phase, stride: h.stride, peck: h.peck, look: h.look })
    })
    parts.end()
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

  return (
    <group name="farm-hens">
      <primitive object={parts.group} />
    </group>
  )
}
