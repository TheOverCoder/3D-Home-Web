import { CROPS, MACHINE_IDS, PRODUCER_IDS, SELLABLE } from '../data'
import { dayOf, phaseOf } from '../day'
import { bump, eventSpeed, farm, save, toast } from './core'
import { bedStage, growBeds } from './beds'
import { growProducer } from './producers'
import { growMachine } from './machines'
import { walkLine } from './buyers'
import { growDispatch, growOrders } from './orders'
import { runDay } from './day'
import { runShop, shelvesEmpty } from './market'
import { stepsOn } from './steps'
import { markPlayed } from './daily'
import { seasonOn } from './season'
import { neighboursOn } from './neighbours'

// The farm going on, frame by frame: everything grows, the people walk, the shop and the day run.

const stageKey = () =>
  [
    ...farm.beds.map((_, i) => bedStage(i)),
    ...PRODUCER_IDS.map((id) => farm.producers[id].stock.join(',')),
    // each job a machine finishes (its ding, the button that collects it) and each one that goes in or comes out
    ...MACHINE_IDS.map((id) => `${farm.machines[id].done}/${farm.machines[id].jobs.length}`),
    farm.orders.map((slot) => ('order' in slot ? 'o' : 'w')).join(''),
    farm.dispatch.trip < 0 ? `home ${farm.dispatch.waiting}` : `trip ${farm.dispatch.aboard}`,
    // the shop's shelves and till (a shopper bought), the day's phase and number (the light, the contractor's pieces)
    farm.market.shelves.map((sh) => sh.units).join(','),
    farm.market.till.coins,
    phaseOf(farm.day.t),
    dayOf(farm.day.t),
  ].join('|')

export function grow(dt: number) {
  // the harvest festival's crops and the machine rush's jobs go faster (the week's events)
  const crops = eventSpeed('crops')
  const machines = eventSpeed('machines')
  growBeds(dt, crops)
  for (const id of PRODUCER_IDS) growProducer(id, dt)
  for (const id of MACHINE_IDS) growMachine(id, dt * machines)
  growOrders(dt)
  growDispatch(dt)
}

let gifted = false
function neverStuck() {
  const broke = farm.coins < Math.min(...CROPS.map((c) => c.seedCost))
  // a machine at work or with something to take out is something on its way
  // (goods put into an order are the farm's too: they come back if it is declined)
  const nothing =
    farm.beds.every((b) => !b.crop) &&
    SELLABLE.every((id) => farm.inv[id] === 0) &&
    MACHINE_IDS.every((id) => farm.machines[id].jobs.length === 0) &&
    farm.orders.every((slot) => !('order' in slot) || slot.order.lines.every((l) => !l.have)) &&
    // goods on the shelves are the farm's too (they sell, or come back), and coins in the till are coins
    shelvesEmpty() &&
    !(farm.market.till.coins > 0)
  if (broke && nothing && !gifted) {
    gifted = true
    farm.coins += 6
    toast('A neighbour left 6 coins at the gate for seeds')
    bump()
    save()
  }
  if (!broke) gifted = false
}

/** Advances the farm by `dt` seconds of real time. */
export function tick(dt: number) {
  if (!(dt > 0)) return
  const before = stageKey()
  farm.clock += dt
  grow(dt)
  walkLine(dt)
  runShop(dt)
  runDay(dt)
  neverStuck()
  stepsOn()
  markPlayed()
  seasonOn()
  neighboursOn()
  if (stageKey() !== before) {
    bump()
    save()
  }
}
