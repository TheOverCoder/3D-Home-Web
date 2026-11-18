import type { NeighbourId } from '../../data/people'
import { amount, int, isRecord } from '../../lib/saved'

// Friendship with the neighbours (update-v1/CONTRACTS.md §1.13; decision 11): points that only grow, from what the farm
// does for them — a sale at the gate (more for a good they like), an order sent for them, a chapter's request filled —
// and the hearts they come to: one at each of FRIENDS.hearts. Hearts never fall and give no XP; a heart brings a letter
// (`told`: the hearts whose letter came) and opens new lines (src/talk/lines.ts). Pure: the farm's side is
// src/farm/state/neighbours.ts, and the save's field is `farm.friends`.

/** What each deed is worth to a neighbour's friendship, and the points each heart is at (set by `npm run sim`). */
export const FRIENDS = { sale: 1, liked: 2, order: 3, chapter: 5, hearts: [3, 8, 15, 25, 40] } as const

/** Why a neighbour grows fonder: a sale, a sale of a good they like, an order sent for them, a chapter's request. */
export type Why = 'sale' | 'liked' | 'order' | 'chapter'

/** A neighbour's friendship: its points, and the hearts whose letter came (never more than the hearts reached). Not
 *  `told` of `charm` or `season`: a record of its own. */
export interface Friend {
  points: number
  told: number
}

/** Each neighbour met (none: not met yet). */
export type Friends = Partial<Record<NeighbourId, Friend>>

/** The most hearts a friendship has. */
export const MOST_HEARTS = FRIENDS.hearts.length

/** The hearts `points` have reached. */
export const heartsOf = (points: number): number => FRIENDS.hearts.filter((h) => points >= h).length

/** `who` a little fonder, for `why` (a new record: the one given is not changed). Points only grow. */
export function befriend(f: Friends, who: NeighbourId, why: Why): Friends {
  const was = f[who] ?? { points: 0, told: 0 }
  return { ...f, [who]: { points: amount(was.points + FRIENDS[why], 0), told: was.told } }
}

/** The saved friendships made safe: only neighbours `met`, their points a count, the hearts told no more than they
 *  have reached; anything else, nobody (a farm from before them has met no one). */
export function sanitizeFriends(raw: unknown, met: readonly NeighbourId[]): Friends {
  const out: Friends = {}
  if (!isRecord(raw)) return out
  for (const who of met) {
    const x = raw[who]
    if (!isRecord(x)) continue
    const points = amount(x.points, 0)
    out[who] = { points, told: int(x.told, 0, 0, heartsOf(points)) }
  }
  return out
}
