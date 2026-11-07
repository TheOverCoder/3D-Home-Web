// Procedural sound for the house. Everything is synthesised with WebAudio from two noise buffers and a few
// oscillators — nothing is downloaded. The context is created on the first user gesture (browsers refuse
// to start audio before one) and every function here is a silent no-op until then, or while sound is off.
// No three.js in here: the entry chunk imports this file.
import type { FloorKind, RoomId } from '../data/layout'
import { playerState } from '../lib/playerState'

interface Engine {
  ac: AudioContext
  master: GainNode // user volume
  sfx: GainNode // one-shots
  amb: GainNode // room tone
  white: AudioBuffer
  brown: AudioBuffer
}

let engine: Engine | null = null
let enabled = true
let volume = 0.7
let wantedRoom: RoomId | null = null
let ambient: { filter: BiquadFilterNode; gain: GainNode; hum: GainNode; fan: GainNode; fanFilter: BiquadFilterNode } | null = null

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** Stereo position (−1 left … 1 right) and nearness (0..1) of a sound at (x, z), heard where the player stands and faces. */
export function placeSound(x: number, z: number) {
  const p = playerState.position
  const f = playerState.facing
  const dx = x - p.x
  const dz = z - p.z
  const d = Math.hypot(dx, dz) || 1e-6
  return { pan: ((-f.z * dx + f.x * dz) / d) * 0.75, near: Math.max(0, Math.min(1, 1 - d / 9)) }
}

function noiseBuffer(ac: AudioContext, seconds: number, brown: boolean) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  if (brown) {
    // fade the loop seam
    const n = Math.min(2000, d.length >> 2)
    for (let i = 0; i < n; i++) d[d.length - 1 - i] = d[d.length - 1 - i] * (i / n) + d[i] * (1 - i / n)
  }
  return buf
}

function create(): Engine | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  const ac = new Ctor({ latencyHint: 'interactive' })
  const limiter = ac.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.knee.value = 8
  limiter.ratio.value = 6
  limiter.attack.value = 0.003
  limiter.release.value = 0.2
  limiter.connect(ac.destination)
  const master = ac.createGain()
  master.gain.value = 0
  master.connect(limiter)
  const sfx = ac.createGain()
  sfx.connect(master)
  const amb = ac.createGain()
  amb.gain.value = 0
  amb.connect(master)
  return { ac, master, sfx, amb, white: noiseBuffer(ac, 1.5, false), brown: noiseBuffer(ac, 6, true) }
}

/** Call from a user gesture: creates or resumes the audio context. Safe to call often. */
export function unlockAudio() {
  if (!engine) {
    try {
      engine = create()
    } catch {
      engine = null
    }
    if (!engine) return
    applyPrefs()
    startAmbient()
  }
  if (engine.ac.state === 'suspended' && enabled) void engine.ac.resume().catch(() => {})
}

function applyPrefs() {
  if (!engine) return
  const { ac, master } = engine
  // perceptual curve: the slider feels even from 0 to 100 %
  master.gain.cancelScheduledValues(ac.currentTime)
  master.gain.setTargetAtTime(enabled ? volume * volume * 0.9 : 0, ac.currentTime, 0.06)
  if (enabled && ac.state === 'suspended') void ac.resume().catch(() => {})
}

export function setSoundPrefs(on: boolean, vol: number) {
  enabled = on
  volume = Math.max(0, Math.min(1, vol))
  applyPrefs()
}

/** A hidden tab goes quiet (the room tone would otherwise keep playing); it resumes when shown again. */
export function suspendForHidden(hidden: boolean) {
  if (!engine) return
  if (hidden) void engine.ac.suspend().catch(() => {})
  else if (enabled) void engine.ac.resume().catch(() => {})
}

/** Debug: state of the audio engine. */
export function audioStatus() {
  return engine ? { state: engine.ac.state, enabled, volume, room: wantedRoom } : null
}

// ─────────────────────── building blocks ───────────────────────

interface BurstOpts {
  type: BiquadFilterType
  freq: number
  q?: number
  gain: number
  attack: number
  decay: number
  sweepTo?: number
  rate?: number
  pan?: number
}

function out(e: Engine, pan?: number): AudioNode {
  if (!pan) return e.sfx
  const p = e.ac.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  p.connect(e.sfx)
  return p
}

/** A filtered noise burst with a fast attack and an exponential decay. */
function burst(e: Engine, t: number, o: BurstOpts) {
  const { ac } = e
  const src = ac.createBufferSource()
  src.buffer = e.white
  src.playbackRate.value = o.rate ?? 1
  const f = ac.createBiquadFilter()
  f.type = o.type
  f.frequency.setValueAtTime(o.freq, t)
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + o.attack + o.decay)
  f.Q.value = o.q ?? 0.8
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + o.attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.attack + o.decay)
  src.connect(f).connect(g).connect(out(e, o.pan))
  src.start(t, Math.random() * 1.2, o.attack + o.decay + 0.05)
}

interface ToneOpts {
  type: OscillatorType
  f0: number
  f1?: number
  gain: number
  attack: number
  decay: number
  pan?: number
}

function tone(e: Engine, t: number, o: ToneOpts) {
  const { ac } = e
  const osc = ac.createOscillator()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.f0, t)
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.attack + o.decay)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + o.attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.attack + o.decay)
  osc.connect(g).connect(out(e, o.pan))
  osc.start(t)
  osc.stop(t + o.attack + o.decay + 0.05)
}

const live = () => (engine && enabled && engine.ac.state === 'running' ? engine : null)

// ─────────────────────── the sounds ───────────────────────

/** One footfall. `strength` 0..1 follows the walking speed. */
export function footstep(kind: FloorKind, strength = 1, run = false) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const v = rnd(0.82, 1.12) * Math.max(0.35, Math.min(1, strength)) * (run ? 1.25 : 1)
  if (kind === 'wood') {
    // heel thump into the boards, then a short hollow knock
    burst(e, t, { type: 'lowpass', freq: rnd(330, 420), q: 0.7, gain: 0.55 * v, attack: 0.004, decay: 0.09 })
    burst(e, t + 0.006, { type: 'bandpass', freq: rnd(950, 1350), q: 1.6, gain: 0.2 * v, attack: 0.002, decay: 0.05 })
    tone(e, t, { type: 'sine', f0: rnd(96, 118), f1: 58, gain: 0.22 * v, attack: 0.003, decay: 0.08 })
    if (Math.random() < 0.06) tone(e, t + 0.03, { type: 'triangle', f0: rnd(420, 520), f1: rnd(380, 460), gain: 0.012, attack: 0.04, decay: 0.12 }) // the odd creak
  } else if (kind === 'tile') {
    // hard heel click with a little ring
    burst(e, t, { type: 'highpass', freq: 2300, q: 0.7, gain: 0.2 * v, attack: 0.001, decay: 0.028 })
    burst(e, t, { type: 'bandpass', freq: rnd(3100, 3900), q: 5, gain: 0.1 * v, attack: 0.001, decay: 0.07 })
    burst(e, t, { type: 'lowpass', freq: 520, q: 0.7, gain: 0.28 * v, attack: 0.003, decay: 0.05 })
    tone(e, t, { type: 'sine', f0: 150, f1: 85, gain: 0.12 * v, attack: 0.002, decay: 0.05 })
  } else if (kind === 'grass') {
    // grass: a soft thud into turf and the swish of blades
    burst(e, t, { type: 'lowpass', freq: rnd(300, 380), q: 0.6, gain: 0.3 * v, attack: 0.012, decay: 0.1 })
    burst(e, t + 0.01, { type: 'bandpass', freq: rnd(3200, 4200), q: 0.6, gain: 0.05 * v, attack: 0.02, decay: 0.12 })
  } else {
    // carpet: a soft muffled pad and a brush of fibre
    burst(e, t, { type: 'lowpass', freq: rnd(460, 600), q: 0.5, gain: 0.34 * v, attack: 0.014, decay: 0.12 })
    burst(e, t + 0.02, { type: 'bandpass', freq: 1900, q: 0.7, gain: 0.025 * v, attack: 0.012, decay: 0.07 })
  }
}

/** Coming down after a jump or a fall; `strength` 0..1. */
export function land(kind: FloorKind, strength: number) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const v = Math.max(0.3, Math.min(1, strength))
  burst(e, t, { type: 'lowpass', freq: kind === 'carpet' ? 260 : 340, q: 0.7, gain: 0.8 * v, attack: 0.004, decay: 0.16 })
  tone(e, t, { type: 'sine', f0: 82, f1: 44, gain: 0.35 * v, attack: 0.004, decay: 0.14 })
  if (kind !== 'carpet') burst(e, t + 0.012, { type: 'bandpass', freq: kind === 'tile' ? 2600 : 1100, q: 1.4, gain: 0.12 * v, attack: 0.002, decay: 0.05 })
  footstep(kind, v * 0.6)
}

/** Push off for a jump: clothes and a breath of air. */
export function jumpSound() {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  burst(e, t, { type: 'bandpass', freq: 700, sweepTo: 1600, q: 0.9, gain: 0.05, attack: 0.03, decay: 0.12 })
}

/** Soft "tock" for buttons and switches in the interface. */
export function uiClick(on = true) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.002
  tone(e, t, { type: 'triangle', f0: on ? 1750 : 1350, f1: on ? 1250 : 950, gain: 0.05, attack: 0.002, decay: 0.035 })
  burst(e, t, { type: 'highpass', freq: 4500, q: 0.7, gain: 0.025, attack: 0.001, decay: 0.012 })
}

/** A rocker switch: a tick and a clack, brighter when switching on. */
export function lampSwitch(on: boolean, pan = 0, near = 1) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const g = 0.35 + 0.65 * near
  burst(e, t, { type: 'highpass', freq: on ? 3800 : 3000, q: 0.8, gain: 0.16 * g, attack: 0.001, decay: 0.012, pan })
  burst(e, t + 0.022, { type: 'bandpass', freq: on ? 1900 : 1500, q: 2.2, gain: 0.22 * g, attack: 0.001, decay: 0.035, pan })
  tone(e, t + 0.022, { type: 'sine', f0: on ? 900 : 700, f1: on ? 640 : 520, gain: 0.03 * g, attack: 0.002, decay: 0.04, pan })
}

/** Door: the latch, a short wooden creak, and the thud when it closes. */
export function doorSound(opening: boolean, pan = 0, near = 1) {
  const e = live()
  if (!e) return
  const { ac } = e
  const t = ac.currentTime + 0.004
  const g = 0.35 + 0.65 * near
  // latch
  burst(e, t, { type: 'bandpass', freq: 2400, q: 3, gain: 0.16 * g, attack: 0.001, decay: 0.03, pan })
  tone(e, t, { type: 'square', f0: 1200, f1: 700, gain: 0.012 * g, attack: 0.001, decay: 0.025, pan })
  // creak: a buzzy tone through a narrow wooden resonance, with a slow pitch drift and stick-slip grain
  const dur = opening ? 0.75 : 0.5
  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  const f0 = rnd(150, 190)
  osc.frequency.setValueAtTime(f0, t + 0.05)
  osc.frequency.linearRampToValueAtTime(f0 * (opening ? 1.45 : 1.25), t + 0.05 + dur * 0.55)
  osc.frequency.linearRampToValueAtTime(f0 * 1.1, t + 0.05 + dur)
  const grain = ac.createOscillator()
  grain.type = 'square'
  grain.frequency.value = rnd(22, 30)
  const grainDepth = ac.createGain()
  grainDepth.gain.value = 0.5
  const am = ac.createGain()
  am.gain.value = 0.5
  grain.connect(grainDepth).connect(am.gain)
  const res = ac.createBiquadFilter()
  res.type = 'bandpass'
  res.frequency.value = rnd(850, 1100)
  res.Q.value = 7
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t + 0.05)
  env.gain.exponentialRampToValueAtTime(0.05 * g, t + 0.05 + dur * 0.25)
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + dur)
  osc.connect(am).connect(res).connect(env).connect(out(e, pan))
  osc.start(t + 0.05)
  grain.start(t + 0.05)
  osc.stop(t + 0.1 + dur)
  grain.stop(t + 0.1 + dur)
  // air moved by the leaf
  burst(e, t + 0.05, { type: 'lowpass', freq: 500, q: 0.5, gain: 0.05 * g, attack: 0.2, decay: dur, pan })
  if (!opening) {
    const tc = t + 0.62
    burst(e, tc, { type: 'lowpass', freq: 240, q: 0.8, gain: 0.55 * g, attack: 0.004, decay: 0.18, pan })
    tone(e, tc, { type: 'sine', f0: 74, f1: 42, gain: 0.3 * g, attack: 0.004, decay: 0.16, pan })
    burst(e, tc + 0.01, { type: 'bandpass', freq: 2100, q: 3, gain: 0.12 * g, attack: 0.001, decay: 0.03, pan })
  }
}

export function pickupSound() {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  burst(e, t, { type: 'bandpass', freq: 380, sweepTo: 1500, q: 1.1, gain: 0.07, attack: 0.04, decay: 0.1 })
  tone(e, t + 0.05, { type: 'sine', f0: 560, f1: 760, gain: 0.03, attack: 0.006, decay: 0.09 })
}

export function dropSound() {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  burst(e, t, { type: 'bandpass', freq: 1400, sweepTo: 420, q: 1.1, gain: 0.06, attack: 0.03, decay: 0.12 })
}

/** Something you carried or pushed hits the floor or the furniture. */
export function impactSound(kind: 'mug' | 'book' | 'gift', strength: number, pan = 0) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.003
  const v = Math.max(0.08, Math.min(1, strength))
  if (kind === 'mug') {
    // ceramic: a short knock and a couple of bright, fast-decaying partials
    burst(e, t, { type: 'bandpass', freq: 2200, q: 2, gain: 0.22 * v, attack: 0.001, decay: 0.03, pan })
    tone(e, t, { type: 'sine', f0: rnd(2100, 2350), gain: 0.06 * v, attack: 0.001, decay: 0.16, pan })
    tone(e, t, { type: 'sine', f0: rnd(3350, 3600), gain: 0.03 * v, attack: 0.001, decay: 0.09, pan })
  } else if (kind === 'book') {
    burst(e, t, { type: 'lowpass', freq: 900, q: 0.8, gain: 0.4 * v, attack: 0.002, decay: 0.06, pan })
    burst(e, t, { type: 'bandpass', freq: 2600, q: 1, gain: 0.08 * v, attack: 0.001, decay: 0.025, pan })
  } else {
    burst(e, t, { type: 'lowpass', freq: 320, q: 0.9, gain: 0.45 * v, attack: 0.003, decay: 0.1, pan })
    burst(e, t, { type: 'bandpass', freq: 750, q: 1.6, gain: 0.16 * v, attack: 0.002, decay: 0.07, pan })
  }
}

/** A soft glassy chime when a screen opens, falling when it closes. */
export function screenSound(open: boolean) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const [a, b] = open ? [587, 880] : [880, 587]
  tone(e, t, { type: 'sine', f0: a, gain: 0.035, attack: 0.012, decay: 0.45 })
  tone(e, t + 0.07, { type: 'sine', f0: b, gain: 0.03, attack: 0.012, decay: 0.6 })
  tone(e, t + 0.07, { type: 'sine', f0: b * 2.01, gain: 0.006, attack: 0.01, decay: 0.3 })
  burst(e, t, { type: 'bandpass', freq: open ? 600 : 2200, sweepTo: open ? 2400 : 500, q: 0.8, gain: 0.025, attack: 0.08, decay: 0.2 })
}

// ─────────────────────── the garden ───────────────────────

export type FarmSound = 'plant' | 'water' | 'harvest' | 'coins' | 'cluck' | 'bell' | 'build' | 'decline'

/** Garden work and the people and animals in it. */
export function farmSound(kind: FarmSound, pan = 0, near = 1) {
  const e = live()
  if (!e) return
  const t = e.ac.currentTime + 0.004
  const v = Math.max(0.25, near)
  switch (kind) {
    case 'plant': // hands in the soil: two scrapes and a pat
      burst(e, t, { type: 'lowpass', freq: 900, q: 0.6, gain: 0.25 * v, attack: 0.03, decay: 0.18, pan })
      burst(e, t + 0.16, { type: 'bandpass', freq: 1400, q: 0.8, gain: 0.12 * v, attack: 0.02, decay: 0.14, pan })
      burst(e, t + 0.32, { type: 'lowpass', freq: 260, q: 0.7, gain: 0.35 * v, attack: 0.005, decay: 0.09, pan })
      break
    case 'water': // a pour sweeping down, and a few drops
      burst(e, t, { type: 'bandpass', freq: 2600, sweepTo: 1200, q: 1.1, gain: 0.2 * v, attack: 0.08, decay: 0.9, pan })
      burst(e, t + 0.05, { type: 'highpass', freq: 5000, q: 0.7, gain: 0.05 * v, attack: 0.05, decay: 0.8, pan })
      for (let i = 0; i < 4; i++)
        tone(e, t + 0.2 + i * 0.13 + Math.random() * 0.05, { type: 'sine', f0: rnd(900, 1500), f1: rnd(1800, 2600), gain: 0.025 * v, attack: 0.004, decay: 0.05, pan })
      break
    case 'harvest': // leaves rustle, a stem snaps
      burst(e, t, { type: 'bandpass', freq: 3200, q: 0.9, gain: 0.12 * v, attack: 0.02, decay: 0.22, pan })
      burst(e, t + 0.12, { type: 'highpass', freq: 2500, q: 0.8, gain: 0.18 * v, attack: 0.002, decay: 0.03, pan })
      tone(e, t + 0.12, { type: 'triangle', f0: 520, f1: 300, gain: 0.05 * v, attack: 0.003, decay: 0.08, pan })
      break
    case 'coins': // clink, clink, chime
      tone(e, t, { type: 'sine', f0: 2093, gain: 0.05, attack: 0.002, decay: 0.25 })
      tone(e, t + 0.07, { type: 'sine', f0: 2637, gain: 0.05, attack: 0.002, decay: 0.35 })
      tone(e, t + 0.14, { type: 'sine', f0: 3136, gain: 0.04, attack: 0.002, decay: 0.5 })
      burst(e, t, { type: 'highpass', freq: 6000, q: 0.7, gain: 0.03, attack: 0.001, decay: 0.05 })
      break
    case 'cluck': {
      // a hen: two or three short nasal notes
      const n = 2 + Math.floor(Math.random() * 2)
      for (let i = 0; i < n; i++) {
        const tt = t + i * rnd(0.09, 0.13)
        tone(e, tt, { type: 'sawtooth', f0: rnd(520, 640), f1: rnd(380, 460), gain: 0.02 * v, attack: 0.008, decay: 0.06, pan })
        burst(e, tt, { type: 'bandpass', freq: 1400, q: 3, gain: 0.03 * v, attack: 0.006, decay: 0.05, pan })
      }
      break
    }
    case 'bell': // the gate bell: someone is here
      for (const [f, d, g] of [
        [1318, 1.4, 0.05],
        [1975, 1.0, 0.025],
        [2637, 0.6, 0.015],
      ])
        tone(e, t, { type: 'sine', f0: f, gain: g * v, attack: 0.003, decay: d, pan })
      tone(e, t + 0.28, { type: 'sine', f0: 1046, gain: 0.04 * v, attack: 0.003, decay: 1.2, pan })
      break
    case 'build': // hammer knocks into timber
      for (let i = 0; i < 3; i++) {
        burst(e, t + i * 0.18, { type: 'lowpass', freq: 700, q: 0.8, gain: 0.4 * v, attack: 0.002, decay: 0.07, pan })
        tone(e, t + i * 0.18, { type: 'sine', f0: 180, f1: 120, gain: 0.15 * v, attack: 0.002, decay: 0.08, pan })
      }
      break
    case 'decline': // a soft falling "oh well"
      tone(e, t, { type: 'triangle', f0: 392, gain: 0.03, attack: 0.01, decay: 0.2 })
      tone(e, t + 0.15, { type: 'triangle', f0: 311, gain: 0.03, attack: 0.01, decay: 0.3 })
      break
  }
}

let outdoors = false
let birdTimer: number | undefined

/** One bird somewhere in the garden: a songbird's quick phrase, now and then a dove. */
function birdCall() {
  const e = live()
  if (e && outdoors) {
    const t = e.ac.currentTime + 0.01
    const pan = rnd(-0.9, 0.9)
    const g = rnd(0.012, 0.03)
    if (Math.random() < 0.18) {
      // a laughing dove: soft, low, rising and falling
      for (let i = 0; i < 4; i++) tone(e, t + i * 0.24, { type: 'sine', f0: rnd(430, 470), f1: rnd(380, 410), gain: g * 0.9, attack: 0.04, decay: 0.16, pan })
    } else {
      const notes = 2 + Math.floor(Math.random() * 5)
      const base = rnd(2600, 3800)
      for (let i = 0; i < notes; i++) {
        const up = Math.random() < 0.6
        tone(e, t + i * rnd(0.07, 0.12), { type: 'sine', f0: base * (up ? 0.85 : 1.2), f1: base * (up ? 1.25 : 0.8), gain: g, attack: 0.008, decay: rnd(0.03, 0.07), pan })
      }
    }
  }
  birdTimer = window.setTimeout(birdCall, rnd(900, 3800))
}

/** In the garden: open-air wind instead of a room's tone, and birds. */
export function setOutdoors(on: boolean) {
  if (on === outdoors) return
  outdoors = on
  window.clearTimeout(birdTimer)
  if (on) birdTimer = window.setTimeout(birdCall, 500)
  setRoomTone(wantedRoom)
}

// ─────────────────────── room tone ───────────────────────

// Each room has its own quiet bed: air, a fridge in the kitchen, a computer fan in the studio.
const ROOM_TONE: Record<RoomId, { cutoff: number; level: number; hum: number; fan: number }> = {
  living: { cutoff: 380, level: 0.05, hum: 0, fan: 0 },
  office: { cutoff: 520, level: 0.045, hum: 0, fan: 0.012 },
  kitchen: { cutoff: 460, level: 0.05, hum: 0.012, fan: 0 },
  bedroom: { cutoff: 300, level: 0.035, hum: 0, fan: 0 },
}

function startAmbient() {
  if (!engine || ambient) return
  const { ac, amb, brown, white } = engine
  const src = ac.createBufferSource()
  src.buffer = brown
  src.loop = true
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 400
  filter.Q.value = 0.4
  const gain = ac.createGain()
  gain.gain.value = 0
  src.connect(filter).connect(gain).connect(amb)
  src.start()
  // mains hum of the fridge: 100 Hz and its harmonic
  const hum = ac.createGain()
  hum.gain.value = 0
  for (const [f, level] of [
    [100, 1],
    [200, 0.35],
  ]) {
    const o = ac.createOscillator()
    o.frequency.value = f
    const g = ac.createGain()
    g.gain.value = level
    o.connect(g).connect(hum)
    o.start()
  }
  hum.connect(amb)
  // fan: band-passed noise
  const fanSrc = ac.createBufferSource()
  fanSrc.buffer = white
  fanSrc.loop = true
  const fanFilter = ac.createBiquadFilter()
  fanFilter.type = 'bandpass'
  fanFilter.frequency.value = 700
  fanFilter.Q.value = 1.2
  const fan = ac.createGain()
  fan.gain.value = 0
  fanSrc.connect(fanFilter).connect(fan).connect(amb)
  fanSrc.start()
  ambient = { filter, gain, hum, fan, fanFilter }
  amb.gain.setTargetAtTime(1, ac.currentTime, 1.2)
  setRoomTone(wantedRoom)
}

/** Cross-fades the room tone to `room` (null: between rooms or outside). */
export function setRoomTone(room: RoomId | null) {
  wantedRoom = room
  if (!engine || !ambient) return
  const now = engine.ac.currentTime
  const tone = outdoors ? { cutoff: 1100, level: 0.05, hum: 0, fan: 0 } : room ? ROOM_TONE[room] : { cutoff: 350, level: 0.04, hum: 0, fan: 0 }
  ambient.filter.frequency.setTargetAtTime(tone.cutoff, now, 0.8)
  ambient.gain.gain.setTargetAtTime(tone.level, now, 0.8)
  ambient.hum.gain.setTargetAtTime(tone.hum, now, 1.0)
  ambient.fan.gain.setTargetAtTime(tone.fan, now, 1.0)
}

/** Room tone fades out while a screen or the settings have your attention. */
export function duckAmbient(ducked: boolean) {
  if (!engine) return
  engine.amb.gain.setTargetAtTime(ducked ? 0.45 : 1, engine.ac.currentTime, 0.4)
}
