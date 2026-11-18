import { farmSound } from '../../audio/sound'
import { coinsFx, itemFx } from '../../fx/fx'
import { CONTRACTOR, count, DAY, ESTATE, HOURS, isItem, LANE_ENDS, VISITOR, WALK_Z, type ItemId } from '../data'
import { dailyOffers, offersPerDay, piecePrice, type Contractor } from '../contractor'
import { dayOf, hourOf, isOpen, phaseOf, sinceTurned, untilOpen, untilPhase } from '../day'
import { CONTRACTOR_LOOK, ESTATE_LOOK } from '../../models/look'
import { AGENT_SEAT } from '../../data/estate'
import { CONTRACTOR_SPOT } from '../../data/market'
import { agentComes, agentLeaves, contractorComes, contractorLeaves, scriptSeconds, stepScript, walker } from '../script'
import { bump, farm, putBack, random, save, steadyLook, toast, type At, type Person, type Walking } from './core'
import { gainXp } from './levels'
import { rewarded } from './rewards'
import { sold } from './ledger'

// The contractor behind the market (his hours, his pieces, his walk) and the estate agent in his office (his hours,
// his walk, the house he sells).

const CONTRACTOR_ID = -2

const CONTRACTOR_DRESS = steadyLook(9157, CONTRACTOR_LOOK)

const standingContractor: Person = { id: CONTRACTOR_ID, ...walker(CONTRACTOR_SPOT.x, CONTRACTOR_SPOT.z, CONTRACTOR_SPOT.heading, []), look: CONTRACTOR_DRESS }

export const AT_CONTRACTOR: At = { x: CONTRACTOR_SPOT.x, y: 1.6, z: CONTRACTOR_SPOT.z }

/** He is at his window in his hours (HOURS in ./data: the morning, noon and the evening), once he has walked back to it
 *  from the lane in the morning (the window does not trade while it is empty); at night he is off. */
export function contractorHere(): boolean {
  const t = farm.day.t
  if (!isOpen('contractor', t)) return false
  const since = intoPhase(t)
  const turned = !isOpen('contractor', t - since - 1)
  return !(turned && since < COMES_SECONDS)
}
/** How long his walk back to the window takes (from the lane's east end). */
const COMES_SECONDS = scriptSeconds(LANE_ENDS[1], WALK_Z, contractorComes(), VISITOR.speed)
/** The seconds until he is at his window again (0 while he is): for the window's wait. */
export function contractorBackIn(): number {
  if (contractorHere()) return 0
  const t = farm.day.t
  const first = HOURS.contractor[0]
  // walking back in now, or away until his hours begin and then the walk
  return isOpen('contractor', t) ? COMES_SECONDS - intoPhase(t) : untilPhase(t, first) + COMES_SECONDS
}

/** Today's offers, made the first time the day is seen (the farm's dice): the pieces the silo or the barn is shortest
 *  of first. */
export function contractorDay() {
  const day = dayOf(farm.day.t)
  if (farm.contractor.day === day) return false
  farm.contractor = { day, offers: dailyOffers(farm, offersPerDay(farm.ladders.stock), random).map((item) => ({ item, sold: false })) }
  return true
}

/** Today's offers (made when a new day is first seen). */
export function contractorOffers(): Contractor['offers'] {
  contractorDay()
  return farm.contractor.offers
}
/** What one of his pieces costs now. */
export const contractorPrice = () => piecePrice(farm.ladders.discount)

/** Sells him the whole stack of a building material; the coins. */
export function sellToContractor(item: ItemId): number {
  if (!contractorHere() || !isItem(item)) return 0
  const n = farm.inv[item]
  if (!(n > 0)) return 0
  const coins = n * CONTRACTOR.buys
  farm.inv[item] = 0
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.stats.sold += n
  farm.stats.earned += coins
  gainXp('sale', coins, AT_CONTRACTOR)
  rewarded('sale', [{ coins }], AT_CONTRACTOR)
  sold('contractor', item, n, coins)
  coinsFx(AT_CONTRACTOR.x, AT_CONTRACTOR.z, coins)
  toast(`+ ${coins} coins · ${count(item, n)}`, item)
  farmSound('coins')
  bump()
  save()
  return coins
}

/** Buys today's k-th piece; whether it was bought. It goes into the barn even past full (as a goal's material does),
 *  and is not a surprise found: a trade, no XP. */
export function buyFromContractor(k: number): boolean {
  if (!contractorHere()) return false
  contractorDay()
  const offer = farm.contractor.offers[k]
  const price = contractorPrice()
  if (!offer || offer.sold || farm.coins < price) return false
  farm.coins -= price
  offer.sold = true
  putBack(offer.item, 1)
  itemFx(AT_CONTRACTOR.x, AT_CONTRACTOR.y, AT_CONTRACTOR.z, offer.item)
  toast(`+ ${count(offer.item, 1)} · ${price} coins`, offer.item)
  farmSound('coins')
  bump()
  save()
  return true
}

/** The seconds since the phase now began. */
const intoPhase = (t: number) => {
  const def = DAY.phases.find((p) => p.id === phaseOf(t))!
  return ((((hourOf(t) - def.from) % 24) + 24) % 24) * (DAY.length / 24)
}
/** How long he takes to walk off at night, or back in the morning (the rest of it he is at his window, or away). */
const WALK_SECONDS = 60

let contractorWalk: { key: string; at: number; who: Person } | null = null
/** Another farm: his walk is not this one's. */
export function forgetContractorWalk() {
  contractorWalk = null
}

/** The contractor as the day's clock has him: walking back in the first minute of the morning, at his window in his
 *  hours, walking off in the first minute of the night, away the rest of it. A function of the clock alone. */
export function contractorNow(): Walking | null {
  const t = farm.day.t
  const phase = phaseOf(t)
  const since = intoPhase(t)
  // his hours begin (or end) with this phase: he was away (or there) in the one before
  const here = isOpen('contractor', t)
  const turned = here !== isOpen('contractor', t - since - 1)
  const coming = here && turned && since < WALK_SECONDS
  const going = !here && turned && since < WALK_SECONDS
  if (!coming && !going) {
    contractorWalk = null
    return here ? standingContractor : null
  }
  const key = `${dayOf(t)} ${phase}`
  if (contractorWalk?.key !== key || since < contractorWalk.at) {
    const start = coming ? { x: LANE_ENDS[1], z: WALK_Z, heading: -Math.PI / 2 } : CONTRACTOR_SPOT
    contractorWalk = { key, at: 0, who: { id: CONTRACTOR_ID, ...walker(start.x, start.z, start.heading, coming ? contractorComes() : contractorLeaves()), look: CONTRACTOR_DRESS } }
  }
  const done = stepScript(contractorWalk.who, since - contractorWalk.at, VISITOR.speed)
  contractorWalk.at = since
  return going && done ? null : contractorWalk.who
}

const AGENT_ID = -3
const AGENT_DRESS = steadyLook(4271, ESTATE_LOOK)
const sittingAgent: Person = { id: AGENT_ID, ...walker(AGENT_SEAT.x, AGENT_SEAT.z, AGENT_SEAT.heading, []), pose: 'sit', look: AGENT_DRESS }
/** How long his walk in takes in the morning (from the lane's west end to his chair), and out at four. */
const AGENT_COMES = scriptSeconds(LANE_ENDS[0], WALK_Z, agentComes(), VISITOR.speed)
const AGENT_GOES = scriptSeconds(AGENT_SEAT.x, AGENT_SEAT.z, agentLeaves(), VISITOR.speed)
/** Where the crystals fly up from when the house is bought: his desk. */
const AT_AGENT: At = { x: AGENT_SEAT.x, y: 1.2, z: AGENT_SEAT.z - 0.4 }

/** The estate office is open (HOURS.estate: 8:00 to 16:00): its door opens for you (he may still be on his way in). */
export const estateOpen = () => isOpen('estate', farm.day.t)
/** The seconds until it opens (0 while it is open). */
export const estateOpensIn = () => untilOpen('estate', farm.day.t)
/** The estate agent is at his desk: in the office's hours, once he has walked in from the lane. */
export function agentHere(): boolean {
  const t = farm.day.t
  return isOpen('estate', t) && sinceTurned('estate', t) >= AGENT_COMES
}
/** The seconds until he is at his desk again (0 while he is): walking in now, or away until the office opens and then
 *  the walk. */
export function agentBackIn(): number {
  if (agentHere()) return 0
  const t = farm.day.t
  return isOpen('estate', t) ? AGENT_COMES - sinceTurned('estate', t) : untilOpen('estate', t) + AGENT_COMES
}

/** The estate agent as the day's clock has him, a function of the clock alone: walking in from the lane as the
 *  office opens, sitting at his desk through its hours, walking out (a wave first) as it closes, away the rest. */
let agentWalk: { key: string; at: number; who: Person } | null = null
export function estateAgentNow(): Walking | null {
  const t = farm.day.t
  const open = isOpen('estate', t)
  const since = sinceTurned('estate', t)
  const coming = open && since < AGENT_COMES
  const going = !open && since < AGENT_GOES
  if (!coming && !going) {
    agentWalk = null
    return open ? sittingAgent : null
  }
  const key = `${dayOf(t)} ${open ? 'in' : 'out'}`
  if (agentWalk?.key !== key || since < agentWalk.at) {
    const start = coming ? { x: LANE_ENDS[0], z: WALK_Z, heading: Math.PI / 2 } : AGENT_SEAT
    agentWalk = { key, at: 0, who: { id: AGENT_ID, ...walker(start.x, start.z, start.heading, coming ? agentComes() : agentLeaves()), look: AGENT_DRESS } }
    if (!coming) agentWalk.who.pose = 'sit'
  }
  const done = stepScript(agentWalk.who, since - agentWalk.at, VISITOR.speed)
  agentWalk.at = since
  return going && done ? null : agentWalk.who
}

/** Buys the house from the estate agent, at his desk in the office's hours, for ESTATE.price; whether it was bought.
 *  The car then drives you there (src/farm/car). */
export function buyApartment(): boolean {
  if (farm.apartment.owned || !agentHere() || !(farm.coins >= ESTATE.price)) return false
  farm.coins -= ESTATE.price
  farm.apartment.owned = true
  gainXp('home', 1, AT_AGENT)
  rewarded('keys', [], AT_AGENT)
  toast('The house is yours', 'key')
  farmSound('keys')
  bump()
  save()
  return true
}
