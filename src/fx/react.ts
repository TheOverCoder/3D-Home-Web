import { lessMotion } from '../ui/still'

// Reactions in the world (update-v1/CONTRACTS.md §1.11): a plant that stretches as it is picked, a sprout coming up, a cow
// that shivers as she is milked, a fence settling into the ground — a short change of a thing's scale, across the
// ground (xz) and up (y), that its crowd puts with `Parts.at` (src/lib/sculpt/parts.ts: the box and the copies follow
// the scale, so nothing new is drawn). The game asks for one where it happens (`react`); the scene reads the scale of
// each thing as it puts it (`reaction`), and puts its crowd every frame while any of them reacts (`reacting`). Nothing
// reacts under less motion. No three.js and no DOM.

/** What a thing does. */
export type Reaction = 'pluck' | 'pick' | 'sprout' | 'perk' | 'wiggle' | 'rustle' | 'settle'
/** Whose it is: a crop in a bed, a fruit (a lemon, an egg, a berry), an animal, a thing put down. Each keeps its own
 *  ids. */
export type ReactOwner = 'plant' | 'fruit' | 'animal' | 'thing'

/** A moment of a reaction: when (a share of its length), the scale across the ground, the scale up. */
export type ReactKey = readonly [t: number, xz: number, y: number]

/**
 * Every reaction: how long (ms) and its moments, eased from one to the next. Each lasts at most 400 ms, keeps within
 * 30 % of the thing's own size, and ends at rest — or at nothing, for a thing that leaves (what is picked); a sprout
 * comes up from small.
 */
export const REACTIONS: Readonly<Record<Reaction, { ms: number; keys: readonly ReactKey[] }>> = {
  // a crop harvested: it stretches up, then is gone
  pluck: {
    ms: 240,
    keys: [
      [0, 1, 1],
      [0.4, 0.88, 1.24],
      [1, 0, 0],
    ],
  },
  // a lemon, an egg or a fruit taken: it swells, then is gone
  pick: {
    ms: 200,
    keys: [
      [0, 1, 1],
      [0.4, 1.25, 1.25],
      [1, 0, 0],
    ],
  },
  // seeds sown: it comes up small, overshoots a little and settles
  sprout: {
    ms: 280,
    keys: [
      [0, 0.6, 0.6],
      [0.6, 1.08, 1.08],
      [1, 1, 1],
    ],
  },
  // watered: it perks up, dips back and rests
  perk: {
    ms: 320,
    keys: [
      [0, 1, 1],
      [0.35, 0.97, 1.12],
      [0.7, 1.01, 0.97],
      [1, 1, 1],
    ],
  },
  // an animal collected from: a happy shiver
  wiggle: {
    ms: 380,
    keys: [
      [0, 1, 1],
      [0.25, 1.04, 0.95],
      [0.6, 0.98, 1.03],
      [1, 1, 1],
    ],
  },
  // a fruit plant picked: its leaves shake
  rustle: {
    ms: 300,
    keys: [
      [0, 1, 1],
      [0.3, 1.05, 0.96],
      [0.65, 0.98, 1.02],
      [1, 1, 1],
    ],
  },
  // put down: a small bounce into the ground
  settle: {
    ms: 260,
    keys: [
      [0, 1, 1],
      [0.3, 0.97, 1.06],
      [0.65, 1.03, 0.94],
      [1, 1, 1],
    ],
  },
}

interface Live {
  kind: Reaction
  start: number
  data: unknown
}

const live: Record<ReactOwner, Map<string | number, Live>> = { plant: new Map(), fruit: new Map(), animal: new Map(), thing: new Map() }

/** Every reaction held at this many ms into itself (the tests: a frozen pose), or null: they run. */
let frozen: number | null = null

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now())

/** A thing reacts (again from the start, if it was): `data` is the caller's, given back while it lasts (what a plant
 *  plucked was, the place a fruit was taken from). Nothing under less motion. */
export function react(owner: ReactOwner, id: string | number, kind: Reaction, data?: unknown) {
  if (lessMotion()) return
  live[owner].set(id, { kind, start: now(), data })
}

/** The ms into a reaction now; past its length it is over (and forgotten, unless frozen). */
function into(owner: ReactOwner, id: string | number, r: Live): number | null {
  const t = frozen ?? now() - r.start
  if (t < REACTIONS[r.kind].ms) return Math.max(0, t)
  if (frozen === null) live[owner].delete(id)
  return null
}

/** The scale at `share` of a reaction's length: eased between its moments. */
export function scaleAt(kind: Reaction, share: number): { xz: number; y: number } {
  const keys = REACTIONS[kind].keys
  const s = Math.min(1, Math.max(0, share))
  let k = 1
  while (k < keys.length - 1 && keys[k][0] < s) k++
  const [t0, xz0, y0] = keys[k - 1]
  const [t1, xz1, y1] = keys[k]
  const u = t1 > t0 ? Math.min(1, Math.max(0, (s - t0) / (t1 - t0))) : 1
  const e = u * u * (3 - 2 * u)
  return { xz: xz0 + (xz1 - xz0) * e, y: y0 + (y1 - y0) * e }
}

/** A thing's scale now while it reacts (with what it reacts to and the caller's data), or null: at rest. */
export function reaction(owner: ReactOwner, id: string | number): { xz: number; y: number; kind: Reaction; data: unknown } | null {
  const r = live[owner].get(id)
  if (!r) return null
  const t = into(owner, id, r)
  if (t === null) return null
  return { ...scaleAt(r.kind, t / REACTIONS[r.kind].ms), kind: r.kind, data: r.data }
}

/** Something of this owner's reacts now: its crowd is put again every frame until none does. */
export function reacting(owner: ReactOwner): boolean {
  for (const [id, r] of live[owner]) if (into(owner, id, r) !== null) return true
  return false
}

/** For the tests: every reaction held at `ms` into itself (a frozen pose, the same frame after frame), or running again
 *  (null). */
export function freeze(ms: number | null) {
  frozen = ms === null ? null : Math.max(0, ms)
}

/** Every reaction over (another farm, a test). */
export function stopReactions() {
  for (const m of Object.values(live)) m.clear()
}
