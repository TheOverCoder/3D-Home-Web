// The farm's sounds: garden work, coins, the animals and the machines, and the cues and stings that tell news. Each is
// a name, a row of ./sounds.ts (its family, its touch, how much it varies) and a synth here that writes it into any
// engine (./engine.ts): `play` puts one into an engine as asked, `farmSound` plays one where it can be heard, varied by
// its row, with the touch of what the player did.
import { haptic, type Haptic } from '../lib/device'
import { burst, live, rnd, tone, voice, type Engine } from './engine'
import { vary } from './palette'
import { SOUNDS } from './sounds'

export type FarmSound =
  | 'plant'
  | 'water'
  | 'harvest'
  | 'coins'
  | 'cluck'
  | 'bell'
  | 'build'
  | 'decline'
  | 'moo'
  | 'milk'
  | 'creak'
  | 'oven'
  | 'ding'
  | 'crow'
  | 'baa'
  | 'shear'
  | 'loom'
  | 'surprise'
  | 'chug'
  | 'xp' // a crystal joining the level chip's bar
  | 'level' // a new level
  | 'till' // the shop's till emptied into your purse
  | 'chime' // the contractor has what you need today
  | 'dress' // a garment put on: cloth rustling
  | 'garment' // a new garment for the wardrobe: a bright flourish
  | 'keys' // the house bought: its keys handed over, jingling, and a warm chord

/** Crystals landing one close behind another climb this scale (semitones over the first note), then hold its top. */
const XP_STEPS = [0, 2, 4, 7, 9, 12, 14, 16]
let xpRun = 0
let xpLast = -Infinity

/** A sound written at audio time `t` into `e`; `v` is how near it is (0.25..1: its loudness), `pan` where (−1..1). */
type Synth = (e: Engine, t: number, v: number, pan: number) => void

const SYNTHS: Record<FarmSound, Synth> = {
  plant(e, t, v, pan) {
    // hands in the soil: two scrapes and a pat
    burst(e, t, { type: 'lowpass', freq: 900, q: 0.6, gain: 0.25 * v, attack: 0.03, decay: 0.18, pan })
    burst(e, t + 0.16, { type: 'bandpass', freq: 1400, q: 0.8, gain: 0.12 * v, attack: 0.02, decay: 0.14, pan })
    burst(e, t + 0.32, { type: 'lowpass', freq: 260, q: 0.7, gain: 0.35 * v, attack: 0.005, decay: 0.09, pan })
  },
  water(e, t, v, pan) {
    // a pour sweeping down, and a few drops
    burst(e, t, { type: 'bandpass', freq: 2600, sweepTo: 1200, q: 1.1, gain: 0.2 * v, attack: 0.08, decay: 0.9, pan })
    burst(e, t + 0.05, { type: 'highpass', freq: 5000, q: 0.7, gain: 0.05 * v, attack: 0.05, decay: 0.8, pan })
    for (let i = 0; i < 4; i++) tone(e, t + 0.2 + i * 0.13 + Math.random() * 0.05, { type: 'sine', f0: rnd(900, 1500), f1: rnd(1800, 2600), gain: 0.025 * v, attack: 0.004, decay: 0.05, pan })
  },
  harvest(e, t, v, pan) {
    // leaves rustle, a stem snaps
    burst(e, t, { type: 'bandpass', freq: 3200, q: 0.9, gain: 0.12 * v, attack: 0.02, decay: 0.22, pan })
    burst(e, t + 0.12, { type: 'highpass', freq: 2500, q: 0.8, gain: 0.18 * v, attack: 0.002, decay: 0.03, pan })
    tone(e, t + 0.12, { type: 'triangle', f0: 520, f1: 300, gain: 0.05 * v, attack: 0.003, decay: 0.08, pan })
  },
  coins(e, t) {
    // clink, clink, chime
    tone(e, t, { type: 'sine', f0: 2093, gain: 0.05, attack: 0.002, decay: 0.25, key: true })
    tone(e, t + 0.07, { type: 'sine', f0: 2637, gain: 0.05, attack: 0.002, decay: 0.35, key: true })
    tone(e, t + 0.14, { type: 'sine', f0: 3136, gain: 0.04, attack: 0.002, decay: 0.5, key: true })
    burst(e, t, { type: 'highpass', freq: 6000, q: 0.7, gain: 0.03, attack: 0.001, decay: 0.05 })
  },
  cluck(e, t, v, pan) {
    // a hen: two or three short nasal notes
    const n = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < n; i++) {
      const tt = t + i * rnd(0.09, 0.13)
      tone(e, tt, { type: 'sawtooth', f0: rnd(520, 640), f1: rnd(380, 460), gain: 0.02 * v, attack: 0.008, decay: 0.06, pan })
      burst(e, tt, { type: 'bandpass', freq: 1400, q: 3, gain: 0.03 * v, attack: 0.006, decay: 0.05, pan })
    }
  },
  bell(e, t, v, pan) {
    // the gate bell: someone is here
    for (const [f, d, g] of [
      [1318, 1.4, 0.05],
      [1975, 1.0, 0.025],
      [2637, 0.6, 0.015],
    ])
      tone(e, t, { type: 'sine', f0: f, gain: g * v, attack: 0.003, decay: d, pan })
    tone(e, t + 0.28, { type: 'sine', f0: 1046, gain: 0.04 * v, attack: 0.003, decay: 1.2, pan })
  },
  build(e, t, v, pan) {
    // hammer knocks into timber
    for (let i = 0; i < 3; i++) {
      burst(e, t + i * 0.18, { type: 'lowpass', freq: 700, q: 0.8, gain: 0.4 * v, attack: 0.002, decay: 0.07, pan })
      tone(e, t + i * 0.18, { type: 'sine', f0: 180, f1: 120, gain: 0.15 * v, attack: 0.002, decay: 0.08, pan })
    }
  },
  decline(e, t) {
    // a soft falling "oh well"
    tone(e, t, { type: 'triangle', f0: 392, gain: 0.03, attack: 0.01, decay: 0.2 })
    tone(e, t + 0.15, { type: 'triangle', f0: 311, gain: 0.03, attack: 0.01, decay: 0.3 })
  },
  moo(e, t, v, pan) {
    // a low "mmm-ooo" that opens up and falls away
    voice(
      e,
      t,
      [
        [rnd(105, 125), 0.6],
        [rnd(135, 150), 1],
        [rnd(140, 150), 1],
        [rnd(100, 112), 0.5],
      ],
      rnd(1.1, 1.5),
      0.09 * v,
      [380, 1100],
      pan,
    )
  },
  milk(e, t, v, pan) {
    // three quick squirts into the pail
    for (let i = 0; i < 3; i++) burst(e, t + i * 0.2, { type: 'bandpass', freq: rnd(2200, 2800), sweepTo: 1600, q: 2.2, gain: 0.12 * v, attack: 0.005, decay: 0.09, pan })
  },
  creak(e, t, v, pan) {
    // the mill's wooden wheel turning
    voice(
      e,
      t,
      [
        [rnd(170, 190), 0.6],
        [rnd(210, 240), 1],
        [rnd(160, 180), 0.4],
      ],
      rnd(0.3, 0.45),
      0.03 * v,
      [600, 1400],
      pan,
      'triangle',
    )
    burst(e, t, { type: 'lowpass', freq: 500, q: 0.6, gain: 0.08 * v, attack: 0.05, decay: 0.3, pan })
  },
  oven(e, t, v, pan) {
    // the fire takes: a whoosh and a low roar
    burst(e, t, { type: 'bandpass', freq: 300, sweepTo: 1300, q: 0.7, gain: 0.22 * v, attack: 0.15, decay: 0.7, pan })
    burst(e, t + 0.1, { type: 'lowpass', freq: 220, q: 0.6, gain: 0.25 * v, attack: 0.2, decay: 0.9, pan })
  },
  surprise(e, t) {
    // a surprise found: a quick rising sparkle of four notes
    ;[1568, 1976, 2349, 3136].forEach((f, i) => tone(e, t + i * 0.07, { type: 'sine', f0: f, gain: 0.04, attack: 0.003, decay: 0.35 + i * 0.1 }))
    burst(e, t + 0.2, { type: 'highpass', freq: 7000, q: 0.7, gain: 0.025, attack: 0.01, decay: 0.3 })
  },
  chug(e, t, v, pan) {
    // the tractor's engine: one low putt (played over and over while it drives)
    tone(e, t, { type: 'sawtooth', f0: rnd(62, 70), f1: 48, gain: 0.05 * v, attack: 0.006, decay: 0.09, pan })
    burst(e, t, { type: 'lowpass', freq: 240, q: 0.8, gain: 0.12 * v, attack: 0.004, decay: 0.08, pan })
  },
  xp(e, t) {
    // a crystal joins the bar: a glassy tink, a step up the scale for each that lands close behind the one before
    const now = performance.now()
    xpRun = now - xpLast < 450 ? Math.min(xpRun + 1, XP_STEPS.length - 1) : 0
    xpLast = now
    const f = 1760 * 2 ** (XP_STEPS[xpRun] / 12)
    tone(e, t, { type: 'sine', f0: f, gain: 0.035, attack: 0.002, decay: 0.16 })
    tone(e, t, { type: 'triangle', f0: f * 1.5, gain: 0.01, attack: 0.002, decay: 0.1 })
    tone(e, t, { type: 'sine', f0: f * 2.01, gain: 0.012, attack: 0.002, decay: 0.07 })
  },
  level(e, t) {
    // a new level: a quick rising arpeggio, then its chord rings on under a shimmer
    ;[1047, 1319, 1568, 2093].forEach((f, i) => tone(e, t + i * 0.08, { type: 'triangle', f0: f, gain: 0.05, attack: 0.004, decay: 0.25 }))
    for (const f of [1047, 1319, 1568, 2093]) tone(e, t + 0.34, { type: 'sine', f0: f, gain: 0.028, attack: 0.012, decay: 1.3 })
    tone(e, t + 0.34, { type: 'sine', f0: 4186, gain: 0.008, attack: 0.012, decay: 0.8 })
    burst(e, t, { type: 'highpass', freq: 3000, sweepTo: 9000, q: 0.7, gain: 0.03, attack: 0.25, decay: 0.5 })
  },
  till(e, t) {
    // the till: its drawer rolls out and knocks open, the bell rings, the coins clink
    burst(e, t, { type: 'bandpass', freq: 1800, sweepTo: 700, q: 1.2, gain: 0.1, attack: 0.01, decay: 0.12 })
    burst(e, t + 0.12, { type: 'lowpass', freq: 500, q: 0.8, gain: 0.22, attack: 0.002, decay: 0.06 })
    tone(e, t + 0.14, { type: 'sine', f0: 2637, gain: 0.055, attack: 0.002, decay: 0.9, key: true })
    tone(e, t + 0.14, { type: 'sine', f0: 3951, gain: 0.025, attack: 0.002, decay: 0.6, key: true })
    tone(e, t + 0.14, { type: 'sine', f0: 5274, gain: 0.01, attack: 0.002, decay: 0.3, key: true })
    tone(e, t + 0.34, { type: 'sine', f0: 2093, gain: 0.03, attack: 0.002, decay: 0.2, key: true })
    tone(e, t + 0.41, { type: 'sine', f0: 2794, gain: 0.03, attack: 0.002, decay: 0.3, key: true })
  },
  chime(e, t) {
    // news worth hearing: three soft handbell notes rising, each with its bell's high overtone
    ;[880, 1175, 1760].forEach((f, i) => {
      tone(e, t + i * 0.16, { type: 'sine', f0: f, gain: 0.04, attack: 0.003, decay: 1.1 })
      tone(e, t + i * 0.16, { type: 'sine', f0: f * 2.76, gain: 0.008, attack: 0.002, decay: 0.3 })
    })
  },
  dress(e, t) {
    // a garment put on: two soft swishes of cloth
    burst(e, t, { type: 'bandpass', freq: 1600, sweepTo: 3200, q: 0.7, gain: 0.07, attack: 0.04, decay: 0.16 })
    burst(e, t + 0.13, { type: 'bandpass', freq: 2600, sweepTo: 1300, q: 0.7, gain: 0.05, attack: 0.03, decay: 0.18 })
  },
  garment(e, t) {
    // a new garment: a skip up the scale, then a bright bell over a soft shimmer
    ;[1319, 1568, 1976].forEach((f, i) => tone(e, t + i * 0.09, { type: 'triangle', f0: f, gain: 0.045, attack: 0.004, decay: 0.22 }))
    tone(e, t + 0.3, { type: 'sine', f0: 2637, gain: 0.05, attack: 0.004, decay: 1.2 })
    tone(e, t + 0.3, { type: 'sine', f0: 3951, gain: 0.015, attack: 0.004, decay: 0.6 })
    burst(e, t + 0.28, { type: 'highpass', freq: 5000, sweepTo: 10000, q: 0.7, gain: 0.025, attack: 0.1, decay: 0.6 })
  },
  keys(e, t) {
    // a bunch of keys handed over: small bright clinks close together, then a warm chord rings on
    for (let i = 0; i < 6; i++) {
      const at = t + i * 0.055 + Math.random() * 0.03
      tone(e, at, { type: 'sine', f0: rnd(3400, 5200), gain: 0.03, attack: 0.001, decay: 0.09 })
      burst(e, at, { type: 'highpass', freq: 7000, q: 0.8, gain: 0.02, attack: 0.001, decay: 0.03 })
    }
    for (const f of [784, 988, 1175, 1568]) tone(e, t + 0.42, { type: 'sine', f0: f, gain: 0.03, attack: 0.01, decay: 1.4 })
  },
  ding(e, t) {
    // the kitchen timer: it is ready
    tone(e, t, { type: 'sine', f0: 1568, gain: 0.06, attack: 0.003, decay: 1.2 })
    tone(e, t, { type: 'sine', f0: 3136, gain: 0.02, attack: 0.003, decay: 0.5 })
    tone(e, t + 0.18, { type: 'sine', f0: 2093, gain: 0.05, attack: 0.003, decay: 1.4 })
  },
  crow(e, t, v, pan) {
    // cock-a-doodle-doo
    voice(
      e,
      t,
      [
        [520, 0.5],
        [640, 1],
        [700, 0.9],
        [760, 1],
        [820, 1],
        [780, 0.9],
        [560, 0.4],
      ],
      1.25,
      0.05 * v,
      [900, 2600],
      pan,
    )
  },
  baa(e, t, v, pan) {
    // a sheep: a bleating "baa-a-a", the voice wavering as it goes
    const f = rnd(330, 420)
    voice(
      e,
      t,
      [
        [f * 0.9, 0.5],
        [f, 1],
        [f * 1.04, 0.8],
        [f * 0.98, 0.9],
        [f * 1.03, 0.7],
        [f * 0.86, 0.3],
      ],
      rnd(0.6, 0.85),
      0.05 * v,
      [1100, 2600],
      pan,
      'square',
    )
  },
  shear(e, t, v, pan) {
    // shears snipping through the fleece
    for (let i = 0; i < 4; i++) {
      burst(e, t + i * 0.14, { type: 'highpass', freq: 3800, q: 0.9, gain: 0.12 * v, attack: 0.002, decay: 0.04, pan })
      tone(e, t + i * 0.14 + 0.01, { type: 'triangle', f0: 2400, f1: 1700, gain: 0.02 * v, attack: 0.002, decay: 0.05, pan })
    }
    burst(e, t + 0.05, { type: 'bandpass', freq: 900, q: 0.7, gain: 0.08 * v, attack: 0.08, decay: 0.5, pan })
  },
  loom(e, t, v, pan) {
    // the shuttle clacks across and the beater knocks
    for (let i = 0; i < 3; i++) {
      burst(e, t + i * 0.32, { type: 'bandpass', freq: 1800, q: 1.4, gain: 0.12 * v, attack: 0.003, decay: 0.05, pan })
      burst(e, t + i * 0.32 + 0.16, { type: 'lowpass', freq: 420, q: 0.8, gain: 0.3 * v, attack: 0.002, decay: 0.08, pan })
    }
  },
}

/** How a sound is played: where it is (`pan` −1 left … 1 right), how near (`near` 0..1, heard at a quarter at least),
 *  its pitch and loudness this time (factors, 1 as written; ./palette.ts, vary) and when (audio time; now if not given). */
export interface PlayOpts {
  pan?: number
  near?: number
  pitch?: number
  level?: number
  at?: number
}

/** One of the farm's sounds written into `e`, exactly as asked: the live engine, an offline one to measure it, or the
 *  tests' fake. */
export function play(e: Engine, kind: FarmSound, o: PlayOpts = {}) {
  const t = o.at ?? e.ac.currentTime + 0.004
  SYNTHS[kind]({ ...e, pitch: o.pitch ?? 1, level: o.level ?? 1 }, t, Math.max(0.25, o.near ?? 1), o.pan ?? 0)
}

/** Garden work and the people and animals in it, where it can be heard, a little different each time its row allows;
 *  what the player did is felt too (`feel`: its touch, its row's by default; null for none), whether the sound plays
 *  or not. */
export function farmSound(kind: FarmSound, pan = 0, near = 1, feel: Haptic | null = SOUNDS[kind].feel) {
  haptic(feel)
  const e = live()
  if (e) play(e, kind, { pan, near, ...vary(SOUNDS[kind]) })
}
