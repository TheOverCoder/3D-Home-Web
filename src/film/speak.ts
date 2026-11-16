import { audioStatus } from '../audio/sound'
import { primeSpeech } from './prime'
import { readingOf, spokenOf, wordsBy, type Speech, type Voice } from './voice'

// Lines read aloud in words: the device's own speech voices (the Web Speech API's speechSynthesis — on every phone and
// computer, nothing downloaded or recorded), in clear English. Each character gets a voice of their own (a man's or a
// woman's, a different one for each where the device has several) read at their pitch and pace (./voice.ts,
// readingOf), so the manager is quick and a little high, the contractor slow and deep, the player low and level. The
// bubble's words come up as the voice reaches them (its word boundaries; where a device gives none, by the clock from
// when it began). A device with no English voice has the babble instead (./score.ts), and so does the lab's offline
// measuring. Phones let a page speak only once it has been touched: `unlock` runs in a tap.

/** Voices that are effects, not voices (macOS's and iOS's novelty and robot voices). */
const NOVELTY =
  /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy|princess|deranged|hysterical|\bfred\b|grandma|grandpa|eddy|\bflo\b|\breed\b|rocko|sandy|shelley/i
/** Voices known to be a man's or a woman's (Apple's, Google's, Microsoft's), the clearest first. */
const MEN = [
  'Daniel',
  'Alex',
  'Aaron',
  'Arthur',
  'Oliver',
  'Evan',
  'Nathan',
  'Tom',
  'Gordon',
  'Rishi',
  'Google UK English Male',
  'Guy',
  'Ryan',
  'Andrew',
  'Brian',
  'Christopher',
  'Eric',
  'David',
  'Mark',
  'George',
  'James',
]
const WOMEN = [
  'Samantha',
  'Ava',
  'Allison',
  'Susan',
  'Karen',
  'Moira',
  'Tessa',
  'Fiona',
  'Victoria',
  'Serena',
  'Kate',
  'Martha',
  'Zoe',
  'Google US English',
  'Google UK English Female',
  'Aria',
  'Jenny',
  'Libby',
  'Sonia',
  'Emma',
  'Zira',
  'Hazel',
]

const speech = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)

/** How well a voice suits a man (or a woman): lower is better, Infinity not at all. */
export function voiceFit(v: SpeechSynthesisVoice, female: boolean) {
  if (!/^en([-_]|$)/i.test(v.lang) || NOVELTY.test(v.name)) return Infinity
  const mine = (female ? WOMEN : MEN).findIndex((n) => v.name.includes(n))
  const theirs = (female ? MEN : WOMEN).some((n) => v.name.includes(n))
  // a voice of the other sex only when there is nothing else; one of unknown sex after the known ones
  const rank = mine >= 0 ? mine : theirs ? 200 : 100
  // a voice on the device (it gives the words as it says them) before one over the network; American and British first
  return rank + (v.localService ? 0 : 0.5) + (/^en[-_](us|gb)/i.test(v.lang) ? 0 : 0.25)
}

interface Said {
  /** performance.now() when asked, and when the voice began (null: not yet) */
  asked: number
  began: number | null
  /** the written words reached, by the voice's own word boundaries (-1: it gives none) */
  word: number
  done: boolean
}

export class Talker {
  private voices: SpeechSynthesisVoice[] = []
  private chosen = new Map<string, SpeechSynthesisVoice | null>()
  private said = new Map<Speech, Said>()
  private unlocked = false

  /** `cast`: each cast id, and whether a woman (for the voice chosen), the one who says most first. */
  constructor(private cast: { id: string; female: boolean }[]) {
    const s = speech()
    if (!s) return
    const load = () => {
      this.voices = s.getVoices().filter((v) => voiceFit(v, false) < Infinity || voiceFit(v, true) < Infinity)
      this.chosen.clear()
    }
    load()
    s.addEventListener?.('voiceschanged', load)
  }

  /** Whether lines can be read aloud in words here (the device has an English voice). */
  get can() {
    return this.voices.length > 0
  }

  /** Each cast member's voice: the one that suits them best of those not taken by someone before them in the cast
   *  (the cast comes in the order of who says most). Where the device has too few, a man shares a man's voice (at his
   *  own pitch) before he is given a woman's, and the same for a woman. */
  voiceOf(id: string) {
    if (!this.chosen.size) {
      const taken = new Set<SpeechSynthesisVoice>()
      for (const c of this.cast) {
        const ranked = [...this.voices].filter((v) => voiceFit(v, c.female) < Infinity).sort((a, b) => voiceFit(a, c.female) - voiceFit(b, c.female))
        const theirs = ranked.filter((v) => voiceFit(v, c.female) < 200)
        const v = theirs.find((x) => !taken.has(x)) ?? theirs[0] ?? ranked[0] ?? null
        if (v) taken.add(v)
        this.chosen.set(c.id, v)
      }
    }
    return this.chosen.get(id) ?? null
  }

  /** In a tap: a phone lets a page speak once it has spoken from a touch. */
  unlock() {
    if (this.unlocked) return
    this.unlocked = true
    primeSpeech()
  }

  /** Reads a line aloud now, in its speaker's voice and mood. */
  say(line: Speech, voice: Voice) {
    const s = speech()
    const female = this.cast.find((c) => c.id === line.who)?.female ?? false
    const v = this.voiceOf(line.who)
    if (!s || !v) return false
    const { text, starts } = spokenOf(line.text)
    const read = readingOf(voice, line.mood, line.u.squeeze, female)
    const u = new SpeechSynthesisUtterance(text)
    u.voice = v
    u.lang = v.lang
    u.pitch = read.pitch
    u.rate = read.rate
    // the game's volume (src/audio/sound.ts): the voice as loud as the game's sounds are at their usual setting
    const prefs = audioStatus()
    u.volume = prefs && !prefs.enabled ? 0 : Math.min(1, (prefs?.volume ?? 0.7) / 0.7)
    const said: Said = { asked: performance.now(), began: null, word: -1, done: false }
    this.said.set(line, said)
    u.onstart = () => (said.began = performance.now())
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return
      said.began ??= performance.now()
      let k = 0
      while (k < starts.length && starts[k] <= e.charIndex) k++
      said.word = Math.max(said.word, k)
    }
    u.onend = u.onerror = () => (said.done = true)
    s.speak(u)
    return true
  }

  /** How many of a line's written words its voice has reached, or null when it is not being read aloud (the film's
   *  own clock then shows them). */
  words(line: Speech): number | null {
    const said = this.said.get(line)
    if (!said) return null
    if (said.done) return 99
    if (said.word >= 0) return said.word
    if (said.began !== null) return wordsBy(line.u, (performance.now() - said.began) / 1000)
    // asked and still silent after a moment: the voice is not coming (a phone that was never touched)
    return performance.now() - said.asked > 900 ? null : 0
  }

  /** Stops whatever is being said (a skip, a jump, the sound turned off). */
  cancel() {
    this.said.clear()
    speech()?.cancel()
  }
}
