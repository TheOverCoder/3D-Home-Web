// The farm's sounds: garden work, coins, the animals and the machines, and the cues and stings that tell news. Each is
// a name, a row of ./sounds.ts (its family, its touch, how much it varies) and a synth here that writes it into any
// engine (./engine.ts): `play` puts one into an engine as asked, `farmSound` plays one where it can be heard, varied by
// its row, with the touch of what the player did.
import { haptic, type Haptic } from '../lib/device'
import { burst, live, rnd, tone, voice, type Engine } from './engine'
import { WORK_GAP, XP_GAP, climb, keyStep, note, vary, type KeyNote } from './palette'
import { SOUNDS } from './sounds'
import { playLanding, playRattle } from './stings'

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
  | 'pick' // fruit picked (the lemon tree, the fruit trees and bushes): a twig springs back, a soft plop
  | 'sack' // flour or sugar taken out of the mill: a sack set down, a puff
  | 'bolt' // cloth taken off the loom: a bolt of cloth, a swish and a soft thud
  | 'tray' // a cake taken out of the oven: the tray slides out and is set down
  | 'crate' // goods put into an order: a hollow knock on the crate, straw
  | 'shelf' // goods put up on a shelf of the market: two taps, a slide
  | 'pay' // coins paid out (the shop, the contractor's piece): two falling clinks
  | 'nope' // cannot (the store is full, a piece went back): decline's soft fall, shorter and higher
  | 'lift' // decoration or furniture lifted under the finger
  | 'thud' // put down where it fits: a thud by its size
  | 'rattle' // a gift box shaking before it opens: its lid knocking, faster and faster (./stings.ts)
  | 'tink' // a coin landing on the coin chip: a quiet glassy tink, a step up the key each (./stings.ts)
  | 'churn' // milk into the dairy's churn, and its dasher at work: a slosh and a wooden plunge
  | 'crock' // butter or cheese taken out of the dairy: a stoneware crock set down, a soft clink
  | 'bubble' // fruit and sugar into the jam kettle, and its jam at the boil: a few thick bubbles popping
  | 'jar' // a jar of jam taken off the fire: glass set down, its lid twisted on

/** Crystals landing one close behind another climb the key from A6 (its 4th note), a step each (./palette.ts, climb),
 *  then hold the top. */
const XP_FROM = 4
/** A press of work climbs a soft pip from C6 (the key's first note in octave 6), a step each quick press. */
const PIP_FROM = 0
/** One press over many beds sounds once a bed, this many at most, this far apart (s), climbing as it goes; each after
 *  the first a little softer, so a batch sounds fuller rather than louder. */
const BATCH_MOST = 6
const BATCH_GAP = 0.06
const BATCH_LEVEL = 0.6

/** The pip of a press `step` steps up its streak (Hz). */
export const pipNote = (step: number) => note(PIP_FROM + step, 6)

/** The keys' clinks, steps of the key in octave 7 (A7 to E8: a bright jingle, the same each time). */
const KEY_CLINKS = [5, 7, 4, 6, 5, 7]

/** A sound written at audio time `t` into `e`; `v` is how near it is (0.25..1: its loudness), `pan` where (−1..1), `o`
 *  how it was asked for (a ding's note, a thud's size). */
type Synth = (e: Engine, t: number, v: number, pan: number, o: PlayOpts) => void

/** How long a rattle shakes when no length is asked for (ms): the daily gift's box (src/farm/DailyCard.tsx). */
const RATTLE_MS = 680
/** A ding's note when none is asked for: G6, the oven's. */
const DING: KeyNote = 'G6'
/** How big a thing put down is, 0..1, from its size across (m): a stool small, a sofa or a shed the biggest. */
const heft = (size = 1) => Math.max(0.15, Math.min(1, size / 2.5))

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
    // leaves rustle, a stem snaps (both where a phone's speaker carries them)
    burst(e, t, { type: 'bandpass', freq: 2600, q: 1.1, gain: 0.12 * v, attack: 0.02, decay: 0.22, pan })
    burst(e, t + 0.12, { type: 'bandpass', freq: 2400, q: 1.2, gain: 0.2 * v, attack: 0.002, decay: 0.03, pan })
    tone(e, t + 0.12, { type: 'triangle', f0: 520, f1: 300, gain: 0.05 * v, attack: 0.003, decay: 0.08, pan })
  },
  coins(e, t) {
    // clink, clink, chime: C7, E7, G7
    tone(e, t, { type: 'sine', f0: note(0, 7), gain: 0.05, attack: 0.002, decay: 0.25, key: true })
    tone(e, t + 0.07, { type: 'sine', f0: note(2, 7), gain: 0.05, attack: 0.002, decay: 0.35, key: true })
    tone(e, t + 0.14, { type: 'sine', f0: note(3, 7), gain: 0.04, attack: 0.002, decay: 0.5, key: true })
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
    // the gate bell: someone is here. E6 with a bell's minor third (G6) and octave over it, then C6
    for (const [f, d, g] of [
      [note(2, 6), 1.4, 0.05],
      [note(3, 6), 1.0, 0.025],
      [note(2, 7), 0.6, 0.015],
    ])
      tone(e, t, { type: 'sine', f0: f, gain: g * v, attack: 0.003, decay: d, pan, key: true })
    tone(e, t + 0.28, { type: 'sine', f0: note(0, 6), gain: 0.04 * v, attack: 0.003, decay: 1.2, pan, key: true })
  },
  build(e, t, v, pan) {
    // hammer knocks into timber: the blow's body, and the wood's knock a phone's speaker carries (0.5–2 kHz)
    for (let i = 0; i < 3; i++) {
      burst(e, t + i * 0.18, { type: 'lowpass', freq: 700, q: 0.8, gain: 0.3 * v, attack: 0.002, decay: 0.07, pan })
      tone(e, t + i * 0.18, { type: 'sine', f0: 180, f1: 120, gain: 0.05 * v, attack: 0.002, decay: 0.08, pan })
      burst(e, t + i * 0.18, { type: 'bandpass', freq: 1100, q: 1.4, gain: 0.5 * v, attack: 0.002, decay: 0.05, pan })
    }
  },
  decline(e, t) {
    // a soft falling "oh well": G4 down to E4, each with its octave over it (what a phone's speaker plays of it)
    for (const [at, step, decay] of [
      [0, 3, 0.2],
      [0.15, 2, 0.3],
    ]) {
      tone(e, t + at, { type: 'triangle', f0: note(step, 4), gain: 0.03, attack: 0.01, decay, key: true })
      tone(e, t + at, { type: 'sine', f0: note(step, 5), gain: 0.026, attack: 0.01, decay: decay * 0.8, key: true })
    }
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
      0.018 * v,
      [600, 1400],
      pan,
      'triangle',
    )
    burst(e, t, { type: 'lowpass', freq: 500, q: 0.6, gain: 0.05 * v, attack: 0.05, decay: 0.3, pan })
    // the wood's own ring as it turns (where a phone carries it)
    burst(e, t + 0.04, { type: 'bandpass', freq: 1050, q: 3, gain: 0.4 * v, attack: 0.06, decay: 0.3, pan })
  },
  oven(e, t, v, pan) {
    // the fire takes: a whoosh and a low roar, and the wood crackling in it (a phone's speaker carries those)
    burst(e, t, { type: 'bandpass', freq: 300, sweepTo: 1300, q: 0.7, gain: 0.22 * v, attack: 0.15, decay: 0.7, pan })
    burst(e, t + 0.1, { type: 'lowpass', freq: 220, q: 0.6, gain: 0.25 * v, attack: 0.2, decay: 0.9, pan })
    for (const at of [0.14, 0.26, 0.38, 0.52]) burst(e, t + at, { type: 'bandpass', freq: 1800, q: 2, gain: 0.26 * v, attack: 0.001, decay: 0.025, pan })
  },
  surprise(e, t) {
    // a surprise found: a quick rising sparkle of four notes, G6 C7 D7 G7
    ;[note(3, 6), note(0, 7), note(1, 7), note(3, 7)].forEach((f, i) => tone(e, t + i * 0.07, { type: 'sine', f0: f, gain: 0.04, attack: 0.003, decay: 0.35 + i * 0.1, key: true }))
    burst(e, t + 0.2, { type: 'highpass', freq: 7000, q: 0.7, gain: 0.025, attack: 0.01, decay: 0.3 })
  },
  chug(e, t, v, pan) {
    // the tractor's engine: one low putt (played over and over while it drives)
    tone(e, t, { type: 'sawtooth', f0: rnd(62, 70), f1: 48, gain: 0.05 * v, attack: 0.006, decay: 0.09, pan })
    burst(e, t, { type: 'lowpass', freq: 240, q: 0.8, gain: 0.12 * v, attack: 0.004, decay: 0.08, pan })
    // the engine's rattle, what a phone's speaker plays of it
    burst(e, t, { type: 'bandpass', freq: 900, q: 1.4, gain: 0.06 * v, attack: 0.004, decay: 0.05, pan })
  },
  xp(e, t, _v, _pan, o) {
    // a crystal joins the bar: a glassy tink, a step up the key for each that lands close behind the one before, with
    // the key's note three steps over it (near a fifth) and its octave for the glass
    const step = XP_FROM + (o.step ?? climb('xp', XP_GAP))
    tone(e, t, { type: 'sine', f0: note(step, 6), gain: 0.035, attack: 0.002, decay: 0.16, key: true })
    tone(e, t, { type: 'triangle', f0: note(step + 3, 6), gain: 0.01, attack: 0.002, decay: 0.1, key: true })
    tone(e, t, { type: 'sine', f0: note(step, 7), gain: 0.012, attack: 0.002, decay: 0.07, key: true })
  },
  level(e, t) {
    // a new level: a quick rising arpeggio (C6 E6 G6 C7), then its chord rings on under a shimmer (C8)
    const chord = [note(0, 6), note(2, 6), note(3, 6), note(0, 7)]
    chord.forEach((f, i) => tone(e, t + i * 0.08, { type: 'triangle', f0: f, gain: 0.05, attack: 0.004, decay: 0.25, key: true }))
    for (const f of chord) tone(e, t + 0.34, { type: 'sine', f0: f, gain: 0.028, attack: 0.012, decay: 1.3, key: true })
    tone(e, t + 0.34, { type: 'sine', f0: note(0, 8), gain: 0.008, attack: 0.012, decay: 0.8, key: true })
    burst(e, t, { type: 'highpass', freq: 3000, sweepTo: 9000, q: 0.7, gain: 0.03, attack: 0.25, decay: 0.5 })
  },
  till(e, t) {
    // the till: its drawer rolls out and knocks open, the bell rings (E7, with a bell's minor third and octave over
    // it), the coins clink (C7, G7)
    burst(e, t, { type: 'bandpass', freq: 1800, sweepTo: 700, q: 1.2, gain: 0.1, attack: 0.01, decay: 0.12 })
    burst(e, t + 0.12, { type: 'lowpass', freq: 500, q: 0.8, gain: 0.22, attack: 0.002, decay: 0.06 })
    tone(e, t + 0.14, { type: 'sine', f0: note(2, 7), gain: 0.055, attack: 0.002, decay: 0.9, key: true })
    tone(e, t + 0.14, { type: 'sine', f0: note(3, 7), gain: 0.025, attack: 0.002, decay: 0.6, key: true })
    tone(e, t + 0.14, { type: 'sine', f0: note(2, 8), gain: 0.01, attack: 0.002, decay: 0.3, key: true })
    tone(e, t + 0.34, { type: 'sine', f0: note(0, 7), gain: 0.03, attack: 0.002, decay: 0.2, key: true })
    tone(e, t + 0.41, { type: 'sine', f0: note(3, 7), gain: 0.03, attack: 0.002, decay: 0.3, key: true })
  },
  chime(e, t) {
    // news worth hearing: three soft handbell notes rising (A5 D6 A6), each with its bell's high overtone (2.76 times
    // it: off the key, but a fifth as loud, a colour rather than a note)
    ;[note(4, 5), note(1, 6), note(4, 6)].forEach((f, i) => {
      tone(e, t + i * 0.16, { type: 'sine', f0: f, gain: 0.04, attack: 0.003, decay: 1.1, key: true })
      tone(e, t + i * 0.16, { type: 'sine', f0: f * 2.76, gain: 0.008, attack: 0.002, decay: 0.3, key: true })
    })
  },
  dress(e, t) {
    // a garment put on: two soft swishes of cloth
    burst(e, t, { type: 'bandpass', freq: 1600, sweepTo: 3200, q: 0.7, gain: 0.07, attack: 0.04, decay: 0.16 })
    burst(e, t + 0.13, { type: 'bandpass', freq: 2600, sweepTo: 1300, q: 0.7, gain: 0.05, attack: 0.03, decay: 0.18 })
  },
  garment(e, t) {
    // a new garment: a skip up the key (E6 G6 C7), then a bright bell (E7, its minor third over it) over a soft shimmer
    ;[note(2, 6), note(3, 6), note(0, 7)].forEach((f, i) => tone(e, t + i * 0.09, { type: 'triangle', f0: f, gain: 0.045, attack: 0.004, decay: 0.22, key: true }))
    tone(e, t + 0.3, { type: 'sine', f0: note(2, 7), gain: 0.05, attack: 0.004, decay: 1.2, key: true })
    tone(e, t + 0.3, { type: 'sine', f0: note(3, 7), gain: 0.015, attack: 0.004, decay: 0.6, key: true })
    burst(e, t + 0.28, { type: 'highpass', freq: 5000, sweepTo: 10000, q: 0.7, gain: 0.025, attack: 0.1, decay: 0.6 })
  },
  keys(e, t) {
    // a bunch of keys handed over: small bright clinks close together (high notes of the key), then a warm chord
    // rings on (G5 C6 E6 G6)
    KEY_CLINKS.forEach((step, i) => {
      const at = t + i * 0.055 + Math.random() * 0.03
      tone(e, at, { type: 'sine', f0: note(step, 7), gain: 0.03, attack: 0.001, decay: 0.09, key: true })
      burst(e, at, { type: 'highpass', freq: 7000, q: 0.8, gain: 0.02, attack: 0.001, decay: 0.03 })
    })
    for (const f of [note(3, 5), note(0, 6), note(2, 6), note(3, 6)]) tone(e, t + 0.42, { type: 'sine', f0: f, gain: 0.03, attack: 0.01, decay: 1.4, key: true })
  },
  ding(e, t, v, pan, o) {
    // the kitchen timer: it is ready. Its note and its octave, then two steps of the key over it (the oven's G6 then
    // C7, the mill's E6 then A6, the loom's A6 then D7): each machine its own, from where it stands
    const { step, octave } = keyStep(o.note ?? DING)
    tone(e, t, { type: 'sine', f0: note(step, octave), gain: 0.06 * v, attack: 0.003, decay: 1.2, pan, key: true })
    tone(e, t, { type: 'sine', f0: note(step, octave + 1), gain: 0.02 * v, attack: 0.003, decay: 0.5, pan, key: true })
    tone(e, t + 0.18, { type: 'sine', f0: note(step + 2, octave), gain: 0.05 * v, attack: 0.003, decay: 1.4, pan, key: true })
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
      burst(e, t + i * 0.14, { type: 'bandpass', freq: 3300, q: 1.8, gain: 0.16 * v, attack: 0.002, decay: 0.04, pan })
      tone(e, t + i * 0.14 + 0.01, { type: 'triangle', f0: 2400, f1: 1700, gain: 0.02 * v, attack: 0.002, decay: 0.05, pan })
    }
    burst(e, t + 0.05, { type: 'bandpass', freq: 900, q: 0.7, gain: 0.08 * v, attack: 0.08, decay: 0.5, pan })
  },
  loom(e, t, v, pan) {
    // the shuttle clacks across and the beater knocks
    for (let i = 0; i < 3; i++) {
      burst(e, t + i * 0.32, { type: 'bandpass', freq: 1800, q: 1.4, gain: 0.12 * v, attack: 0.003, decay: 0.05, pan })
      burst(e, t + i * 0.32 + 0.16, { type: 'lowpass', freq: 420, q: 0.8, gain: 0.24 * v, attack: 0.002, decay: 0.08, pan })
      burst(e, t + i * 0.32 + 0.16, { type: 'bandpass', freq: 900, q: 1.5, gain: 0.2 * v, attack: 0.002, decay: 0.06, pan })
    }
  },
  pick(e, t, v, pan) {
    // fruit picked: the leaves rustle, the twig springs back (a quick falling twang), the fruit drops soft into the hand
    burst(e, t, { type: 'bandpass', freq: 3400, q: 0.9, gain: 0.07 * v, attack: 0.01, decay: 0.14, pan })
    burst(e, t + 0.02, { type: 'highpass', freq: 2800, q: 0.8, gain: 0.1 * v, attack: 0.002, decay: 0.03, pan })
    tone(e, t + 0.02, { type: 'triangle', f0: 1300, f1: 700, gain: 0.03 * v, attack: 0.002, decay: 0.07, pan })
    tone(e, t + 0.12, { type: 'sine', f0: 560, f1: 280, gain: 0.08 * v, attack: 0.004, decay: 0.08, pan })
    burst(e, t + 0.12, { type: 'bandpass', freq: 900, q: 1.2, gain: 0.14 * v, attack: 0.003, decay: 0.06, pan })
  },
  sack(e, t, v, pan) {
    // a sack from the mill set down: a soft heavy thump, its cloth, and a puff of flour
    burst(e, t, { type: 'lowpass', freq: 600, q: 0.7, gain: 0.24 * v, attack: 0.01, decay: 0.13, pan })
    burst(e, t, { type: 'bandpass', freq: 950, q: 1.2, gain: 0.34 * v, attack: 0.006, decay: 0.09, pan })
    tone(e, t, { type: 'sine', f0: 150, f1: 90, gain: 0.05 * v, attack: 0.006, decay: 0.1, pan })
    burst(e, t + 0.05, { type: 'bandpass', freq: 1300, sweepTo: 2200, q: 0.7, gain: 0.1 * v, attack: 0.03, decay: 0.25, pan })
  },
  bolt(e, t, v, pan) {
    // a bolt of cloth off the loom: two swishes as it is rolled off, then a soft thud as it is laid down
    burst(e, t, { type: 'bandpass', freq: 1200, sweepTo: 2400, q: 0.8, gain: 0.18 * v, attack: 0.04, decay: 0.12, pan })
    burst(e, t + 0.12, { type: 'bandpass', freq: 2000, sweepTo: 1000, q: 0.8, gain: 0.15 * v, attack: 0.03, decay: 0.14, pan })
    burst(e, t + 0.28, { type: 'lowpass', freq: 520, q: 0.7, gain: 0.4 * v, attack: 0.006, decay: 0.1, pan })
    burst(e, t + 0.28, { type: 'bandpass', freq: 800, q: 1.3, gain: 0.25 * v, attack: 0.004, decay: 0.07, pan })
  },
  churn(e, t, v, pan) {
    // milk sloshing in the churn as the dasher plunges: a wet swirl sweeping down, and the wood's dull knock under it
    burst(e, t, { type: 'bandpass', freq: 1700, sweepTo: 700, q: 1.6, gain: 0.2 * v, attack: 0.02, decay: 0.24, pan })
    burst(e, t + 0.16, { type: 'bandpass', freq: 900, sweepTo: 1600, q: 1.4, gain: 0.14 * v, attack: 0.02, decay: 0.2, pan })
    burst(e, t + 0.3, { type: 'lowpass', freq: 380, q: 0.9, gain: 0.3 * v, attack: 0.004, decay: 0.08, pan })
    tone(e, t + 0.3, { type: 'sine', f0: 210, f1: 140, gain: 0.04 * v, attack: 0.004, decay: 0.09, pan })
  },
  crock(e, t, v, pan) {
    // a stoneware crock set down on the dairy's counter: a dull clay knock and a short glazed ring (A6)
    burst(e, t, { type: 'bandpass', freq: 1100, q: 2.4, gain: 0.36 * v, attack: 0.002, decay: 0.06, pan })
    burst(e, t, { type: 'lowpass', freq: 500, q: 0.8, gain: 0.22 * v, attack: 0.003, decay: 0.07, pan })
    tone(e, t + 0.005, { type: 'triangle', f0: note(4, 6), gain: 0.026 * v, attack: 0.002, decay: 0.22, pan, key: true })
  },
  bubble(e, t, v, pan) {
    // the jam at the boil: thick bubbles, each a little rising blip with a wet pop, a soft hiss under them
    burst(e, t, { type: 'bandpass', freq: 3200, q: 0.6, gain: 0.05 * v, attack: 0.08, decay: 0.5, pan })
    for (const [at, f] of [
      [0.02, 380],
      [0.17, 520],
      [0.29, 440],
      [0.43, 600],
    ]) {
      tone(e, t + at, { type: 'sine', f0: f, f1: f * 2.2, gain: 0.06 * v, attack: 0.003, decay: 0.06, pan })
      burst(e, t + at + 0.04, { type: 'bandpass', freq: 1400, q: 2.5, gain: 0.16 * v, attack: 0.002, decay: 0.03, pan })
    }
  },
  jar(e, t, v, pan) {
    // a jar set down on the table: glass on wood, its ring (E7), then the lid twisted on in two short scrapes
    burst(e, t, { type: 'bandpass', freq: 2000, q: 2, gain: 0.3 * v, attack: 0.002, decay: 0.04, pan })
    tone(e, t + 0.003, { type: 'sine', f0: note(2, 7), gain: 0.028 * v, attack: 0.002, decay: 0.28, pan, key: true })
    burst(e, t + 0.18, { type: 'bandpass', freq: 3600, sweepTo: 2600, q: 3, gain: 0.12 * v, attack: 0.01, decay: 0.06, pan })
    burst(e, t + 0.27, { type: 'bandpass', freq: 3400, sweepTo: 2400, q: 3, gain: 0.12 * v, attack: 0.01, decay: 0.06, pan })
  },
  tray(e, t, v, pan) {
    // the oven's tray slides out over its runners and is set down on the stone with a little ring of tin (E7)
    burst(e, t, { type: 'bandpass', freq: 2400, sweepTo: 1600, q: 2, gain: 0.14 * v, attack: 0.03, decay: 0.2, pan })
    burst(e, t + 0.26, { type: 'bandpass', freq: 1500, q: 3, gain: 0.38 * v, attack: 0.002, decay: 0.05, pan })
    burst(e, t + 0.26, { type: 'lowpass', freq: 450, q: 0.8, gain: 0.2 * v, attack: 0.003, decay: 0.06, pan })
    tone(e, t + 0.26, { type: 'sine', f0: note(2, 7), gain: 0.03 * v, attack: 0.002, decay: 0.32, pan, key: true })
  },
  crate(e, t, v, pan) {
    // goods into an order's crate: a hollow knock on its boards, a softer one, and the straw
    for (const [at, g] of [
      [0, 1],
      [0.11, 0.6],
    ]) {
      burst(e, t + at, { type: 'bandpass', freq: 700, q: 2.2, gain: 0.78 * g * v, attack: 0.002, decay: 0.07, pan })
      tone(e, t + at, { type: 'sine', f0: 300, f1: 240, gain: 0.04 * g * v, attack: 0.002, decay: 0.09, pan })
    }
    burst(e, t + 0.05, { type: 'bandpass', freq: 2600, q: 0.8, gain: 0.05 * v, attack: 0.03, decay: 0.2, pan })
  },
  shelf(e, t, v, pan) {
    // goods put up on a shelf: two light taps on the board, then a short slide back into place
    burst(e, t, { type: 'bandpass', freq: 1800, q: 3, gain: 0.5 * v, attack: 0.001, decay: 0.03, pan })
    burst(e, t + 0.08, { type: 'bandpass', freq: 1600, q: 3, gain: 0.4 * v, attack: 0.001, decay: 0.03, pan })
    burst(e, t + 0.14, { type: 'bandpass', freq: 1400, sweepTo: 2600, q: 1.4, gain: 0.25 * v, attack: 0.03, decay: 0.13, pan })
  },
  pay(e, t) {
    // coins paid out: two clinks falling (E7, C7), the coins' own going the other way
    tone(e, t, { type: 'sine', f0: note(2, 7), gain: 0.05, attack: 0.002, decay: 0.22, key: true })
    tone(e, t + 0.08, { type: 'sine', f0: note(0, 7), gain: 0.045, attack: 0.002, decay: 0.32, key: true })
    burst(e, t, { type: 'highpass', freq: 6000, q: 0.7, gain: 0.025, attack: 0.001, decay: 0.04 })
  },
  nope(e, t) {
    // cannot: decline's soft falling notes, shorter and higher (E5 down to C5)
    tone(e, t, { type: 'triangle', f0: note(2, 5), gain: 0.042, attack: 0.008, decay: 0.1, key: true })
    tone(e, t + 0.09, { type: 'triangle', f0: note(0, 5), gain: 0.042, attack: 0.008, decay: 0.16, key: true })
  },
  lift(e, t) {
    // lifted: a breath of air rising and a little lift in a soft tone
    burst(e, t, { type: 'bandpass', freq: 380, sweepTo: 1500, q: 1.1, gain: 0.2, attack: 0.04, decay: 0.1 })
    tone(e, t + 0.05, { type: 'sine', f0: 560, f1: 760, gain: 0.08, attack: 0.006, decay: 0.09 })
  },
  thud(e, t, _v, _pan, o) {
    // put down: a thud, deeper, longer and louder the bigger the thing, with a knock a phone's speaker carries
    const h = heft(o.size)
    burst(e, t, { type: 'lowpass', freq: 560 - 300 * h, q: 0.8, gain: 0.08 + 0.06 * h, attack: 0.004, decay: 0.08 + 0.1 * h })
    tone(e, t, { type: 'sine', f0: 150 - 60 * h, f1: 85 - 35 * h, gain: 0.015 + 0.03 * h, attack: 0.004, decay: 0.1 + 0.08 * h })
    burst(e, t + 0.004, { type: 'bandpass', freq: 1300 - 450 * h, q: 1.2, gain: 0.28 + 0.24 * h, attack: 0.002, decay: 0.06 + 0.03 * h })
  },
  rattle(e, t, _v, _pan, o) {
    // a box shaking for as long as it is asked to (the daily gift's, by default), its knocks coming faster
    playRattle(e, o.ms ?? RATTLE_MS, o.delay ?? 0, t)
  },
  tink(e, t, _v, _pan, o) {
    // the coin that lands `step`-th on the chip, a step up the key from the one before
    playLanding(e, o.step ?? 0, t)
  },
}

/** What a sound may be asked for beyond where it is: a ding's note (a machine's own: `MACHINES[].sounds.done`), a
 *  thud's size across (m: what was put down), how many beds one press did (a snap each, BATCH_MOST at most), and how
 *  long a rattle shakes (ms) after how long (ms). */
export interface SoundMore {
  note?: KeyNote
  size?: number
  times?: number
  ms?: number
  delay?: number
}

/** A press's pip: a soft bell of the key `step` steps up its streak (and its octave for the glass), climbing while the
 *  work's noise varies. */
function pip(e: Engine, t: number, v: number, pan: number, step: number) {
  const f = pipNote(step)
  tone(e, t + 0.02, { type: 'sine', f0: f, gain: 0.014 * v, attack: 0.003, decay: 0.12, pan, key: true })
  tone(e, t + 0.02, { type: 'sine', f0: f * 2, gain: 0.004 * v, attack: 0.002, decay: 0.06, pan, key: true })
}

/** How a sound is played: where it is (`pan` −1 left … 1 right), how near (`near` 0..1, heard at a quarter at least),
 *  its pitch and loudness this time (factors, 1 as written; ./palette.ts, vary) and when (audio time; now if not given). */
export interface PlayOpts extends SoundMore {
  pan?: number
  near?: number
  pitch?: number
  level?: number
  at?: number
  /** its place in its streak (./palette.ts, climb): a press of work's pip, a crystal's note */
  step?: number
}

/** One of the farm's sounds written into `e`, exactly as asked: the live engine, an offline one to measure it, or the
 *  tests' fake. */
export function play(e: Engine, kind: FarmSound, o: PlayOpts = {}) {
  const t = o.at ?? e.ac.currentTime + 0.004
  const on = { ...e, pitch: o.pitch ?? 1, level: (o.level ?? 1) * 10 ** ((SOUNDS[kind].mix ?? 0) / 20) }
  const v = Math.max(0.25, o.near ?? 1)
  SYNTHS[kind](on, t, v, o.pan ?? 0, o)
  if (o.step !== undefined && SOUNDS[kind].climb === 'work') pip(on, t, v, o.pan ?? 0, o.step)
}

/** Garden work and the people and animals in it, where it can be heard, a little different each time its row allows;
 *  what the player did is felt too (`feel`: its touch, its row's by default; null for none), whether the sound plays
 *  or not. `more`: a ding's note, a thud's size, how many beds one press did. A press of work (a row that climbs, with
 *  the work's touch: the farm's own sounds never climb) climbs its streak, each bed of a batch a step. */
export function farmSound(kind: FarmSound, pan = 0, near = 1, feel: Haptic | null = SOUNDS[kind].feel, more: SoundMore = {}) {
  haptic(feel)
  const row = SOUNDS[kind]
  const press = row.climb === 'work' && feel === 'tick'
  const { times = 1, ...as } = more
  const n = Math.max(1, Math.min(BATCH_MOST, Math.floor(times) || 1))
  const e = live()
  for (let i = 0; i < n; i++) {
    const step = press ? climb('work', WORK_GAP) : undefined
    if (!e) continue
    const { pitch, level } = vary(row)
    play(e, kind, { pan, near, pitch, level: level * (i ? BATCH_LEVEL : 1), ...as, step, at: e.ac.currentTime + 0.004 + i * BATCH_GAP })
  }
}
