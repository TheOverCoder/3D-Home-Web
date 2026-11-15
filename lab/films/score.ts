import { audioGraph, farmSound, unlockAudio } from '../../src/audio/sound'
import type { Sting, Timeline, Track } from './format'

// A film's music and stings, composed as it plays, as the game's own music is (src/audio/music.ts): oscillators and
// noise, nothing downloaded. Three tracks — the shop's muzak (a bossa nova out of a ceiling speaker), a tension pulse
// (a heartbeat and a clock) and a boom-bap beat — and short stings on the moments. The game's own sounds (coins, the
// till, a level) are the game's (src/audio/sound.ts, farmSound), so the film sounds like the game; it plays through
// the game's volume. `Synth` writes into any audio context, so the score can be rendered offline and measured.

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

/** The sounds that are the game's own. */
const GAME: Partial<Record<Sting, Parameters<typeof farmSound>[0]>> = { coins: 'coins', till: 'till', level: 'level' }

export class Synth {
  private white: AudioBuffer
  private buses = new Map<Track, GainNode>()
  readonly out: GainNode

  constructor(
    readonly ac: BaseAudioContext,
    dest: AudioNode,
  ) {
    this.out = ac.createGain()
    this.out.gain.value = 0.9
    this.out.connect(dest)
    this.white = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const d = this.white.getChannelData(0)
    let seed = 7
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647
      d[i] = (seed / 2147483647) * 2 - 1
    }
  }

  /** A track's own bus (the muzak through a ceiling speaker's narrow band). */
  private bus(track: Track) {
    let g = this.buses.get(track)
    if (g) return g
    g = this.ac.createGain()
    if (track === 'muzak') {
      const lo = this.ac.createBiquadFilter()
      lo.type = 'highpass'
      lo.frequency.value = 320
      const hi = this.ac.createBiquadFilter()
      hi.type = 'lowpass'
      hi.frequency.value = 3200
      g.connect(lo).connect(hi).connect(this.out)
    } else g.connect(this.out)
    this.buses.set(track, g)
    return g
  }

  /** Every bus silent at t (the needle lifted). */
  hush(t: number, seconds = 0.03) {
    for (const g of this.buses.values()) {
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(0.0001, t + seconds)
    }
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  private tone(dest: AudioNode, t: number, f: number, o: { type?: OscillatorType; gain: number; attack?: number; decay: number; f1?: number; detune?: number }) {
    const osc = this.ac.createOscillator()
    osc.type = o.type ?? 'sine'
    osc.frequency.setValueAtTime(f, t)
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.attack ?? 0.005) + o.decay)
    if (o.detune) osc.detune.value = o.detune
    const g = this.ac.createGain()
    this.env(g, t, o.gain, o.attack ?? 0.005, o.decay)
    osc.connect(g).connect(dest)
    osc.start(t)
    osc.stop(t + (o.attack ?? 0.005) + o.decay + 0.05)
  }

  private noise(dest: AudioNode, t: number, o: { type: BiquadFilterType; f: number; f1?: number; q?: number; gain: number; attack?: number; decay: number }) {
    const src = this.ac.createBufferSource()
    src.buffer = this.white
    const f = this.ac.createBiquadFilter()
    f.type = o.type
    f.frequency.setValueAtTime(o.f, t)
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.attack ?? 0.003) + o.decay)
    f.Q.value = o.q ?? 0.8
    const g = this.ac.createGain()
    this.env(g, t, o.gain, o.attack ?? 0.003, o.decay)
    src.connect(f).connect(g).connect(dest)
    src.start(t, Math.random() * 1.5)
    src.stop(t + (o.attack ?? 0.003) + o.decay + 0.05)
  }

  /** A filtered sawtooth note (a bass, a stab, a brass). */
  private saw(dest: AudioNode, t: number, f: number, o: { gain: number; decay: number; cut: number; cut1?: number; attack?: number; voices?: number }) {
    const filter = this.ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 2
    filter.frequency.setValueAtTime(o.cut, t)
    if (o.cut1) filter.frequency.exponentialRampToValueAtTime(o.cut1, t + (o.attack ?? 0.01) + o.decay)
    filter.connect(dest)
    const n = o.voices ?? 1
    for (let i = 0; i < n; i++) this.tone(filter, t, f, { type: 'sawtooth', gain: o.gain / n, attack: o.attack ?? 0.01, decay: o.decay, detune: n > 1 ? (i - (n - 1) / 2) * 9 : 0 })
  }

  // ───────────── the tracks: each scheduled bar by bar from a to b (audio seconds), the first beat at `origin` ─────────────

  music(track: Track, a: number, b: number, origin: number) {
    const g = this.bus(track)
    g.gain.cancelScheduledValues(a)
    g.gain.setValueAtTime(1, a)
    const bpm = track === 'muzak' ? 112 : track === 'tension' ? 100 : 90
    const beat = 60 / bpm
    const bar = beat * 4
    for (let k = 0; ; k++) {
      const t = origin + k * bar
      if (t >= b) break
      if (t + bar <= a) continue
      if (track === 'muzak') this.muzakBar(g, t, beat, k, a, b)
      else if (track === 'tension') this.tensionBar(g, t, beat, k, a, b)
      else this.beatBar(g, t, beat, k, a, b)
    }
  }

  private muzakBar(g: AudioNode, t: number, beat: number, k: number, a: number, b: number) {
    // Cmaj7 · Am7 · Dm7 · G7, a bossa nova's comping on an electric piano, a soft bass, a brush
    const chords = [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [62, 65, 69, 72],
      [55, 59, 62, 65],
    ]
    const roots = [48, 45, 50, 43]
    const c = chords[k % 4]
    const on = (x: number) => x >= a && x < b
    for (const [at, len] of [
      [0, 1.2],
      [1.5, 0.9],
      [3, 0.8],
    ])
      if (on(t + at * beat))
        for (const n of c) {
          this.tone(g, t + at * beat, midi(n), { gain: 0.075, attack: 0.008, decay: len })
          this.tone(g, t + at * beat, midi(n + 12), { gain: 0.018, decay: len * 0.4 })
        }
    const root = roots[k % 4]
    for (const [at, n] of [
      [0, root],
      [1.5, root + 7],
      [2, root + 7],
      [3.5, root],
    ])
      if (on(t + at * beat)) this.tone(g, t + at * beat, midi(n), { type: 'triangle', gain: 0.24, decay: 0.45 })
    for (let i = 0; i < 8; i++) {
      const x = t + i * beat * 0.5 + (i % 2 ? 0.03 : 0)
      if (on(x)) this.noise(g, x, { type: 'highpass', f: 6000, gain: i % 2 ? 0.04 : 0.07, decay: 0.07 })
    }
    // a vibraphone's cheesy line every other bar
    if (k % 2 === 1)
      [76, 74, 72, 71].forEach((n, i) => {
        const x = t + (0.5 + i * 0.75) * beat
        if (on(x)) this.tone(g, x, midi(n), { gain: 0.1, decay: 0.7 })
      })
  }

  private tensionBar(g: AudioNode, t: number, beat: number, k: number, a: number, b: number) {
    const on = (x: number) => x >= a && x < b
    for (const at of [0, 0.32, 2, 2.32]) if (on(t + at * beat)) this.tone(g, t + at * beat, 58, { gain: 0.5, decay: 0.32, f1: 40 })
    for (let i = 0; i < 4; i++) if (on(t + i * beat)) this.noise(g, t + i * beat, { type: 'bandpass', f: i % 2 ? 2600 : 3400, q: 6, gain: 0.08, decay: 0.03 })
    // a low string held under it, opening a little more each bar
    if (on(t)) this.saw(g, t, midi(31 + (k % 2)), { gain: 0.06, attack: 0.4, decay: beat * 4, cut: 260 + k * 90, cut1: 420 + k * 120, voices: 2 })
  }

  private beatBar(g: AudioNode, t: number, beat: number, k: number, a: number, b: number) {
    const on = (x: number) => x >= a && x < b
    const swing = beat * 0.08
    for (const at of [0, 0.75, 2.5, k % 2 ? 2.75 : 2.5]) if (on(t + at * beat)) this.kick(g, t + at * beat, 0.7)
    for (const at of [1, 3]) if (on(t + at * beat)) this.snare(g, t + at * beat)
    for (let i = 0; i < 8; i++) {
      const x = t + i * beat * 0.5 + (i % 2 ? swing : 0)
      if (on(x)) this.noise(g, x, { type: 'highpass', f: 8000, gain: i === 7 ? 0.08 : i % 2 ? 0.04 : 0.07, decay: i === 7 ? 0.22 : 0.04 })
    }
    // C minor: a bass riff over two bars, a minor stab on the one
    const riff =
      k % 2 === 0
        ? [
            [0, 36, 0.8],
            [0.75, 36, 0.2],
            [2.5, 39, 0.4],
            [3.25, 31, 0.6],
          ]
        : [
            [0, 32, 1.0],
            [0.75, 32, 0.2],
            [2.5, 31, 0.4],
            [3.25, 34, 0.6],
          ]
    for (const [at, n, len] of riff) if (on(t + at * beat)) this.saw(g, t + at * beat, midi(n), { gain: 0.3, decay: len * beat, cut: 520, cut1: 160 })
    const stab = k % 2 === 0 ? [60, 63, 67, 70] : [56, 60, 63, 67]
    if (on(t)) for (const n of stab) this.saw(g, t, midi(n), { gain: 0.045, decay: 0.32, cut: 2600, cut1: 500, voices: 2 })
    // the vinyl's crackle
    for (let i = 0; i < 6; i++) {
      const x = t + ((i * 0.618 + k * 0.37) % 1) * beat * 4
      if (on(x)) this.noise(g, x, { type: 'highpass', f: 3000, gain: 0.018, decay: 0.01 })
    }
  }

  private kick(g: AudioNode, t: number, v: number) {
    this.tone(g, t, 150, { gain: 0.9 * v, decay: 0.32, f1: 42 })
    this.noise(g, t, { type: 'lowpass', f: 1800, gain: 0.1 * v, decay: 0.02 })
  }

  private snare(g: AudioNode, t: number) {
    this.noise(g, t, { type: 'bandpass', f: 1900, q: 0.7, gain: 0.32, decay: 0.2 })
    this.tone(g, t, 190, { gain: 0.16, decay: 0.09, f1: 150 })
    for (const dt of [0.012, 0.026]) this.noise(g, t + dt, { type: 'bandpass', f: 1300, q: 1.2, gain: 0.12, decay: 0.06 })
  }

  // ───────────── stings, at t ─────────────

  sting(kind: Sting, t: number) {
    const o = this.out
    switch (kind) {
      case 'thud':
        this.tone(o, t, 95, { gain: 0.9, decay: 0.42, f1: 38 })
        this.noise(o, t, { type: 'lowpass', f: 420, gain: 0.5, decay: 0.22 })
        break
      case 'glow':
        // a choir's "aah", a major chord swelling, and a shimmer over it
        for (const n of [60, 64, 67, 72])
          for (const formant of [780, 1150]) {
            const f = this.ac.createBiquadFilter()
            f.type = 'bandpass'
            f.frequency.value = formant
            f.Q.value = 3
            f.connect(o)
            this.saw(f, t, midi(n), { gain: 0.7, attack: 0.3, decay: 2.0, cut: 4000, voices: 3 })
          }
        for (let i = 0; i < 6; i++) this.tone(o, t + 0.15 + i * 0.09, midi(96 + [0, 4, 7, 12, 7, 4][i]), { gain: 0.03, decay: 0.6 })
        break
      case 'scratch':
        this.hush(t)
        this.noise(o, t, { type: 'bandpass', f: 500, f1: 2600, q: 5, gain: 0.55, attack: 0.01, decay: 0.12 })
        this.noise(o, t + 0.13, { type: 'bandpass', f: 2400, f1: 400, q: 5, gain: 0.45, attack: 0.01, decay: 0.16 })
        this.tone(o, t, 260, { type: 'sawtooth', gain: 0.12, decay: 0.12, f1: 900 })
        this.tone(o, t + 0.13, 900, { type: 'sawtooth', gain: 0.1, decay: 0.16, f1: 180 })
        break
      case 'snap':
        this.noise(o, t, { type: 'highpass', f: 2200, gain: 0.5, decay: 0.045 })
        this.tone(o, t, 1900, { gain: 0.08, decay: 0.03 })
        break
      case 'whoosh':
        this.noise(o, t, { type: 'bandpass', f: 300, f1: 3200, q: 1.4, gain: 0.3, attack: 0.18, decay: 0.2 })
        break
      case 'clunk':
        // a big switch thrown, and the lights' hum coming up
        this.tone(o, t, 75, { gain: 0.7, decay: 0.28, f1: 45 })
        this.noise(o, t, { type: 'bandpass', f: 2500, q: 2, gain: 0.3, decay: 0.05 })
        this.saw(o, t + 0.05, 100, { gain: 0.05, attack: 0.25, decay: 0.9, cut: 300, cut1: 900 })
        break
      case 'trombone': {
        // the sad trombone: four notes down, the last one wobbling, each opened and shut by a plunger
        const notes: [number, number][] = [
          [58, 0.42],
          [57, 0.42],
          [56, 0.42],
          [55, 1.3],
        ]
        let x = t
        for (const [n, len] of notes) {
          const f = this.ac.createBiquadFilter()
          f.type = 'lowpass'
          f.Q.value = 4
          f.frequency.setValueAtTime(380, x)
          f.frequency.linearRampToValueAtTime(1500, x + 0.12)
          f.frequency.linearRampToValueAtTime(700, x + len)
          f.connect(o)
          const osc = this.ac.createOscillator()
          osc.type = 'sawtooth'
          osc.frequency.value = midi(n - 12)
          if (len > 1) {
            const vib = this.ac.createOscillator()
            vib.frequency.value = 5.5
            const depth = this.ac.createGain()
            depth.gain.setValueAtTime(0, x)
            depth.gain.linearRampToValueAtTime(midi(n - 12) * 0.04, x + 0.4)
            vib.connect(depth).connect(osc.frequency)
            vib.start(x)
            vib.stop(x + len + 0.1)
          }
          const g = this.ac.createGain()
          g.gain.setValueAtTime(0.0001, x)
          g.gain.exponentialRampToValueAtTime(0.28, x + 0.04)
          g.gain.setValueAtTime(0.28, x + len - 0.08)
          g.gain.exponentialRampToValueAtTime(0.0001, x + len)
          osc.connect(g).connect(f)
          osc.start(x)
          osc.stop(x + len + 0.05)
          x += len
        }
        break
      }
      case 'riser':
        this.noise(o, t, { type: 'highpass', f: 400, f1: 6000, gain: 0.16, attack: 1.1, decay: 0.12 })
        this.tone(o, t, 180, { type: 'triangle', gain: 0.08, attack: 1.1, decay: 0.1, f1: 900 })
        break
      case 'drop':
        this.kick(o, t, 0.75)
        this.tone(o, t, 55, { gain: 0.42, decay: 1.3, f1: 40 })
        this.noise(o, t, { type: 'highpass', f: 5000, gain: 0.18, decay: 1.2 })
        for (const n of [48, 55, 60, 63]) this.saw(o, t, midi(n), { gain: 0.08, decay: 0.7, cut: 3000, cut1: 400, voices: 3 })
        break
      case 'tick':
        this.noise(o, t, { type: 'bandpass', f: 3800, q: 8, gain: 0.18, decay: 0.025 })
        this.tone(o, t, 2400, { gain: 0.03, decay: 0.03 })
        break
      case 'door':
        this.noise(o, t, { type: 'bandpass', f: 900, f1: 2000, q: 1, gain: 0.08, attack: 0.15, decay: 0.4 })
        break
      case 'swell':
        for (const n of [60, 64, 67, 72, 76]) this.saw(o, t, midi(n), { gain: 0.05, attack: 0.8, decay: 1.4, cut: 900, cut1: 3500, voices: 2 })
        for (let i = 0; i < 8; i++) this.tone(o, t + 0.5 + i * 0.07, midi(84 + [0, 4, 7, 11, 12, 16, 19, 24][i]), { gain: 0.035, decay: 0.5 })
        break
      default:
        break
    }
  }
}

/** The film's sound as it plays: the music scheduled ahead on the audio clock from a film time, the stings fired as
 *  the film passes them (the game's own through its engine). Silent until `start`, which must run from a tap. */
export class Score {
  private synth: Synth | null = null
  private origin = 0
  private next = 0

  constructor(private tl: Timeline) {}

  get on() {
    return this.synth !== null
  }

  /** Sound from film time `t` (in a tap: browsers start audio only from one). */
  start(t: number) {
    unlockAudio()
    const g = audioGraph()
    if (!g) return
    this.stop()
    this.synth = new Synth(g.ac, g.master)
    this.origin = g.ac.currentTime + 0.06 - t
    this.next = this.tl.cues.findIndex((c) => c.t >= t)
    if (this.next < 0) this.next = this.tl.cues.length
    const music = this.tl.cues.filter((c) => c.item.music)
    music.forEach((c, i) => {
      const end = music[i + 1]?.t ?? this.tl.length + 4
      if (c.item.music === 'stop' || end <= t) return
      this.synth!.music(c.item.music as Track, this.origin + Math.max(t, c.t), this.origin + end, this.origin + c.t)
    })
  }

  /** The stings the film has passed since the last frame. */
  tick(t: number) {
    const s = this.synth
    if (!s) return
    while (this.next < this.tl.cues.length && this.tl.cues[this.next].t <= t) {
      const c = this.tl.cues[this.next++].item
      if (c.music === 'stop') s.hush(s.ac.currentTime)
      if (!c.sting) continue
      const game = GAME[c.sting]
      if (game) farmSound(game)
      else s.sting(c.sting, s.ac.currentTime + 0.005)
    }
  }

  /** Jumped to t (a skip): what was scheduled is cut, the stings go on from there. */
  skip(t: number) {
    if (!this.synth) return
    this.start(t)
  }

  stop() {
    if (!this.synth) return
    const s = this.synth
    s.out.gain.setTargetAtTime(0, s.ac.currentTime, 0.04)
    setTimeout(() => s.out.disconnect(), 400)
    this.synth = null
  }
}
