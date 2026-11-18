// The top's attention budget (update-v1/CONTRACTS.md §1.8): of everything up there that could move to say "something
// for you", one moves at a time — the one that ranks highest among those that apply now — and the rest show their counts
// and hold still. A call applies only where 04's REVEAL shows its part at all. This is the pure core; 07 adds
// `useCalling(id)` and moves the chips onto it. Not yet used by the game.

/** What can call: the daily gift waiting, the level's gift boxes, a goal to claim, the one "almost there" nearest, the
 *  farm news, the compass's walk (a letter waiting is the mailbox's mark there), the gear or price tag of what you look at. */
export const CALLS = [
  { id: 'daily', rank: 1 },
  { id: 'boxes', rank: 2 },
  { id: 'goal', rank: 3 },
  // [review: update-v1/JOURNEY.md fix 10] every "almost there" (a goal's last stretch, an album page, a road stop, a
  // level box) is this one call: only the nearest glows. Without this row, each glows on its own.
  { id: 'almost', rank: 4 },
  { id: 'news', rank: 5 },
  { id: 'compass', rank: 6 },
  { id: 'tag', rank: 7 },
] as const
export type CallId = (typeof CALLS)[number]['id']

/** [review: JOURNEY.md fix 9] While the busy card shows ("Busy till 07:40"), nothing calls: it is the visit's stopping
 *  cue. */
export const BUSY_RESTS: boolean = true

/** The one call that moves now: the highest-ranked that applies; none while the busy card shows (`busy`). */
export function calling(applies: ReadonlySet<CallId>, busy = false): CallId | null {
  if (busy && BUSY_RESTS) return null
  let best: (typeof CALLS)[number] | null = null
  for (const c of CALLS) if (applies.has(c.id) && (!best || c.rank < best.rank)) best = c
  return best?.id ?? null
}
