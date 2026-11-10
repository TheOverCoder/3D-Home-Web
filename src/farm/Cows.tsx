import { MathUtils } from 'three'
import { cowParts, putCow } from '../models/cow'
import { PASTURE, mostAnimals } from './data'
import { Herd, herdAgent, type HerdAgent, type HerdKind } from './Herd'
import { toWorld, turnOf } from './layout'

// The herd: each cow strolls the pasture, lowers her head to graze, swishes her tail and now and then moos
// when you are near. The cows themselves are sculpted models (src/models/cow.ts), one instanced draw per part
// and coat for the whole herd; each cow also rides a kinematic body, so you bump into her instead of walking
// through, and carries her own "Milk …" interaction, which follows her around. The herd lives in the world's
// coordinates; when the pasture is moved (the edit mode), the cows are carried along with it (src/farm/Herd.tsx).

export interface CowAgent extends HerdAgent {
  graze: number // 0 head up … 1 head on the grass
  tail: number
}

/** The herd, for the scene and the tests. */
export const herd: CowAgent[] = []

/** Where the cows roam: the pasture, in its own frame, less a strip along the fence. */
const INNER = { minX: PASTURE.minX + 0.8, maxX: PASTURE.maxX - 0.8, minZ: PASTURE.minZ + 1.1, maxZ: PASTURE.maxZ - 1.1 }

const COWS: HerdKind<CowAgent> = {
  id: 'cows',
  name: 'farm-cows',
  debug: 'herd',
  // stroll, then graze (mostly) or stand about; each to a spot 2.4 m clear of where the others are going
  wander: {
    speed: 0.45,
    turn: 1.6,
    ease: 0.15,
    arrive: 0.05,
    legs: 5.5,
    strideRate: 4,
    graze: 0.75,
    grazeFor: [4, 6],
    idleFor: [2, 3],
    area: INNER,
    spacing: 2.4,
    tries: 24,
    fallback: () => [(INNER.minX + INNER.maxX) / 2, INNER.minZ + Math.random() * (INNER.maxZ - INNER.minZ)],
  },
  parts: cowParts,
  // in a line down the middle of the pasture, facing across it, grazing
  spawn: (i, pasture) => {
    const [x, z] = toWorld(pasture, (INNER.minX + INNER.maxX) / 2, INNER.minZ + ((i + 0.5) / mostAnimals('cows')) * (INNER.maxZ - INNER.minZ))
    return { ...herdAgent('cows', x, z, Math.PI / 2 + turnOf(pasture), 'graze', 2 + i), graze: 1, tail: Math.random() * 6 }
  },
  body: { half: [0.36, 0.55, 0.95], y: 0.95 },
  pause: 3,
  call: { sound: 'moo', first: 6, every: 9, more: 14, range: 16 },
  pose: (parts, c, i, t, dt) => {
    c.graze = MathUtils.damp(c.graze, c.mode === 'graze' ? 1 : 0, 2, dt)
    c.tail += dt * (1.6 + Math.sin(t * 0.3 + i) * 0.6)
    putCow(parts, i, c.x, c.z, c.heading, { phase: c.phase, stride: c.stride, graze: c.graze, tail: c.tail, chew: t * 5 + i, look: c.mode === 'idle' ? Math.sin(t * 0.4 + i * 2) * 0.35 : 0 })
  },
}

export const Cows = () => <Herd kind={COWS} agents={herd} />
