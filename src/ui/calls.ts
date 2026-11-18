import { useEffect, useSyncExternalStore } from 'react'

// The top's attention budget (update-v1/CONTRACTS.md §1.8): of everything up there that could move to say "something
// for you", one moves at a time — the one that ranks highest among those that apply now — and the rest show their counts
// and hold still. A call applies only where 04's REVEAL shows its part at all. The pure core (`calling`), then the
// game's side: each part that could call says so with `useCalling(id, wants)` and moves only while it is true; the busy
// card rests them all (`useCallsRest`).

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

// ── the game's side: which calls apply now, said by the parts that could call while they are on the screen ──

/** How many parts want each call now (two chips may say the same call). */
const wanting = new Map<CallId, number>()
let resting = 0
let now: CallId | null = null
const listeners = new Set<() => void>()

function update() {
  const next = calling(new Set([...wanting].filter(([, n]) => n > 0).map(([id]) => id)), resting > 0)
  if (next === now) return
  now = next
  for (const f of listeners) f()
}

/** The call that moves now (null: none). */
export const callingNow = (): CallId | null => now

/** Told each time the call that moves changes. Returns the way to stop. */
export function onCalling(f: () => void): () => void {
  listeners.add(f)
  return () => void listeners.delete(f)
}

/** A part wants to call (its gift waits, its goal is done): until the returned function is called. */
export function wantCall(id: CallId): () => void {
  wanting.set(id, (wanting.get(id) ?? 0) + 1)
  update()
  let done = false
  return () => {
    if (done) return
    done = true
    wanting.set(id, (wanting.get(id) ?? 1) - 1)
    update()
  }
}

/** The busy card shows: nothing calls (with BUSY_RESTS) until the returned function is called. */
export function restCalls(): () => void {
  resting++
  update()
  let done = false
  return () => {
    if (done) return
    done = true
    resting--
    update()
  }
}

/** Whether this part may move to call now: it wants to (`wants`, while it is on the screen), and of all that want to,
 *  its call ranks highest. The rest show their counts and hold still. */
export function useCalling(id: CallId, wants = true): boolean {
  useEffect(() => (wants ? wantCall(id) : undefined), [id, wants])
  const moving = useSyncExternalStore(onCalling, callingNow, callingNow)
  return wants && moving === id
}

/** The busy card's: while it shows (`on`), nothing at the top calls. */
export function useCallsRest(on: boolean) {
  useEffect(() => (on ? restCalls() : undefined), [on])
}
