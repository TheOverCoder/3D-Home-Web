import { PERSON, type PersonRig } from '../../src/models/person'
import type { Pose } from './format'

// The poses a film's people take, on the people engine's rig (src/models/person.ts): its joints turned, nothing else.
// Each pose is a set of joint angles that may live a little (a wave, a laugh, a count); a new pose blends in from the
// last one, and walking moves the legs (and the free arms) under any pose. Signs, as the game's own poses use them:
// an arm or a thigh turned by a negative x swings forward and up; a positive head x looks down; a positive lean bends
// the body forward (the legs are turned back by it, so they stay upright), a positive tilt leans it to its right.

export interface Joints {
  /** the hips raised (m, in the rig's units) */
  lift: number
  lean: number
  tilt: number
  headX: number
  headY: number
  headZ: number
  armLX: number
  armLZ: number
  elbowL: number
  armRX: number
  armRZ: number
  elbowR: number
}

/** The leg's two lengths in the rig's units: hip to knee, knee to the sole. */
const THIGH = -PERSON.kneeY
const SHIN = PERSON.hipsY - THIGH

const STAND: Joints = { lift: 0, lean: 0, tilt: 0, headX: 0, headY: 0, headZ: 0, armLX: 0, armLZ: 0.06, elbowL: -0.12, armRX: 0, armRZ: -0.06, elbowR: -0.15 }

/** Which arms a pose holds (walking swings only the free ones). */
const HOLDS: Partial<Record<Pose, 'r' | 'both'>> = { carry: 'r', box: 'both', count: 'both', type: 'both', shake: 'r', point: 'r', wave: 'r', snap: 'r' }

/** A pose's joints at world time `w`, `s` seconds after it began; `n` a person's own seed (no two breathe together). */
export function poseJoints(pose: Pose, w: number, s: number, n: number): Joints {
  const j = { ...STAND }
  const sin = (f: number, p = 0) => Math.sin(w * f + n + p)
  switch (pose) {
    case 'talk':
      j.armRX = -0.45 + 0.12 * sin(4.3)
      j.armRZ = -0.14
      j.elbowR = -0.95 + 0.18 * sin(5.1, 1)
      j.headZ = 0.05 * sin(2.3)
      break
    case 'laugh':
      j.lean = -0.1
      j.headX = -0.32
      j.headZ = 0.08 * sin(13)
      j.lift = 0.012 * Math.abs(sin(13))
      j.armLX = -0.35
      j.armLZ = 0.3
      j.elbowL = -1.45
      j.armRX = -0.35
      j.armRZ = -0.3
      j.elbowR = -1.45
      break
    case 'point':
      j.armRX = -1.45
      j.armRZ = -0.1
      j.elbowR = -0.05
      j.lean = 0.04
      break
    case 'snap': {
      // the hand up by the shoulder, a flick of the wrist a quarter of a second in
      const flick = s > 0.22 && s < 0.4 ? 0.35 : 0
      j.armRX = -1.1
      j.armRZ = -0.32
      j.elbowR = -1.55 + flick
      j.headX = -0.08
      break
    }
    case 'carry':
      // something heavy in the right hand: held a little out, the body leaning away from it, the left arm out
      j.armRX = 0.04
      j.armRZ = -0.24
      j.elbowR = -0.04
      j.tilt = -0.1
      j.armLZ = 0.55
      j.elbowL = -0.35
      j.headZ = 0.06
      break
    case 'surprise': {
      const jolt = s < 0.16 ? 0.03 * Math.sin((s / 0.16) * Math.PI) : 0
      j.lift = jolt
      j.lean = -0.12
      j.headX = -0.22
      j.armLX = -2.3
      j.armLZ = 0.5
      j.elbowL = -0.5
      j.armRX = -2.3
      j.armRZ = -0.5
      j.elbowR = -0.5
      break
    }
    case 'count':
      j.lean = 0.1
      j.headX = 0.38 + 0.05 * sin(9)
      j.armLX = -0.6
      j.elbowL = -0.9
      j.armRX = -0.75
      j.elbowR = -1.0 + 0.2 * Math.max(0, sin(9))
      break
    case 'shake':
      j.armRX = -0.95 + 0.12 * sin(10)
      j.armRZ = 0.06
      j.elbowR = -0.35
      j.lean = 0.04
      break
    case 'wave':
      j.armRX = -2.7
      j.armRZ = -0.35 + 0.25 * sin(9)
      j.elbowR = -0.5
      break
    case 'shrug':
      j.armLX = -0.25
      j.armLZ = 0.34
      j.elbowL = -1.25
      j.armRX = -0.25
      j.armRZ = -0.34
      j.elbowR = -1.25
      j.headZ = 0.18
      break
    case 'slump':
      j.headX = 0.42
      j.lean = 0.14
      j.lift = -0.02
      j.armLZ = 0.02
      j.armRZ = -0.02
      j.elbowL = -0.05
      j.elbowR = -0.05
      break
    case 'cheer':
      j.armLX = -2.75
      j.armLZ = 0.45
      j.armRX = -2.75
      j.armRZ = -0.45
      j.elbowL = -0.2
      j.elbowR = -0.2
      j.headX = -0.15
      j.lift = 0.05 * Math.abs(sin(7))
      break
    case 'box':
      j.armLX = -0.55
      j.armLZ = 0.14
      j.elbowL = -1.0
      j.armRX = -0.55
      j.armRZ = -0.14
      j.elbowR = -1.0
      j.lean = -0.03
      j.headX = 0.06
      break
    case 'cool':
      // chin up, hands loose behind: the swagger
      j.armLX = 0.12
      j.armLZ = 0.1
      j.elbowL = -0.22
      j.armRX = 0.12
      j.armRZ = -0.1
      j.elbowR = -0.22
      j.headX = -0.1
      j.tilt = 0.03 * sin(2.4)
      break
    case 'type':
      j.headX = 0.26
      j.lean = 0.06
      j.armLX = -0.85
      j.elbowL = -0.75 + 0.06 * sin(14)
      j.armRX = -0.85
      j.elbowR = -0.75 + 0.06 * sin(15, 2)
      break
    default:
      break
  }
  return j
}

const mix = (a: Joints, b: Joints, k: number): Joints => {
  const out = { ...a }
  for (const key of Object.keys(a) as (keyof Joints)[]) out[key] = a[key] + (b[key] - a[key]) * k
  return out
}

export interface PoseNow {
  pose: Pose
  /** the pose before, and how far the new one has blended in (0..1) */
  was: Pose
  blend: number
  /** seconds since this pose began, and since the one before began */
  since: number
  wasSince: number
  /** walking: how much (0..1) and the stride's phase */
  walk: number
  phase: number
  /** saying a line now: the head nods along */
  talking: boolean
  /** the world time a freeze stopped this person at (their pose held there, breath and all) */
  frozenAt?: number
}

/** Turns a rig's joints to a pose at world time `w`. */
export function poseRig(rig: PersonRig, hipsY: number, p: PoseNow, w: number, n: number) {
  const at = p.frozenAt ?? w
  const j = mix(poseJoints(p.was, at, p.wasSince, n), poseJoints(p.pose, at, p.since, n), p.blend)
  const holds = p.blend > 0.5 ? HOLDS[p.pose] : HOLDS[p.was]
  const amp = 0.55 * p.walk
  const f = p.phase
  const swing = Math.sin(f) * amp
  // talking: small nods and turns of the head, whatever the pose
  if (p.talking && p.frozenAt === undefined) {
    j.headX += 0.06 * Math.sin(w * 7.3 + n)
    j.headY += 0.05 * Math.sin(w * 3.1 + n)
  }
  rig.hips.position.y = hipsY + j.lift + (p.walk ? Math.abs(Math.cos(f)) * 0.025 * p.walk : p.frozenAt === undefined ? Math.sin(w * 1.6 + n) * 0.004 : 0)
  rig.hips.rotation.set(j.lean, 0, j.tilt)
  rig.head.rotation.set(j.headX, j.headY, j.headZ)
  // the legs stay under the body: turned back by the lean and the tilt, then swung by the stride
  rig.thighL.rotation.set(-j.lean - swing, 0, -j.tilt)
  rig.thighR.rotation.set(-j.lean + swing, 0, -j.tilt)
  rig.kneeL.rotation.x = Math.max(0, Math.cos(f)) * amp * 1.1 + 0.03
  rig.kneeR.rotation.x = Math.max(0, -Math.cos(f)) * amp * 1.1 + 0.03
  // the feet on the ground: the body comes down by what the bent legs have lost of their length (from a camera on the
  // floor a stride would otherwise float)
  if (p.walk) {
    const reach = (a: number, b: number) => THIGH * Math.cos(a) + SHIN * Math.cos(a + b)
    const lowest = Math.max(reach(rig.thighL.rotation.x + j.lean, rig.kneeL.rotation.x), reach(rig.thighR.rotation.x + j.lean, rig.kneeR.rotation.x))
    rig.hips.position.y -= (THIGH + SHIN - lowest) * rig.hips.scale.y
  }
  const armSwing = swing * 0.7
  rig.armL.rotation.set(j.armLX + (holds === 'both' ? 0 : armSwing), 0, j.armLZ)
  rig.armR.rotation.set(j.armRX - (holds ? 0 : armSwing), 0, j.armRZ)
  rig.elbowL.rotation.x = j.elbowL
  rig.elbowR.rotation.x = j.elbowR
}
