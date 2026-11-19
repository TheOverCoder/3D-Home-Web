// How a reward sounds by its size (mission 06 c7; update-v1/CONTRACTS.md §1.12), written into any engine (the live
// one through ./rewardSound.ts, an offline one to measure it, the tests' fake): the sting, all in the one key
// (./palette.ts), longer and richer by its tier — two notes for a small one, a rising run under a chord for a big one,
// and for a huge one a low body under it and an octave's shimmer over it — each family in a voice of its own (coins
// clink, a gift rings like glass, a level plucks and rings, a garment skips up, the keys jingle); the rattle of a box
// shaking before it opens, its knocks coming faster; and the tink of a coin landing on its chip, a step higher each. The
// tier is the farm's (src/farm/worth.ts: the amount decides, never dice): here it only sounds. Nothing here loads the
// farm.
import { rewardKind, type Family, type RewardKind, type Tier } from '../lib/tier'
import { burst, tone, type Engine } from './engine'
import { CLIMB_STEPS, keyStep, note, type KeyNote } from './palette'

/** How a tier sounds: its notes rising (a key note each, `gap` seconds apart), the chord that rings on after them, a low
 *  body under it, a clink at its end, an octave's shimmer over the chord; how long it lasts, and how far it steps the
 *  music and the ambience back while it rings (none for the small two). */
export interface StingTier {
  run: readonly KeyNote[]
  gap: number
  chord: readonly KeyNote[] | null
  body: KeyNote | null
  clink: boolean
  shimmer: boolean
  /** how long it rings (s) */
  seconds: number
  /** the music and the ambience stepped back (dB) for how long (ms); null: not at all */
  stepBack: { dB: number; ms: number } | null
}

/** The four tiers (mission 06 c7's table): each longer, with more notes and a wider range than the one below. */
export const STING_TIERS: Readonly<Record<Tier, StingTier>> = {
  small: { run: ['G6', 'C7'], gap: 0.075, chord: null, body: null, clink: false, shimmer: false, seconds: 0.35, stepBack: null },
  medium: { run: ['E6', 'G6', 'C7'], gap: 0.08, chord: null, body: null, clink: true, shimmer: false, seconds: 0.7, stepBack: null },
  big: { run: ['C6', 'E6', 'G6', 'C7'], gap: 0.085, chord: ['C6', 'E6', 'G6', 'C7'], body: null, clink: false, shimmer: false, seconds: 1.2, stepBack: { dB: -6, ms: 800 } },
  huge: { run: ['C6', 'E6', 'G6', 'C7', 'E7'], gap: 0.09, chord: ['C6', 'E6', 'G6', 'C7', 'E7'], body: 'C5', clink: false, shimmer: true, seconds: 1.8, stepBack: { dB: -6, ms: 1800 } },
}

/** How fast the music and the ambience step back for a sting, and come again (s: a time constant): quicker than a
 *  screen's, so the sting rings in the clear from its first note. */
export const STING_TC = 0.08

/** A key note's frequency. */
const hzOf = (n: KeyNote) => {
  const { step, octave } = keyStep(n)
  return note(step, octave)
}

/** One note of a family's voice at `t`: frequency `f`, loudness `g`, ringing for `d` seconds. */
type Voice = (e: Engine, t: number, f: number, g: number, d: number) => void

/** Each family's voice. The coins clink (a bright note, its octave and the metal's click); a gift rings like glass (its
 *  note and a bell's overtone, 2.76 times it: a colour a fifth as loud, never a note); a level plucks (a triangle, a
 *  sine under it); a garment skips up on a softer pluck with a bell over it; the keys jingle (a high clink and its
 *  click). */
const VOICES: Readonly<Record<Exclude<Family, 'work'>, Voice>> = {
  coins(e, t, f, g, d) {
    tone(e, t, { type: 'sine', f0: f, gain: g, attack: 0.002, decay: d, key: true })
    tone(e, t, { type: 'sine', f0: f * 2, gain: g * 0.22, attack: 0.002, decay: d * 0.35, key: true })
    burst(e, t, { type: 'highpass', freq: 6000, q: 0.7, gain: g * 0.55, attack: 0.001, decay: 0.035 })
  },
  gift(e, t, f, g, d) {
    tone(e, t, { type: 'sine', f0: f, gain: g, attack: 0.003, decay: d, key: true })
    tone(e, t, { type: 'sine', f0: f * 2.76, gain: g * 0.2, attack: 0.002, decay: d * 0.3, key: true })
  },
  level(e, t, f, g, d) {
    tone(e, t, { type: 'triangle', f0: f, gain: g, attack: 0.004, decay: d * 0.6, key: true })
    tone(e, t, { type: 'sine', f0: f, gain: g * 0.5, attack: 0.008, decay: d, key: true })
  },
  garment(e, t, f, g, d) {
    tone(e, t, { type: 'triangle', f0: f, gain: g * 1.36, attack: 0.004, decay: d * 0.5, key: true })
    tone(e, t, { type: 'sine', f0: f * 2, gain: g * 0.51, attack: 0.004, decay: d * 0.8, key: true })
  },
  keys(e, t, f, g, d) {
    tone(e, t, { type: 'sine', f0: f * 2, gain: g * 1.05, attack: 0.001, decay: Math.min(d, 0.12), key: true })
    tone(e, t, { type: 'sine', f0: f, gain: g * 0.9, attack: 0.008, decay: d, key: true })
    burst(e, t, { type: 'highpass', freq: 7000, q: 0.8, gain: g * 0.75, attack: 0.001, decay: 0.03 })
  },
}

/** How loud each tier's notes are written: the run, the chord and the body (a bigger sting has more voices at once,
 *  so each is a little softer: every sting sits at the reward family's loudness, a big one a shade over a small one,
 *  ./measure.ts; what tells its size is its length, its notes and the music stepping back). */
const LEVEL: Readonly<Record<Tier, { run: number; chord: number; body: number }>> = {
  small: { run: 0.058, chord: 0, body: 0 },
  medium: { run: 0.046, chord: 0, body: 0 },
  big: { run: 0.047, chord: 0.026, body: 0 },
  huge: { run: 0.04, chord: 0.02, body: 0.03 },
}
/** Coins tumbling in with a big sum: this many more clinks, high in the key, through the run (a few coins, more coins). */
const TUMBLE: Readonly<Record<Tier, number>> = { small: 0, medium: 2, big: 5, huge: 9 }

/** The family a reward of `kind` sounds in, or null for goods collected (the press made its work's sound). */
export function stingFamily(kind: RewardKind): Exclude<Family, 'work'> | null {
  const f = rewardKind(kind).family
  return f === 'work' ? null : f
}

/** A reward's sting written into `e` at `t` (the live engine, an offline one to measure it, or the tests' fake):
 *  nothing for goods collected. The till's drawer knocks open before its coins. How long it rings (s). */
export function playSting(e: Engine, kind: RewardKind, tier: Tier, at = e.ac.currentTime + 0.004): number {
  const family = stingFamily(kind)
  if (!family) return 0
  let t = at
  const s = STING_TIERS[tier]
  const lv = LEVEL[tier]
  const voice = VOICES[family]
  if (kind === 'till') {
    // the drawer rolls out and knocks open, then the coins
    burst(e, t, { type: 'bandpass', freq: 1800, sweepTo: 700, q: 1.2, gain: 0.1, attack: 0.01, decay: 0.12 })
    burst(e, t + 0.12, { type: 'bandpass', freq: 900, q: 1.2, gain: 0.25, attack: 0.002, decay: 0.06 })
    t += 0.14
  }
  const end = t + s.seconds
  const runEnd = t + (s.run.length - 1) * s.gap
  // the run, rising: each note rings until the chord takes over (the last one on to the end when there is none)
  s.run.forEach((n, i) => {
    const when = t + i * s.gap
    voice(e, when, hzOf(n), lv.run, s.chord ? Math.max(0.2, runEnd + 0.27 - when) : Math.max(0.2, end - when))
  })
  // the chord rings on under it to the end
  if (s.chord) for (const n of s.chord) voice(e, runEnd + 0.06, hzOf(n), lv.chord, end - runEnd - 0.06)
  // a low body (and its octave, what a phone's speaker plays of it) under the whole of a huge one
  if (s.body) {
    const f = hzOf(s.body)
    tone(e, t, { type: 'sine', f0: f, gain: lv.body, attack: 0.03, decay: s.seconds, key: true })
    tone(e, t, { type: 'triangle', f0: f * 2, gain: lv.body * 0.45, attack: 0.03, decay: s.seconds * 0.8, key: true })
  }
  // a clink as it lands (a medium one): the metal's tick, and a glint of the key two octaves up (a colour)
  if (s.clink) {
    const when = runEnd + 0.07
    tone(e, when, { type: 'sine', f0: note(0, 8), gain: lv.run * 0.2, attack: 0.001, decay: 0.12, key: true })
    burst(e, when, { type: 'highpass', freq: 7500, q: 0.7, gain: lv.run * 0.7, attack: 0.001, decay: 0.03 })
  }
  // an octave's shimmer over the chord: its notes an octave up, one after another, quiet
  if (s.shimmer && s.chord) {
    s.chord.forEach((n, i) => {
      const { step, octave } = keyStep(n)
      tone(e, runEnd + 0.12 + i * 0.06, { type: 'sine', f0: note(step, octave + 1), gain: lv.chord * 0.35, attack: 0.002, decay: 0.5, key: true })
    })
    burst(e, runEnd + 0.08, { type: 'highpass', freq: 5000, sweepTo: 10000, q: 0.7, gain: 0.02, attack: 0.15, decay: 0.7 })
  }
  // coins tumbling in with a bigger sum: more clinks, high in the key, through the run
  if (family === 'coins')
    for (let i = 0; i < TUMBLE[tier]; i++) {
      const when = t + 0.03 + Math.random() * Math.max(0.1, runEnd - t + 0.15)
      const step = Math.floor(Math.random() * 5)
      tone(e, when, { type: 'sine', f0: note(step, 7), gain: lv.run * 0.32, attack: 0.001, decay: 0.09, key: true })
      burst(e, when, { type: 'highpass', freq: 6500, q: 0.7, gain: lv.run * 0.3, attack: 0.001, decay: 0.025 })
    }
  return end - at
}

// ─────────────────────── the rattle ───────────────────────

/** A rattle's knocks: about one every this long (s) on average, more the longer it shakes. */
const KNOCK_EVERY = 0.075
/** How much quicker its last knock follows the one before than its first: it speeds up towards the opening. */
const SPEED_UP = 3.2

/** When a rattle of `ms` (after `delayMs`) knocks, in seconds from its start: closer and closer together, the last a
 *  moment before it opens. */
export function knocksOf(ms: number, delayMs = 0): number[] {
  const len = Math.max(0.1, ms / 1000 - 0.03)
  const n = Math.max(3, Math.round(len / KNOCK_EVERY))
  // gaps falling geometrically from the first to the last, scaled to fill the shake
  const r = SPEED_UP ** (-1 / Math.max(1, n - 2))
  const gaps = Array.from({ length: n - 1 }, (_, i) => r ** i)
  const sum = gaps.reduce((a, b) => a + b, 0)
  const out = [delayMs / 1000]
  for (const g of gaps) out.push(out[out.length - 1] + (g / sum) * len)
  return out
}

/** A box rattling written into `e` from `t`: its lid knocking on it, a little louder and closer each time, a little
 *  higher and lower as it rocks one way and the other. */
export function playRattle(e: Engine, ms: number, delayMs = 0, t = e.ac.currentTime + 0.004) {
  const knocks = knocksOf(ms, delayMs)
  knocks.forEach((k, i) => {
    const when = t + k
    const v = 0.55 + 0.45 * (i / Math.max(1, knocks.length - 1))
    const side = i % 2 ? 1 : 0.88
    // the lid's knock on the box (where a phone's speaker carries it), the cardboard's body under it, a tick of the lid
    burst(e, when, { type: 'bandpass', freq: 1250 * side, q: 2.2, gain: 1.12 * v, attack: 0.002, decay: 0.04 })
    burst(e, when, { type: 'lowpass', freq: 520, q: 0.8, gain: 0.37 * v, attack: 0.002, decay: 0.05 })
    burst(e, when + 0.004, { type: 'bandpass', freq: 2600 * side, q: 3, gain: 0.32 * v, attack: 0.001, decay: 0.02 })
  })
}

// ─────────────────────── coins landing ───────────────────────

/** The coins' tinks climb the key from G6 (its 4th note in octave 6), a step each, holding the top. */
const LAND_FROM = 3

/** The tink of the `i`-th coin landing (Hz): a step of the key higher each, held at the top. */
export const landNote = (i: number) => note(LAND_FROM + Math.max(0, Math.min(CLIMB_STEPS - 1, Math.floor(i))), 6)

/** A coin landing on its chip written into `e` at `t`: a quiet glassy tink, the `i`-th a step higher. */
export function playLanding(e: Engine, i: number, t = e.ac.currentTime + 0.004) {
  const f = landNote(i)
  tone(e, t, { type: 'sine', f0: f, gain: 0.038, attack: 0.002, decay: 0.12, key: true })
  tone(e, t, { type: 'sine', f0: f * 2, gain: 0.015, attack: 0.002, decay: 0.05, key: true })
  burst(e, t, { type: 'highpass', freq: 7000, q: 0.7, gain: 0.015, attack: 0.001, decay: 0.02 })
}
