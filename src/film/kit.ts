import { pieceOpen, type ToolLook, type ToolStyle } from '../models/tools'
import type { Act, Cam, Cue, FxAt, Line, PropAct, Shot, Spot, Sting } from './format'

// The film kit: what every film of a kind does the same way, written once (lab/FILM.md, how a film is made here). A
// film is still data; these make the data — a shot, or a few — from the few things that differ (who, what, where, how
// long), so a new film of a kind is its story and its own shots, and the beats every one shares keep in step with the
// game's models by themselves (the clicks of a build land on its pieces whatever the style). Only what three films
// already share is here.

// ───────────────────────────── shot presets ─────────────────────────────

/** The look into the lens (FILM.md: the animal's line): straight on, still, held. */
export const lens = (who: string, size: Cam['size'] = 'medium'): Cam => ({ on: who, from: 0, size })
/** The hero's walk: from the ground, a little to the side (slow it: `slow` on the shot). */
export const hero = (who: string): Cam => ({ on: who, from: 20, size: 'full', angle: 'ground' })
/** A reaction: medium, at three quarters from the scene's side. */
export const reaction = (who: string, from = 30): Cam => ({ on: who, from, size: 'medium' })
/** Say where: the whole place from above. */
export const establish = (on: string | string[], from = 15): Cam => ({ on, from, size: 'wide', angle: 'high' })

// ───────────────────────────── cues ─────────────────────────────

/** Silence before the drop (FILM.md): a riser `rise` seconds long ending in a cut of the music, the hit `gap` later — the
 *  new track and its sting on it, and a flash. Times from `at` (where the riser starts), in the shot's seconds. */
export function drop(at: number, track: Cue['music'], o: { rise?: number; gap?: number } = {}) {
  const rise = o.rise ?? 1.1
  const gap = o.gap ?? 0.45
  return {
    hear: [
      { at, sting: 'riser' as Sting },
      { at: at + rise, music: 'stop' as const },
      { at: at + rise + gap, music: track, sting: 'drop' as Sting },
    ] as Cue[],
    fx: [{ at: at + rise + gap, fx: 'flash' }] as FxAt[],
    /** when the hit lands */
    hit: at + rise + gap,
  }
}

/** Beats in a row: `n` stings `every` seconds apart from `at` (clucks in a scrum, ticks of suspense). */
export const beats = (at: number, every: number, n: number, sting: Sting): Cue[] => Array.from({ length: n }, (_, i) => ({ at: at + i * every, sting }))

// ───────────────────────────── a delivery and a build ─────────────────────────────

/** Each tool's pieces in the order they go up, for each style (src/models/tools.ts, `toolPieces`: ./kit.test.ts holds
 *  this to it), and the piece that is what waits to be collected (drawn only while there is some: no click for it). */
export const PIECES: Record<ToolLook, Record<ToolStyle, readonly string[]>> = {
  nests: { a: ['legs', 'house', 'straw', 'trim', 'roof'], b: ['legs', 'box', 'straw', 'lid'], c: ['posts', 'planks', 'nests'] },
  pail: { a: ['stand', 'back', 'roof', 'churn', 'pail', 'milk'], b: ['post', 'hook', 'churn', 'pail', 'milk'], c: ['post', 'stool', 'pail', 'milk'] },
  shears: { a: ['posts', 'board', 'roof', 'basket', 'wool', 'shears'], b: ['base', 'tub', 'wool', 'shears'], c: ['post', 'basket', 'wool', 'shears'] },
}
export const GOODS_PIECE: Record<ToolLook, string | null> = { nests: null, pail: 'milk', shears: 'wool' }

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k))

/** When each of a tool's pieces lands in its place (seconds after its `open` begins, eased over `over` as the stage
 *  eases it): its click goes there. The goods piece has none. */
export function landings(look: ToolLook, style: ToolStyle, over: number) {
  const ids = PIECES[look][style]
  return ids.flatMap((id, k) => {
    if (id === GOODS_PIECE[look]) return []
    for (let t = 0; t <= over + 1e-6; t += 0.01) if (pieceOpen(ease(t / over), k, ids.length) >= 1) return [{ id, t }]
    return [{ id, t: over }]
  })
}

/** He comes in with the crate in his arms (it is heavy: his walk is slow and rolls), and says his doubt on the way: a
 *  medium shot on him as he comes, the camera where his walk ends. */
export function carryIn(o: { who: string; crate: string; from?: Spot; to?: Spot; pace?: number; len?: number; say?: Omit<Line, 'who'>; cam?: Partial<Cam>; also?: Act[] }): Shot {
  return {
    len: o.len ?? 2.6,
    cam: { on: o.who, size: 'medium', ...o.cam },
    do: [{ at: 0, who: o.who, put: o.from ?? 'east' }, { at: 0, who: o.who, pose: 'box' }, { at: 0, who: o.who, to: o.to ?? 'carry', pace: o.pace ?? 1.25 }, ...(o.also ?? [])],
    props: [{ at: 0, prop: o.crate, on: o.who }],
    say: o.say ? [{ ...o.say, who: o.who }] : undefined,
  }
}

/** He bends and sets the crate down (it lands with a thud and a puff of dust, the camera jolts), straightens, and steps
 *  back to see, or goes (`away`): a full shot on the crate. Cut on the action: the next shot opens it. */
export function setDown(o: { who: string; crate: string; len?: number; away?: Spot; cam?: Partial<Cam>; also?: Act[] }): Shot {
  const down = 0.55
  return {
    len: o.len ?? 1.9,
    cam: { on: [o.crate, o.who], from: -25, size: 'full', ...o.cam },
    do: [{ at: 0, who: o.who, pose: 'stoop' }, { at: down + 0.25, who: o.who, pose: 'hips' }, { at: down + 0.45, who: o.who, to: o.away ?? 'aside', pace: 1.0 }, ...(o.also ?? [])],
    props: [{ at: down, prop: o.crate, on: 'down' }],
    hear: [{ at: down, sting: 'thud' }],
    fx: [{ at: down, fx: 'dust', on: o.crate }],
  }
}

/** The crate opens and the tool goes up out of it, a piece after a piece, each with a click and a pop of sparkles, a
 *  riser under it: a shot on the tool. `over` the build's seconds; the shot ends `tail` after the last piece. Its music
 *  is cut at its end (the next shot's drop is the hit). */
export function build(o: { tool: string; crate: string; look: ToolLook; style: ToolStyle; over?: number; at?: number; tail?: number; cam?: Partial<Cam>; also?: Act[]; click?: Sting; last?: Sting }) {
  const at = o.at ?? 0.45
  const over = o.over ?? 1.6
  const lands = landings(o.look, o.style, over)
  const end = at + over + (o.tail ?? 0.45)
  const shot: Shot = {
    len: Math.round(end * 10) / 10,
    cam: { on: o.tool, from: 0, size: 'full', move: 'push', ...o.cam },
    props: [
      { at: 0.05, prop: o.crate, open: 1, over: 0.6 },
      { at, prop: o.tool, open: 1, over },
    ] as PropAct[],
    do: o.also,
    hear: [
      { at: 0.05, sting: 'whoosh' },
      { at: Math.max(0, at - 0.1), sting: 'riser' },
      ...lands.map((l, i) => ({ at: at + l.t, sting: i === lands.length - 1 ? (o.last ?? 'clunk') : (o.click ?? 'pop') })),
      { at: end - 0.05, music: 'stop' },
    ] as Cue[],
    fx: [{ at: 0.1, fx: 'dust', on: o.crate }, ...lands.map((l) => ({ at: at + l.t, fx: 'pop', on: o.tool }) as FxAt), { at: at + lands[lands.length - 1].t, fx: 'glint' }] as FxAt[],
  }
  return shot
}
