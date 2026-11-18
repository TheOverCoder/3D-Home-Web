import { personById, type NeighbourId } from '../../data/people'
import { BUYER_OFFERS, PEOPLE_ODDS, produceById, type Keeper, type ProduceId } from '../data'
import { isOpen } from '../day'
import { offerFactor } from '../prices'

// The neighbours at the gate (update-v1/missions/03-characters-story.md, change 4): now and then a neighbour met takes a
// stranger's turn in the line — the line comes no faster — looking the same and wearing the same every time, asking
// for one of the two goods they like, at a fair or a generous price, never a low one. Pure: who comes and what they
// ask; the line's side is src/farm/state/buyers.ts.

/** The hours a neighbour keeps (a row of HOURS in src/farm/data.ts): their row's, or the row named after them. */
export const keeperOf = (who: NeighbourId): Keeper => (personById(who).hours ?? who) as Keeper

/**
 * Who comes to the gate instead of a stranger, or null: of the neighbours `met`, those in their hours at the farm's
 * moment `t` (seconds of farm time) and not already in line or on their way (`inLine`), one now and then
 * (PEOPLE_ODDS.visit), on `roll` (0 to under 1: two throws).
 */
export function whoComes(met: readonly NeighbourId[], t: number, inLine: readonly (string | undefined)[], roll: () => number): NeighbourId | null {
  const free = met.filter((who) => isOpen(keeperOf(who), t) && !inLine.includes(who))
  if (!free.length || roll() >= PEOPLE_ODDS.visit) return null
  return free[Math.min(free.length - 1, Math.floor(roll() * free.length))]
}

/**
 * What a neighbour asks for: one of the two goods they like — one the silo or the barn holds first, else one the farm
 * makes (`known`), else the first they like — and how many, as a stranger asks (a share of what is in store, else up
 * to the most a buyer asks), on `roll`.
 */
export function neighbourAsk(who: NeighbourId, known: readonly ProduceId[], inv: Partial<Record<ProduceId, number>>, roll: () => number): { want: ProduceId; qty: number } {
  const likes = personById(who).likes ?? ['egg', 'milk']
  const stocked = likes.filter((g) => (inv[g] ?? 0) > 0)
  const made = likes.filter((g) => known.includes(g))
  const pool = stocked.length ? stocked : made.length ? made : [likes[0]]
  const want = pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))]
  const most = produceById(want).maxAsk
  const have = inv[want] ?? 0
  const qty = have > 0 ? Math.round(have * (0.45 + roll() * 0.7)) : Math.round(Math.min(2, most) + roll() * (most - Math.min(2, most)))
  return { want, qty: Math.max(1, Math.min(most, qty)) }
}

/** The share of buyers whose offer is under the goods' worth (BUYER_OFFERS), to a billionth as the steps of
 *  `offerFactor` are: a neighbour's roll starts past them. */
const UNDER = Math.round(BUYER_OFFERS.filter((o) => o.factor < 1).reduce((n, o) => n + o.odds, 0) * 1e9) / 1e9

/** A neighbour's offer against what the goods are worth, on `roll` (0 to under 1): fair or generous, in the odds a
 *  stranger's fair and generous offers have, never under the worth. */
export const kindFactor = (roll: number): number => offerFactor(UNDER + Math.min(0.999999, Math.max(0, roll)) * (1 - UNDER))
