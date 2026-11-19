import { useSettings } from '../settings'
import { hold } from './mix'
import { useMusic, wantedTrack, type MusicMood } from './music'
import { hz } from './palette'
import { audioGraph, unlockAudio } from './sound'

// Background music, composed as it plays (./music.ts is the part the page shell holds, and fetches this): each track is
// a chord progression, a scale and a handful of voices (a warm pad, plucked arpeggios, a soft bass, bells, a shaker),
// scheduled a moment ahead on the audio clock with a little chance in every bar, so it never loops exactly. Nothing is
// downloaded. Each voice plays into a gain of its own, so the music follows where it is heard (mission 06 c10): at
// night the shaker and the bells drop out and the pad softens, indoors (the house, the market) only the pad and the
// pluck play, a little darker, and with a panel open it steps back 4 dB (./mix.ts, hold). Every change ramps, never
// cuts. On Auto the track follows the time of day and the place (./music.ts, autoTrack), changing on a two-bar
// boundary: the old track's pad rings out under the new one's. It plays into the mixer's music bus (its own volume
// under the main one) and follows the Music settings.

export interface TrackDef {
  name: string
  bpm: number
  root: number // MIDI note of the key
  scale: number[] // semitones above the root
  chords: number[][] // per bar: chord tones as semitones above the root (two bars each)
  pluck: OscillatorType
  pad: number // pad loudness
  pulse: 'arp' | 'sparse' | 'bounce'
  shaker: boolean
  bells: number // chance per bar
}

/** How each track is composed, in ./music.ts's order (TRACKS: their names and moods). */
export const TRACK_DEFS: TrackDef[] = [
  {
    name: 'Morning on the farm',
    bpm: 84,
    root: 60,
    scale: [0, 2, 4, 7, 9],
    chords: [
      [0, 4, 7],
      [7, 11, 14],
      [9, 12, 16],
      [5, 9, 12],
    ],
    pluck: 'triangle',
    pad: 1,
    pulse: 'arp',
    shaker: false,
    bells: 0.35,
  },
  {
    name: 'Slow afternoon',
    bpm: 64,
    root: 57,
    scale: [0, 2, 3, 5, 7, 9, 10],
    chords: [
      [0, 3, 7, 10],
      [-2, 2, 5, 9],
      [-4, 0, 3, 7],
      [-2, 2, 5, 9],
    ],
    pluck: 'sine',
    pad: 1.2,
    pulse: 'sparse',
    shaker: false,
    bells: 0.2,
  },
  {
    name: 'Market day',
    bpm: 104,
    root: 55,
    scale: [0, 2, 4, 5, 7, 9, 11],
    chords: [
      [0, 4, 7],
      [5, 9, 12],
      [0, 4, 7],
      [7, 11, 14],
    ],
    pluck: 'square',
    pad: 0.6,
    pulse: 'bounce',
    shaker: true,
    bells: 0.1,
  },
  {
    name: 'Evening lights',
    bpm: 72,
    root: 53,
    scale: [0, 2, 4, 7, 9, 11],
    chords: [
      [0, 4, 7, 11],
      [9, 12, 16, 19],
      [2, 5, 9, 12],
      [7, 11, 14, 17],
    ],
    pluck: 'sine',
    pad: 0.9,
    pulse: 'arp',
    shaker: false,
    bells: 0.25,
  },
]

/** The music's voices, each on a gain of its own. */
export const VOICES = ['pad', 'pluck', 'bass', 'bells', 'shaker'] as const
export type Voice = (typeof VOICES)[number]
export type Layer = 'day' | 'evening' | 'night' | 'indoors'

/** How loud each voice plays where the music is heard (a share of its own level), and how bright it all is (the
 *  low-pass's cutoff, Hz): by day all of it; in the evening the bells and the shaker softer; at night the shaker and
 *  the bells out and the pad softer; indoors (the house, the market) only the pad and the pluck, a little darker. */
export const MUSIC_LAYERS: Readonly<Record<Layer, Readonly<Record<Voice, number>> & { bright: number }>> = {
  day: { pad: 1, pluck: 1, bass: 1, bells: 1, shaker: 1, bright: 5200 },
  evening: { pad: 0.9, pluck: 0.9, bass: 1, bells: 0.6, shaker: 0.5, bright: 4400 },
  night: { pad: 0.65, pluck: 0.8, bass: 0.85, bells: 0, shaker: 0, bright: 3400 },
  indoors: { pad: 1, pluck: 0.85, bass: 0, bells: 0, shaker: 0, bright: 2600 },
}

/** The layer where the music is heard: indoors whatever the hour, else the time of day's (morning and noon by day). */
export const layerOf = (m: MusicMood): Layer => (m.indoors ? 'indoors' : m.phase === 'night' ? 'night' : m.phase === 'evening' ? 'evening' : 'day')

/** How far a panel open steps the music back (dB). */
export const PANEL_STEP_BACK = -4
/** How slowly a layer comes and goes (s: a time constant): never a cut. */
export const LAYER_TC = 1.2
/** The music's own level in the mix while it plays (its volume slider is the mixer's music bus). */
const LEVEL = 0.55
/** How many eighths a track changes on (Auto's change): two bars, where its pad begins. */
export const SWITCH_EIGHTHS = 16
/** How far ahead the notes are scheduled (s), and how often (ms). */
const AHEAD = 0.35
const EVERY = 90

/** The music's own graph on a context: its level (on or off) → the low-pass (its brightness) → the bus, with a short
 *  tail of echo; each voice into the level through a gain of its own. */
export interface Band {
  ac: BaseAudioContext
  level: GainNode
  tone: BiquadFilterNode
  voices: Record<Voice, GainNode>
}

export function createBand(ac: BaseAudioContext, out: AudioNode, layer: Layer = 'day'): Band {
  const level = ac.createGain()
  level.gain.value = 0
  // a gentle low-pass and a short tail of echo make the synthesised voices sit back, behind the house's sounds
  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = MUSIC_LAYERS[layer].bright
  const delay = ac.createDelay(1)
  delay.delayTime.value = 0.33
  const feedback = ac.createGain()
  feedback.gain.value = 0.28
  const wet = ac.createGain()
  wet.gain.value = 0.22
  level.connect(tone)
  tone.connect(out)
  tone.connect(delay)
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(out)
  const voices = Object.fromEntries(
    VOICES.map((v) => {
      const g = ac.createGain()
      g.gain.value = MUSIC_LAYERS[layer][v]
      g.connect(level)
      return [v, g]
    }),
  ) as Record<Voice, GainNode>
  return { ac, level, tone, voices }
}

/** The band follows a layer: each voice's gain and the brightness glide there (`tc`), never cut. */
export function setLayer(b: Band, layer: Layer, tc = LAYER_TC) {
  const now = b.ac.currentTime
  const row = MUSIC_LAYERS[layer]
  for (const v of VOICES) {
    b.voices[v].gain.cancelScheduledValues(now)
    b.voices[v].gain.setTargetAtTime(row[v], now, tc)
  }
  b.tone.frequency.cancelScheduledValues(now)
  b.tone.frequency.setTargetAtTime(row.bright, now, tc)
}

/** The band heard or not (the music playing and on), gliding in or out. */
export function setHeard(b: Band, on: boolean) {
  const now = b.ac.currentTime
  b.level.gain.cancelScheduledValues(now)
  b.level.gain.setTargetAtTime(on ? LEVEL : 0, now, on ? 0.6 : 0.25)
}

function env(ac: BaseAudioContext, t: number, attack: number, hold: number, release: number, level: number) {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(level, t + attack)
  g.gain.setValueAtTime(level, t + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
  return g
}

function voice(ac: BaseAudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, attack: number, hold: number, release: number, level: number, cutoff = 3000, detune = 0) {
  const o = ac.createOscillator()
  o.type = type
  o.frequency.value = f
  o.detune.value = detune
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cutoff
  const g = env(ac, t, attack, hold, release, level)
  o.connect(lp).connect(g).connect(out)
  o.start(t)
  o.stop(t + attack + hold + release + 0.05)
}

function shaker(ac: BaseAudioContext, out: AudioNode, t: number, level: number) {
  const len = Math.floor(ac.sampleRate * 0.06)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ac.createBufferSource()
  src.buffer = buf
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 6500
  const g = ac.createGain()
  g.gain.value = level
  src.connect(hp).connect(g).connect(out)
  src.start(t)
}

/** A track as it plays: which, its step (an eighth note), when its next step falls (audio time), its dice, and the
 *  track to change to on its next two-bar boundary (Auto). */
export interface Score {
  track: number
  step: number
  next: number
  seed: number
  pending: number | null
}

export const newScore = (track: number, at: number): Score => ({ track, step: 0, next: at, seed: 1 + track * 977, pending: null })

function rand(s: Score) {
  s.seed = (s.seed * 1664525 + 1013904223) >>> 0
  return s.seed / 4294967296
}

/** One eighth-note step of the track at audio time `t`, each voice into its own gain. */
function playStep(b: Band, s: Score, t: number) {
  const { ac } = b
  const def = TRACK_DEFS[s.track]
  const eighth = 30 / def.bpm
  const bar = Math.floor(s.step / 8)
  const inBar = s.step % 8
  const chord = def.chords[Math.floor(bar / 2) % def.chords.length]
  const root = def.root
  const v = b.voices
  // the pad: the chord, held for two bars, voiced in the middle
  if (inBar === 0 && bar % 2 === 0) {
    for (const n of chord) {
      const f = hz(root + n)
      voice(ac, v.pad, 'sawtooth', f, t, 1.2, eighth * 16 - 1.6, 1.8, 0.012 * def.pad, 900, -6)
      voice(ac, v.pad, 'sawtooth', f, t, 1.2, eighth * 16 - 1.6, 1.8, 0.012 * def.pad, 900, 7)
    }
  }
  // the bass: the chord's root, on the first beat (and the third, in the busier tracks)
  if (inBar === 0 || (inBar === 4 && def.pulse !== 'sparse')) {
    const n = chord[0] - 12 + (inBar === 4 && def.pulse === 'bounce' ? 7 : 0)
    voice(ac, v.bass, 'sine', hz(root + n), t, 0.02, eighth * 2, 0.6, 0.11, 400)
    voice(ac, v.bass, 'triangle', hz(root + n), t, 0.02, eighth, 0.4, 0.04, 700)
  }
  // the pulse: arpeggios, a few scattered notes, or a bouncing rhythm
  const tones = chord.map((n) => n + 12)
  if (def.pulse === 'arp') {
    const order = [0, 1, 2, 1, 2, chord.length > 3 ? 3 : 1, 2, 1]
    if (rand(s) < 0.85) voice(ac, v.pluck, def.pluck, hz(root + tones[order[inBar] % tones.length]), t, 0.005, 0.02, 0.7, 0.05, 2400)
  } else if (def.pulse === 'sparse') {
    if (inBar % 2 === 0 && rand(s) < 0.45) {
      const n = def.scale[Math.floor(rand(s) * def.scale.length)] + 12 + (rand(s) < 0.3 ? 12 : 0)
      voice(ac, v.pluck, def.pluck, hz(root + n), t, 0.01, 0.1, 1.6, 0.05, 2000)
      voice(ac, v.pluck, 'triangle', hz(root + n) * 2, t, 0.01, 0.05, 0.8, 0.012, 3000)
    }
  } else if (inBar !== 1 && inBar !== 5) {
    const n = tones[(inBar + bar) % tones.length]
    voice(ac, v.pluck, def.pluck, hz(root + n), t, 0.004, 0.03, 0.25, 0.022, 1800)
  }
  if (def.shaker && inBar % 2 === 1) shaker(ac, v.shaker, t, 0.05 + rand(s) * 0.03)
  // now and then a bell over the top, on a note of the scale
  if (inBar === 6 && rand(s) < def.bells) {
    const n = def.scale[Math.floor(rand(s) * def.scale.length)] + 24
    voice(ac, v.bells, 'sine', hz(root + n), t, 0.004, 0.05, 2.2, 0.035, 6000)
    voice(ac, v.bells, 'sine', hz(root + n) * 2.76, t, 0.004, 0.02, 0.9, 0.008, 8000)
  }
}

/** Schedules the score's steps up to audio time `until`, changing to a pending track on its next two-bar boundary
 *  (its first step falls just where the old track's next would have: no gap). The track it changed to, or null. */
export function scheduleUntil(b: Band, s: Score, until: number): number | null {
  let changed: number | null = null
  if (s.next < b.ac.currentTime) s.next = b.ac.currentTime + 0.05
  while (s.next < until) {
    if (s.pending !== null && s.step % SWITCH_EIGHTHS === 0) {
      if (s.pending !== s.track) {
        Object.assign(s, newScore(s.pending, s.next))
        changed = s.track
      }
      s.pending = null
    }
    playStep(b, s, s.next)
    s.next += 30 / TRACK_DEFS[s.track].bpm
    s.step++
  }
  return changed
}

// ─────────────────────── the live music ───────────────────────

let band: Band | null = null
let score: Score | null = null
let timer: number | undefined

/** The band on the live engine's music bus (made with the first sound). */
function liveBand(): Band | null {
  const g = audioGraph()
  if (!g) return null
  if (!band || band.ac !== g.ac) band = createBand(g.ac, g.music, layerOf(useMusic.getState().mood))
  return band
}

/** The track the settings ask for where the music is heard now. */
const wanted = () => wantedTrack(useSettings.getState().musicTrack, useMusic.getState().mood)

function tick() {
  const b = liveBand()
  if (!b || !score) return
  const changed = scheduleUntil(b, score, b.ac.currentTime + AHEAD)
  if (changed !== null) useMusic.setState({ track: changed })
}

/** Whether audio has been unlocked (a gesture made the engine), so the music can start without one. */
export const heard = () => audioGraph() !== null

/** Starts the music (from a tap or click the first time: ./music.ts, playMusic). */
export function start() {
  unlockAudio()
  const b = liveBand()
  if (!b) return
  setHeard(b, useSettings.getState().music && useMusic.getState().playing)
  if (timer !== undefined) return
  const track = wanted()
  useMusic.setState({ track })
  score = newScore(track, b.ac.currentTime + 0.1)
  timer = window.setInterval(tick, EVERY)
  tick()
}

/** Stops it (its last notes ring out as it fades). */
export function stop() {
  if (band) setHeard(band, false)
  window.clearInterval(timer)
  timer = undefined
}

/** A track picked: from its start, now. */
export function pick(track: number) {
  if (score) Object.assign(score, newScore(track, score.next))
}

/** Where the music is heard changed: the layers glide to it, a panel steps it back, and on Auto a new track waits for
 *  its two bars. */
function follow(mood: MusicMood, was: MusicMood) {
  if (band && layerOf(mood) !== layerOf(was)) setLayer(band, layerOf(mood))
  if (mood.panel !== was.panel) hold('music:panel', 'music', mood.panel ? PANEL_STEP_BACK : null)
  ask()
}

/** On Auto, the track the day and the place ask for, from the next two bars (at once while nothing plays). */
function ask() {
  const track = wanted()
  if (!score || timer === undefined) {
    if (useSettings.getState().musicTrack === 'auto') useMusic.setState({ track })
    return
  }
  if (useSettings.getState().musicTrack === 'auto') score.pending = track === score.track ? null : track
}

useMusic.subscribe((s, p) => {
  if (s.mood !== p.mood) follow(s.mood, p.mood)
})
useSettings.subscribe((s, p) => {
  if (s.musicTrack !== p.musicTrack && s.musicTrack === 'auto') ask()
})
hold('music:panel', 'music', useMusic.getState().mood.panel ? PANEL_STEP_BACK : null)
