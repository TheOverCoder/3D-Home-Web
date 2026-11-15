import type { Mood, Timeline } from './format'

// The characters' voices: each line "read aloud" in the way game characters talk (Animal Crossing, Banjo-Kazooie,
// Reigns): not words, a babble made from the line's own text, so it has its rhythm — one sound for each syllable, a
// hiss for an s, a click for a t, a pause at a comma, a rise at a question mark — in a voice of the character's own.
// Nothing is recorded: the babble is a buzz shaped into vowels by three formant filters (./score.ts, `speak`).
//
// A voice is a few numbers (`Voice`). The game's fixed characters have theirs (`VOICES`), anyone else gets one from their
// look (a woman's is higher, a tall man's deeper), and a film may tune any of them in its cast (`Member.voice`). The same
// line in the same voice always sounds the same (the babble's dice are the line's own letters), so a film never needs
// recording again when a line changes: the text is the script and the voice.
//
// Pure: `utter` turns a line into syllables on a clock; `level` and `wordsBy` say how loud the voice is and how many
// words have been said at a moment, for the speaker's nods and the bubble's words.

/** How someone sounds. */
export interface Voice {
  /** the voice's middle pitch, Hz: a man about 110, a woman about 210 */
  pitch: number
  /** syllables a second */
  speed: number
  /** how big the head it comes out of is: the vowels' resonances are divided by it (a man 1, a woman 0.85, a big man 1.15) */
  size: number
  /** soft and round (0) to bright and buzzy, nasal (1) */
  bright: number
  /** breath and rasp in it, 0..1 */
  rasp?: number
  /** how far it swings up and down: flat (0) to sing-song (1) */
  swing?: number
}

/** The game's fixed characters: the same voice in every film. */
export const VOICES: Record<'manager' | 'contractor', Voice> = {
  /** a salesman: quick, a little high and nasal, up and down */
  manager: { pitch: 128, speed: 7.4, size: 0.97, bright: 0.85, rasp: 0.04, swing: 0.9 },
  /** a big man of few words: slow, deep, a rough edge */
  contractor: { pitch: 84, speed: 4.6, size: 1.16, bright: 0.38, rasp: 0.32, swing: 0.3 },
}

/** A voice for someone with none of their own, from their look: a woman's higher and smaller, a tall one's deeper. */
export function voiceOfLook(look: { sex?: 'f' | 'm'; height?: number }): Voice {
  const h = look.height ?? 1
  const f = look.sex === 'f'
  return { pitch: (f ? 205 : 112) / h ** 1.5, speed: 5.8, size: (f ? 0.86 : 1) * h, bright: f ? 0.6 : 0.5, rasp: 0.05, swing: f ? 0.7 : 0.5 }
}

/** How a mood changes the way a line is said: slower or quicker, higher or lower, more or less up and down. */
const DELIVERY: Record<Mood, { speed: number; pitch: number; swing: number; gain: number; glide: number }> = {
  flat: { speed: 1, pitch: 1, swing: 1, gain: 1, glide: 0.97 },
  // each stressed syllable sneers down
  smug: { speed: 0.9, pitch: 1.04, swing: 1.35, gain: 1, glide: 0.86 },
  shock: { speed: 1.15, pitch: 1.3, swing: 1.2, gain: 1.15, glide: 1.04 },
  warm: { speed: 0.9, pitch: 0.97, swing: 0.8, gain: 0.85, glide: 0.95 },
  sad: { speed: 0.8, pitch: 0.88, swing: 0.6, gain: 0.8, glide: 0.9 },
  // the last laugh: low, slow, level
  cool: { speed: 0.8, pitch: 0.9, swing: 0.25, gain: 0.95, glide: 0.96 },
}

/** Three resonances of the mouth (Hz, a man's), a vowel's colour. */
export type Formants = [number, number, number]

/** A noise of the lips, the tongue or the teeth: when, how long, its colour (a band of noise) and how loud. */
export interface Burst {
  t: number
  len: number
  f: number
  q: number
  gain: number
}

/** One syllable on the line's clock (seconds from the line's start). */
export interface Syllable {
  /** its slot */
  t: number
  len: number
  /** the vowel, inside the slot */
  v0: number
  v1: number
  /** the vowel's resonances at its start and its end (a diphthong glides), and where a glide (l, r, w, y) comes from */
  f: Formants
  g: Formants
  from?: Formants
  /** the pitch at the vowel's start and its end, Hz */
  p0: number
  p1: number
  gain: number
  /** consonants: noise before and after the vowel, a hum through the nose (m, n) */
  bursts: Burst[]
  hums: [number, number][]
  /** the word of the line (as written) it belongs to */
  word: number
}

export interface Utterance {
  syllables: Syllable[]
  /** seconds, to the last sound */
  length: number
  /** each written word's first sound (seconds from the line's start) */
  words: number[]
  /** how much quicker than the voice's own pace it is said, to fit its time (1: its own pace) */
  squeeze: number
}

// ───────────────────────────── reading the text ─────────────────────────────

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
// (spelt as they are said: "ninety" is two syllables)
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninty']

/** A number as it is said: 1,498 "fourteen ninety eight" (as money is counted), 1,500 "fifteen hundred". */
export function numberWords(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '')
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred` + (n % 100 ? ` ${numberWords(n % 100)}` : '')
  if (n < 10000 && n % 1000 !== 0) {
    const hi = Math.floor(n / 100)
    const lo = n % 100
    return `${numberWords(hi)} ` + (lo === 0 ? 'hundred' : lo < 10 ? `oh ${ONES[lo]}` : numberWords(lo))
  }
  if (n < 1_000_000) return `${numberWords(Math.floor(n / 1000))} thousand` + (n % 1000 ? ` ${numberWords(n % 1000)}` : '')
  return String(n)
    .split('')
    .map((d) => ONES[Number(d)])
    .join(' ')
}

type Stop = ',' | '.' | '?' | '!' | '…' | ''

interface Said {
  /** the written word it is part of */
  word: number
  letters: string
  /** the punctuation after it, if it ends a phrase */
  stop: Stop
  /** a pause before it (a line opening on "…") */
  lead: number
}

/** The line's words as said: numbers in words, punctuation kept where a phrase ends. */
function words(text: string): { said: Said[]; written: number } {
  const written = text.split(/\s+/).filter(Boolean)
  const said: Said[] = []
  written.forEach((w, i) => {
    const lead = /^(…|\.\.\.)/.test(w) ? 0.12 : 0
    const end = w.match(/(…|\.\.\.|[,.?!])+$/)?.[0] ?? ''
    const stop: Stop = /…|\.\.\./.test(end) ? '…' : end.includes('?') ? '?' : end.includes('!') ? '!' : end.includes('.') ? '.' : end.includes(',') ? ',' : ''
    const spoken = w
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/\d[\d,]*/g, (d) => ` ${numberWords(Number(d.replace(/,/g, '')))} `)
      .replace(/%/g, ' percent ')
      .replace(/&/g, ' and ')
      .split(/[^a-z]+/)
      .filter(Boolean)
    spoken.forEach((letters, k) => said.push({ word: i, letters, stop: k === spoken.length - 1 ? stop : '', lead: k === 0 ? lead : 0 }))
  })
  return { said, written: written.length }
}

const VOWEL = 'aeiou'
/** A vowel letter here: a, e, i, o, u, and a y that is not a consonant (yes, beyond), as in "my", "happy", "buy". */
const isVowel = (w: string, i: number) => VOWEL.includes(w[i]) || (w[i] === 'y' && i > 0 && (!VOWEL.includes(w[i - 1]) || !VOWEL.includes(w[i + 1] ?? '')))

interface Part {
  onset: string
  nucleus: string
  coda: string
  /** a long vowel by a silent e (made, time, home) */
  magic: boolean
}

/** A word cut into syllables, near enough: a run of vowels is a syllable, the consonants between two go one each way. */
export function syllablesOf(w: string): Part[] {
  const groups: [number, number][] = []
  for (let i = 0; i < w.length;) {
    if (isVowel(w, i)) {
      let j = i
      while (j < w.length && isVowel(w, j)) j++
      groups.push([i, j])
      i = j
    } else i++
  }
  // a silent e at the end makes the vowel before it long (but "table" keeps its "le")
  let magic = false
  const last = groups[groups.length - 1]
  if (groups.length > 1 && last[0] === w.length - 1 && w[last[0]] === 'e' && !(w[last[0] - 1] === 'l' && !isVowel(w, last[0] - 2))) {
    groups.pop()
    magic = true
  }
  if (!groups.length) return [{ onset: w, nucleus: '', coda: '', magic: false }]
  const parts: Part[] = []
  groups.forEach(([s, e], k) => {
    const before = w.slice(k ? groups[k - 1][1] : 0, s)
    let onset = before
    if (k > 0 && before.length > 1) {
      const pair = /(th|sh|ch|ph|wh|ck|qu)$/.test(before) ? 2 : 1
      onset = before.slice(-pair)
      parts[k - 1].coda += before.slice(0, -pair)
    } else if (k > 0) onset = before
    parts.push({ onset, nucleus: w.slice(s, e), coda: '', magic: false })
  })
  const end = groups[groups.length - 1][1]
  const tail = parts[parts.length - 1]
  tail.coda += w.slice(end, magic ? -1 : undefined)
  tail.magic = magic
  return parts
}

// a man's vowels (after Hillenbrand et al. 1995): the mouth's first three resonances
const V: Record<string, Formants> = {
  i: [300, 2300, 3000],
  ih: [420, 2000, 2650],
  eh: [560, 1800, 2600],
  ae: [670, 1750, 2550],
  ah: [760, 1300, 2500],
  aw: [620, 1000, 2500],
  oh: [500, 950, 2450],
  uh: [620, 1200, 2550],
  oo: [460, 1100, 2400],
  u: [340, 950, 2350],
  er: [480, 1350, 1700],
}
/** A vowel, and where it glides to (a diphthong). */
type Vowel = [string, string]

function vowelOf(p: Part, one: boolean): Vowel {
  const n = p.nucleus
  const r = p.coda.startsWith('r')
  if (p.magic) return ({ a: ['eh', 'i'], e: ['i', 'i'], i: ['ah', 'i'], o: ['oh', 'oo'], u: ['u', 'u'], y: ['ah', 'i'] } as Record<string, Vowel>)[n[n.length - 1]] ?? ['uh', 'uh']
  const two: Record<string, Vowel> = {
    ee: ['i', 'i'],
    ea: ['i', 'i'],
    ie: ['i', 'i'],
    oo: ['u', 'u'],
    ou: ['ah', 'oo'],
    ow: ['ah', 'oo'],
    oi: ['aw', 'i'],
    oy: ['aw', 'i'],
    ai: ['eh', 'i'],
    ay: ['eh', 'i'],
    ei: ['eh', 'i'],
    ey: ['eh', 'i'],
    au: ['aw', 'aw'],
    aw: ['aw', 'aw'],
    oa: ['oh', 'oo'],
    ue: ['u', 'u'],
    ew: ['u', 'u'],
    ui: ['u', 'u'],
    uy: ['ah', 'i'],
  }
  if (two[n.slice(0, 2)]) return two[n.slice(0, 2)]
  const c = n[0]
  if (r && c !== 'a' && c !== 'o') return ['er', 'er']
  if (c === 'a') return r ? ['ah', 'ah'] : !p.coda && !one ? ['uh', 'uh'] : ['ae', 'ae']
  if (c === 'e') return one && !p.coda ? ['i', 'i'] : ['eh', 'eh']
  // "I", and I'll, I'm, I'd
  if (c === 'i') return one && !p.onset && /^(|ll|m|d)$/.test(p.coda) ? ['ah', 'i'] : ['ih', 'ih']
  if (c === 'o') return !p.coda ? ['oh', 'oo'] : r ? ['aw', 'aw'] : ['ah', 'ah']
  if (c === 'u') return ['uh', 'uh']
  if (c === 'y') return one ? ['ah', 'i'] : ['i', 'i']
  return ['uh', 'uh']
}

/** What a consonant cluster sounds like: a burst of noise (its band, loudness, length), a hum, or a glide into the vowel. */
interface Sound {
  noise?: { f: number; q: number; gain: number; len: number }
  hum?: number
  glide?: Formants
  /** a voiced consonant starts the vowel a little lower */
  dip?: boolean
}

function soundOf(c: string, next: string): Sound {
  if (!c) return {}
  if (/sh|ch|j|tch|ge$/.test(c)) return { noise: { f: 2900, q: 2.5, gain: 0.22, len: 0.065 } }
  if (/s|z|x/.test(c) || (c.endsWith('c') && /^[eiy]/.test(next))) return { noise: { f: c.includes('z') ? 5000 : 5800, q: 2, gain: 0.2, len: 0.065 } }
  if (/th|f|v|ph/.test(c)) return { noise: { f: 3800, q: 0.8, gain: 0.1, len: 0.045 } }
  if (/t/.test(c)) return { noise: { f: 4200, q: 1.2, gain: 0.32, len: 0.03 } }
  if (/[kcq]/.test(c)) return { noise: { f: 2200, q: 1.2, gain: 0.32, len: 0.03 } }
  if (/p/.test(c)) return { noise: { f: 900, q: 1.2, gain: 0.3, len: 0.028 } }
  if (/b/.test(c)) return { noise: { f: 600, q: 1, gain: 0.16, len: 0.018 }, dip: true }
  if (/d/.test(c)) return { noise: { f: 3000, q: 1, gain: 0.16, len: 0.018 }, dip: true }
  if (/g/.test(c)) return { noise: { f: 1800, q: 1, gain: 0.16, len: 0.018 }, dip: true }
  if (/[mn]/.test(c)) return { hum: 0.045 }
  if (/w/.test(c)) return { glide: [300, 700, 2300] }
  if (/r/.test(c)) return { glide: [350, 1100, 1600] }
  if (/l/.test(c)) return { glide: [380, 1000, 2600] }
  if (/y/.test(c)) return { glide: [280, 2250, 3000] }
  if (/h/.test(c)) return { noise: { f: 1500, q: 0.5, gain: 0.08, len: 0.045 } }
  return {}
}

/** The babble's dice: the same text gives the same numbers. */
function dice(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const PAUSE: Record<Stop, number> = { '': 0.025, ',': 0.17, '.': 0.3, '?': 0.3, '!': 0.28, '…': 0.36 }

/** A line said in a voice and a mood: its syllables on a clock from 0. `fit`: seconds it must be said in (it is said
 *  quicker to fit, never slower). */
export function utter(text: string, voice: Voice, mood: Mood = 'flat', fit = Infinity): Utterance {
  const d = DELIVERY[mood]
  const roll = dice(text)
  const swing = (voice.swing ?? 0.5) * d.swing
  const beat = 1 / (voice.speed * d.speed)
  const pitch = voice.pitch * d.pitch
  const { said } = words(text)
  // the phrases (up to a comma, a stop or the end), for the pitch to fall across each
  const out: Syllable[] = []
  const wordStart = new Map<number, number>()
  let t = 0
  let phrase: Syllable[] = []
  const endPhrase = (stop: Stop) => {
    phrase.forEach((s, j) => {
      const k = phrase.length > 1 ? j / (phrase.length - 1) : 0
      s.p0 *= 1.06 - 0.12 * k
      s.p1 *= 1.06 - 0.12 * k
    })
    const last = phrase[phrase.length - 1]
    if (last) {
      if (stop === '?') last.p1 = last.p0 * 1.45
      else if (stop === '!') last.p1 = last.p0 * 0.8
      else if (stop === '.') last.p1 = last.p0 * 0.84
      else if (stop === ',') last.p1 = last.p0 * 1.05
      else if (stop === '…') {
        last.p1 = last.p0 * 0.88
        last.gain *= 0.8
      }
    }
    phrase = []
  }
  for (const w of said) {
    t += w.lead
    const parts = syllablesOf(w.letters)
    const one = parts.length === 1
    parts.forEach((p, k) => {
      const [a, b] = vowelOf(p, one)
      const final = k === parts.length - 1 && w.stop !== ''
      const long = a !== b || p.magic || p.nucleus.length > 1
      const len = beat * (long ? 1.15 : 0.92) * (final ? 1.4 : 1) * (one && w.letters.length > 3 ? 1.08 : 1)
      const on = soundOf(p.onset, p.nucleus)
      const off = soundOf(p.coda, '')
      // the consonants take what they need, the vowel at least half the slot
      let lead = (on.noise?.len ?? 0) + (on.hum ?? 0)
      let tail = (off.noise?.len ?? 0) + (off.hum ?? 0)
      const room = len * 0.5
      if (lead + tail > room) {
        const k2 = room / (lead + tail)
        lead *= k2
        tail *= k2
      }
      const stressed = (k === 0 && (!one || w.letters.length > 3)) || (one && w.letters.length > 3)
      const lift = (stressed ? 1 + 0.12 * swing : 1) * (1 + (roll() - 0.5) * (0.04 + 0.08 * swing))
      const p0 = pitch * lift * (on.dip ? 0.93 : 1)
      const s: Syllable = {
        t,
        len,
        v0: t + lead,
        v1: t + len - tail,
        f: V[a],
        g: V[b],
        from: on.glide,
        p0,
        p1: p0 * (stressed ? d.glide : 0.98),
        gain: (stressed ? 1 : 0.82) * d.gain,
        bursts: [],
        hums: [],
        word: w.word,
      }
      if (on.noise) s.bursts.push({ t, len: Math.min(on.noise.len, lead), f: on.noise.f, q: on.noise.q, gain: on.noise.gain })
      if (on.hum) s.hums.push([t, s.v0 + 0.01])
      if (off.noise) s.bursts.push({ t: s.v1, len: Math.min(off.noise.len, tail), f: off.noise.f, q: off.noise.q, gain: off.noise.gain * 0.85 })
      if (off.hum) s.hums.push([s.v1 - 0.01, s.v1 + tail])
      if (!wordStart.has(w.word)) wordStart.set(w.word, t)
      out.push(s)
      phrase.push(s)
      t += len
    })
    t += PAUSE[w.stop]
    if (w.stop) endPhrase(w.stop)
  }
  endPhrase('')
  let length = out.length ? out[out.length - 1].t + out[out.length - 1].len : 0
  let squeeze = 1
  // quicker to fit the time it has
  if (length > fit && fit > 0) {
    const k = fit / length
    squeeze = 1 / k
    for (const s of out) {
      s.t *= k
      s.len *= k
      s.v0 *= k
      s.v1 *= k
      for (const b of s.bursts) {
        b.t *= k
        b.len *= k
      }
      s.hums = s.hums.map(([a, b]) => [a * k, b * k])
    }
    for (const [w, x] of wordStart) wordStart.set(w, x * k)
    length = fit
  }
  const { written } = words(text)
  const starts: number[] = []
  for (let i = 0; i < written; i++) starts.push(wordStart.get(i) ?? (i ? starts[i - 1] : 0))
  return { syllables: out, length, words: starts, squeeze }
}

/** How loud the voice is at x seconds into the line, 0..1 (the vowels: the speaker's head nods with them). */
export function level(u: Utterance, x: number): number {
  for (const s of u.syllables) if (x >= s.v0 && x < s.v1) return s.gain * Math.sin((Math.PI * (x - s.v0)) / (s.v1 - s.v0))
  return 0
}

/** How many of the line's written words have begun to be said at x seconds into it. */
export const wordsBy = (u: Utterance, x: number) => u.words.filter((w) => w <= x + 0.02).length

// ───────────────────────────── a film's speech ─────────────────────────────

/** Something said aloud in a film: a line (its bubble on screen) or a sound of someone's with no bubble (a gasp). */
export interface Speech {
  /** film seconds */
  t: number
  who: string
  u: Utterance
  /** its line in the timeline's lines, or null for one with no bubble */
  line: number | null
}

/** Everything said in a film, in the cast's voices: each line said within the time its bubble is up. */
export function speechOf(tl: Timeline, voices: Record<string, Voice>): Speech[] {
  const out: Speech[] = []
  tl.lines.forEach((l, i) => {
    const v = voices[l.item.who]
    if (v) out.push({ t: l.t, who: l.item.who, u: utter(l.item.text, v, l.item.mood, l.end - l.t - 0.2), line: i })
  })
  for (const c of tl.cues) {
    const v = c.item.voice ? voices[c.item.voice] : undefined
    if (v && c.item.text) out.push({ t: c.t, who: c.item.voice!, u: utter(c.item.text, v, c.item.mood, 2.5), line: null })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** What the voices break of FILM.md's rules: a line said much quicker than its speaker talks, to fit its bubble's time. */
export const lintSpeech = (speech: Speech[]) =>
  speech.filter((s) => s.u.squeeze > 1.35).map((s) => `${s.who} says a line ${s.u.squeeze.toFixed(1)}× quicker than they talk, to fit its bubble: give it more time`)

/** Who is speaking at film time t, and how loud: a speech of theirs under way. */
export function speakingAt(speech: Speech[], who: string, t: number): number | null {
  let on: number | null = null
  for (const s of speech) if (s.who === who && t >= s.t && t < s.t + s.u.length + 0.05) on = level(s.u, t - s.t)
  return on
}
