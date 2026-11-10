import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { playerState } from '../lib/playerState'
import { chickenParts, putChicken } from '../models/chicken'
import { COOP, RUN, mostAnimals } from './data'
import { shownPlacement } from './edit'
import { samePlacement, type Placement } from './layout'
import { animals } from './state'
import { agentAt, carryAlong, freeSpot, penAt, wander, type Agent, type Wander } from './wander'

// The hens (and a rooster): each wanders the run on its own — strolls to a spot, pecks at the ground, stands about — and the
// odd one clucks when you are near. They are sculpted models (src/models/chicken.ts): one instanced draw per part
// for all the hens, and the rooster's own. They live in the world's coordinates; when the run is moved (the edit
// mode), they are carried along with it (src/farm/wander.ts).

interface Hen extends Agent {
  peck: number
  look: number
}

const COOP_HALF = { x: 0.8, z: 0.65 } // keep out from under the coop

/** Quick little walks straight to a spot in the run (anywhere but under the coop), then pecking (the wander's grazing)
 *  or a look about. */
const HENS: Wander = {
  speed: 0.32,
  turn: 6,
  arrive: 0,
  legs: 11 / 0.32, // eleven steps a second
  strideRate: 8,
  graze: 0.6,
  grazeFor: [1, 2.2],
  idleFor: [1, 2.2],
  area: { minX: RUN.minX + 0.35, maxX: RUN.maxX - 0.35, minZ: RUN.minZ + 0.35, maxZ: RUN.maxZ - 0.35 },
  free: (x, z) => Math.abs(x - COOP.x) > COOP_HALF.x || Math.abs(z - COOP.z) > COOP_HALF.z,
  spacing: 0,
  tries: 20,
  fallback: () => [(RUN.minX + RUN.maxX) / 2, RUN.maxZ - 0.6],
}

const newHen = (run: Placement): Hen => {
  const [x, z] = freeSpot(HENS, run, [], 0)
  return { ...agentAt(x, z, Math.random() * Math.PI * 2, 'idle', Math.random() * 2), peck: 0, look: 0 }
}

export function Chickens() {
  const parts = useMemo(() => chickenParts(mostAnimals('hens')), [])
  useEffect(() => () => parts.dispose(), [parts])
  const hens = useRef<Hen[]>([])
  const rooster = useRef<Hen | null>(null)
  const frame = useRef<Placement>(shownPlacement('hens'))
  const crow = useRef(8)
  const cluck = useRef(4)

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = state.clock.elapsedTime
    const run = shownPlacement('hens')
    rooster.current ??= newHen(run)
    // as many hens as the farm has: one bought joins the run, and a farm with fewer (a reset, another save) has fewer
    while (hens.current.length < animals('hens')) hens.current.push(newHen(run))
    hens.current.length = Math.min(animals('hens'), mostAnimals('hens'))
    const all = [rooster.current, ...hens.current]
    // the run was moved: everyone in it comes along, where they were in it
    if (!samePlacement(run, frame.current)) carryAlong(all, frame.current, run)
    frame.current = run
    const pen = penAt(HENS, run)
    parts.begin()
    all.forEach((h, n) => {
      const isRooster = n === 0
      wander(h, n, all, HENS, pen, dt)
      h.peck = h.mode === 'graze' ? Math.max(0, Math.sin(h.timer * 9)) : Math.max(0, h.peck - dt * 4)
      // a glance about now and then while standing
      h.look = MathUtils.damp(h.look, h.mode === 'idle' ? Math.sin(t * 0.9 + n * 3) * 0.7 : 0, 6, dt)
      putChicken(parts, isRooster, n - 1, h.x, h.z, h.heading, { phase: h.phase, stride: h.stride, peck: h.peck, look: h.look })
    })
    parts.end()
    // the rooster crows now and then — loud enough to hear across the garden
    crow.current -= dt
    if (crow.current <= 0) {
      crow.current = 25 + Math.random() * 30
      const p = playerState.position
      const r = rooster.current
      if (r && Math.hypot(p.x - r.x, p.z - r.z) < 22) {
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
