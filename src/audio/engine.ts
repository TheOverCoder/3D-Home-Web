// The sound engine: one audio context made on the first gesture (browsers refuse to start audio before one), its
// buses, two noise buffers, and the building blocks every sound is made of (a noise burst, a tone, a voice). A sound is
// written into an `Engine`: the live one (`live()`: null until a gesture has unlocked audio, while sound is off and
// while the context is not running), an OfflineAudioContext's to measure it, or the recording fake's in the tests
// (./fakeAudio.ts): the same code each time (`makeEngine`). Nothing is downloaded: everything is synthesised.
// No three.js in here: the entry chunk imports this file.

/** Where a sound is written: a context, the buses its one-shots and its room tone go into, the noise it is made of,
 *  and this sound's own pitch and loudness (./palette.ts, vary: 1 is as written). */
export interface Engine {
  ac: BaseAudioContext
  /** one-shots */
  sfx: GainNode
  /** room tone and the open air */
  amb: GainNode
  white: AudioBuffer
  brown: AudioBuffer
  /** this sound's pitch factor: every frequency but a note of the key (a tone's `key`) is multiplied by it */
  pitch?: number
  /** this sound's loudness factor */
  level?: number
}

interface LiveEngine extends Engine {
  ac: AudioContext
  /** the user's volume, into the limiter */
  master: GainNode
}

let engine: LiveEngine | null = null
let enabled = true
let volume = 0.7

export const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function noiseBuffer(ac: BaseAudioContext, seconds: number, brown: boolean) {
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

/** An engine writing into `ac`: its one-shots into `sfx` and its room tone into `amb` (both straight into the
 *  context's output when not given: offline, to measure a sound, or the fake). */
export function makeEngine(ac: BaseAudioContext, sfx?: GainNode, amb?: GainNode): Engine {
  const bus = () => {
    const g = ac.createGain()
    g.connect(ac.destination)
    return g
  }
  return { ac, sfx: sfx ?? bus(), amb: amb ?? bus(), white: noiseBuffer(ac, 1.5, false), brown: noiseBuffer(ac, 6, true) }
}

function create(): LiveEngine | null {
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
  return { ...makeEngine(ac, sfx, amb), ac, master }
}

/** The live engine, made (and resumed) from a user gesture: null where the browser has no audio. Safe to call often. */
export function openEngine(): LiveEngine | null {
  if (!engine) {
    try {
      engine = create()
    } catch {
      engine = null
    }
    if (!engine) return null
    applyPrefs()
  }
  if (engine.ac.state === 'suspended' && enabled) void engine.ac.resume().catch(() => {})
  return engine
}

/** The live engine once a gesture has made it, heard or not (null before). */
export const engineNow = (): Engine | null => engine

/** The live engine while it can be heard: made, sound on, the context running. */
export const live = (): Engine | null => (engine && enabled && engine.ac.state === 'running' ? engine : null)

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

/** The audio context and the user-volume bus, for the music, the films and the drive (null until the first gesture
 *  unlocked audio). */
export function audioGraph(): { ac: AudioContext; master: GainNode } | null {
  return engine ? { ac: engine.ac, master: engine.master } : null
}

/** The engine's state, its switch and its volume (null before the first gesture). */
export function engineStatus() {
  return engine ? { state: engine.ac.state, enabled, volume } : null
}

// ─────────────────────── building blocks ───────────────────────

export interface BurstOpts {
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

/** Where a sound goes: the one-shots' bus, through a stereo position when it has one. */
export function out(e: Engine, pan?: number): AudioNode {
  if (!pan) return e.sfx
  const p = e.ac.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  p.connect(e.sfx)
  return p
}

/** A filtered noise burst with a fast attack and an exponential decay (its filter moves with the sound's pitch). */
export function burst(e: Engine, t: number, o: BurstOpts) {
  const { ac } = e
  const p = e.pitch ?? 1
  const src = ac.createBufferSource()
  src.buffer = e.white
  src.playbackRate.value = o.rate ?? 1
  const f = ac.createBiquadFilter()
  f.type = o.type
  f.frequency.setValueAtTime(o.freq * p, t)
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo * p, t + o.attack + o.decay)
  f.Q.value = o.q ?? 0.8
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain * (e.level ?? 1)), t + o.attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.attack + o.decay)
  src.connect(f).connect(g).connect(out(e, o.pan))
  src.start(t, Math.random() * 1.2, o.attack + o.decay + 0.05)
}

export interface ToneOpts {
  type: OscillatorType
  f0: number
  f1?: number
  gain: number
  attack: number
  decay: number
  pan?: number
  /** a note of the key (./palette.ts): it stays in tune when the sound's pitch varies */
  key?: boolean
}

/** One oscillator note with a fast attack and an exponential decay, gliding to `f1` when it has one. */
export function tone(e: Engine, t: number, o: ToneOpts) {
  const { ac } = e
  const p = o.key ? 1 : (e.pitch ?? 1)
  const osc = ac.createOscillator()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.f0 * p, t)
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1 * p, t + o.attack + o.decay)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain * (e.level ?? 1)), t + o.attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.attack + o.decay)
  osc.connect(g).connect(out(e, o.pan))
  osc.start(t)
  osc.stop(t + o.attack + o.decay + 0.05)
}

/** A voiced, filtered tone whose pitch and brightness follow a short contour: animals. */
export function voice(e: Engine, t: number, notes: [number, number][], seconds: number, gain: number, cutoff: [number, number], pan?: number, type: OscillatorType = 'sawtooth') {
  const { ac } = e
  const osc = ac.createOscillator()
  osc.type = type
  const step = seconds / Math.max(1, notes.length - 1)
  notes.forEach(([f], i) => (i === 0 ? osc.frequency.setValueAtTime(f, t) : osc.frequency.linearRampToValueAtTime(f, t + i * step)))
  const vib = ac.createOscillator()
  vib.frequency.value = 6
  const depth = ac.createGain()
  depth.gain.value = notes[0][0] * 0.012
  vib.connect(depth).connect(osc.frequency)
  const f = ac.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 2
  f.frequency.setValueAtTime(cutoff[0], t)
  f.frequency.linearRampToValueAtTime(cutoff[1], t + seconds * 0.6)
  f.frequency.linearRampToValueAtTime(cutoff[0], t + seconds)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  notes.forEach(([, level], i) => g.gain.linearRampToValueAtTime(Math.max(0.0002, gain * level), t + Math.max(0.03, i * step)))
  g.gain.linearRampToValueAtTime(0.0001, t + seconds + 0.08)
  osc.connect(f).connect(g).connect(out(e, pan))
  osc.start(t)
  vib.start(t)
  osc.stop(t + seconds + 0.1)
  vib.stop(t + seconds + 0.1)
}
