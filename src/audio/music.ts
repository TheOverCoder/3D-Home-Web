import { create } from 'zustand'
import { useSettings } from '../settings'
import { audioGraph, unlockAudio } from './sound'

// Background music, composed as it plays: each track is a chord progression, a scale and a handful of voices (a
// warm pad, plucked arpeggios, a soft bass, bells, a shaker), scheduled a moment ahead on the audio clock with a
// little chance in every bar, so it never loops exactly. Nothing is downloaded. It plays through the same volume
// as the house's sound, starts on the first tap or click (browsers wait for one), and follows the Music settings.
// No three.js here: the intro's player uses it.

interface TrackDef {
  name: string
  mood: string
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

export const TRACKS: TrackDef[] = [
  {
    name: 'Morning on the farm',
    mood: 'bright, unhurried',
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
    mood: 'calm, a little wistful',
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
    mood: 'lively, folky',
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
    mood: 'warm, jazzy',
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

interface MusicState {
  playing: boolean
  track: number
}

export const useMusic = create<MusicState>(() => ({ playing: false, track: useSettings.getState().musicTrack % TRACKS.length }))

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

let bus: GainNode | null = null
let timer: number | undefined
let nextTime = 0
let step = 0
let seed = 1
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

function musicBus(ac: AudioContext, master: GainNode) {
  if (bus && bus.context === ac) return bus
  bus = ac.createGain()
  bus.gain.value = 0
  // a gentle low-pass and a short tail of echo make the synthesised voices sit back, behind the house's sounds
  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 5200
  const delay = ac.createDelay(1)
  delay.delayTime.value = 0.33
  const feedback = ac.createGain()
  feedback.gain.value = 0.28
  const wet = ac.createGain()
  wet.gain.value = 0.22
  bus.connect(tone)
  tone.connect(master)
  tone.connect(delay)
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(master)
  return bus
}

function applyVolume() {
  const g = audioGraph()
  if (!g || !bus) return
  const { music, musicVolume } = useSettings.getState()
  const on = music && useMusic.getState().playing
  bus.gain.cancelScheduledValues(g.ac.currentTime)
  bus.gain.setTargetAtTime(on ? musicVolume * musicVolume * 0.55 : 0, g.ac.currentTime, on ? 0.6 : 0.25)
}

function env(ac: AudioContext, t: number, attack: number, hold: number, release: number, level: number) {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(level, t + attack)
  g.gain.setValueAtTime(level, t + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
  return g
}

function voice(ac: AudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, attack: number, hold: number, release: number, level: number, cutoff = 3000, detune = 0) {
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

function shaker(ac: AudioContext, out: AudioNode, t: number, level: number) {
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

/** One eighth-note step of the current track at audio time `t`. */
function playStep(ac: AudioContext, out: AudioNode, def: TrackDef, s: number, t: number) {
  const eighth = 30 / def.bpm
  const bar = Math.floor(s / 8)
  const inBar = s % 8
  const chord = def.chords[Math.floor(bar / 2) % def.chords.length]
  const root = def.root
  // the pad: the chord, held for two bars, voiced in the middle
  if (inBar === 0 && bar % 2 === 0) {
    for (const n of chord) {
      const f = hz(root + n)
      voice(ac, out, 'sawtooth', f, t, 1.2, eighth * 16 - 1.6, 1.8, 0.012 * def.pad, 900, -6)
      voice(ac, out, 'sawtooth', f, t, 1.2, eighth * 16 - 1.6, 1.8, 0.012 * def.pad, 900, 7)
    }
  }
  // the bass: the chord's root, on the first beat (and the third, in the busier tracks)
  if (inBar === 0 || (inBar === 4 && def.pulse !== 'sparse')) {
    const n = chord[0] - 12 + (inBar === 4 && def.pulse === 'bounce' ? 7 : 0)
    voice(ac, out, 'sine', hz(root + n), t, 0.02, eighth * 2, 0.6, 0.11, 400)
    voice(ac, out, 'triangle', hz(root + n), t, 0.02, eighth, 0.4, 0.04, 700)
  }
  // the pulse: arpeggios, a few scattered notes, or a bouncing rhythm
  const tones = chord.map((n) => n + 12)
  if (def.pulse === 'arp') {
    const order = [0, 1, 2, 1, 2, chord.length > 3 ? 3 : 1, 2, 1]
    if (rand() < 0.85) voice(ac, out, def.pluck, hz(root + tones[order[inBar] % tones.length]), t, 0.005, 0.02, 0.7, 0.05, 2400)
  } else if (def.pulse === 'sparse') {
    if (inBar % 2 === 0 && rand() < 0.45) {
      const n = def.scale[Math.floor(rand() * def.scale.length)] + 12 + (rand() < 0.3 ? 12 : 0)
      voice(ac, out, def.pluck, hz(root + n), t, 0.01, 0.1, 1.6, 0.05, 2000)
      voice(ac, out, 'triangle', hz(root + n) * 2, t, 0.01, 0.05, 0.8, 0.012, 3000)
    }
  } else if (inBar !== 1 && inBar !== 5) {
    const n = tones[(inBar + bar) % tones.length]
    voice(ac, out, def.pluck, hz(root + n), t, 0.004, 0.03, 0.25, 0.022, 1800)
  }
  if (def.shaker && inBar % 2 === 1) shaker(ac, out, t, 0.05 + rand() * 0.03)
  // now and then a bell over the top, on a note of the scale
  if (inBar === 6 && rand() < def.bells) {
    const n = def.scale[Math.floor(rand() * def.scale.length)] + 24
    voice(ac, out, 'sine', hz(root + n), t, 0.004, 0.05, 2.2, 0.035, 6000)
    voice(ac, out, 'sine', hz(root + n) * 2.76, t, 0.004, 0.02, 0.9, 0.008, 8000)
  }
}

function tick() {
  const g = audioGraph()
  if (!g) return
  const { ac, master } = g
  const out = musicBus(ac, master)
  const def = TRACKS[useMusic.getState().track]
  const eighth = 30 / def.bpm
  if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05
  while (nextTime < ac.currentTime + 0.35) {
    playStep(ac, out, def, step, nextTime)
    nextTime += eighth
    step++
  }
}

/** Starts the music (call from a tap or click the first time: browsers only allow sound after one). */
export function playMusic() {
  unlockAudio()
  const g = audioGraph()
  if (!g) return
  if (!useSettings.getState().music) useSettings.getState().update({ music: true })
  useMusic.setState({ playing: true })
  musicBus(g.ac, g.master)
  applyVolume()
  if (timer === undefined) {
    step = 0
    nextTime = g.ac.currentTime + 0.1
    seed = 1 + useMusic.getState().track * 977
    timer = window.setInterval(tick, 90)
    tick()
  }
}

export function pauseMusic(remember = true) {
  useMusic.setState({ playing: false })
  if (remember && useSettings.getState().music) useSettings.getState().update({ music: false })
  applyVolume()
  window.clearInterval(timer)
  timer = undefined
}

export function nextTrack(dir: 1 | -1 = 1) {
  const track = (useMusic.getState().track + dir + TRACKS.length) % TRACKS.length
  useMusic.setState({ track })
  useSettings.getState().update({ musicTrack: track })
  step = 0
  seed = 1 + track * 977
}

/** Follows the settings: music on starts it (once audio is unlocked), off stops it; the volume slider applies live. */
export function wireMusic() {
  const sync = () => {
    const { music } = useSettings.getState()
    if (music && !useMusic.getState().playing && audioGraph()) playMusic()
    else if (!music && useMusic.getState().playing) pauseMusic(false)
    applyVolume()
  }
  const unsub = useSettings.subscribe((s, p) => {
    if (s.music !== p.music || s.musicVolume !== p.musicVolume) sync()
  })
  // the first tap or click unlocks audio: start the music then, if it is on
  const first = () => {
    window.setTimeout(() => {
      if (useSettings.getState().music && !useMusic.getState().playing) playMusic()
    }, 0)
  }
  window.addEventListener('pointerdown', first, { once: true, capture: true })
  window.addEventListener('keydown', first, { once: true, capture: true })
  return () => {
    unsub()
    window.removeEventListener('pointerdown', first, true)
    window.removeEventListener('keydown', first, true)
  }
}
