import { BUYER_OFFERS, MACHINES, MACHINE_IDS, produceById, type MachineId, type ProduceId } from './data'

// What a good sells for, decided here for every sale — a buyer's offer at the gate, an order's pay, what the manager
// pays, a unit on your shop's shelves: its fair price (PRODUCE in ./data), more for what a machine makes once it has
// worked its way up a level (its level's coins boost, src/farm/machineView.ts: a cake from a level-2 oven is worth a
// fifth more), and double on the lucky draw's day for the two goods drawn (src/farm/events.ts). Each sale rounds its own
// total, as it always has. The price is one sum with named parts (priceAt), the same for a sale and for a view of the
// prices (src/farm/computer), and so is what a buyer at the gate offers on it (BUYER_OFFERS, offerFactor).

/** The machine that makes each good (the oven the cakes, the mill flour and sugar, the loom cloth). */
const MAKER = new Map<ProduceId, MachineId>(MACHINE_IDS.flatMap((id) => MACHINES[id].recipes.map((r) => [r.makes, id] as const)))

/** The machine that makes a good (null: it is grown, or given by an animal or the tree). */
export const makerOf = (good: ProduceId): MachineId | null => MAKER.get(good) ?? null

let boost: (machine: MachineId) => number = () => 0

/** The farm says how much more each machine's goods are worth now (src/farm/state.ts, from each one's level). Until it
 *  does (and in tests of the rules alone), nothing more. */
export function priceBoosts(f: (machine: MachineId) => number) {
  boost = f
}

let event: (good: ProduceId) => number = () => 1

/** The farm says what the week's events multiply each good's price by now (src/farm/state.ts: the lucky draw's goods,
 *  double on its day). Until it does, nothing. */
export function priceEvents(f: (good: ProduceId) => number) {
  event = f
}

/** What one of a good is worth with its parts given, the way priceOf works it out from the farm's own: its fair price,
 *  `more` for the level of the machine that makes it (0.2: a fifth more; nothing below 0) and `factor` for the day
 *  (what the events multiply it by; 1: nothing). Not rounded: each sale rounds its own total. For a view of the prices
 *  on a farm given to it (src/farm/computer), which must never disagree with a sale. */
export function priceAt(good: ProduceId, more = 0, factor = 1): number {
  const base = produceById(good).price
  const price = more > 0 ? base * (1 + more) : base
  return factor !== 1 ? price * factor : price
}

/** What one of a good is worth: its fair price, a share more for what a machine of a higher level makes, and the
 *  events' factor (the lucky draw's): priceAt with the farm's own parts. */
export function priceOf(good: ProduceId): number {
  const maker = MAKER.get(good)
  return priceAt(good, maker ? boost(maker) : 0, event(good))
}

/** The odds of BUYER_OFFERS added up, row by row (the last row takes the rest): a roll under the k-th step draws the
 *  k-th factor. Each running sum is rounded to a billionth, finer than any odds the table gives, so that it is the
 *  number the odds say and a roll falls on the same side of it (summed as they are, 0.15 + 0.23 + 0.28 + 0.2 comes to
 *  0.8600000000000001). */
const OFFER_STEPS = BUYER_OFFERS.slice(0, -1).reduce<number[]>((steps, o) => [...steps, Math.round(((steps.at(-1) ?? 0) + o.odds) * 1e9) / 1e9], [])

/** The factor a buyer at the gate offers on what the goods are worth, for a roll from 0 to under 1 (Math.random's):
 *  BUYER_OFFERS's rows by their odds — mostly fair, now and then generous, sometimes cheeky. */
export function offerFactor(roll: number): number {
  const k = OFFER_STEPS.findIndex((step) => roll < step)
  return BUYER_OFFERS[k < 0 ? BUYER_OFFERS.length - 1 : k].factor
}
