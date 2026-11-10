import { profile } from '../lib/profile'

// Small effects on the farm, asked for beside the sounds: a splash of water on each bed you water, a pop of sparkles
// on what you harvest (in its colour), a puff of dust where a bed or a field is built and where a piece of furniture
// is put down, and a few coins flying from a buyer to the coin chip when they pay. The particles are three.quarks,
// in a chunk of their own loaded once the game is playing (src/fx/FarmFx.tsx, src/fx/quarks.ts); this module is what
// the game calls, and it holds no three.js. Nothing moves when the player asks for less motion, and the light
// graphics draw half as many particles (`profile.particles`).

export type FxKind = 'water' | 'harvest' | 'dust'

/** One effect asked for: where, and what it is about. */
export interface FxRequest {
  kind: FxKind | 'coins'
  x: number
  y: number
  z: number
  /** sparkles: the good harvested (they take its colour) */
  good?: string
  /** dust: half the size of what was built or put down, each way (the puff rises from its edge) */
  half?: { x: number; z: number }
  /** coins: how many changed hands */
  coins?: number
  /** when it was asked (performance.now()): an effect that could not start soon after is dropped */
  at: number
}

/** What the effects are doing, for the tests (`window.__home.fx`): bursts started, systems alive, coin flights. */
export const fxStats = { loaded: false, started: 0, alive: 0, coins: 0 }

/** The player asked their system for less motion: no particles, no flying coins. */
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Whether effects are drawn at all on this device, for this player. */
export const effectsOn = () => profile.particles > 0 && !reducedMotion()

const queue: FxRequest[] = []
const MAX_QUEUE = 48

function ask(r: Omit<FxRequest, 'at'>) {
  if (!effectsOn()) return
  queue.push({ ...r, at: performance.now() })
  if (queue.length > MAX_QUEUE) queue.shift()
}

/** A burst of particles at (x, y, z): water on a bed, sparkles on a harvest (`good`: its colour), dust round what was
 *  built or put down (`half`: its footprint). */
export function farmFx(kind: FxKind, x: number, y: number, z: number, opts: { good?: string; half?: { x: number; z: number } } = {}) {
  ask({ kind, x, y, z, ...opts })
}

/** Coins from a buyer standing at (x, z) to the coin chip at the top of the screen. */
export function coinsFx(x: number, z: number, coins: number) {
  ask({ kind: 'coins', x, y: 1.5, z, coins })
}

/** Everything asked since the last frame (the effects component plays it). */
export const takeFx = () => queue.splice(0)

/** How many coin pictures fly for a sale of `coins`: a few, more for a bigger sale, never a swarm. */
export const coinsToFly = (coins: number) => Math.max(3, Math.min(7, Math.round(coins / 8) + 2))
