import { isAnimal, lookOf, voicesOf } from './cast'
import { lintStage } from './checks'
import { lint, timeline, type Film, type Timeline } from './format'
import { Score } from './score'
import { Talker } from './speak'
import type { FrameInfo } from './stage3d'
import { lintSpeech, speechOf, type Speech, type Voice } from './voice'

// A film playing: its clock (film seconds, started by its first frame on the screen, held for a picture, jumped by a
// skip), its sound (./score.ts: the music composed as it plays, the stings, each line read aloud in its speaker's voice
// by ./speak.ts) and what each frame showed, for whoever draws over it. One for the game's player (./StoryFilm.tsx) and
// the design lab's (lab/films/Player.tsx): the 3D view draws the film at `now()` and hands `frame` what it drew; the
// overlay (src/ui/Film.tsx) listens. No three.js and no React here.

export type { FrameInfo }

export class FilmRun {
  readonly tl: Timeline
  readonly voices: Record<string, Voice>
  readonly speech: Speech[]
  readonly talker: Talker
  readonly score: Score
  /** the clock: film time `base` at `origin` (performance.now; null: not started, the first frame starts it), or held */
  private clock: { origin: number | null; base: number; paused: boolean }
  private frames = new Set<(t: number, info: FrameInfo) => void>()
  private restarts = new Set<(t: number) => void>()

  constructor(
    readonly film: Film,
    from = 0,
    private time: () => number = () => performance.now(),
  ) {
    this.tl = timeline(film)
    this.voices = voicesOf(film)
    this.speech = speechOf(this.tl, this.voices)
    // (the cast in the order of who says most: the best voices go to them)
    const lines = (id: string) => this.speech.filter((s) => s.who === id).length
    // (the animals say nothing: no speech voice goes to them)
    const cast = Object.entries(film.cast)
      .filter(([, m]) => !isAnimal(m.look))
      .map(([id, m]) => ({ id, female: lookOf(m.look).sex === 'f' }))
    this.talker = new Talker(cast.sort((a, b) => lines(b.id) - lines(a.id)))
    this.score = new Score(this.tl, this.speech, this.voices, this.talker)
    this.clock = { origin: null, base: Math.max(0, Math.min(from, this.tl.length)), paused: false }
  }

  get length() {
    return this.tl.length
  }

  /** The film's second now (at most its end). */
  now() {
    const c = this.clock
    const t = c.origin === null || c.paused ? c.base : c.base + (this.time() - c.origin) / 1000
    return Math.min(t, this.tl.length)
  }

  /** At its end: the end card's time. */
  get ended() {
    return this.now() >= this.tl.length - 1e-3
  }

  /** Whether the clock has started (its first frame drawn). */
  get started() {
    return this.clock.origin !== null
  }

  /** On from film time `t` (`held`: kept there, a picture of that moment). The overlay starts its beat again. */
  restart(t: number, held = false) {
    this.clock = { origin: this.time(), base: Math.max(0, Math.min(t, this.tl.length)), paused: held }
    for (const f of this.restarts) f(this.clock.base)
  }

  /** Whether its sound is wanted (started by its first frame where the page had been touched, or by Sound). */
  sound = false

  /** Its sound from film time `t` (in a tap, or once the page has had one: browsers start audio only then). */
  startSound(t: number) {
    this.sound = true
    this.score.start(t)
  }

  /** Its sound off (Sound pressed again). */
  stopSound() {
    this.sound = false
    this.score.stop()
  }

  /** Skipped: straight to the end (the end card), its sound cut (still wanted, for Watch again). */
  skip() {
    this.restart(this.tl.length)
    this.score.stop()
  }

  /** From the start again, with its sound if it was wanted. */
  again() {
    this.restart(0)
    if (this.sound) this.score.start(0)
  }

  /** A frame drawn at `t`: the clock starts with the first one, and the overlay hears what it showed. */
  frame(t: number, info: FrameInfo) {
    if (this.clock.origin === null) this.clock.origin = this.time()
    for (const f of this.frames) f(t, info)
  }

  onFrame(f: (t: number, info: FrameInfo) => void) {
    this.frames.add(f)
    return () => void this.frames.delete(f)
  }

  onRestart(f: (t: number) => void) {
    this.restarts.add(f)
    return () => void this.restarts.delete(f)
  }

  /** What the film breaks of lab/FILM.md's countable rules (its lines' lengths and times, its shots, its names), and of
   *  its set's (./checks.ts: walls, people through each other, someone framed who is not there). */
  problems() {
    return [...lint(this.film), ...lintSpeech(this.speech), ...lintStage(this.film)]
  }

  /** Its sound stopped (the film closed). */
  stop() {
    this.score.stop()
  }
}
