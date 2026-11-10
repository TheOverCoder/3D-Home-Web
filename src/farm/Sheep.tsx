import { MathUtils } from 'three'
import { putSheep, sheepParts } from '../models/sheep'
import { FOLD } from './data'
import { Herd, herdAgent, type HerdAgent, type HerdKind } from './Herd'
import { toWorld, turnOf } from './layout'
import { woolliness } from './state'

// The flock: each sheep wanders the fold behind the house, nibbles the grass and now and then bleats when you are
// near. Her fleece shows how much wool she has: round and woolly when there is wool to shear, slim and shorn
// straight after shearing, filling out again as it grows back. The sheep are sculpted models
// (src/models/sheep.ts), one instanced draw per part for the whole flock; each rides a kinematic body so you
// bump into her, and carries her own "Shear …" interaction. The flock lives in the world's coordinates; when the fold
// is moved (the edit mode), the sheep are carried along with it (src/farm/Herd.tsx).

export interface SheepAgent extends HerdAgent {
  graze: number
  fluff: number // shown woolliness, eased towards the real one (the fleece comes off with a little shrink)
}

/** The flock, for the scene and the tests. */
export const flock: SheepAgent[] = []

/** Where the sheep roam: the fold, in its own frame, less a strip along the fence. */
const INNER = { minX: FOLD.minX + 0.6, maxX: FOLD.maxX - 0.6, minZ: FOLD.minZ + 0.6, maxZ: FOLD.maxZ - 0.6 }
const SHELTER = { maxX: FOLD.minX + 2.3, maxZ: FOLD.minZ + 1.4 } // the lean-to in the north-west corner

const SHEEP: HerdKind<SheepAgent> = {
  id: 'sheep',
  name: 'farm-sheep',
  debug: 'flock',
  // amble, then graze or stand about; each to a spot 1.4 m clear of where the others are going
  wander: {
    speed: 0.38,
    turn: 2.4,
    ease: 0.2,
    arrive: 0.04,
    legs: 9,
    strideRate: 5,
    graze: 0.7,
    grazeFor: [3, 5],
    idleFor: [1.5, 2.5],
    area: INNER,
    // not into the lean-to or the trough
    free: (x, z) => !(x < SHELTER.maxX && z < SHELTER.maxZ) && !(x > FOLD.maxX - 1.6 && z < FOLD.minZ + 1.1),
    spacing: 1.4,
    tries: 24,
    fallback: () => [(INNER.minX + INNER.maxX) / 2 + 1, (INNER.minZ + INNER.maxZ) / 2],
  },
  parts: sheepParts,
  // side by side across the fold, facing west, grazing
  spawn: (i, fold) => {
    const [x, z] = toWorld(fold, INNER.maxX - 0.8 - i * 1.6, (INNER.minZ + INNER.maxZ) / 2 + (i % 2 ? 0.6 : -0.4))
    return { ...herdAgent('sheep', x, z, -Math.PI / 2 + turnOf(fold), 'graze', 1.5 + i), graze: 1, fluff: woolliness(i) }
  },
  body: { half: [0.28, 0.4, 0.55], y: 0.45 },
  pause: 2.5,
  call: { sound: 'baa', first: 5, every: 7, more: 12, range: 14 },
  pose: (parts, a, i, t, dt) => {
    a.graze = MathUtils.damp(a.graze, a.mode === 'graze' ? 1 : 0, 2.5, dt)
    a.fluff = MathUtils.damp(a.fluff, woolliness(i), 3, dt)
    putSheep(parts, i, a.x, a.z, a.heading, { phase: a.phase, stride: a.stride, graze: a.graze, wool: a.fluff, chew: t * 6 + i, look: a.mode === 'idle' ? Math.sin(t * 0.5 + i * 2) * 0.4 : 0 })
  },
}

export const Sheep = () => <Herd kind={SHEEP} agents={flock} />
