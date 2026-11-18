// A road of stops (update-v1/CONTRACTS.md §1.10): a count that grows — gifts claimed, XP earned, an album page's tiles,
// levels — and the stops along it where something comes. One engine for every road the game draws: the daily week, the
// season road, a goal's rungs, an album page, the story's chapters. It says how many stops a count has reached and how
// far the next one is, with the last stretch before a stop marked "almost". Pure; not yet used by the game.

/** A road: the count each stop is reached at, rising (stop k at road[k − 1]). */
export type Road = readonly number[]

/** From this share of the way from one stop to the next, the next is "almost" reached. */
export const ALMOST = 0.85

/** A road of `n` stops, stop k (from 1) at `at(k)`, rounded up; each at least one past the one before (the first at
 *  least 1). */
export function stops(n: number, at: (k: number) => number): Road {
  const out: number[] = []
  let last = 0
  for (let k = 1; k <= n; k++) {
    const v = at(k)
    last = Math.max(last + 1, Number.isFinite(v) ? Math.ceil(v - 1e-9) : last + 1)
    out.push(last)
  }
  return out
}

/** How many stops a count has reached (0 to all of them). */
export function reached(road: Road, have: number): number {
  let k = 0
  while (k < road.length && road[k] <= have) k++
  return k
}

/** The next stop: which it is (from 1), the count it is at, how much is left to it, how far along from the stop before
 *  (0–1; from 0 for the first), and whether it is almost reached. Null past the last. */
export interface Nearest {
  stop: number
  at: number
  left: number
  share: number
  almost: boolean
}
export function nearest(road: Road, have: number): Nearest | null {
  const k = reached(road, have)
  if (k >= road.length) return null
  const at = road[k]
  const from = k > 0 ? road[k - 1] : 0
  const share = Math.min(1, Math.max(0, (have - from) / (at - from)))
  return { stop: k + 1, at, left: at - Math.max(from, have), share, almost: share >= ALMOST }
}
