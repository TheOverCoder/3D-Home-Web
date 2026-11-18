import { isNeighbour, personById, type PersonId } from '../../data/people'
import type { ProduceId } from '../data'
import { befriend as fonder, type Friends } from '../people/friends'
import { farm } from './core'

// The neighbours on the farm (update-v1/CONTRACTS.md §5): their friendship as the farm's deeds grow it (the rules are
// src/farm/people/friends.ts). Called by the sale paths, never calling them. 03's next part adds their visits at the
// gate, their letters, the story and their requests here.

declare module './core' {
  interface FarmData {
    /** each neighbour met: their friendship's points (they only grow) and the hearts whose letter came
     *  (src/farm/people/friends.ts) */
    friends: Friends
  }
}

/** What was sold or sent, and for whom: a buyer at the gate (`who`: a neighbour; none, a stranger) and the good they
 *  asked for, or an order (`from`: the neighbour it is for; `chapter`: a chapter's request). */
export type Deal = { who?: PersonId; want: ProduceId } | { from?: PersonId; chapter?: string; lines: readonly unknown[] }

/** A sale or an order sent: if it was for a neighbour, they grow fonder (a sale, more for a good they like; an order;
 *  a chapter's request). A stranger: nothing. Hearts never fall and give no XP. One line in each sale and send path,
 *  after `rewarded` and `sold` (update-v1/CONTRACTS.md E). */
export function befriend(deal: Deal) {
  const order = 'lines' in deal
  const who = order ? deal.from : deal.who
  if (!isNeighbour(who)) return
  const why = order ? (deal.chapter ? 'chapter' : 'order') : personById(who).likes?.includes(deal.want) ? 'liked' : 'sale'
  farm.friends = fonder(farm.friends, who, why)
}
