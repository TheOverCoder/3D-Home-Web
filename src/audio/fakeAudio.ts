// A recording stand-in for the Web Audio API, for the unit tests (Node has none). The sounds write into it as into a
// real context (./engine.ts, makeEngine): it keeps every node made, what each is connected to and every value its
// parameters are given and when, so a test can read what a sound plays (its notes, how loud) and what a bus's gain is
// at any moment, as a browser would compute it. Only what the game's sound uses is here. Not part of the game.

type Event = { kind: 'set' | 'linear' | 'exp' | 'target'; v: number; t: number; tc: number }

export class FakeParam {
  events: Event[] = []
  constructor(public value: number) {}
  private add(kind: Event['kind'], v: number, t: number, tc = 0) {
    this.events.push({ kind, v, t, tc })
    return this
  }
  setValueAtTime = (v: number, t: number) => this.add('set', v, t)
  linearRampToValueAtTime = (v: number, t: number) => this.add('linear', v, t)
  exponentialRampToValueAtTime = (v: number, t: number) => this.add('exp', v, t)
  setTargetAtTime = (v: number, t: number, tc: number) => this.add('target', v, t, tc)
  cancelScheduledValues = (t: number) => {
    this.events = this.events.filter((e) => e.t < t)
    return this
  }
  /** Its value at audio time `t`: the events up to then, in time order (a ramp from the event before it). */
  at(t: number): number {
    let curve: (x: number) => number = () => this.value
    let from = 0
    for (const e of [...this.events].sort((a, b) => a.t - b.t)) {
      if (e.kind === 'linear' || e.kind === 'exp') {
        const start = curve(from)
        if (t < e.t) {
          const k = Math.max(0, (t - from) / (e.t - from || 1e-9))
          return e.kind === 'linear' ? start + (e.v - start) * k : start * (e.v / start) ** k
        }
      } else if (e.t > t) break
      const v0 = curve(e.t)
      curve = e.kind === 'target' ? (x) => e.v + (v0 - e.v) * Math.exp(-(x - e.t) / e.tc) : () => e.v
      from = e.t
    }
    return curve(t)
  }
  /** The highest value it is ever given (its plain value when it is given none). */
  get peak(): number {
    return this.events.length ? Math.max(...this.events.map((e) => e.v)) : this.value
  }
}

export class FakeNode {
  readonly to: unknown[] = []
  constructor(
    readonly ctx: FakeContext,
    readonly kind: string,
  ) {
    ctx.nodes.push(this)
  }
  connect<T>(dest: T): T {
    this.to.push(dest)
    return dest
  }
  disconnect() {
    this.to.length = 0
  }
}

class Scheduled extends FakeNode {
  starts: number[] = []
  stops: number[] = []
  start(t = 0) {
    this.starts.push(t)
  }
  stop(t = 0) {
    this.stops.push(t)
  }
}

export class FakeOscillator extends Scheduled {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeParam(440)
  readonly detune = new FakeParam(0)
}

export class FakeContext {
  readonly nodes: FakeNode[] = []
  readonly destination = new FakeNode(this, 'destination')
  currentTime = 0
  sampleRate = 8000
  state: AudioContextState = 'running'
  private node<T extends FakeNode>(n: T, params: Record<string, number> = {}): T {
    for (const [k, v] of Object.entries(params)) Object.assign(n, { [k]: new FakeParam(v) })
    return n
  }
  createGain = () => this.node(new FakeNode(this, 'gain'), { gain: 1 }) as FakeNode & { gain: FakeParam }
  createOscillator = () => this.node(new FakeOscillator(this, 'oscillator'))
  createBiquadFilter = () => this.node(Object.assign(new FakeNode(this, 'filter'), { type: 'lowpass' }), { frequency: 350, Q: 1, gain: 0 })
  createBufferSource = () => this.node(Object.assign(new Scheduled(this, 'source'), { buffer: null, loop: false }), { playbackRate: 1 })
  createStereoPanner = () => this.node(new FakeNode(this, 'panner'), { pan: 0 })
  createDelay = () => this.node(new FakeNode(this, 'delay'), { delayTime: 0 })
  createDynamicsCompressor = () => this.node(new FakeNode(this, 'compressor'), { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 })
  createBuffer = (channels: number, length: number, sampleRate: number) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (c: number) => data[c] }
  }
  resume = async () => void (this.state = 'running')
  suspend = async () => void (this.state = 'suspended')
  /** As the sounds take it. */
  get audio(): BaseAudioContext {
    return this as unknown as BaseAudioContext
  }
  /** Every oscillator made since `from` (an index into `nodes`). */
  oscillators(from = 0): FakeOscillator[] {
    return this.nodes.slice(from).filter((n): n is FakeOscillator => n instanceof FakeOscillator)
  }
}

/** A note an oscillator played: when, at what frequency (and the one it glides to), and how loud at its loudest (its
 *  envelope: the gain it goes straight into). */
export interface PlayedNote {
  t: number
  f: number
  f1: number | null
  gain: number
}

export function notesOf(ctx: FakeContext, from = 0): PlayedNote[] {
  return ctx.oscillators(from).map((o) => {
    const f = o.frequency.events.filter((e) => e.kind === 'set')
    const ramp = o.frequency.events.find((e) => e.kind !== 'set')
    const g = o.to[0] as { gain?: FakeParam } | undefined
    return { t: o.starts[0] ?? 0, f: f[0]?.v ?? o.frequency.value, f1: ramp?.v ?? null, gain: g?.gain?.peak ?? 1 }
  })
}

/** Every frequency a filter was set to since `from` (a noise burst's colour). */
export function filtersOf(ctx: FakeContext, from = 0): number[] {
  return ctx.nodes
    .slice(from)
    .filter((n) => n.kind === 'filter')
    .flatMap((n) => (n as unknown as { frequency: FakeParam }).frequency.events.map((e) => e.v))
}
