// The mixer: every sound of the game goes into one of three buses, effects (`sfx`: work, coins, the animals, the
// interface, footsteps), ambience (`amb`: the room tone, the open air, birds and crickets) and the music, each with the
// player's own volume (Settings: Effects, Ambience, Music) and a step back for a while (`duck`: a screen, the settings,
// a film; 06c's big stings), all under the main volume and its switch, into a limiter. A duck is the one way a bus is
// made quieter: several at once never fight, the deepest wins, and each lets go on its own. Films, the drive and the
// voices go straight into the main volume. It writes into any context (the live one, or the tests' fake: ./fakeAudio.ts).

export type Bus = 'sfx' | 'amb' | 'music'
export const BUSES: readonly Bus[] = ['sfx', 'amb', 'music']

/** The player's volumes, each 0..1 as the settings keep them, and the sound's switch. */
export interface Levels {
  on: boolean
  main: number
  sfx: number
  amb: number
  music: number
}

/** The main volume at the slider's top: a little under full, for the limiter's headroom. */
export const MAIN_TOP = 0.9
/** How fast a volume follows its slider (s: a time constant). */
const FOLLOW = 0.06
/** How fast a bus steps back and comes again, unless asked otherwise (s: a time constant). */
export const DUCK_TC = 0.4
/** How far a screen, the settings or a film steps the room tone back (dB: the 0.45 it always was). */
export const SCREEN_DUCK = -7

/** A slider's place as a level: a number 0..1 (anything else is full). */
export const unit = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 1)
/** How loud a slider's place is: its square, so the slider feels even from 0 to 100 %. */
export const curve = (x: number) => unit(x) ** 2
/** A step back in dB as a gain (−6 dB is about a half). */
export const gainOf = (dB: number) => 10 ** (dB / 20)

interface Duck {
  bus: Bus
  dB: number
  /** audio time it lets go (Infinity: held until let go by its key) */
  until: number
  tc: number
  key?: string
}

export interface Mixer {
  ac: BaseAudioContext
  /** the main volume and the switch, into the limiter */
  master: GainNode
  /** where each bus's sounds go in */
  input: Record<Bus, GainNode>
  /** each bus's volume from the settings */
  user: Record<Bus, GainNode>
  /** each bus stepped back for a while */
  ducker: Record<Bus, GainNode>
  levels: Levels
  ducks: Duck[]
}

const busesOf = (bus: Bus | 'all') => (bus === 'all' ? BUSES : [bus])

/** The buses on `ac`, silent until `setLevels`: each bus's input → its volume → its step back → the main volume → a
 *  limiter → `dest`. */
export function createMixer(ac: BaseAudioContext, dest: AudioNode = ac.destination): Mixer {
  const limiter = ac.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.knee.value = 8
  limiter.ratio.value = 6
  limiter.attack.value = 0.003
  limiter.release.value = 0.2
  limiter.connect(dest)
  const master = ac.createGain()
  master.gain.value = 0
  master.connect(limiter)
  const make = () => Object.fromEntries(BUSES.map((b) => [b, ac.createGain()])) as Record<Bus, GainNode>
  const m: Mixer = { ac, master, input: make(), user: make(), ducker: make(), levels: { on: false, main: 0, sfx: 1, amb: 1, music: 1 }, ducks: [] }
  for (const b of BUSES) m.input[b].connect(m.user[b]).connect(m.ducker[b]).connect(master)
  return m
}

function follow(p: AudioParam, v: number, now: number, tc = FOLLOW) {
  p.cancelScheduledValues(now)
  p.setTargetAtTime(v, now, tc)
}

/** The player's volumes on the curve: the main one (none while sound is off), and each bus's under it. */
export function setLevels(m: Mixer, l: Levels) {
  m.levels = { ...l }
  const now = m.ac.currentTime
  follow(m.master.gain, l.on ? curve(l.main) * MAIN_TOP : 0, now)
  for (const b of BUSES) follow(m.user[b].gain, curve(l[b]), now)
}

/** How far `bus` is stepped back at audio time `t` (dB; 0 for not at all): the deepest step back on then. */
export function depthAt(m: Mixer, bus: Bus, t: number): number {
  return Math.min(0, ...m.ducks.filter((d) => d.bus === bus && d.until > t).map((d) => d.dB))
}

/** The bus's step back written on the audio clock from now: to the deepest duck on, then at each one's end to the
 *  deepest left, each change at the speed of the duck that made it. */
function schedule(m: Mixer, bus: Bus, tc: number) {
  const now = m.ac.currentTime
  m.ducks = m.ducks.filter((d) => d.until > now)
  const mine = m.ducks.filter((d) => d.bus === bus)
  const p = m.ducker[bus].gain
  let last = depthAt(m, bus, now)
  follow(p, gainOf(last), now, tc)
  for (const end of [...new Set(mine.map((d) => d.until).filter(Number.isFinite))].sort((a, b) => a - b)) {
    const dB = depthAt(m, bus, end)
    if (dB === last) continue
    p.setTargetAtTime(gainOf(dB), end, mine.find((d) => d.until === end)?.tc ?? DUCK_TC)
    last = dB
  }
}

/** Steps `bus` (or all three) back by `dB` for `holdMs`, then lets it come again (`tc`: how fast, a time constant). */
export function duckOn(m: Mixer, bus: Bus | 'all', dB: number, holdMs: number, tc = DUCK_TC) {
  const until = m.ac.currentTime + Math.max(0, holdMs) / 1000
  for (const b of busesOf(bus)) {
    m.ducks.push({ bus: b, dB: Math.min(0, dB), until, tc })
    schedule(m, b, tc)
  }
}

/** A step back held under `key` (a screen open, a film playing) until the same key lets it go (`dB` null). */
export function holdOn(m: Mixer, key: string, bus: Bus | 'all', dB: number | null, tc = DUCK_TC) {
  const touched = new Set<Bus>([...m.ducks.filter((d) => d.key === key).map((d) => d.bus), ...busesOf(bus)])
  m.ducks = m.ducks.filter((d) => d.key !== key)
  if (dB !== null) for (const b of busesOf(bus)) m.ducks.push({ bus: b, dB: Math.min(0, dB), until: Infinity, tc, key })
  for (const b of touched) schedule(m, b, tc)
}

/** Each bus as it stands now: its volume (the slider's place), its gain on the curve, and how far it is stepped back. */
export function busesNow(m: Mixer): Record<Bus, { volume: number; gain: number; duck: number }> {
  const now = m.ac.currentTime
  return Object.fromEntries(BUSES.map((b) => [b, { volume: unit(m.levels[b]), gain: curve(m.levels[b]), duck: depthAt(m, b, now) }])) as Record<Bus, { volume: number; gain: number; duck: number }>
}

// ─────────────────────── the live mixer ───────────────────────

let live: Mixer | null = null
/** The steps back held now, kept from before the live mixer is made (a screen open before the first sound). */
const held = new Map<string, { bus: Bus | 'all'; dB: number; tc: number }>()

/** The mixer the game's sound plays through (./engine.ts makes it on the first gesture). */
export function setLiveMixer(m: Mixer | null) {
  live = m
  if (m) for (const [key, h] of held) holdOn(m, key, h.bus, h.dB, h.tc)
}

/** Steps a bus (or all three) back by `dB` for `holdMs` and lets it come again: the one way a bus is made quieter for a
 *  while (06c's big stings: −6 dB). Nothing before the first gesture (nothing is playing). */
export function duck(bus: Bus | 'all', dB: number, holdMs: number, tc = DUCK_TC) {
  if (live) duckOn(live, bus, dB, holdMs, tc)
}

/** A step back held under `key` while something has the player's attention (a screen, the settings, a film), until the
 *  same key lets it go (`dB` null). Each holder its own: one letting go never lifts another's. */
export function hold(key: string, bus: Bus | 'all', dB: number | null, tc = DUCK_TC) {
  if (dB === null) held.delete(key)
  else held.set(key, { bus, dB, tc })
  if (live) holdOn(live, key, bus, dB, tc)
}
