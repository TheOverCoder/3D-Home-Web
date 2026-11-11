import { TRACTOR } from './data'

// The tractor's trips, as a timeline: from the seconds since a trip began, where the tractor is, which way it faces,
// how far its wheels have turned and what it is doing. A trip: the crates on the pallet hop onto its carrier one by
// one; it drives off west along its track, out through the gate in the hedge and away (out of sight for a while);
// it comes back, turns round outside the gate (forward, then back) and backs into its yard. Plain arithmetic: the
// farm's clock (src/farm/state.ts) counts the seconds and the scene (src/farm/OrderYard.tsx) draws what this says.

/** Seconds a crate takes to hop from the pallet onto the carrier, and the pause before it drives off. */
export const CRATE_SECONDS = 0.8
const SETTLE = 0.6
/** Seconds it is out of sight, away delivering. */
export const AWAY_SECONDS = 12
/** How far past the gate it drives before it is out of sight, and the radius of its turn outside the gate. */
const FAR = 60
const TURN = 3

type Ease = 'in' | 'out' | 'both' | 'none'

interface Segment {
  /** a straight run from a to b, or an arc round `c` from angle a0 to a1 (points at c + r·(sin a, cos a)) */
  line?: { a: [number, number]; b: [number, number] }
  arc?: { c: [number, number]; r: number; a0: number; a1: number }
  /** backing up: it faces away from where it goes */
  reverse: boolean
  /** metres a second, on average */
  speed: number
  ease: Ease
  /** out of sight (away delivering): it stays at its start */
  hold?: number
}

export type TractorPhase = 'home' | 'loading' | 'out' | 'away' | 'back'

export interface TractorPose {
  x: number
  z: number
  /** which way it faces (radians about y; 0 looks along +z, as the farm's people and animals) */
  heading: number
  /** metres its wheels have rolled since the trip began (less when it backs up) */
  roll: number
  /** how fast it goes now, metres a second (0 standing) */
  speed: number
  phase: TractorPhase
  /** crates on its carrier now (while it loads, those already on) */
  aboard: number
  /** where it is a while into the trip: false while it is far off, away */
  visible: boolean
  /** backing up */
  reverse: boolean
}

const ease = (e: Ease, u: number) => (e === 'in' ? 1 - Math.cos((u * Math.PI) / 2) : e === 'out' ? Math.sin((u * Math.PI) / 2) : e === 'both' ? (1 - Math.cos(u * Math.PI)) / 2 : u)
const easeRate = (e: Ease, u: number) =>
  e === 'in' ? (Math.PI / 2) * Math.sin((u * Math.PI) / 2) : e === 'out' ? (Math.PI / 2) * Math.cos((u * Math.PI) / 2) : e === 'both' ? (Math.PI / 2) * Math.sin(u * Math.PI) : 1

const lengthOf = (s: Segment) => (s.line ? Math.hypot(s.line.b[0] - s.line.a[0], s.line.b[1] - s.line.a[1]) : s.arc ? Math.abs(s.arc.a1 - s.arc.a0) * s.arc.r : 0)
const durationOf = (s: Segment) => s.hold ?? lengthOf(s) / s.speed

/** The way out and back, for a gate in the hedge at x = `gateX` (the farm's west edge, where the track crosses it). */
export function route(gateX: number): Segment[] {
  const z = TRACTOR.z
  const park: [number, number] = [TRACTOR.park, z]
  const far: [number, number] = [gateX - FAR, z]
  const stop: [number, number] = [gateX - 8, z]
  return [
    { line: { a: park, b: far }, reverse: false, speed: 4.5, ease: 'in' },
    { line: { a: far, b: far }, reverse: false, speed: 1, ease: 'none', hold: AWAY_SECONDS },
    { line: { a: far, b: stop }, reverse: false, speed: 4.5, ease: 'out' },
    // forward round to the left (to face north), then back round (to face west), just outside the gate
    { arc: { c: [stop[0], z - TURN], r: TURN, a0: 0, a1: Math.PI / 2 }, reverse: false, speed: 1.6, ease: 'both' },
    { arc: { c: [stop[0] + 2 * TURN, z - TURN], r: TURN, a0: -Math.PI / 2, a1: 0 }, reverse: true, speed: 1.3, ease: 'both' },
    // and back through the gate into the yard
    { line: { a: [stop[0] + 2 * TURN, z], b: park }, reverse: true, speed: 1.4, ease: 'both' },
  ]
}

/** Seconds the crates take to go on. */
export const loadingSeconds = (aboard: number) => aboard * CRATE_SECONDS + SETTLE

/** Seconds a whole trip takes, loading included. */
export const tripSeconds = (aboard: number, gateX: number) => loadingSeconds(aboard) + route(gateX).reduce((t, s) => t + durationOf(s), 0)

/** Where the tractor is `t` seconds into a trip carrying `aboard` crates (t < 0: at home, not on a trip). */
export function tractorPose(t: number, aboard: number, gateX: number): TractorPose {
  const home: TractorPose = { x: TRACTOR.park, z: TRACTOR.z, heading: -Math.PI / 2, roll: 0, speed: 0, phase: 'home', aboard: 0, visible: true, reverse: false }
  if (t < 0 || aboard <= 0) return home
  const load = loadingSeconds(aboard)
  if (t < load) return { ...home, phase: 'loading', aboard: Math.min(aboard, Math.floor(t / CRATE_SECONDS)) }
  let left = t - load
  let roll = 0
  const segments = route(gateX)
  for (let k = 0; k < segments.length; k++) {
    const s = segments[k]
    const d = durationOf(s)
    const L = lengthOf(s)
    if (left > d) {
      left -= d
      if (!s.hold) roll += s.reverse ? -L : L
      continue
    }
    const u = d > 0 ? left / d : 1
    const phase: TractorPhase = k === 0 ? 'out' : k === 1 ? 'away' : 'back'
    if (s.hold) return { x: s.line!.a[0], z: s.line!.a[1], heading: Math.PI / 2, roll, speed: 0, phase, aboard, visible: false, reverse: false }
    const f = ease(s.ease, u)
    const speed = (easeRate(s.ease, u) * L) / d
    let x: number
    let z: number
    let dx: number
    let dz: number
    if (s.line) {
      x = s.line.a[0] + (s.line.b[0] - s.line.a[0]) * f
      z = s.line.a[1] + (s.line.b[1] - s.line.a[1]) * f
      dx = s.line.b[0] - s.line.a[0]
      dz = s.line.b[1] - s.line.a[1]
    } else {
      const { c, r, a0, a1 } = s.arc!
      const a = a0 + (a1 - a0) * f
      x = c[0] + r * Math.sin(a)
      z = c[1] + r * Math.cos(a)
      const sign = Math.sign(a1 - a0)
      dx = Math.cos(a) * sign
      dz = -Math.sin(a) * sign
    }
    const heading = Math.atan2(dx, dz) + (s.reverse ? Math.PI : 0)
    roll += (s.reverse ? -L : L) * f
    // far off along the track it is out of sight (past the woods): not drawn
    return { x, z, heading, roll, speed, phase, aboard, visible: x > gateX - FAR * 0.7, reverse: s.reverse }
  }
  return home
}
