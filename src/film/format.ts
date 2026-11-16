import type { DayPhase } from '../farm/data'
import type { Voice } from './voice'

// A film is data: who is in it (looks from the game's people engine), the scenes it plays in (a place the game has, its
// light from the game's own day), and in each scene its shots in order — what the camera frames, from where, how big,
// at what angle, how it moves — with what is said, done and heard during each shot, at seconds from the shot's start.
// Its player plays any film from this — the game's on its own canvas (./StoryFilm.tsx), the design lab's in a view of
// its own (lab/films/Player.tsx), both with the same overlay (src/ui/Film.tsx) — and frames each shot for the screen it
// is on (a phone upright or sideways), so a film names who and what to see, never where the camera stands. Nothing here knows a model, a
// coordinate or a colour: those come from the game, so a film keeps working when the game's looks change.

/** Someone from the people engine: the player as dressed now, the game's fixed characters, or a roll of its dice. */
export type Look = 'player' | 'manager' | 'contractor' | { roll: number }

/** A place to stand: a named mark of the set (./set.ts: 'desk', 'boss', 'door'…) or a point, metres on the ground. */
export type Spot = string | { x: number; z: number; heading?: number }

export interface Member {
  /** the name on their lines */
  name: string
  look: Look
  /** where they stand when the film starts */
  at: Spot
  /** which way they face then: a cast id or degrees (0 south, 180 north, as the game's headings) */
  face?: string | number
  /** not on stage until an act puts them there */
  off?: boolean
  /** how they sound (./voice.ts): left out, the game's voice for this character, or one from their look; any number
   *  given here tunes it */
  voice?: Partial<Voice>
}

/** How much a shot shows of its subject: from the eyes or a hand (extreme) to the whole place round it (wide). */
export type Size = 'extreme' | 'close' | 'medium' | 'full' | 'wide'
/** Where the camera looks from: level with the subject, below it looking up (low: power), from the floor (ground:
 *  a hero), above it looking down (high: small), or from overhead (top). */
export type Angle = 'eye' | 'low' | 'ground' | 'high' | 'top'
/** How the camera moves through the shot: push in (this matters), pull out (a reveal), crane up (triumph), orbit round,
 *  drift sideways, or a quick comic zoom at the start (punch). */
export type Move = 'still' | 'push' | 'pull' | 'crane' | 'orbit' | 'drift' | 'punch'

export interface Cam {
  /** what is framed: cast ids or things of the set ('shop', 'sign', 'door', 'screen', 'desk', 'shelves', 'aisle', 'till', and
   *  the props 'case' and 'box') */
  on: string | string[]
  /** where the camera stands: over a cast member's shoulder (their id), beside the scene's line ('side'), or degrees
   *  round the (first) subject from its front. Left out: a three-quarter view from the scene's side. */
  from?: string | number
  size?: Size
  angle?: Angle
  move?: Move
  /** an impact at the start of the shot: how hard the camera shakes (0..1) */
  shake?: number
}

/** The poses the player knows (./poses.ts). A pose holds until the next; walking moves the legs under any of them. */
export type Pose = 'stand' | 'talk' | 'laugh' | 'point' | 'snap' | 'carry' | 'surprise' | 'count' | 'shake' | 'wave' | 'shrug' | 'slump' | 'cheer' | 'box' | 'cool' | 'type' | 'freeze'

/** How a line is said: its bubble's look, and a little of the speaker's body. */
export type Mood = 'flat' | 'smug' | 'shock' | 'warm' | 'sad' | 'cool'

export interface Line {
  at: number
  who: string
  text: string
  mood?: Mood
  /** seconds on screen; left out, its reading time (`readTime`) */
  hold?: number
}

export interface Act {
  at: number
  who: string
  pose?: Pose
  /** walk there (a path: one spot after another), at `pace` m/s */
  to?: Spot | Spot[]
  pace?: number
  /** turn to face someone (a cast id) or a heading in degrees */
  face?: string | number
  /** put on stage at a spot at once (between scenes), or take off it */
  put?: Spot
  off?: boolean
}

/** A prop: the briefcase, the boss's box, the banner over the sign, the computer's screen, the shop's lights. */
export interface PropAct {
  at: number
  prop: string
  /** who holds it (a cast id) or where it stands (a spot) */
  on?: string | Spot
  /** how open (a lid, a banner unrolled, lights on, shelves filled): 0..1, eased over `over` seconds (0.45) */
  open?: number
  over?: number
  /** what it shows (the screen: 'sale' or 'yours') */
  show?: string
}

/** Music the player composes as it plays (./score.ts), and stings. */
export type Track = 'muzak' | 'tension' | 'beat'
export type Sting = 'thud' | 'glow' | 'scratch' | 'snap' | 'whoosh' | 'clunk' | 'coins' | 'till' | 'trombone' | 'riser' | 'drop' | 'tick' | 'door' | 'level' | 'swell'

export interface Cue {
  at: number
  /** start a track (it plays to the next music cue), or stop the music dead */
  music?: Track | 'stop'
  sting?: Sting
  /** someone's sound with no bubble (a gasp, a grunt): a cast id, saying `text` in their voice and `mood` */
  voice?: string
  text?: string
  mood?: Mood
}

/** What the picture does over the scene: a white flash, a glint across the screen, coins and confetti, a gold glow,
 *  sparkles, or one of the game's own chips popping up in the middle (a price: `art` and `text`). */
export type Fx = 'flash' | 'glint' | 'coins' | 'confetti' | 'glow' | 'sparkle' | 'tag'

export interface FxAt {
  at: number
  fx: Fx
  /** a chip's picture (src/ui/art.ts) and words */
  art?: string
  text?: string
}

export interface Shot {
  /** seconds */
  len: number
  cam: Cam
  say?: Line[]
  do?: Act[]
  props?: PropAct[]
  hear?: Cue[]
  fx?: FxAt[]
  /** a few typed words at the bottom (a place, a time): never a sentence */
  caption?: string
  /** slow motion: the world runs at this speed through the shot (0.5: half) */
  slow?: number
  /** more walls left out for this shot's camera (added to its scene's) */
  open?: string[]
}

export interface Scene {
  /** the place: the set the player builds from the game's rows */
  place: 'market'
  /** the game's time of day (src/farm/data.ts, DAY): its light */
  light: DayPhase
  /** the two who talk: the camera keeps to one side of the line between them (the 180° rule), `side` 1 or −1 */
  line?: [string, string]
  side?: 1 | -1
  /** walls left out for the camera besides those the player leaves out by itself (every wall between the camera and
   *  what it films goes, as a film set's "wild walls"): 'office-east', 'office-south', 'office-west', 'hall-west' */
  open?: string[]
  shots: Shot[]
}

/** One thing on the end card: a picture (src/ui/art.ts) and a few words. */
export interface EndThing {
  art: string
  text: string
}

/** The end card (src/ui/Film.tsx): what the player got, in the game's own words and pictures — a sense of progress:
 *  what they own now, the XP it gave (the level bar filling from where it was), and what it opens next. */
export interface EndCard {
  art: string
  title: string
  /** a ribbon over the picture, as the film's banner (a callback) */
  ribbon?: string
  /** the XP the moment gave (the game's XP_FOR) */
  xp: number
  /** what is the player's now */
  owns: EndThing[]
  /** what it opens: the next steps to take */
  next: EndThing[]
}

export interface Film {
  id: string
  title: string
  /** the story in one sentence, and its turn (FILM.md: write these first) */
  logline: string
  turn: string
  cast: Record<string, Member>
  /** the props and where they start */
  props: Record<string, { kind: 'case' | 'box' | 'banner' | 'screen' | 'lights' | 'goods'; on?: string | Spot; open?: number; show?: string }>
  scenes: Scene[]
  end: EndCard
}

// ───────────────────────────── the timeline ─────────────────────────────

/** How long a line stays up: about 15 characters a second, never under 1.1 s (FILM.md, the words). */
export const readTime = (text: string) => Math.max(1.1, 0.5 + text.length / 15)

export interface Timed<T> {
  t: number
  item: T
}

export interface ShotAt {
  start: number
  end: number
  scene: Scene
  shot: Shot
  index: number
}

export interface Timeline {
  film: Film
  length: number
  shots: ShotAt[]
  lines: (Timed<Line> & { end: number })[]
  acts: Timed<Act>[]
  props: Timed<PropAct>[]
  cues: Timed<Cue>[]
  fx: Timed<FxAt>[]
  captions: (Timed<string> & { end: number })[]
  /** the world's clock at film time t (slow motion runs it slower) */
  world: (t: number) => number
}

/** The film laid out on one clock: every shot, line, act and cue at its second from the start. Acts and props are put
 *  on the world's clock (slow motion stretches what happens in a slow shot). */
export function timeline(film: Film): Timeline {
  const shots: ShotAt[] = []
  const lines: Timeline['lines'] = []
  const acts: Timeline['acts'] = []
  const props: Timeline['props'] = []
  const cues: Timeline['cues'] = []
  const fx: Timeline['fx'] = []
  const captions: Timeline['captions'] = []
  // the world clock: piecewise, each shot at its speed
  const pieces: { t: number; w: number; k: number }[] = []
  let t = 0
  let w = 0
  for (const scene of film.scenes)
    for (const shot of scene.shots) {
      const k = shot.slow ?? 1
      pieces.push({ t, w, k })
      shots.push({ start: t, end: t + shot.len, scene, shot, index: shots.length })
      for (const l of shot.say ?? []) lines.push({ t: t + l.at, end: t + l.at + (l.hold ?? readTime(l.text)), item: l })
      for (const a of shot.do ?? []) acts.push({ t: w + a.at * k, item: a })
      for (const p of shot.props ?? []) props.push({ t: w + p.at * k, item: p })
      for (const c of shot.hear ?? []) cues.push({ t: t + c.at, item: c })
      for (const f of shot.fx ?? []) fx.push({ t: t + f.at, item: f })
      if (shot.caption) captions.push({ t, end: t + shot.len, item: shot.caption })
      t += shot.len
      w += shot.len * k
    }
  const byTime = <T extends { t: number }>(a: T, b: T) => a.t - b.t
  acts.sort(byTime)
  props.sort(byTime)
  cues.sort(byTime)
  fx.sort(byTime)
  lines.sort(byTime)
  const world = (at: number) => {
    let p = pieces[0]
    for (const q of pieces) if (q.t <= at) p = q
    return p ? p.w + (at - p.t) * p.k : at
  }
  return { film, length: t, shots, lines, acts, props, cues, fx, captions, world }
}

/** The shot on screen at film time t (the last one past the end). */
export const shotAt = (tl: Timeline, t: number) => tl.shots.find((s) => t >= s.start && t < s.end) ?? tl.shots[tl.shots.length - 1]

/** The line on screen at film time t, if any (the latest started wins). */
export function lineAt(tl: Timeline, t: number) {
  let on: Timeline['lines'][number] | undefined
  for (const l of tl.lines) if (t >= l.t && t < l.end) on = l
  return on
}

/** What a film breaks of FILM.md's rules that can be counted: lines over 38 characters, a line that runs past the
 *  next one or past its shot's scene, shots shorter than half a second or longer than 6, a film over 45 s, a cast id
 *  or prop no one declared. Empty when it keeps them. */
export function lint(film: Film): string[] {
  const tl = timeline(film)
  const out: string[] = []
  if (tl.length > 45) out.push(`the film is ${tl.length.toFixed(1)} s: at most 45`)
  for (const l of tl.lines) {
    if (l.item.text.length > 38) out.push(`"${l.item.text}" is ${l.item.text.length} characters: at most 38`)
    if (!film.cast[l.item.who]) out.push(`"${l.item.text}": no one called ${l.item.who}`)
    if (l.end > tl.length + 0.01) out.push(`"${l.item.text}" runs past the end`)
  }
  for (let i = 1; i < tl.lines.length; i++) if (tl.lines[i].t < tl.lines[i - 1].end - 0.05) out.push(`"${tl.lines[i].item.text}" starts before "${tl.lines[i - 1].item.text}" is read`)
  for (const s of tl.shots) {
    if (s.shot.len < 0.5 || s.shot.len > 6) out.push(`shot ${s.index + 1} is ${s.shot.len} s: between 0.5 and 6`)
    for (const who of [s.shot.cam.on].flat()) if (!film.cast[who] && !THINGS.includes(who)) out.push(`shot ${s.index + 1} frames "${who}": no one and nothing by that name`)
  }
  for (const a of tl.acts) if (!film.cast[a.item.who]) out.push(`an act of "${a.item.who}": no one by that name`)
  for (const p of tl.props) if (!film.props[p.item.prop]) out.push(`a prop "${p.item.prop}" the film does not have`)
  for (const c of tl.cues)
    if (c.item.voice !== undefined) {
      if (!film.cast[c.item.voice]) out.push(`a sound of "${c.item.voice}": no one by that name`)
      if (!c.item.text) out.push(`a sound of "${c.item.voice}" with nothing to say`)
    }
  return out
}

/** The things of a set a camera can frame. */
export const THINGS = ['shop', 'sign', 'door', 'screen', 'desk', 'case', 'till', 'box', 'shelves', 'aisle']
