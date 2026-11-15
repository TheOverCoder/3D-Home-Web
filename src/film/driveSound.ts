import { audioGraph } from '../audio/sound'

// The drive's sound (./DriveFilm.tsx plays it with the film): the little car's engine humming under the picture — a
// buzzy note that rises with its speed and a soft putter, muffled from inside the cabin — the road's hiss under the
// tyres, and two toots of the horn as it arrives. Made with WebAudio on the game's own sound graph (src/audio/sound.ts:
// the volume and mute in the settings apply), nothing downloaded; silent until the page has been touched (the Drive
// button is that touch) and while the sound is off.

const LEVEL = 0.09

export class EngineSound {
  private readonly g = audioGraph()
  private readonly out: GainNode | null = null
  /** the engine's notes (their pitch follows the speed) */
  private readonly engine: OscillatorNode[] = []
  /** everything that plays until the drive is over */
  private readonly sources: AudioScheduledSourceNode[] = []
  private readonly tone: BiquadFilterNode | null = null
  private readonly putter: OscillatorNode | null = null
  private readonly road: GainNode | null = null
  private readonly roadFilter: BiquadFilterNode | null = null
  private stopped = false

  constructor() {
    const g = this.g
    if (!g) return
    const { ac, master } = g
    const now = ac.currentTime
    const out = ac.createGain()
    out.gain.setValueAtTime(0, now)
    out.gain.setTargetAtTime(LEVEL, now, 0.12)
    out.connect(master)
    this.out = out
    // the engine: a sawtooth and a square an octave under it, through a low filter (phone speakers hear its upper
    // harmonics, not its fundamental)
    const tone = ac.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 700
    tone.Q.value = 2.5
    const body = ac.createGain()
    body.gain.value = 1
    // the putter: the engine's note beating a few times a second
    const putter = ac.createOscillator()
    putter.frequency.value = 9
    const depth = ac.createGain()
    depth.gain.value = 0.35
    putter.connect(depth).connect(body.gain)
    for (const [type, mul, level] of [
      ['sawtooth', 1, 0.55],
      ['square', 0.5, 0.35],
    ] as const) {
      const o = ac.createOscillator()
      o.type = type
      o.frequency.value = 42 * mul
      const lv = ac.createGain()
      lv.gain.value = level
      o.connect(lv).connect(tone)
      o.start(now)
      this.engine.push(o)
      this.sources.push(o)
    }
    tone.connect(body).connect(out)
    putter.start(now)
    this.sources.push(putter)
    this.tone = tone
    this.putter = putter
    // the road under the tyres: noise, band-passed, louder with speed
    const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const d = noise.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04
      d[i] = last * 6
    }
    const src = ac.createBufferSource()
    src.buffer = noise
    src.loop = true
    const roadFilter = ac.createBiquadFilter()
    roadFilter.type = 'bandpass'
    roadFilter.frequency.value = 520
    roadFilter.Q.value = 0.7
    const road = ac.createGain()
    road.gain.value = 0
    src.connect(roadFilter).connect(road).connect(out)
    src.start(now)
    this.road = road
    this.roadFilter = roadFilter
    this.sources.push(src)
  }

  /** The car at this speed (m/s) and acceleration, heard from inside the cabin or from outside. */
  drive(v: number, a: number, inside: boolean) {
    const g = this.g
    if (!g || this.stopped || !this.tone) return
    const t = g.ac.currentTime
    // pulling away the note climbs ahead of the speed, and sags as it brakes
    const pitch = 40 + v * 2.4 + Math.max(-6, Math.min(14, a * 3))
    this.engine.forEach((o, i) => o.frequency.setTargetAtTime(pitch * (i === 1 ? 0.5 : 1), t, 0.08))
    this.putter!.frequency.setTargetAtTime(7 + v * 0.55, t, 0.1)
    this.tone.frequency.setTargetAtTime(inside ? 420 + v * 14 : 700 + v * 40, t, 0.06)
    this.road!.gain.setTargetAtTime((inside ? 0.12 : 0.22) * Math.min(1, v / 12), t, 0.1)
    this.roadFilter!.frequency.setTargetAtTime(inside ? 360 : 620, t, 0.1)
  }

  /** Two toots of the horn. */
  horn() {
    const g = this.g
    if (!g || this.stopped || !this.out) return
    const { ac } = g
    const t0 = ac.currentTime + 0.01
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 2400
    f.connect(this.out)
    for (const [start, len] of [
      [0, 0.12],
      [0.2, 0.2],
    ]) {
      const env = ac.createGain()
      const t = t0 + start
      env.gain.setValueAtTime(0.0001, t)
      env.gain.exponentialRampToValueAtTime(0.5, t + 0.012)
      env.gain.setValueAtTime(0.5, t + len - 0.03)
      env.gain.exponentialRampToValueAtTime(0.0001, t + len)
      env.connect(f)
      // a major third, as a little car's horn
      for (const hz of [392, 494]) {
        const o = ac.createOscillator()
        o.type = 'square'
        o.frequency.value = hz
        const lv = ac.createGain()
        lv.gain.value = 0.18
        o.connect(lv).connect(env)
        o.start(t)
        o.stop(t + len + 0.02)
      }
    }
  }

  /** Fades out and lets go of its sounds. */
  stop() {
    const g = this.g
    if (!g || this.stopped || !this.out) return
    this.stopped = true
    const t = g.ac.currentTime
    this.out.gain.cancelScheduledValues(t)
    this.out.gain.setTargetAtTime(0, t, 0.08)
    const end = t + 0.6
    for (const o of this.sources) o.stop(end)
    const out = this.out
    setTimeout(() => out.disconnect(), 800)
  }
}
