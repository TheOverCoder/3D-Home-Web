import { PERSON, type PersonRig } from '../models/person'
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
  /** knees bent (0 straight … 1 a deep squat): the thighs come forward, the shins back, the hips down by what the legs
   *  lose of their height, the feet staying on the ground */
  squat: number
}

/** The leg's two lengths in the rig's units: hip to knee, knee to the sole. */
const THIGH = -PERSON.kneeY
const SHIN = PERSON.hipsY - THIGH

const STAND: Joints = { lift: 0, lean: 0, tilt: 0, headX: 0, headY: 0, headZ: 0, armLX: 0, armLZ: 0.06, elbowL: -0.12, armRX: 0, armRZ: -0.06, elbowR: -0.15, squat: 0 }

/** Which arms a pose holds (walking swings only the free ones). */
const HOLDS: Partial<Record<Pose, 'r' | 'both'>> = {
  carry: 'r',
  box: 'both',
  count: 'both',
  type: 'both',
  shake: 'r',
  point: 'r',
  wave: 'r',
  snap: 'r',
  stoop: 'both',
  hips: 'both',
  facepalm: 'r',
  scratch: 'r',
  crouch: 'both',
  flinch: 'both',
  clap: 'both',
  sneak: 'both',
}

/** The arms of the `box` pose: the hands at the sides of what they carry, a little below the chest (the crate's sides,
 *  0.29 m either side of the middle, 1.0 m up and 0.36 m out in front: worked out on the rig's arms, src/models/person.ts),
 *  the body leaning back against the weight. ./pen.ts puts the crate between the hands as they are. */
export const CARRY = { lean: -0.08, armX: -0.22, armZ: 0.16, elbow: -0.84 }

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
      // a load in both arms, at its sides: the body leans back against it, and rolls a little with each step
      j.armLX = CARRY.armX
      j.armLZ = CARRY.armZ
      j.elbowL = CARRY.elbow
      j.armRX = CARRY.armX
      j.armRZ = -CARRY.armZ
      j.elbowR = CARRY.elbow
      j.lean = CARRY.lean
      j.headX = 0.1
      j.tilt = 0.035 * sin(5.2)
      break
    case 'stoop':
      // bent down over the load to set it down (or pick it up): knees bent, back bent, arms down in front
      j.squat = 0.45
      j.lean = 0.62
      j.headX = -0.35
      j.armLX = -0.85
      j.armLZ = 0.12
      j.elbowL = -0.15
      j.armRX = -0.85
      j.armRZ = -0.12
      j.elbowR = -0.15
      break
    case 'hips':
      // hands on the hips, elbows out, chin up: waiting, sure of oneself
      j.armLX = 0.25
      j.armLZ = 0.62
      j.elbowL = -1.75
      j.armRX = 0.25
      j.armRZ = -0.62
      j.elbowR = -1.75
      j.headX = -0.08
      j.tilt = 0.02 * sin(1.9)
      break
    case 'facepalm':
      // the right hand over the eyes, the head bowed into it
      j.armRX = -1.95
      j.armRZ = 0.32
      j.elbowR = -2.3
      j.headX = 0.32
      j.lean = 0.06
      break
    case 'scratch':
      // scratching the back of the head, puzzled, the head tipped
      j.armRX = -2.55
      j.armRZ = -0.28
      j.elbowR = -1.95 + 0.12 * sin(14)
      j.headZ = -0.16
      j.headX = 0.08
      break
    case 'crouch':
      // squatting low, leaning in, hands forward low (milking, peering at something on the ground)
      j.squat = 0.85
      j.lean = 0.28
      j.headX = -0.1
      j.armLX = -1.0
      j.armLZ = 0.1
      j.elbowL = -0.5
      j.armRX = -1.0
      j.armRZ = -0.1
      j.elbowR = -0.5
      break
    case 'flinch': {
      // something flies at them: arms up over the face, leaning away, a jolt at the start
      const jolt = s < 0.18 ? 0.03 * Math.sin((s / 0.18) * Math.PI) : 0
      j.lift = jolt
      j.lean = -0.22
      j.squat = 0.15
      j.headX = 0.25
      j.armLX = -1.9
      j.armLZ = -0.15
      j.elbowL = -1.9
      j.armRX = -1.9
      j.armRZ = 0.15
      j.elbowR = -1.9
      break
    }
    case 'clap': {
      // the hands meet in front of the chest, three times a second
      const k = Math.abs(Math.sin(w * 9.4 + n))
      j.armLX = -1.1
      j.armLZ = -0.05 + 0.3 * k
      j.elbowL = -1.0
      j.armRX = -1.1
      j.armRZ = 0.05 - 0.3 * k
      j.elbowR = -1.0
      j.headX = -0.05
      break
    }
    case 'sneak':
      // creeping on bent knees, leaning in, the hands up in front like paws
      j.squat = 0.35
      j.lean = 0.3
      j.headX = -0.25
      j.armLX = -0.9
      j.armLZ = 0.15
      j.elbowL = -1.3
      j.armRX = -0.9
      j.armRZ = -0.15
      j.elbowR = -1.3
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
  /** walking: how much (0..1), how fast (m/s: past a walk's pace it is a run) and the stride's phase */
  walk: number
  speed: number
  phase: number
  /** saying a line now: the head nods along */
  talking: boolean
  /** how loud their voice is this moment, 0..1 (./voice.ts, level): each syllable a small nod */
  voice: number
  /** the world time a freeze stopped this person at (their pose held there, breath and all) */
  frozenAt?: number
}

/** Turns a rig's joints to a pose at world time `w`. */
export function poseRig(rig: PersonRig, hipsY: number, p: PoseNow, w: number, n: number) {
  const at = p.frozenAt ?? w
  const j = mix(poseJoints(p.was, at, p.wasSince, n), poseJoints(p.pose, at, p.since, n), p.blend)
  const holds = p.blend > 0.5 ? HOLDS[p.pose] : HOLDS[p.was]
  // a run: longer strides, the arms pumping, the body leaning into it
  const run = Math.max(0, Math.min(1, (p.speed - 1.4) / 1.4)) * p.walk
  const amp = 0.55 * p.walk * (1 + 0.45 * run)
  const f = p.phase
  const swing = Math.sin(f) * amp
  j.lean += 0.16 * run
  // talking: the head dips a little on each syllable and turns slowly, whatever the pose
  if (p.talking && p.frozenAt === undefined) {
    j.headX += 0.02 * Math.sin(w * 7.3 + n) + 0.11 * p.voice
    j.headY += 0.05 * Math.sin(w * 3.1 + n)
    j.lean += 0.02 * p.voice
  }
  rig.hips.position.y = hipsY + j.lift + (p.walk ? Math.abs(Math.cos(f)) * 0.025 * p.walk : p.frozenAt === undefined ? Math.sin(w * 1.6 + n) * 0.004 : 0)
  rig.hips.rotation.set(j.lean, 0, j.tilt)
  rig.head.rotation.set(j.headX, j.headY, j.headZ)
  // the legs stay under the body: turned back by the lean and the tilt, then swung by the stride; a squat brings the
  // thighs forward and the shins back by twice as much, the hips coming down by what the legs lose (the feet stay put)
  const sq = j.squat * 1.15
  rig.thighL.rotation.set(-j.lean - swing - sq, 0, -j.tilt)
  rig.thighR.rotation.set(-j.lean + swing - sq, 0, -j.tilt)
  rig.kneeL.rotation.x = Math.max(0, Math.cos(f)) * amp * 1.1 + 0.03 + 2 * sq
  rig.kneeR.rotation.x = Math.max(0, -Math.cos(f)) * amp * 1.1 + 0.03 + 2 * sq
  if (sq) rig.hips.position.y -= (THIGH + SHIN) * (1 - Math.cos(sq)) * rig.hips.scale.y
  // the feet on the ground: the body comes down by what the bent legs have lost of their length (from a camera on the
  // floor a stride would otherwise float)
  if (p.walk) {
    const reach = (a: number, b: number) => THIGH * Math.cos(a) + SHIN * Math.cos(a + b)
    const lowest = Math.max(reach(rig.thighL.rotation.x + j.lean, rig.kneeL.rotation.x), reach(rig.thighR.rotation.x + j.lean, rig.kneeR.rotation.x))
    // (a squat's own drop is already taken)
    rig.hips.position.y -= (THIGH + SHIN - lowest - (THIGH + SHIN) * (1 - Math.cos(sq))) * rig.hips.scale.y
  }
  const armSwing = swing * 0.7
  rig.armL.rotation.set(j.armLX + (holds === 'both' ? 0 : armSwing), 0, j.armLZ)
  rig.armR.rotation.set(j.armRX - (holds ? 0 : armSwing), 0, j.armRZ)
  rig.elbowL.rotation.x = j.elbowL
  rig.elbowR.rotation.x = j.elbowR
}
