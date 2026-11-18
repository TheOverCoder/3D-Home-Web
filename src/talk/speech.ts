import { audioStatus } from '../audio/sound'
import { talkerOf } from '../data/people'
import { useStory } from '../film/films'
import { primeSpeech } from '../film/prime'
import { voiceFit } from '../film/speak'
import { useFilm } from '../film/state'
import { readingOf, voiceOfLook, type Voice } from '../film/voice'
import { playerState } from '../lib/playerState'
import { useSettings } from '../settings'
import { useHome } from '../store'
import { TALK, voiceMood, type Line, type TalkMoment } from './lines'
import { freshMemory, mayTalk, nextLine, type TalkWorld } from './rules'

// The game's characters talking (./lines.ts) in the device's own speech voices — the Web Speech API's
// speechSynthesis, as the films' lines are read (src/film/speak.ts): on every phone and computer, nothing downloaded
// or recorded. Each character keeps one voice of their own (the game's people, src/data/people.ts, the best ones for a
// man or a woman, one each; each buyer one by their number) at their own pitch and pace, as loud as the game's sounds,
// read in the mood of the line's face (./lines.ts, voiceMood). When a line may be said is
// ./rules.ts; this gives it the game as it is (where you stand, the map, a film or the drive, the sound settings).
// Silent where there is no English voice; a phone speaks only once a touch has made it (the first touch primes it).

/** Who says a line: a key of their own (each keeps one voice), a man's or a woman's voice, how they sound, and whether
 *  they are one of the game's fixed characters (they get the best voices, one each). */
export interface Talker {
  key: string
  female: boolean
  voice: Voice
  fixed?: boolean
}

/** The estate agent and the man on the tractor, as the people table voices them (src/data/people.ts). */
export const AGENT: Talker = talkerOf('agent')!
export const DRIVER: Talker = talkerOf('driver')!
/** A buyer: their voice from their look (a woman's higher, a tall one's deeper: src/film/voice.ts, voiceOfLook). */
export const buyerTalker = (v: { id: number; look: { sex?: 'f' | 'm'; height?: number } }): Talker => ({ key: `buyer-${v.id}`, female: v.look.sex === 'f', voice: voiceOfLook(v.look) })

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined' ? window.speechSynthesis : null)

/** The device's English voices, each character's (kept), what has been said, and the line of ours being said. */
let voices: SpeechSynthesisVoice[] = []
let listening = false
const chosen = new Map<string, SpeechSynthesisVoice | null>()
const memory = freshMemory()
let ours: SpeechSynthesisUtterance | null = null
/** The lines said (for ?debug and the tests): the moment, who, the words, when. */
export const heard: { moment: TalkMoment; who: string; text: string; at: number }[] = []

function loadVoices() {
  const s = synth()
  if (!s) return
  voices = s.getVoices().filter((v) => voiceFit(v, false) < Infinity || voiceFit(v, true) < Infinity)
  chosen.clear()
}

function listen() {
  if (listening) return
  listening = true
  const s = synth()
  if (!s) return
  loadVoices()
  s.addEventListener?.('voiceschanged', loadVoices)
}

/** The keys of the fixed characters heard so far: each takes the best voice no other of them has. */
const fixedKeys = new Set<string>()

/** A number for a key (the same every time). */
function hash(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A character's own voice, chosen once: a fixed character the best not taken by another, a buyer one of the voices
 *  that suit them by their number (with too few, buyers share one, each at their own pitch). */
function voiceOf(t: Talker): SpeechSynthesisVoice | null {
  const kept = chosen.get(t.key)
  if (kept !== undefined) return kept
  const ranked = voices.filter((v) => voiceFit(v, t.female) < Infinity).sort((a, b) => voiceFit(a, t.female) - voiceFit(b, t.female))
  const theirs = ranked.filter((v) => voiceFit(v, t.female) < 200)
  const pool = theirs.length ? theirs : ranked
  let v: SpeechSynthesisVoice | null
  if (t.fixed) {
    fixedKeys.add(t.key)
    const taken = new Set([...chosen.entries()].filter(([k]) => fixedKeys.has(k)).map(([, x]) => x))
    v = pool.find((x) => !taken.has(x)) ?? pool[0] ?? null
  } else v = pool.length ? pool[hash(t.key) % pool.length] : null
  chosen.set(t.key, v)
  return v
}

/** The game as a moment finds it, for one at `at` (and what has been said: ?debug). */
export const talkNow = (at: { x: number; z: number }) => ({ world: worldAt(at), memory: structuredClone(memory) })

/** The game as a moment finds it, for one at `at`. */
function worldAt(at: { x: number; z: number }): TalkWorld {
  const h = useHome.getState()
  const a = audioStatus()
  const s = synth()
  return {
    now: performance.now() / 1000,
    distance: Math.hypot(playerState.position.x - at.x, playerState.position.z - at.z),
    sameMap: h.map === 'farm' && h.mapReady,
    film: !!useFilm.getState().on || !!useStory.getState().on || h.curtain,
    sound: a ? { enabled: a.enabled, volume: a.volume } : null,
    speech: !!s && voices.length > 0,
    hidden: typeof document !== 'undefined' && document.hidden,
    speaking: !!s?.speaking,
  }
}

/** A moment of a character's (./lines.ts), at `at` on the farm: one of its lines said out loud if it may be now
 *  (./rules.ts), of those `hearts` open (a neighbour's friendship); whether it was. */
export function talk(moment: TalkMoment, who: Talker, at: { x: number; z: number }, hearts = 0, roll = Math.random()): boolean {
  listen()
  const w = worldAt(at)
  if (!mayTalk(moment, w, memory, roll)) return false
  const s = synth()
  const v = voiceOf(who)
  if (!s || !v || !w.sound) return false
  const row = TALK[moment]
  const line = nextLine(moment, memory, w.now, Math.random(), hearts)
  const text = line.say
  const read = readingOf(who.voice, voiceMood(line.mood), 1, who.female)
  const u = new SpeechSynthesisUtterance(text)
  u.voice = v
  u.lang = v.lang
  u.pitch = read.pitch
  u.rate = read.rate
  // as loud as the game's sounds (src/audio/sound.ts: its volume, 0.7 the usual)
  u.volume = Math.min(1, w.sound.volume / 0.7)
  u.onend = u.onerror = () => {
    if (ours === u) ours = null
  }
  // (an answer to you cuts in)
  if ('answer' in row && row.answer) s.cancel()
  ours = u
  s.speak(u)
  heard.push({ moment, who: who.key, text, at: w.now })
  if (heard.length > 50) heard.shift()
  return true
}

/** A line of a letter read aloud as it comes up on its card (src/farm/people/LetterCard.tsx), in its speaker's own
 *  voice and the mood of their face, cutting in over a line being said: only with the game's sound on, an English
 *  voice there, the page shown and no film or drive up (the words are on the card all the same: half play muted). The
 *  farmer has no voice: his lines are read, never heard. Whether it was said. */
export function sayLine(line: Line): boolean {
  listen()
  const who = line.who === 'buyer' ? null : talkerOf(line.who)
  const s = synth()
  const a = audioStatus()
  if (!who || !s || !a || !a.enabled || !(a.volume > 0) || document.hidden || useFilm.getState().on || useStory.getState().on) return false
  const v = voiceOf(who)
  if (!v) return false
  const read = readingOf(who.voice, voiceMood(line.mood), 1, who.female)
  const u = new SpeechSynthesisUtterance(line.say)
  u.voice = v
  u.lang = v.lang
  u.pitch = read.pitch
  u.rate = read.rate
  u.volume = Math.min(1, a.volume / 0.7)
  u.onend = u.onerror = () => {
    if (ours === u) ours = null
  }
  s.cancel()
  ours = u
  s.speak(u)
  return true
}

/** Stops a line of ours being said (a film or the drive starting, the sound turned off). */
export function hushTalk() {
  if (ours) synth()?.cancel()
  ours = null
}

/** From the scene's start on the farm: the first touch lets the page speak (a phone speaks only after one), and a
 *  line of ours stops as a film or the drive starts or the sound is turned off. The returned function undoes it. */
export function wireTalk(): () => void {
  listen()
  const prime = () => {
    primeSpeech()
    window.removeEventListener('pointerdown', prime, true)
    window.removeEventListener('keydown', prime, true)
  }
  window.addEventListener('pointerdown', prime, true)
  window.addEventListener('keydown', prime, true)
  const offDrive = useFilm.subscribe((s, p) => s.on && !p.on && hushTalk())
  const offStory = useStory.subscribe((s, p) => s.on && !p.on && hushTalk())
  const offSound = useSettings.subscribe((s) => (!s.sound || !(s.volume > 0)) && hushTalk())
  return () => {
    window.removeEventListener('pointerdown', prime, true)
    window.removeEventListener('keydown', prime, true)
    offDrive()
    offStory()
    offSound()
  }
}
