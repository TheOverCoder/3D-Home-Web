import { create } from 'zustand'
import { LADDERS, type LadderId, type ToolKind } from '../farm/data'
import { buyLadder, buyMarket, farm } from '../farm/state'
import type { FilmRun } from './run'
import { primeSpeech } from './prime'

// The films a moment of play opens (the film director's: .claude/agents/film-director.md, lab/FILM.md). The moment's
// own act asks for its film once it has happened — buying the shop from its card asks for "Under New Management"
// (./supermarket.ts), an animal's tool from its card its build film (./coop.ts, ./bucket.ts, ./shears.ts) — and the film player in the scene (./StoryFilm.tsx) plays it on the game's own canvas, the
// overlay (src/ui/Film.tsx) over it: its lines, Skip (a tap anywhere), and the end card with what the player got. A
// film asked for plays once: nothing of it is in the save, so a reload, a farm loaded or another slot plays none.
// What the moment did is done before the film starts (the coins, the shop, the XP: as it always was); the film only
// shows it, and nothing changes when it ends.

export type FilmId = 'shop' | 'coop' | 'bucket' | 'shears'

/** A film asked for: which, and the player's XP before and after its moment (the end card's bar fills between them). */
export interface FilmAsk {
  id: FilmId
  xp: [number, number]
}

let asked: FilmAsk | null = null
const listeners = new Set<() => void>()

/** Asks for a moment's film (in the tap that made the moment: the page may then speak its lines on a phone). */
export function askFilm(ask: FilmAsk) {
  asked = ask
  primeSpeech()
  for (const f of listeners) f()
}

/** The film asked for, taken to be played (null: none): each is taken once. */
export function takeFilm(): FilmAsk | null {
  const a = asked
  asked = null
  return a
}

/** The film asked for and not taken yet (null: none). */
export const filmAsked = () => asked

/** Called whenever a film is asked for; the returned function stops it. */
export function onFilmAsked(f: () => void) {
  listeners.add(f)
  return () => void listeners.delete(f)
}

/** Buys the shop from its card (src/farm/MarketPanel.tsx, MarketBuyPanel), and then its film plays (once); whether it
 *  was bought. The buying is the farm's (src/farm/state.ts, buyMarket), all of it before the film. */
export function buyShop(): boolean {
  const before = farm.xp.points
  if (!buyMarket()) return false
  askFilm({ id: 'shop', xp: [before, farm.xp.points] })
  return true
}

/** Each animal's tool's build film. */
const TOOL_FILM: Record<ToolKind, FilmId> = { hens: 'coop', cows: 'bucket', sheep: 'shears' }

/** Buys a ladder's step from its card (src/farm/Ladder.tsx), and a tool's own step (the coop, the bucket, the shears)
 *  then plays its build film (once); whether it was bought. The buying is the farm's (buyLadder), all of it before the
 *  film: tests and the simulation buy with buyLadder and ask for no film. */
export function buyWithFilm(id: LadderId): boolean {
  const before = farm.xp.points
  if (!buyLadder(id)) return false
  const tool = LADDERS[id].tool
  if (tool?.part === 'tool') askFilm({ id: TOOL_FILM[tool.kind], xp: [before, farm.xp.points] })
  return true
}

// ───────────────────────────── a film playing ─────────────────────────────

/** Where a film playing is: `dark` the screen fading to dark while it is made (the game still drawn under the veil),
 *  `film` playing, `out` fading to dark at its end (or skipped), `card` the end card over the game. */
export type StoryStep = 'dark' | 'film' | 'out' | 'card'
/** What moves it on: the film made and its first frames drawn (`ready`), its end reached (`end`), a tap or Skip
 *  (`skip`), the screen dark again (`dark`), Watch again (`again`), something that failed (`fail`), Continue (`close`). */
export type StoryEvent = 'ready' | 'end' | 'skip' | 'dark' | 'again' | 'fail' | 'close'

/** The next step (null: the film is over and gone). A skip or a failure always lands on the end card — the reward is
 *  never lost — and the film never plays again by itself. */
export function storyStep(step: StoryStep, e: StoryEvent): StoryStep | null {
  if (e === 'close') return null
  if (e === 'fail') return 'card'
  if (step === 'dark') return e === 'ready' ? 'film' : e === 'skip' ? 'card' : step
  if (step === 'film') return e === 'end' || e === 'skip' ? 'out' : step
  if (step === 'out') return e === 'dark' ? 'card' : step
  return e === 'again' ? 'dark' : step
}

/** The film playing, as the page's overlay sees it (src/ui/Film.tsx): what was asked, its step, its run once made
 *  (its clock and sound), and whether motion is kept low. */
export interface StoryShowing {
  ask: FilmAsk
  step: StoryStep
  run: FilmRun | null
  still: boolean
}

export const useStory = create<{ on: StoryShowing | null }>(() => ({ on: null }))

/** What the overlay's buttons do (the player in the scene sets them while a film is up). */
export const storyControls: { skip: () => void; again: () => void; close: () => void } = { skip: () => {}, again: () => {}, close: () => {} }
