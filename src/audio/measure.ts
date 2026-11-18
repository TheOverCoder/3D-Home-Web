// The phone mix, measured (mission 06 c8). A phone's speaker carries little under 500 Hz, so a sound the player causes
// must have its weight where it does: each is rendered offline at full size (an OfflineAudioContext, the same synth as
// the game plays: ./farmSounds.ts, play) and measured: how much of its energy lies in 0.5–4 kHz (a spectrum), its peak
// (it must never lean on the limiter), and its loudness against its family's (LUFS's K-weighting over its loudest fifth
// of a second). `?debug`'s `window.__home.audio.measure()` gives the table; `03-settings` holds every row to it, and
// `SOUND_MEASURE=1` prints it without the checks (as BUDGET_MEASURE does for the drawing budget).
import { makeEngine } from './engine'
import { farmSound, play, type FarmSound, type PlayOpts } from './farmSounds'
import { WORK_GAP } from './palette'
import { PLAYER_SOUNDS, SOUNDS, type SoundFamily } from './sounds'

/** Where a phone's speaker carries (Hz). */
export const PHONE_BAND = [500, 4000] as const
/** The least share of a sound's energy that must lie in that band. */
export const PHONE_SHARE = 0.35
/** The highest a sound may peak, rendered at full size (dBFS): under the limiter's work, never on it. */
export const PEAK_MOST = -1
/** How loud each family is (LUFS over its loudest fifth of a second, rendered at full size, before the volumes): work, a
 *  thing put down and the farm's own even; coins, cues and reward stings a little over them; a "no" soft; a count's tinks
 *  landing (the crystals) quieter still, as they come many in a row after the press's own sound. */
export const MIX_TARGETS: Readonly<Record<SoundFamily, number>> = { work: -36, coins: -31, reward: -30, no: -41, world: -40, cue: -30, ui: -39, landing: -41 }
/** How far from its family's loudness a sound may lie (dB). */
export const MIX_WITHIN = 3
/** How long a sound is rendered for (s): the longest rings out inside it. */
const RENDER_SECONDS = 2.5
const RATE = 48_000
/** A sound "sounds" while it is within this of its peak (dB): how long it lasts is measured there. */
const SOUNDING = -40
/** Its loudness is that of its loudest stretch this long (s): about as long as the ear gathers a short sound over (LUFS's
 *  momentary 400 ms would count a short sound's silence after it). */
const LOUDNESS_WINDOW = 0.2

export interface SoundMeasure {
  kind: FarmSound
  family: SoundFamily
  /** dBFS */
  peak: number
  /** LUFS, K-weighted, its loudest fifth of a second */
  loud: number
  /** the share of its energy in PHONE_BAND */
  band: number
  /** how long it sounds (s) */
  seconds: number
  /** what is wrong with it, in words (none: it carries on a phone, under the peak, at its family's loudness) */
  faults: string[]
}

const dB = (x: number) => 20 * Math.log10(Math.max(x, 1e-9))

/** The share of a signal's energy between `lo` and `hi` Hz: its spectrum (an FFT over the whole of it, zero-padded). */
export function bandShare(x: Float32Array, rate: number, lo: number, hi: number): number {
  let n = 1
  while (n < x.length) n <<= 1
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  re.set(x)
  fft(re, im)
  let all = 0
  let band = 0
  for (let k = 1; k < n / 2; k++) {
    const e = re[k] * re[k] + im[k] * im[k]
    all += e
    const f = (k * rate) / n
    if (f >= lo && f <= hi) band += e
  }
  return all > 0 ? band / all : 0
}

/** In place, radix 2 (n a power of two). */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len
    const wr = Math.cos(a)
    const wi = Math.sin(a)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const p = i + k
        const q = p + len / 2
        const tr = re[q] * cr - im[q] * ci
        const ti = re[q] * ci + im[q] * cr
        re[q] = re[p] - tr
        im[q] = im[p] - ti
        re[p] += tr
        im[p] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

/** ITU-R BS.1770's K-weighting at 48 kHz (a shelf up 4 dB over about 1.5 kHz, as the head hears, then a highpass at
 *  38 Hz): the two biquads' coefficients, b0 b1 b2 a1 a2. */
const K_WEIGHTING = [
  [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
  [1, -2, 1, -1.99004745483398, 0.99007225036621],
] as const

/** A signal through the K-weighting (48 kHz). */
export function kWeighted(x: Float32Array): Float64Array {
  let y = Float64Array.from(x)
  for (const [b0, b1, b2, a1, a2] of K_WEIGHTING) {
    const out = new Float64Array(y.length)
    let x1 = 0
    let x2 = 0
    let y1 = 0
    let y2 = 0
    for (let i = 0; i < y.length; i++) {
      const v = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = y[i]
      y2 = y1
      y1 = v
      out[i] = v
    }
    y = out
  }
  return y
}

/** A rendered signal (48 kHz) measured: its peak (dBFS), its loudness (LUFS of its loudest LOUDNESS_WINDOW, K-weighted),
 *  how long it sounds (from the first to the last moment within SOUNDING of its peak), and its share of energy on a
 *  phone's speaker. */
export function measureSamples(x: Float32Array, rate = RATE) {
  let top = 0
  for (const v of x) top = Math.max(top, Math.abs(v))
  const floor = top * 10 ** (SOUNDING / 20)
  let first = -1
  let last = -1
  for (let i = 0; i < x.length; i++)
    if (top > 0 && Math.abs(x[i]) >= floor) {
      if (first < 0) first = i
      last = i
    }
  // the K-weighted energy so far at each sample, so any stretch's is a difference
  const k = kWeighted(x)
  const sums = new Float64Array(k.length + 1)
  for (let i = 0; i < k.length; i++) sums[i + 1] = sums[i] + k[i] * k[i]
  const w = Math.min(k.length, Math.max(1, Math.round(LOUDNESS_WINDOW * rate)))
  let most = 0
  for (let i = 0; i + w <= k.length; i++) most = Math.max(most, sums[i + w] - sums[i])
  return { peak: dB(top), loud: -0.691 + 10 * Math.log10(Math.max(most / w, 1e-18)), seconds: first < 0 ? 0 : (last - first + 1) / rate, band: bandShare(x, rate, PHONE_BAND[0], PHONE_BAND[1]) }
}

/** What is wrong with a measured sound of `family`, in words (none: it passes). */
export function mixFaults(family: SoundFamily, m: { peak: number; loud: number; band: number }): string[] {
  const out: string[] = []
  if (m.band < PHONE_SHARE) out.push(`only ${Math.round(m.band * 100)} % in ${PHONE_BAND[0]}–${PHONE_BAND[1]} Hz`)
  if (m.peak > PEAK_MOST) out.push(`peaks at ${m.peak.toFixed(1)} dBFS`)
  const off = m.loud - MIX_TARGETS[family]
  if (Math.abs(off) > MIX_WITHIN) out.push(`${off > 0 ? '+' : ''}${off.toFixed(1)} dB off its family's ${MIX_TARGETS[family]} LUFS`)
  return out
}

/** A sound rendered offline at full size, as a press plays it (the first step of its streak, a ding's own note, a thud
 *  at one size): its samples, mono, 48 kHz. Browsers only (Node has no Web Audio). */
export async function renderSound(kind: FarmSound, o: PlayOpts = {}): Promise<Float32Array> {
  const ac = new OfflineAudioContext(1, Math.round(RENDER_SECONDS * RATE), RATE)
  const step = SOUNDS[kind].climb ? 0 : undefined
  play(makeEngine(ac), kind, { at: 0.01, step, ...o })
  const buf = await ac.startRendering()
  return buf.getChannelData(0)
}

/** Each sound measured (every sound the player causes, by default), with what is wrong with it. */
export async function measureSounds(kinds: readonly FarmSound[] = PLAYER_SOUNDS): Promise<SoundMeasure[]> {
  const out: SoundMeasure[] = []
  const r = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d
  for (const kind of kinds) {
    const family = SOUNDS[kind].family
    const m = measureSamples(await renderSound(kind))
    out.push({ kind, family, peak: r(m.peak), loud: r(m.loud), band: r(m.band, 2), seconds: r(m.seconds, 2), faults: mixFaults(family, m) })
  }
  return out
}

/** The order a demo plays the families in. */
const DEMO_ORDER: readonly SoundFamily[] = ['work', 'world', 'coins', 'no', 'ui', 'landing', 'reward', 'cue']

/** For an ear on a phone (`?debug`'s `window.__home.audio.demo()`, after a tap has unlocked the sound): every sound the
 *  player causes, family by family, each with its touch, then a streak of work climbing and one press over six beds.
 *  How long it lasts (s). */
export function demo(): number {
  const kinds = DEMO_ORDER.flatMap((f) => PLAYER_SOUNDS.filter((k) => SOUNDS[k].family === f))
  const steps: [number, () => void][] = kinds.map((k, i) => [i * 1200, () => farmSound(k)])
  let at = kinds.length * 1200 + 600
  for (let i = 0; i < 10; i++, at += 400) steps.push([at, () => farmSound('harvest')])
  steps.push([at + WORK_GAP + 600, () => farmSound('water', 0, 1, undefined, { times: 6 })])
  for (const [ms, f] of steps) setTimeout(f, ms)
  return (at + WORK_GAP + 2000) / 1000
}
